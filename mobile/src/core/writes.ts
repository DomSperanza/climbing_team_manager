// Saving to the Sheet (HANDOFF.md §2.3): every change is written straight through, online.
// Coaches may be editing at the same time, so:
// - An edit writes only the fields that coach changed, after re-reading the row. Two coaches
//   changing different fields of one row both keep their changes; if both changed the same
//   field, the save stops with a ConflictError so the coach can choose ("mine" / "theirs")
//   instead of silently overwriting the other.
// - A new row is re-checked just after it's written; if another coach took the same empty
//   row at the same moment, it moves to the next free row.
//
// Rules carried over from the Sheet and Team_Tools_Apps_Script.gs:
// - Formula columns are never written: IDs (A), Full Name (D), Times Used, hidden helpers.
// - The Athlete "Age" column (E) is never written, except to clear it when a row is deleted,
//   exactly as the Sheet's own delete does (HANDOFF.md §1.6).
// - New rows go in the first empty row inside the range the Sheet's formulas cover.
// - Deleting clears the editable cells and leaves the formulas for the next row to reuse.
//
// Everything here is pure (no network) so it can be tested against a simulated Sheet.

import { cellToISO, isoToSerial, type ISODate } from "./logic/dates";
import { LOG_TIME_HEADERS, ROW_LIMITS, TAB } from "./schema/layout";
import type { Athlete, Coach, ExerciseLibraryEntry, ProgressEntry, Status, WorkoutBlock } from "./schema/model";
import type { Cell, Rows } from "./schema/parse";

export type Table = keyof typeof ROW_LIMITS;

export type BlockInput = Omit<WorkoutBlock, "row">;
export type ProgressInput = Omit<ProgressEntry, "row">;
export type AthleteInput = Omit<Athlete, "row" | "id" | "fullName">;
export type CoachInput = Omit<Coach, "row" | "id" | "fullName">;
export type ExerciseInput = Omit<ExerciseLibraryEntry, "row" | "id">;

/** A change to save. `row` null = add a new row; `was` = the record as the app last saw it. */
export type Change =
  | { table: "log"; row: null; value: BlockInput }
  | { table: "log"; row: number; was: WorkoutBlock; value: BlockInput | null }
  | { table: "progress"; row: null; value: ProgressInput }
  | { table: "progress"; row: number; was: ProgressEntry; value: ProgressInput | null }
  | { table: "athletes"; row: null; value: AthleteInput }
  | { table: "athletes"; row: number; was: Athlete; value: AthleteInput | null }
  | { table: "coaches"; row: null; value: CoachInput }
  | { table: "coaches"; row: number; was: Coach; value: CoachInput | null }
  | { table: "library"; row: null; value: ExerciseInput }
  | { table: "library"; row: number; was: ExerciseLibraryEntry; value: ExerciseInput | null };
// value: null on an existing row = delete it.

export interface ValueRange { range: string; values: Cell[][] }

const q = (tab: string) => `'${tab}'`;
const TAB_OF: Record<Table, string> = { log: TAB.log, progress: TAB.progress, athletes: TAB.athletes, coaches: TAB.coaches, library: TAB.library };
const date = (d: ISODate | null): Cell => (d ? isoToSerial(d) : "");
const yesNo = (b: boolean) => (b ? "Yes" : "No");
const status = (s: Status) => s;

// ---- where a table's rows are identified ------------------------------------------------
// The columns that make a row "filled" (the same ones the parser needs) and the cells
// re-read before an edit to make sure the row still holds the record the coach was editing.

const KEY_COLS: Record<Table, [string, string]> = {
  athletes: ["B", "C"], coaches: ["B", "C"], library: ["D", "D"], log: ["A", "A"], progress: ["B", "B"],
};
const IDENTITY_COLS: Record<Table, [string, string]> = {
  athletes: ["B", "C"], coaches: ["B", "C"], library: ["D", "D"], log: ["A", "C"], progress: ["A", "C"],
};

/** The range to read to find an empty row for `table`. */
export function keyColumnRange(table: Table): string {
  const [a, b] = KEY_COLS[table];
  const { first, last } = ROW_LIMITS[table];
  return `${q(TAB_OF[table])}!${a}${first}:${b}${last}`;
}

/** First row in the key-column values (from keyColumnRange) with every key cell blank. */
export function firstEmptyRow(table: Table, keyValues: Rows): number | null {
  const { first, last } = ROW_LIMITS[table];
  for (let row = first; row <= last; row++) {
    const cells = keyValues[row - first] ?? [];
    if (cells.every((c) => String(c ?? "").trim() === "")) return row;
  }
  return null;
}

