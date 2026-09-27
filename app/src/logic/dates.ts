// Dates are plain "YYYY-MM-DD" strings everywhere in the app. All arithmetic goes through
// UTC midnight so a phone's timezone can never shift a practice onto the wrong day.

export type ISODate = string;

const DAY_MS = 86_400_000;
// Spreadsheet serial day 0 (Google Sheets and Excel share this epoch for modern dates).
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type PracticeDay = "Monday" | "Tuesday" | "Thursday";
export const PRACTICE_DAYS: PracticeDay[] = ["Monday", "Tuesday", "Thursday"];

function toMs(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Spreadsheet serial number -> ISO date. Time-of-day (the fraction) is dropped. */
export function serialToISO(serial: number): ISODate {
  return fromMs(SERIAL_EPOCH_MS + Math.floor(serial) * DAY_MS);
}

export function isoToSerial(d: ISODate): number {
  return Math.round((toMs(d) - SERIAL_EPOCH_MS) / DAY_MS);
}

/**
 * Reads a date cell as the Sheets API returns it (serial number), tolerating dates someone
 * typed as text ("2026-09-24", "9/24/2026"). Anything else -> null.
 */
export function cellToISO(v: unknown): ISODate | null {
  if (typeof v === "number" && isFinite(v) && v > 0) return serialToISO(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return fromMs(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return fromMs(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  return null;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromMs(toMs(d) + n * DAY_MS);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

export function weekdayOf(d: ISODate): Weekday {
  return WEEKDAYS[new Date(toMs(d)).getUTCDay()];
}

/** Today on this device, as a local calendar date. */
export function todayISO(now: Date = new Date()): ISODate {
  return fromMs(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function isPracticeDay(d: ISODate): boolean {
  return (PRACTICE_DAYS as string[]).includes(weekdayOf(d));
}

/** The given day if it's a practice day, otherwise the next one. */
export function nextPracticeDay(d: ISODate): ISODate {
  let cur = d;
  while (!isPracticeDay(cur)) cur = addDays(cur, 1);
  return cur;
}

export function stepPracticeDay(d: ISODate, dir: 1 | -1): ISODate {
  let cur = addDays(d, dir);
  while (!isPracticeDay(cur)) cur = addDays(cur, dir);
  return cur;
}

/** The Thursday of the Monday-starting week containing `d`. */
export function thursdayOfWeek(d: ISODate): ISODate {
  const dow = new Date(toMs(d)).getUTCDay(); // 0 = Sunday
  const mondayOffset = (dow + 6) % 7;
  return addDays(d, 3 - mondayOffset);
}

export function formatLong(d: ISODate): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function formatShort(d: ISODate): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    month: "short", day: "numeric", timeZone: "UTC",
  });
}
