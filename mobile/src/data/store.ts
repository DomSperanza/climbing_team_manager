// App state: which Sheet (or demo) is connected, the parsed team data, refresh/save status,
// and the app lock. Cached data is shown instantly on launch; a refresh re-reads the Sheet in
// one request. Nothing polls — refresh happens on connect, on launch, after a save, and on
// the refresh button.

import { useSyncExternalStore } from "react";
import { AppState as RNAppState } from "react-native";
import * as auth from "@/platform/auth";
import { cacheClearAll, cacheGet, cacheSet } from "@/platform/cache";
import * as lock from "@/platform/lock";
import { watchOnline } from "@/platform/network";
import { fetchAllRanges, fetchSheetInfo, sheetWriter, SheetsError } from "@/google/sheets";
import { addPerson, createSheetFromWorkbook, listPeople, removePerson, type Person, type Role } from "@/google/drive";
import { memorySheet } from "@/core/memorySheet";
import { base64ToBytes, setupPlan, validateNewSheet, type NewSheetOptions } from "@/core/setup";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "@/core/schema/parse";
import { missingTabs, validateSheet } from "@/core/schema/validate";
import type { TeamData, WorkoutBlock } from "@/core/schema/model";
import { recording, SaveError, saveChange, saveOrder, type Change, type SheetWriter } from "@/core/writes";
import { reorder, standardOutline } from "@/core/logic/timeline";
import { saveAssignment } from "@/core/logic/assignments";
import { ALL_TEAM, rangeKeysFor } from "@/core/schema/layout";
import type { ISODate } from "@/core/logic/dates";

export type Source = { kind: "sheet"; spreadsheetId: string; title: string } | { kind: "demo" };

export interface AppState {
  source: Source | null;
  data: TeamData | null;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  needsSignIn: boolean; // connected to a Sheet but no valid token right now
  connectingTo: string | null; // spreadsheet ID of an in-progress or failed first connect
  online: boolean;
  ready: boolean; // cache has been read
  locked: boolean;
  lockAvailable: boolean; // false when the phone has no screen lock to check against
  setupStep: string | null; // progress while a new team Sheet is being created
  setupDraft: NewSheetOptions | null; // the create form, kept across a web sign-in round trip
}

/** What to carry on with after leaving the page for Google sign-in (web only). */
type Pending = { kind: "connect"; id: string } | { kind: "create"; options: NewSheetOptions };

// Stored raw (not parsed) so an app update with a smarter parser applies to cached data too.
interface Cached { source: Source; raw: RawRanges; fetchedAt: number }
const CACHE_KEY = "rt.cache.v1";

let state: AppState = {
  source: null, data: null, fetchedAt: null, loading: false, error: null, needsSignIn: false,
  connectingTo: null, online: true, ready: false, locked: false, lockAvailable: false, setupStep: null, setupDraft: null,
};
let raw: RawRanges | null = null; // the cells behind state.data — demo saves edit these directly
const listeners = new Set<() => void>();

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
export const getState = () => state;

function apply(source: Source, r: RawRanges, fetchedAt: number) {
  raw = r;
  update({ source, data: parseTeamData(r), fetchedAt, error: null, needsSignIn: false, connectingTo: null });
}

async function loadDemo() {
  const demo = (await import("./demo-fixture.json")).default as { valueRanges: { values?: Rows }[] };
  const r = rawFromValueRanges(JSON.parse(JSON.stringify(demo.valueRanges)));
  const fetchedAt = Date.now();
  apply({ kind: "demo" }, r, fetchedAt);
  await cacheSet(CACHE_KEY, { source: { kind: "demo" }, raw: r, fetchedAt } satisfies Cached);
}

// Bumped by every save. A refresh that started before a save finished would show data from
// before it, so it's thrown away and run again.
let saveCount = 0;
let staleRefresh = false;

