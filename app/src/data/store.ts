// App state: which Sheet (or demo) is connected, the parsed team data, and refresh status.
// Cached data is shown instantly on launch; a refresh re-reads the Sheet in one request.
// Nothing polls — refresh happens on connect, on launch when signed in, and on the button.

import { useEffect, useState } from "preact/hooks";
import { del, get, set } from "idb-keyval";
import { accessToken, forgetToken, signIn } from "../google/auth";
import { fetchAllRanges, fetchSheetInfo, SheetsError } from "../google/sheets";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "../schema/parse";
import { missingTabs, validateSheet } from "../schema/validate";
import type { TeamData } from "../schema/model";

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
}

// Stored raw (not parsed) so an app update with a smarter parser applies to cached data too.
interface Cached { source: Source; raw: RawRanges; fetchedAt: number }
const CACHE_KEY = "rt.cache.v1";
const PENDING_SHEET_KEY = "rt.pendingSheet";

let state: AppState = {
  source: null, data: null, fetchedAt: null, loading: false, error: null,
  needsSignIn: false, connectingTo: null, online: typeof navigator === "undefined" ? true : navigator.onLine, ready: false,
};
const listeners = new Set<() => void>();

function update(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

async function saveCache(c: Cached) {
  try { await set(CACHE_KEY, c); } catch { /* private mode etc. — the app still works, just without a cache */ }
}

function apply(source: Source, raw: RawRanges, fetchedAt: number) {
  update({ source, data: parseTeamData(raw), fetchedAt, error: null, needsSignIn: false, connectingTo: null });
}

async function loadDemo() {
  const demo = (await import("./demo-fixture.json")).default as { valueRanges: { values?: Rows }[] };
  const raw = rawFromValueRanges(demo.valueRanges);
  const fetchedAt = Date.now();
  apply({ kind: "demo" }, raw, fetchedAt);
  await saveCache({ source: { kind: "demo" }, raw, fetchedAt });
}

async function loadSheet(spreadsheetId: string, token: string) {
  const info = await fetchSheetInfo(spreadsheetId, token);
  const tabProblems = missingTabs(info.sheetTitles);
  if (tabProblems.length) throw new SheetsError(validateSheet(info.sheetTitles).join(" "), "layout");
  const raw = rawFromValueRanges(await fetchAllRanges(spreadsheetId, token));
  const problems = validateSheet(info.sheetTitles, raw);
  if (problems.length) throw new SheetsError(problems.join(" "), "layout");
  const source: Source = { kind: "sheet", spreadsheetId, title: info.title };
  const fetchedAt = Date.now();
  apply(source, raw, fetchedAt);
  await saveCache({ source, raw, fetchedAt });
}

/** Startup: show whatever is cached, then refresh if we can do so without bothering anyone. */
export async function init(signInError?: string) {
  window.addEventListener("online", () => update({ online: true }));
  window.addEventListener("offline", () => update({ online: false }));

  let cached: Cached | undefined;
  try { cached = await get<Cached>(CACHE_KEY); } catch { /* no cache available */ }
  if (cached) apply(cached.source, cached.raw, cached.fetchedAt);

  // Coming back from Google after "Connect" on a new Sheet.
  let pending: string | null = null;
  try { pending = sessionStorage.getItem(PENDING_SHEET_KEY); sessionStorage.removeItem(PENDING_SHEET_KEY); } catch { /* ignore */ }

  update({ ready: true, error: signInError ?? null, connectingTo: pending });
  if (signInError) {
    if (state.source?.kind === "sheet") update({ needsSignIn: true });
    return;
  }
  if (pending) return connectSheet(pending);
  if (state.source?.kind === "sheet") {
    if (accessToken()) return refresh();
    update({ needsSignIn: true });
  }
}

export async function refresh() {
  const source = state.source;
  if (!source || state.loading) return;
  if (source.kind === "demo") return loadDemo();
  const token = accessToken();
  if (!token) { update({ needsSignIn: true }); return; }
  if (!state.online) { update({ error: "You're offline — showing saved data." }); return; }
  update({ loading: true, error: null });
  try {
    await loadSheet(source.spreadsheetId, token);
  } catch (e) {
    const err = e instanceof SheetsError ? e : new SheetsError(String(e), "other");
    update({ error: err.message, needsSignIn: err.kind === "auth" });
    if (err.kind === "auth") forgetToken();
  } finally {
    update({ loading: false });
  }
}

/** First-time connect to a Sheet. Leaves for Google sign-in if needed and resumes after. */
export async function connectSheet(spreadsheetId: string) {
  update({ connectingTo: spreadsheetId });
  const token = accessToken();
  if (!token) {
    try { sessionStorage.setItem(PENDING_SHEET_KEY, spreadsheetId); } catch { /* ignore */ }
    signIn("#/today");
    return;
  }
  update({ loading: true, error: null });
  try {
    await loadSheet(spreadsheetId, token);
  } catch (e) {
    const auth = e instanceof SheetsError && e.kind === "auth";
    if (auth) forgetToken(); // so the next attempt signs in fresh instead of reusing a rejected token
    update({ error: auth ? "Google sign-in didn't go through — please try again." : e instanceof Error ? e.message : String(e) });
  } finally {
    update({ loading: false });
  }
}

export async function startDemo() {
  update({ loading: true, error: null });
  try { await loadDemo(); } finally { update({ loading: false }); }
}

export function signInAgain() {
  signIn(window.location.hash || "#/today");
}

/** Sign out and wipe everything this app stored on the device. */
export async function disconnect() {
  forgetToken();
  try { await del(CACHE_KEY); } catch { /* ignore */ }
  update({ source: null, data: null, fetchedAt: null, error: null, needsSignIn: false });
}
