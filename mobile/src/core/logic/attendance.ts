// Who was at each practice, and so what each athlete did. "Save workout" on a day adds one
// row per active athlete to the "Attendance" tab (Date | Athlete | Group | Here | Notes).
// What an athlete did that day is the day's plan for their group plus the All Team blocks —
// looked up from Log a Workout, so fixing the plan afterwards fixes their history too.
// Athletes are matched by full name, like the Progress Log.

import { ATTENDANCE_HEADERS, OPTIONAL_TAB } from "../schema/layout";
import type { Athlete, AttendanceEntry, TeamData } from "../schema/model";
import { ConflictError, type Conflict, type Resolve, type SheetWriter, type ValueRange } from "../writes";
import { cellToISO, isoToSerial, type ISODate } from "./dates";
import { dayTimeline, type TimedBlock } from "./timeline";

const TAB = `'${OPTIONAL_TAB.attendance}'`;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export interface DayRecord { entry: AttendanceEntry; blocks: TimedBlock[] }

/** The day's blocks for one group: that group's plus All Team, in time order. */
export function workoutFor(data: TeamData, date: ISODate, group: string): TimedBlock[] {
  const day = data.log.filter((b) => b.date === date);
  return dayTimeline(day, data.settings.practice, data.settings.tierNames).blocks
    .filter((t) => t.lane === null || norm(t.block.group) === norm(group));
}

/** Attendance for one date, by athlete name (the last row wins if someone was entered twice). */
export function attendanceOn(data: TeamData, date: ISODate): Map<string, AttendanceEntry> {
  const m = new Map<string, AttendanceEntry>();
  for (const e of data.attendance) if (e.date === date) m.set(norm(e.athlete), e);
  return m;
}

export function recordFor(data: TeamData, date: ISODate, athlete: string): AttendanceEntry | undefined {
  return attendanceOn(data, date).get(norm(athlete));
}

/** An athlete's practices, newest first, each with what they did (absent days have no blocks). */
export function athleteHistory(data: TeamData, athlete: Athlete): DayRecord[] {
  const byDate = new Map<ISODate, AttendanceEntry>();
  for (const e of data.attendance) if (norm(e.athlete) === norm(athlete.fullName)) byDate.set(e.date, e);
  return [...byDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => ({ entry, blocks: entry.here ? workoutFor(data, entry.date, entry.group) : [] }));
}

/** Active athletes not yet recorded for `date` — who "Save workout" would add. */
export function unrecorded(data: TeamData, date: ISODate): Athlete[] {
  const done = attendanceOn(data, date);
  return data.athletes.filter((a) => a.status === "Active" && !done.has(norm(a.fullName)));
}

const rowValues = (date: ISODate, athlete: string, group: string, here: boolean, notes: string) =>
  [isoToSerial(date), athlete, group, here ? "Yes" : "No", notes.trim()];
const header: ValueRange = { range: `${TAB}!A1:E1`, values: [[...ATTENDANCE_HEADERS]] };

/**
 * "Save workout": records every active athlete not already recorded for `date`, in their
 * usual group, as there. Athletes already recorded (moved group, marked absent, notes) keep
 * their row, so saving again only adds whoever is missing. Rows are appended by the Sheet
 * itself, so two coaches saving together can't overwrite each other; if both added the same
 * athlete, the extra row is cleared. Returns how many were added.
 */
export async function saveDay(sheet: SheetWriter, data: TeamData, date: ISODate, tabExists: boolean): Promise<number> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.attendance);
  await sheet.write([header]);
  const rows = await sheet.read(`${TAB}!A2:E`); // fresh, in case another coach saved meanwhile
  const already = new Set(rows.filter((r) => cellToISO(r[0]) === date).map((r) => norm(r[1])));
  const add = unrecorded(data, date).filter((a) => !already.has(norm(a.fullName)));
  if (!add.length) return 0;
  await sheet.append(`${TAB}!A1:E`, add.map((a) => rowValues(date, a.fullName, a.tier, true, "")));
  await clearDuplicates(sheet, date);
  return add.length;
}

/** Keeps the first row for each athlete on `date` and clears any later copies. */
async function clearDuplicates(sheet: SheetWriter, date: ISODate) {
  const rows = await sheet.read(`${TAB}!A2:E`);
  const seen = new Set<string>();
  const extra: string[] = [];
  rows.forEach((r, i) => {
    if (cellToISO(r[0]) !== date || !norm(r[1])) return;
    if (seen.has(norm(r[1]))) extra.push(`${TAB}!A${i + 2}:E${i + 2}`);
    seen.add(norm(r[1]));
  });
  if (extra.length) await sheet.clear(extra);
}

export interface DayValue { group: string; here: boolean; notes: string }

/**
 * Sets one athlete's record for a day. `base` is what the coach saw when they started; only
 * the fields they changed are written, and if another coach changed the same field meanwhile
 * it stops with a ConflictError (unless `resolve` says whose version to keep).
 */
export async function saveAthleteDay(sheet: SheetWriter, date: ISODate, athlete: string, value: DayValue,
  base: DayValue | null, tabExists: boolean, resolve?: Resolve): Promise<void> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.attendance);
  const rows = await sheet.read(`${TAB}!A2:E`);
  const matches = rows.map((r, i) => (cellToISO(r[0]) === date && norm(r[1]) === norm(athlete) ? i + 2 : 0)).filter(Boolean);
  const row = matches.shift();
  if (!row) {
    await sheet.write([header]);
    await sheet.append(`${TAB}!A1:E`, [rowValues(date, athlete, value.group, value.here, value.notes)]);
    return;
  }
  const r = rows[row - 2];
  const theirs: DayValue = { group: String(r[2] ?? "").trim(), here: String(r[3] ?? "").trim().toLowerCase() !== "no", notes: String(r[4] ?? "").trim() };
  const was = base ?? theirs; // no starting point (e.g. added by another coach's save) → their row is the base
  const fields: { key: keyof DayValue; col: string; label: string; cell: (v: DayValue) => string }[] = [
    { key: "group", col: "C", label: "Group", cell: (v) => v.group },
    { key: "here", col: "D", label: "Was there", cell: (v) => (v.here ? "Yes" : "No") },
    { key: "notes", col: "E", label: "Notes", cell: (v) => v.notes.trim() },
  ];
  const write: ValueRange[] = [];
  const conflicts: Conflict[] = [];
  for (const fl of fields) {
    const [b, m, t] = [fl.cell(was), fl.cell(value), fl.cell(theirs)];
    if (m === b || m === t) continue;
    if (t !== b) {
      conflicts.push({ label: fl.label, theirs: t, mine: m });
      if (resolve !== "mine") continue;
    }
    write.push({ range: `${TAB}!${fl.col}${row}:${fl.col}${row}`, values: [[m]] });
  }
  if (conflicts.length && !resolve) throw new ConflictError(conflicts);
  if (write.length) await sheet.write(write);
  if (matches.length) await sheet.clear(matches.map((m) => `${TAB}!A${m}:E${m}`)); // stray duplicates
}