async function loadSheet(spreadsheetId: string, token: string) {
  const savesAtStart = saveCount;
  const info = await fetchSheetInfo(spreadsheetId, token);
  if (missingTabs(info.sheetTitles).length) throw new SheetsError(validateSheet(info.sheetTitles).join(" "), "layout");
  const keys = rangeKeysFor(info.sheetTitles);
  const r = rawFromValueRanges(await fetchAllRanges(spreadsheetId, token, keys), keys);
  const problems = validateSheet(info.sheetTitles, r);
  if (problems.length) throw new SheetsError(problems.join(" "), "layout");
  const source: Source = { kind: "sheet", spreadsheetId, title: info.title };
  const fetchedAt = Date.now();
  if (saveCount !== savesAtStart) { staleRefresh = true; return; }
  apply(source, r, fetchedAt);
  await cacheSet(CACHE_KEY, { source, raw: r, fetchedAt } satisfies Cached);
}

/** Runs `fn` with a token, retrying once with a fresh one if Google says the token is stale. */
async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await auth.accessToken();
  if (!token) throw new SheetsError("Your Google sign-in has expired.", "auth");
  try {
    return await fn(token);
  } catch (e) {
    if (!(e instanceof SheetsError && e.kind === "auth")) throw e;
    await auth.forgetToken(token);
    const fresh = await auth.accessToken();
    if (!fresh || fresh === token) throw e;
    return fn(fresh);
  }
}

// ---- startup, lock ------------------------------------------------------------------------

let backgroundedAt: number | null = null;

async function lockIfNeeded() {
  if (!lock.LOCK_SUPPORTED || state.source?.kind !== "sheet") return;
  const available = await lock.canLock();
  update({ lockAvailable: available, locked: available });
}

/** Startup: show whatever is cached, then refresh if we can do so without bothering anyone. */
export async function init() {
  const redirect = auth.completeRedirect();
  watchOnline((online) => { if (online !== state.online) update({ online }); });
  RNAppState.addEventListener("change", (s) => {
    if (s === "background") backgroundedAt = Date.now();
    if (s === "active" && backgroundedAt !== null) {
      if (Date.now() - backgroundedAt > lock.RELOCK_AFTER_MS) lockIfNeeded();
      backgroundedAt = null;
    }
  });

  let cached: Cached | undefined;
  try { cached = await cacheGet<Cached>(CACHE_KEY); } catch { /* unreadable cache — start fresh */ }
  if (cached) apply(cached.source, cached.raw, cached.fetchedAt);
  await lockIfNeeded();

  let pending: Pending | null = null;
  try { pending = redirect.pending ? (JSON.parse(redirect.pending) as Pending) : null; } catch { /* ignore */ }
  update({
    ready: true, error: redirect.error ?? null,
    connectingTo: pending?.kind === "connect" ? pending.id : null,
    setupDraft: pending?.kind === "create" ? pending.options : null,
  });
  if (redirect.error) {
    if (state.source?.kind === "sheet") update({ needsSignIn: true });
    return;
  }
  if (pending?.kind === "connect") return connectSheet(pending.id);
  if (pending?.kind === "create") return createTeamSheet(pending.options);
  if (state.source?.kind === "sheet") {
    if (await auth.accessToken()) return refresh();
    update({ needsSignIn: true });
  }
}

export async function unlockApp() {
  if (await lock.unlock()) update({ locked: false });
}

// ---- reading ------------------------------------------------------------------------------

export async function refresh() {
  const source = state.source;
  if (!source || state.loading) return;
  if (source.kind === "demo") return; // demo data lives on the phone; "Leave demo" resets it
  if (!state.online) { update({ error: "You're offline — showing saved data." }); return; }
  update({ loading: true, error: null });
  try {
    await withToken((token) => loadSheet(source.spreadsheetId, token));
  } catch (e) {
    const err = e instanceof SheetsError ? e : new SheetsError(String(e), "other");
    update({ error: err.message, needsSignIn: err.kind === "auth" });
  } finally {
    update({ loading: false });
  }
  if (staleRefresh) { staleRefresh = false; return refresh(); }
}

/**
 * Makes sure there's a signed-in Google account before a connect or create. Returns false
 * when it couldn't (the error is in state) — or when the web version is leaving the page for
 * Google, in which case init() picks `pending` back up on return.
 */
