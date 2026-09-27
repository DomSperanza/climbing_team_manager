// The Thursday tier rotation and the per-day lead-coach rotation — ported from the Sheet's
// formulas (Rotation Schedule!C:E and Full Team Calendar!C:D) and checked against them in
// test/rotation.test.ts. Inputs are only the season start, tier order and coach day-flags.
//
// Known quirk kept on purpose so the app and Sheet agree: the Thursday lead index advances
// on "All Team" weeks too, i.e. lead = list[(week-1) mod n]. If the number of Thursday
// coaches shares a factor with 4, some coaches' turns always land on an All Team week
// (with 4 coaches the 4th never leads). Changing this means changing the Sheet as well.

import { ALL_COACHES, ALL_TEAM } from "../schema/layout";
import type { Coach, SeasonSettings } from "../schema/model";
import { addDays, daysBetween, thursdayOfWeek, weekdayOf, type ISODate, type PracticeDay } from "./dates";

/** Active coaches flagged for `day`, in Sheet row order — that order *is* the rotation order. */
export function coachesFor(coaches: Coach[], day: PracticeDay): Coach[] {
  const flag = day === "Monday" ? "coachesMonday" : day === "Tuesday" ? "coachesTuesday" : "coachesThursday";
  return coaches.filter((c) => c.status === "Active" && c[flag]).sort((a, b) => a.row - b.row);
}

/** 1-based season week containing `d` (weeks run Mon–Sun around each Thursday), or null before the season. */
export function weekNumberFor(settings: SeasonSettings, d: ISODate): number | null {
  if (!settings.seasonStartDate) return null;
  const diff = daysBetween(settings.seasonStartDate, thursdayOfWeek(d));
  const week = Math.floor(diff / 7) + 1;
  return week >= 1 ? week : null;
}

export function cycleWeek(week: number): 1 | 2 | 3 | 4 {
  return (((week - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

export function featuredTier(settings: SeasonSettings, week: number): string {
  const c = cycleWeek(week);
  return c === 4 ? ALL_TEAM : settings.tierNames[c - 1] ?? "";
}

/** Lead coach for a practice day in a given week. null = nobody is flagged for that day. */
export function leadCoach(coaches: Coach[], day: PracticeDay, week: number): string | null {
  if (day === "Thursday" && cycleWeek(week) === 4) return ALL_COACHES;
  const list = coachesFor(coaches, day);
  if (!list.length) return null;
  return list[(week - 1) % list.length].fullName;
}

export interface PracticeInfo {
  date: ISODate;
  day: PracticeDay;
  week: number | null; // null = before the season starts
  featuredTier: string | null; // Thursdays only
  lead: string | null;
}

export function practiceInfo(settings: SeasonSettings, coaches: Coach[], d: ISODate): PracticeInfo {
  const day = weekdayOf(d) as PracticeDay;
  const week = weekNumberFor(settings, d);
  return {
    date: d,
    day,
    week,
    featuredTier: week && day === "Thursday" ? featuredTier(settings, week) : null,
    lead: week ? leadCoach(coaches, day, week) : null,
  };
}

export interface SeasonWeek {
  week: number;
  thursday: ISODate;
  cycle: 1 | 2 | 3 | 4;
  featuredTier: string;
  thursdayLead: string | null;
  mondayLead: string | null;
  tuesdayLead: string | null;
}

export function seasonWeeks(settings: SeasonSettings, coaches: Coach[], count = settings.numberOfWeeks): SeasonWeek[] {
  const start = settings.seasonStartDate;
  if (!start) return [];
  return Array.from({ length: count }, (_, i) => {
    const week = i + 1;
    return {
      week,
      thursday: addDays(start, 7 * i),
      cycle: cycleWeek(week),
      featuredTier: featuredTier(settings, week),
      thursdayLead: leadCoach(coaches, "Thursday", week),
      mondayLead: leadCoach(coaches, "Monday", week),
      tuesdayLead: leadCoach(coaches, "Tuesday", week),
    };
  });
}
