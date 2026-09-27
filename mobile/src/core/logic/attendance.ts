// Who was at each practice, and so what each athlete did. "Save workout" on a day adds one
// row per active athlete to the "Attendance" tab (Date | Athlete | Group | Here | Notes).
// What an athlete did that day is the day's plan for their group plus the All Team blocks —
// looked up from Log a Workout, so fixing the plan afterwards fixes their history too.
// Athletes are matched by full name, like the Progress Log.

import { ATTENDANCE_HEADERS, OPTIONAL_TAB } from "../schema/layout";
import type { Athlete, AttendanceEntry, TeamData } from "../schema/model";
import type { SheetWriter, ValueRange } from "../writes";
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
 * their row, so saving again only adds whoever is missing. Returns how many were added.
 */
export async function saveDay(sheet: SheetWriter, data: TeamData, date: ISODate, tabExists: boolean): Promise<number> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.attendance);
  const rows = await sheet.read(`${TAB}!A2:E`); // fresh, in case another coach saved meanwhile
  const already = new Set(rows.filter((r) => cellToISO(r[0]) === date).map((r) => norm(r[1])));
  const add = unrecorded(data, date).filter((a) => !already.has(norm(a.fullName)));
  if (!add.length) { await sheet.write([header]); return 0; }
  const first = rows.length + 2; // after the last row with anything in it
  await sheet.write([header, {
    range: `${TAB}!A${first}:E${first + add.length - 1}`,
    values: add.map((a) => rowValues(date, a.fullName, a.tier, true, "")),
  }]);
  return add.length;
}

/** Sets one athlete's record for a day: their group that day, whether they were there, notes. */
export async function saveAthleteDay(sheet: SheetWriter, date: ISODate, athlete: string,
  value: { group: string; here: boolean; notes: string }, tabExists: boolean): Promise<void> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.attendance);
  const rows = await sheet.read(`${TAB}!A2:E`);
  const matches = rows.map((r, i) => (cellToISO(r[0]) === date && norm(r[1]) === norm(athlete) ? i + 2 : 0)).filter(Boolean);
  const row = matches.shift() ?? rows.length + 2;
  await sheet.write([header, { range: `${TAB}!A${row}:E${row}`, values: [rowValues(date, athlete, value.group, value.here, value.notes)] }]);
  if (matches.length) await sheet.clear(matches.map((r) => `${TAB}!A${r}:E${r}`)); // stray duplicates
}
