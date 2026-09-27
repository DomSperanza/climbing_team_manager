// Who's coaching a given practice day, and who has which group. Everyone flagged for that
// weekday in Coach Profiles (and Active) is on. Any coach can claim a group for a date, or
// hand it to someone else; those claims live in the "Coach Assignments" tab (Date | Group |
// Coach), which the app adds the first time someone claims a group. The day's lead is the
// "All Team" claim.

import { ASSIGNMENT_HEADERS, ALL_TEAM, OPTIONAL_TAB } from "../schema/layout";
import type { Coach, TeamData } from "../schema/model";
import type { SheetWriter } from "../writes";
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
 * Sets (or with coach null, clears) who has `group` on `date`. Reads the tab fresh first so it
 * updates the existing row rather than adding a duplicate, and adds the tab if it's missing.
 */
export async function saveAssignment(sheet: SheetWriter, date: ISODate, group: string, coach: string | null, tabExists: boolean): Promise<void> {
  if (!tabExists) await sheet.addTab(OPTIONAL_TAB.assignments);
  const rows = await sheet.read(`${TAB}!A2:C2000`);
  const matches: number[] = [];
  let firstEmpty = -1;
  rows.forEach((r, i) => {
    if (cellToISO(r[0]) === date && norm(r[1]) === norm(group)) matches.push(i + 2);
    else if (firstEmpty < 0 && r.every((c) => String(c ?? "").trim() === "")) firstEmpty = i + 2;
  });
  const header = { range: `${TAB}!A1:C1`, values: [[...ASSIGNMENT_HEADERS]] };
  if (coach) {
    const row = matches.shift() ?? (firstEmpty > 0 ? firstEmpty : rows.length + 2);
    await sheet.write([header, { range: `${TAB}!A${row}:C${row}`, values: [[isoToSerial(date), group, coach]] }]);
  } else {
    await sheet.write([header]);
  }
  if (matches.length) await sheet.clear(matches.map((r) => `${TAB}!A${r}:C${r}`)); // clearing, or duplicates
}
