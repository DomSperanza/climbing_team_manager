// Saving to the Sheet (HANDOFF.md §2.3): every change is written straight through, online,
// to the exact cells it touches — never whole rows — so two coaches editing different
// fields of the same row can't clobber each other.
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

/** The three Sheets API calls a save needs; the real one is in google/sheets.ts. */
export interface SheetWriter {
  read(range: string): Promise<Rows>;
  readMany(ranges: string[]): Promise<Rows[]>;
  write(data: ValueRange[]): Promise<void>;
  clear(ranges: string[]): Promise<void>;
}

export class SaveError extends Error {}

/**
 * Validates, finds the row (a fresh read — never the cached copy), checks an edited row
 * still holds the same record, then writes. Returns the Sheet row that was written.
 */
export async function saveChange(sheet: SheetWriter, change: Change): Promise<number> {
  const problem = validateChange(change);
  if (problem) throw new SaveError(problem);
  const c = (change.value ? { ...change, value: trimmed(change.value) } : change) as Change;

  let row: number;
  if (c.row === null) {
    const found = firstEmptyRow(c.table, await sheet.read(keyColumnRange(c.table)));
    if (found === null) throw new SaveError(tableFullMessage(c.table));
    row = found;
  } else {
    row = c.row;
    if (!rowStillMatches(c, await sheet.read(identityRange(c.table, row)))) throw new SaveError(ROW_CHANGED_MESSAGE);
  }

  const plan = rangesFor(c, row);
  if ("write" in plan) await sheet.write(plan.write);
  else await sheet.clear(plan.clear);
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