async function ensureSignedIn(pending: Pending): Promise<boolean> {
  if (await auth.accessToken()) return true;
  auth.rememberPending(JSON.stringify(pending));
  const res = await auth.signIn();
  if (res.status === "ok") return true;
  if (res.status === "cancelled") update({ error: "Sign-in was cancelled." });
  if (res.status === "error") update({ error: res.message });
  return false;
}

/** First-time connect to a Sheet. Signs in first if needed (on the web that leaves the page and resumes after). */
export async function connectSheet(spreadsheetId: string) {
  update({ connectingTo: spreadsheetId, error: null });
  if (!(await ensureSignedIn({ kind: "connect", id: spreadsheetId }))) return;
  update({ loading: true });
  try {
    await withToken((token) => loadSheet(spreadsheetId, token));
    await lockIfNeeded();
    if (state.locked) update({ locked: false }); // they just signed in — don't ask again straight away
  } catch (e) {
    const auth401 = e instanceof SheetsError && e.kind === "auth";
    update({ error: auth401 ? "Google sign-in didn't go through — please try again." : e instanceof Error ? e.message : String(e) });
  } finally {
    update({ loading: false });
  }
}

/**
 * Creates a new, private team Sheet in the signed-in coach's Google Drive from the team
 * workbook, sets it up (see core/setup.ts), and connects to it.
 */
