// Which days a coach coaches. Coach Profiles has a Yes/No column for Monday, Tuesday and
// Thursday (the original team's days) and a free-text "Other Days" column. A team that
// practices on other days keeps those in Other Days as day names ("Wed, Sat"), so the Sheet
// layout stays the same for every team. Anything else typed there is left alone.

import type { Coach } from "../schema/model";
import { dayWord, daysInText, shortDay, sortDays, WEEK, type Weekday } from "./dates";

type CoachDays = Pick<Coach, "coachesMonday" | "coachesTuesday" | "coachesThursday" | "otherDays">;

const FLAG: Partial<Record<Weekday, "coachesMonday" | "coachesTuesday" | "coachesThursday">> = {
  Monday: "coachesMonday", Tuesday: "coachesTuesday", Thursday: "coachesThursday",
};

/** Every day the coach is down for, in week order. */
export function coachDays(c: CoachDays): Weekday[] {
  const flagged = (Object.keys(FLAG) as Weekday[]).filter((d) => c[FLAG[d]!]);
  return sortDays([...flagged, ...daysInText(c.otherDays)]);
}

export function coachesDay(c: CoachDays, day: Weekday): boolean {
  return coachDays(c).includes(day);
}

/** The same coach, on or off for `day`. Other Days keeps whatever else it said. */
export function withCoachDay<C extends CoachDays>(c: C, day: Weekday, on: boolean): C {
  const flag = FLAG[day];
  // A day named in Other Days comes off there even when it has its own column.
  const other = removeDay(c.otherDays, day);
  if (flag) return { ...c, [flag]: on, otherDays: other };
  return { ...c, otherDays: on ? [other, shortDay(day)].filter(Boolean).join(", ") : other };
}

/** What Other Days says besides day names ("some Saturdays" → "some"), or "" when it's only days. */
export function otherDaysNote(text: string): string {
  return WEEK.reduce((t, d) => removeDay(t, d), text).trim();
}

/** Other Days without any mention of `day` ("Wed, Sat" − Wednesday → "Sat"). */
function removeDay(text: string, day: Weekday): string {
  if (!dayWord(day).test(text)) return text;
  return text.replace(dayWord(day), "")
    .replace(/\s*(,|\/|&|\band\b)\s*(?=(,|\/|&|\band\b|$))/gi, "") // separators left dangling
    .replace(/^\s*(,|\/|&|\band\b)\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
