// Who's coaching a given practice day, and who has which group. Everyone flagged for that
// weekday in Coach Profiles (and Active) is on. Any coach can claim a group for a date, or
// hand it to someone else; those claims live in the "Coach Assignments" tab (Date | Group |
// Coach), which the app adds the first time someone claims a group. The day's lead is the
// "All Team" claim — until someone sets it, the rotation's pick stands in as a suggestion.

import { ASSIGNMENT_HEADERS, ALL_COACHES, ALL_TEAM, OPTIONAL_TAB } from "../schema/layout";
import type { Coach, TeamData } from "../schema/model";
import type { SheetWriter } from "../writes";
import { cellToISO, isoToSerial, isPracticeDay, weekdayOf, type ISODate, type PracticeDay } from "./dates";
import { coachesFor, practiceInfo } from "./rotation";

const TAB = `'${OPTIONAL_TAB.assignments}'`;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export interface DayCoaching {
  onDuty: Coach[]; // in Coach Profiles order
  lead: { coach: string | null; suggested: boolean }; // suggested = the rotation's pick, nobody has set it
  groups: { group: string; coach: string | null }[]; // one per tier, in Settings order
}

/** Claims for one date: group → coach (the last row wins if a group was entered twice). */
export function claimsOn(data: TeamData, date: ISODate): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of data.assignments) if (a.date === date) m.set(norm(a.group), a.coach);
  return m;
}

export function dayCoaching(data: TeamData, date: ISODate): DayCoaching {
  const claims = claimsOn(data, date);
  const onDuty = isPracticeDay(date) ? coachesFor(data.coaches, weekdayOf(date) as PracticeDay) : [];
  const rotation = practiceInfo(data.settings, data.coaches, date).lead;
  const leadClaim = claims.get(norm(ALL_TEAM)) ?? null;
  return {
    onDuty,
    lead: leadClaim ? { coach: leadClaim, suggested: false } : { coach: rotation && rotation !== ALL_COACHES ? rotation : null, suggested: true },
    groups: data.settings.tierNames.filter(Boolean).map((group) => ({ group, coach: claims.get(norm(group)) ?? null })),
  };
}

/** The coach who has `group` that day — the default "Coach" for a new block in that group. */
export function coachForGroup(data: TeamData, date: ISODate, group: string): string | null {
  const day = dayCoaching(data, date);
  if (norm(group) === norm(ALL_TEAM)) return day.lead.coach;
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