export async function createTeamSheet(options: NewSheetOptions) {
  const problem = validateNewSheet(options);
  if (problem) return update({ error: problem, setupDraft: options });
  if (!state.online) return update({ error: "You're offline — creating a Sheet needs a connection.", setupDraft: options });
  update({ error: null, setupDraft: options });
  if (!(await ensureSignedIn({ kind: "create", options }))) return;

  update({ loading: true, setupStep: "Creating the Sheet in your Google Drive…" });
  try {
    const me = options.me && { ...options.me, email: options.me.email || auth.signedInEmail() || "" };
    const spreadsheetId = await withToken(async (token) => {
      const { TEMPLATE_XLSX_BASE64 } = await import("./template-xlsx");
      return createSheetFromWorkbook(token, options.name.trim(), base64ToBytes(TEMPLATE_XLSX_BASE64));
    });
    update({ setupStep: "Setting up the Sheet…" });
    const plan = setupPlan({ ...options, me });
    await withToken(async (token) => {
      const sheet = sheetWriter(spreadsheetId, token);
      await sheet.clear(plan.clear);
      await sheet.write(plan.write);
    });
    update({ setupStep: "Loading…" });
    await withToken((token) => loadSheet(spreadsheetId, token));
    update({ setupDraft: null });
    await lockIfNeeded();
    if (state.locked) update({ locked: false }); // they just signed in — don't ask again straight away
  } catch (e) {
    update({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    update({ loading: false, setupStep: null });
  }
}

export async function startDemo() {
  update({ loading: true, error: null });
  try { await loadDemo(); } finally { update({ loading: false }); }
}

export async function signInAgain() {
  const res = await auth.signIn();
  if (res.status === "ok") return refresh();
  if (res.status === "error") update({ error: res.message });
}

/** Sign out and wipe everything this app stored on the device. */
export async function disconnect() {
  await auth.signOut();
  await cacheClearAll();
  raw = null;
  update({ source: null, data: null, fetchedAt: null, error: null, needsSignIn: false, locked: false });
}

// ---- sharing ------------------------------------------------------------------------------
// Straight through to Drive's own sharing list, which is what decides who can open the Sheet.

function connectedSheetId(): string {
  if (state.source?.kind !== "sheet") throw new SaveError("Sharing needs a real Sheet — it isn't available in the demo.");
  if (!state.online) throw new SaveError("You're offline — sharing needs a connection.");
  return state.source.spreadsheetId;
}

export async function peopleWithAccess(): Promise<Person[]> {
  const id = connectedSheetId();
  return withToken((token) => listPeople(token, id));
}

export async function shareWith(email: string, role: Role): Promise<void> {
  const id = connectedSheetId();
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new SaveError("That doesn't look like an email address.");
  await withToken((token) => addPerson(token, id, e, role));
}

export async function stopSharingWith(permissionId: string): Promise<void> {
  const id = connectedSheetId();
  await withToken((token) => removePerson(token, id, permissionId));
}

// ---- saving -------------------------------------------------------------------------------

/** Why saving isn't possible right now, or null when it is. */
export function cannotSaveReason(s: AppState): string | null {
  if (s.source?.kind === "demo") return null;
  if (!s.online) return "You're offline — reconnect to save. Nothing is saved on the phone until then.";
  if (s.needsSignIn) return "Sign in again to save.";
  return null;
}

/**
 * Runs a save against the Sheet (or, in demo mode, the demo data). The screen updates as soon
 * as Google confirms — the same cell changes are applied to the app's own copy — and then
 * the whole Sheet is re-read in the background, so the app ends up showing exactly what the
 * Sheet holds. Throws a message for the screen that asked.
 */
async function runSave(op: (sheet: SheetWriter) => Promise<unknown>): Promise<void> {
  const source = state.source;
  if (!source || !raw) throw new SaveError("Nothing is connected.");
  if (source.kind === "demo") {
    await op(memorySheet(raw));
    apply(source, raw, Date.now());
    await cacheSet(CACHE_KEY, { source, raw, fetchedAt: Date.now() } satisfies Cached);
    return;
  }
  const reason = cannotSaveReason(state);
  if (reason) throw new SaveError(reason);
  let rec: ReturnType<typeof recording> | null = null;
  try {
    await withToken(async (token) => {
      rec = recording(sheetWriter(source.spreadsheetId, token));
      await op(rec.writer);
    });
  } catch (e) {
    if (e instanceof SheetsError && e.kind === "auth") update({ needsSignIn: true });
    throw e;
  } finally {
    saveCount++;
  }
  const local = raw;
  if (rec && local) {
    await (rec as ReturnType<typeof recording>).replayOnto(memorySheet(local));
    apply(source, local, state.fetchedAt ?? Date.now());
  }
  refresh(); // re-sync in the background
}

/** Saves one change straight to the Sheet (add, edit or delete one row). */
export function save(change: Change): Promise<void> {
  return runSave((sheet) => saveChange(sheet, change));
}

/** Moves a workout block one place earlier or later in its day's plan. */
export function moveBlock(dayBlocks: WorkoutBlock[], row: number, direction: -1 | 1): Promise<void> {
  const moves = reorder(dayBlocks, row, direction, state.data?.settings.tierNames ?? []);
  return moves.length ? runSave((sheet) => saveOrder(sheet, moves)) : Promise.resolve();
}

/** Gives `group` on `date` to `coach` (a full name), or clears it with null. "All Team" = the day's lead. */
export function assignCoach(date: ISODate, group: string, coach: string | null): Promise<void> {
  const tabExists = (raw?.assignments.length ?? 0) > 0;
  return runSave((sheet) => saveAssignment(sheet, date, group, coach, tabExists));
}

/** The Coach Profiles entry for whoever is signed in (matched by email), if there is one. */
export function signedInCoach(): string | null {
  const email = state.source?.kind === "sheet" ? auth.signedInEmail()?.toLowerCase() : null;
  return (email && state.data?.coaches.find((c) => c.email.toLowerCase() === email)?.fullName) || null;
}

/** Fills an empty day with the standard outline from Settings: team warm-up, then team stretch. */
export function addStandardOutline(date: ISODate): Promise<void> {
  const data = state.data;
  if (!data) return Promise.resolve();
  return runSave(async (sheet) => {
    for (const o of standardOutline(data.settings.practice, data.settings.blockTypes)) {
      await saveChange(sheet, { table: "log", row: null, value: {
        date, group: ALL_TEAM, libraryItem: "", blockType: o.blockType, description: o.description,
        setsRepsDuration: "", coach: "", notes: "", minutes: o.minutes, order: o.order,
      } });
    }
  });
}
