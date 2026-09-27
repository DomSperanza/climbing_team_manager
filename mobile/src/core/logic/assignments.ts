// Who's coaching a given practice day, and who has which group. Everyone flagged for that
// weekday in Coach Profiles (and Active) is on. Any coach can claim a group for a date, or
// hand it to someone else; those claims live in the "Coach Assignments" tab (Date | Group |
// Coach), which the app adds the first time someone claims a group. The day's lead is the
// "All Team" claim.

import { ASSIGNMENT_HEADERS, ALL_TEAM, OPTIONAL_TAB } from "../schema/layout";
import type { Coach, TeamData } from "../schema/model";
import { ConflictError, type Resolve, type SheetWriter } from "../writes";
import { cellToISO, isoToSerial, isPracticeDay, weekdayOf, type ISODate, type PracticeDay } from "./dates";

const TAB = `'${OPTIONAL_TAB.assignments}'`;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export interface DayCoaching {
  onDuty: Coach[]; // in Coach Profiles order
  lead: string | null; // the "All Team" claim
  groups: { group: string; coach: string | null }[]; // one per tier, in Settings order
}

/** Active coaches who coach on `day`, in Coach Profiles order. */
export function coachesOn(coaches: Coach[], day: PracticeDay): Coach[] {
  const flag = day === "Monday" ? "coachesMonday" : day === "Tuesday" ? "coachesTuesday" : "coachesThursday";
  return coaches.filter((c) => c.status === "Active" && c[flag]).sort((a, b) => a.row - b.row);
}

/** Claims for one date: group → coach (the last row wins if a group was entered twice). */
export function claimsOn(data: TeamData, date: ISODate): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of data.assignments) if (a.date === date) m.set(norm(a.group), a.coach);
  return m;
}

export function dayCoaching(data: TeamData, date: ISODate): DayCoaching {
  const claims = claimsOn(data, date);
  return {
    onDuty: isPracticeDay(date) ? coachesOn(data.coaches, weekdayOf(date) as PracticeDay) : [],
    lead: claims.get(norm(ALL_TEAM)) ?? null,
    groups: data.settings.tierNames.filter(Boolean).map((group) => ({ group, coach: claims.get(norm(group)) ?? null })),
  };
}

/** The coach who has `group` that day — the default "Coach" for a new block in that group. */
export function coachForGroup(data: TeamData, date: ISODate, group: string): string | null {
  const day = dayCoaching(data, date);
  if (norm(group) === norm(ALL_TEAM)) return day.lead;
  return day.groups.find((g) => norm(g.group) === norm(group))?.coach ?? null;
}

/**
 * Sets (or with coach null, clears) who has `group` on `date`. `expected` is who the coach saw
 * there when they started; if someone else claimed it meanwhile, it stops with a
 * ConflictError (unless `resolve` says whose to keep). Reads the tab fresh, updates the
 * existing row rather than adding a duplicate, and adds the tab if it's missing.
 */
export async function saveAssignment(sheet: SheetWriter, date: ISODate, group: string, coach: string | null,
  tabExists: boolean, expected: string | null = null, resolve?: Resolve): Promise<void> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.assignments);
  const rows = await sheet.read(`${TAB}!A2:C`);
  const matches = rows.map((r, i) => (cellToISO(r[0]) === date && norm(r[1]) === norm(group) ? i + 2 : 0)).filter(Boolean);
  const theirs = matches.length ? String(rows[matches[0] - 2][2] ?? "").trim() || null : null;
  if (norm(theirs) !== norm(expected) && norm(theirs) !== norm(coach)) {
    if (!resolve) throw new ConflictError([{ label: norm(group) === norm(ALL_TEAM) ? "Lead" : group, theirs: theirs ?? "open", mine: coach ?? "open" }]);
    if (resolve === "theirs") return;
  }
  await sheet.write([{ range: `${TAB}!A1:C1`, values: [[...ASSIGNMENT_HEADERS]] }]);
  if (coach) {
    const row = matches.shift();
    if (row) await sheet.write([{ range: `${TAB}!A${row}:C${row}`, values: [[isoToSerial(date), group, coach]] }]);
    else await sheet.append(`${TAB}!A1:C`, [[isoToSerial(date), group, coach]]);
  }
  if (matches.length) await sheet.clear(matches.map((r) => `${TAB}!A${r}:C${r}`)); // clearing, or duplicates
}