export function tableFullMessage(table: Table): string {
  const { last } = ROW_LIMITS[table];
  return `'${TAB_OF[table]}' is full (its formulas stop at row ${last}). In Google Sheets, insert more rows and copy the formulas down, then try again.`;
}

export function identityRange(table: Table, row: number): string {
  const [a, b] = IDENTITY_COLS[table];
  return `${q(TAB_OF[table])}!${a}${row}:${b}${row}`;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** What the identity cells should hold for the record the app has cached. */
function expectedIdentity(c: Extract<Change, { was: unknown }>): string[] {
  switch (c.table) {
    case "athletes": case "coaches": return [c.was.firstName, c.was.lastName];
    case "library": return [c.was.name];
    case "log": return [c.was.date, c.was.group, c.was.libraryItem];
    case "progress": return [c.was.date ?? "", c.was.athleteFullName, c.was.metricType];
  }
}

/**
 * True when the row, freshly read from the Sheet, still holds the record being edited.
 * Guards against someone sorting, deleting or inserting rows in the Sheet since the app
 * last refreshed — writing by row number would otherwise land on someone else's data.
 */
export function rowStillMatches(c: Extract<Change, { was: unknown }>, identityValues: Rows): boolean {
  const got = identityValues[0] ?? [];
  const expected = expectedIdentity(c);
  return expected.every((want, i) => {
    const cell = got[i];
    const isDateCol = (c.table === "log" || c.table === "progress") && i === 0;
    const have = isDateCol ? cellToISO(cell) ?? "" : cell;
    return norm(have) === norm(want);
  });
}

export const ROW_CHANGED_MESSAGE =
  "That row changed in the Sheet since this phone last refreshed (someone may have edited or sorted it). Refresh and try again.";

// ---- what gets written ------------------------------------------------------------------

/** The value ranges to write for an add/edit, or to clear for a delete. */
export function rangesFor(c: Change, row: number): { write: ValueRange[] } | { clear: string[] } {
  const t = q(TAB_OF[c.table]);
  const r = (a: string, b: string) => `${t}!${a}${row}:${b}${row}`;

  if (c.value === null) {
    switch (c.table) {
      case "athletes": case "coaches": return { clear: [r("B", "C"), r("E", "N")] }; // same cells as the Sheet's own delete
      case "library": return { clear: [r("B", "H")] };
      case "log": return { clear: [r("A", "H"), r("J", "K")] }; // not I: the hidden Day Rk formula
      case "progress": return { clear: [r("A", "F")] };
    }
  }

  switch (c.table) {
    case "log": {
      const v = c.value;
      // Block Type / Description / Sets are written as values even when picked from the
      // library, like typing over the Sheet's autofill: the plan keeps what was planned
      // even if the library entry is edited later.
      return { write: [
        { range: r("A", "H"), values: [[date(v.date), v.group, v.libraryItem, v.blockType, v.description, v.setsRepsDuration, v.coach, v.notes]] },
        { range: r("J", "K"), values: [[v.minutes ?? "", v.order ?? ""]] },
        LOG_TIME_HEADER_WRITE, // the Sheet as first built has no Minutes / Order columns
      ] };
    }
    case "progress": {
      const v = c.value;
      return { write: [{ range: r("A", "F"), values: [[date(v.date), v.athleteFullName, v.metricType, v.value, v.notes, v.loggedBy]] }] };
    }
    case "athletes": {
      const v = c.value;
      return { write: [
        { range: r("B", "C"), values: [[v.firstName, v.lastName]] },
        // D (Full Name) is a formula and E (Age) is never touched.
        { range: r("F", "N"), values: [[v.tier, v.currentFlashGrade, v.goalGrade, v.strengths, v.growthAreas, v.currentFocus, date(v.joinDate), status(v.status), v.notes]] },
      ] };
    }
    case "coaches": {
      const v = c.value;
      return { write: [
        { range: r("B", "C"), values: [[v.firstName, v.lastName]] },
        { range: r("E", "N"), values: [[v.role, yesNo(v.coachesMonday), yesNo(v.coachesTuesday), yesNo(v.coachesThursday), v.otherDays, v.email, v.phone, v.specialties, v.bio, status(v.status)]] },
      ] };
    }
    case "library": {
      const v = c.value;
      return { write: [{ range: r("B", "H"), values: [[v.blockType, v.tier, v.name, v.description, v.setsRepsDuration, v.equipment, v.notesSource]] }] };
    }
  }
}

const LOG_TIME_HEADER_WRITE: ValueRange = { range: `${q(TAB.log)}!J4:K4`, values: [[...LOG_TIME_HEADERS]] };

/** A problem with the input that should stop the save, in words for the coach. */
export function validateChange(c: Change): string | null {
  const v = c.value;
  if (!v) return null;
  switch (c.table) {
    case "log":
      if (!(v as BlockInput).date) return "Pick a date.";
      if (!(v as BlockInput).group) return "Pick a group.";
      if (!(v as BlockInput).libraryItem && !(v as BlockInput).blockType && !(v as BlockInput).description) return "Pick an exercise, or fill in a block type or description.";
      if ((v as BlockInput).minutes !== null && !((v as BlockInput).minutes! > 0 && (v as BlockInput).minutes! <= 600)) return "Minutes should be between 1 and 600.";
      return null;
    case "progress":
      if (!(v as ProgressInput).athleteFullName) return "Pick an athlete.";
      if (!(v as ProgressInput).date) return "Pick a date.";
      return null;
    case "athletes": case "coaches":
      if (!(v as AthleteInput).firstName.trim() || !(v as AthleteInput).lastName.trim()) return "First and last name are required.";
      return null;
    case "library":
      if (!(v as ExerciseInput).name.trim()) return "The exercise needs a name.";
      return null;
  }
}

/** Trims every string field, so stray spaces never break the name-based links between tabs. */
export function trimmed<T extends object>(v: T): T {
  const out = { ...v } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (typeof out[k] === "string") out[k] = (out[k] as string).trim();
  return out as T;
}

// ---- the save sequence --------------------------------------------------------------------

/** The Sheets API calls a save needs; the real one is in google/sheets.ts. */
export interface SheetWriter {
  read(range: string): Promise<Rows>;
  readMany(ranges: string[]): Promise<Rows[]>;
  addTab(title: string): Promise<void>;
  write(data: ValueRange[]): Promise<void>;
  clear(ranges: string[]): Promise<void>;
  /** Adds rows after the last row of a table, with the Sheet itself picking where (so two coaches never get the same row). Returns the range written. */
  append(range: string, values: Cell[][]): Promise<string>;
}

export class SaveError extends Error {}

/** One field two coaches changed differently. Values are as shown in the app. */
export interface Conflict { label: string; theirs: string; mine: string }
/** When there's a conflict: overwrite with mine, or keep theirs (my other changes still save). */
export type Resolve = "mine" | "theirs";

export class ConflictError extends SaveError {
  constructor(readonly conflicts: Conflict[]) {
    super("Someone else changed this while you were editing:\n" +
      conflicts.map((c) => `• ${c.label}: they saved “${c.theirs || "(blank)"}”, you have “${c.mine || "(blank)"}”`).join("\n"));
  }
}

// ---- fields, for writing only what changed --------------------------------------------------

type Kind = "text" | "date" | "yesno" | "number" | "status";
interface Field { key: string; col: string; label: string; kind: Kind }
const f = (key: string, col: string, label: string, kind: Kind = "text"): Field => ({ key, col, label, kind });

// Each table's editable cells (never the formula columns, never Age).
const FIELDS: Record<Table, Field[]> = {
  athletes: [f("firstName", "B", "First name"), f("lastName", "C", "Last name"), f("tier", "F", "Group"),
    f("currentFlashGrade", "G", "Flash grade"), f("goalGrade", "H", "Goal grade"), f("strengths", "I", "Strengths"),
    f("growthAreas", "J", "Growth areas"), f("currentFocus", "K", "Current focus"), f("joinDate", "L", "Join date", "date"),
    f("status", "M", "Status", "status"), f("notes", "N", "Notes")],
  coaches: [f("firstName", "B", "First name"), f("lastName", "C", "Last name"), f("role", "E", "Role"),
    f("coachesMonday", "F", "Mondays", "yesno"), f("coachesTuesday", "G", "Tuesdays", "yesno"), f("coachesThursday", "H", "Thursdays", "yesno"),
    f("otherDays", "I", "Other days"), f("email", "J", "Email"), f("phone", "K", "Phone"), f("specialties", "L", "Specialties"),
    f("bio", "M", "Bio"), f("status", "N", "Status", "status")],
  library: [f("blockType", "B", "Block type"), f("tier", "C", "Tier"), f("name", "D", "Name"), f("description", "E", "Description"),
    f("setsRepsDuration", "F", "Sets × reps"), f("equipment", "G", "Equipment"), f("notesSource", "H", "Notes / source")],
  log: [f("date", "A", "Date", "date"), f("group", "B", "Group"), f("libraryItem", "C", "Exercise"), f("blockType", "D", "Block type"),
    f("description", "E", "Description"), f("setsRepsDuration", "F", "Sets × reps"), f("coach", "G", "Coach"), f("notes", "H", "Notes"),
    f("minutes", "J", "Minutes", "number"), f("order", "K", "Order", "number")],
  progress: [f("date", "A", "Date", "date"), f("athleteFullName", "B", "Athlete"), f("metricType", "C", "Metric"),
    f("value", "D", "Value"), f("notes", "E", "Notes"), f("loggedBy", "F", "Logged by")],
};
const LAST_COL: Record<Table, string> = { athletes: "N", coaches: "N", library: "H", log: "K", progress: "F" };
const colIdx = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const cellStr = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

/** A value from the app, in the comparable form. */
function fromModel(field: Field, v: unknown): string {
  switch (field.kind) {
    case "date": return (v as string | null) ?? "";
    case "yesno": return v ? "Yes" : "No";
    case "number": return v === null || v === undefined || v === "" ? "" : String(Number(v));
    case "status": return v === "Inactive" ? "Inactive" : "Active";
    default: return cellStr(v);
  }
}
/** A cell from the Sheet, in the same comparable form. */
function fromCell(field: Field, v: Cell | undefined): string {
  switch (field.kind) {
    case "date": return cellToISO(v) ?? "";
    case "yesno": return cellStr(v).toLowerCase() === "yes" ? "Yes" : "No";
    case "number": return cellStr(v) === "" ? "" : String(Number(v));
    case "status": return cellStr(v).toLowerCase() === "inactive" ? "Inactive" : "Active";
    default: return cellStr(v);
  }
}
function toCell(field: Field, v: unknown): Cell {
  switch (field.kind) {
    case "date": return date((v as string | null) ?? null);
    case "yesno": return yesNo(!!v);
    case "number": return v === null || v === undefined ? "" : (v as number);
    default: return (v as string) ?? "";
  }
}

/**
 * The cells to write for an edit, given the row as it is in the Sheet right now: only fields
 * this coach changed; a field someone else also changed (differently) is a conflict.
 */
export function editPlan(c: Extract<Change, { was: unknown }>, fresh: Cell[], resolve?: Resolve): { write: ValueRange[]; conflicts: Conflict[] } {
  const was = c.was as unknown as Record<string, unknown>;
  const mine = c.value as unknown as Record<string, unknown>;
  const write: ValueRange[] = [];
  const conflicts: Conflict[] = [];
  for (const field of FIELDS[c.table]) {
    const base = fromModel(field, was[field.key]);
    const next = fromModel(field, mine[field.key]);
    const theirs = fromCell(field, fresh[colIdx(field.col)]);
    if (next === base || next === theirs) continue; // I didn't change it, or it already says what I want
    if (theirs !== base) {
      conflicts.push({ label: field.label, theirs, mine: next });
      if (resolve !== "mine") continue;
    }
    write.push({ range: `${q(TAB_OF[c.table])}!${field.col}${c.row}:${field.col}${c.row}`, values: [[toCell(field, mine[field.key])]] });
  }
  if (c.table === "log" && write.some((w) => /![JK]\d/.test(w.range))) write.push(LOG_TIME_HEADER_WRITE);
  return { write, conflicts };
}

/** True when the identity cells of `row` (just re-read) hold the new record's values. */
function holdsNewRecord(table: Table, value: object, identity: Rows): boolean {
  const [a, b] = IDENTITY_COLS[table];
  const got = identity[0] ?? [];
  return FIELDS[table].filter((fl) => colIdx(fl.col) >= colIdx(a) && colIdx(fl.col) <= colIdx(b))
    .every((fl) => fromCell(fl, got[colIdx(fl.col) - colIdx(a)]) === fromModel(fl, (value as Record<string, unknown>)[fl.key]));
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** How long a new row waits before being re-checked (tests set 0). */
export const saveTiming = { settleMs: 700 };

export interface SaveOptions {
  resolve?: Resolve; // how to settle a conflict the coach has already been shown
  settleMs?: number; // wait before re-checking a new row (another coach's write may still be landing)
}

/**
 * Validates, then:
 * - new row: finds the first empty row (a fresh read), writes, waits a moment, and re-checks
 *   the row still holds this record — if another coach took the same row at the same time,
 *   tries the next free one;
 * - edit: re-reads the row, checks it still holds the same record, and writes only the fields
 *   this coach changed (ConflictError if someone else changed one of them too);
 * - delete: checks the row still holds the record, then clears it.
 * Returns the Sheet row.
 */
export async function saveChange(sheet: SheetWriter, change: Change, opts: SaveOptions = {}): Promise<number> {
  const problem = validateChange(change);
  if (problem) throw new SaveError(problem);
  const c = (change.value ? { ...change, value: trimmed(change.value) } : change) as Change;
  const tab = q(TAB_OF[c.table]);

  if (c.row === null) {
    const taken = new Set<number>();
    for (let attempt = 0; attempt < 3; attempt++) {
      const keys = await sheet.read(keyColumnRange(c.table));
      const { first } = ROW_LIMITS[c.table];
      taken.forEach((r) => { keys[r - first] = ["taken"]; });
      const row = firstEmptyRow(c.table, keys);
      if (row === null) throw new SaveError(tableFullMessage(c.table));
      const plan = rangesFor(c, row) as { write: ValueRange[] };
      await sheet.write(plan.write);
      await sleep(opts.settleMs ?? saveTiming.settleMs);
      if (holdsNewRecord(c.table, c.value, await sheet.read(identityRange(c.table, row)))) return row;
      taken.add(row); // someone else's record landed there — theirs stays, mine moves on
    }
    throw new SaveError("Other coaches were adding at the same moment and there was no free row. Refresh and try again.");
  }

  const row = c.row;
  if (c.value === null) {
    if (!rowStillMatches(c, await sheet.read(identityRange(c.table, row)))) throw new SaveError(ROW_CHANGED_MESSAGE);
    await sheet.clear((rangesFor(c, row) as { clear: string[] }).clear);
    return row;
  }
  const fresh = (await sheet.read(`${tab}!A${row}:${LAST_COL[c.table]}${row}`))[0] ?? [];
  const [a, b] = IDENTITY_COLS[c.table];
  if (!rowStillMatches(c, [fresh.slice(colIdx(a), colIdx(b) + 1)])) throw new SaveError(ROW_CHANGED_MESSAGE);
  const plan = editPlan(c as Extract<Change, { was: unknown }>, fresh, opts.resolve);
  if (plan.conflicts.length && !opts.resolve) throw new ConflictError(plan.conflicts);
  if (plan.write.length) await sheet.write(plan.write);
  return row;
}

/**
 * Saves a new order for several blocks of one day (moving a block up or down): checks every
 * row still holds its block, then writes only their Order cells, in one request.
 */
export async function saveOrder(sheet: SheetWriter, moves: { block: WorkoutBlock; order: number }[]): Promise<void> {
  if (!moves.length) return;
  const found = await sheet.readMany(moves.map((m) => identityRange("log", m.block.row)));
  moves.forEach((m, i) => {
    if (!rowStillMatches({ table: "log", row: m.block.row, was: m.block, value: null }, found[i] ?? [])) throw new SaveError(ROW_CHANGED_MESSAGE);
  });
  await sheet.write([
    ...moves.map((m) => ({ range: `${q(TAB.log)}!K${m.block.row}:K${m.block.row}`, values: [[m.order]] })),
    LOG_TIME_HEADER_WRITE,
  ]);
}

/**
 * Wraps a SheetWriter and records every write and clear, so the same cell changes can be
 * replayed onto the app's own copy of the Sheet — the screen updates the moment a save
 * succeeds, without waiting to re-download everything.
 */
export function recording(sheet: SheetWriter): { writer: SheetWriter; replayOnto: (target: SheetWriter) => Promise<void> } {
  const log: ({ write: ValueRange[] } | { clear: string[] })[] = [];
  return {
    writer: {
      read: (r) => sheet.read(r),
      readMany: (r) => sheet.readMany(r),
      addTab: (t) => sheet.addTab(t),
      append: async (r, values) => { const at = await sheet.append(r, values); log.push({ write: [{ range: at, values }] }); return at; },
      write: async (d) => { await sheet.write(d); log.push({ write: d }); },
      clear: async (r) => { await sheet.clear(r); log.push({ clear: r }); },
    },
    async replayOnto(target) {
      for (const op of log) {
        if ("write" in op) await target.write(op.write);
        else await target.clear(op.clear);
      }
    },
  };
}
