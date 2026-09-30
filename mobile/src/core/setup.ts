// Creating a new team Sheet. The app uploads the team workbook to Google Drive, which
// converts it into a Google Sheet (formulas, dropdowns, color rules and named ranges intact,
// exactly as the original Sheet was made). Then this plan fills in the new team's Settings
// (its groups, practice days and times — see teamSettings.ts) and clears the example rows,
// using the same "clear the editable cells, keep the formulas" rule as deleting. Pure
// functions only, so it's tested against the example workbook.

import { withCoachDay } from "./logic/coachDays";
import type { Weekday } from "./logic/dates";
import { ALL_LEVELS, LIB_ADDED_BY_HEADER, LOG_TIME_HEADERS, TAB } from "./schema/layout";
import { settingsWrites, validateTeamSetup, type TeamSetup } from "./teamSettings";
import type { SheetWriter, ValueRange } from "./writes";

export interface NewSheetOptions {
  name: string;
  team: TeamSetup; // groups, practice days and times (every group's `was` is null)
  keepLibrary: boolean; // the ~21 starter exercises from the team's real practice plans
  me: { firstName: string; lastName: string; role: string; email: string; days: Weekday[] } | null; // added as the first coach
}

export function validateNewSheet(o: NewSheetOptions): string | null {
  if (!o.name.trim()) return "Give the Sheet a name.";
  const team = validateTeamSetup(o.team);
  if (team) return team;
  if (o.me && (!o.me.firstName.trim() || !o.me.lastName.trim())) return "Add your first and last name, or switch off \"Add me as a coach\".";
  return null;
}

/** Cells to clear (the example rows) and then fill (Settings, and you as the first coach). */
export function setupPlan(o: NewSheetOptions): { clear: string[]; write: ValueRange[] } {
  const clear = [
    "'Athlete Profiles'!B6:C37", "'Athlete Profiles'!E6:N37", // not A/D: ID and Full Name formulas
    "'Coach Profiles'!B6:C19", "'Coach Profiles'!E6:N19",
    // Log: not D:F, whose library-autofill formulas blank themselves once C is empty.
    "'Log a Workout'!A5:C200", "'Log a Workout'!G5:H200", "'Log a Workout'!J5:K200",
    "'Progress Log'!A5:F260",
    ...(o.keepLibrary ? [] : ["'Exercise Library'!B6:H120", "'Exercise Library'!K6:K120"]),
  ];
  const write: ValueRange[] = [
    ...settingsWrites(o.team),
    { range: "'Log a Workout'!J4:K4", values: [[...LOG_TIME_HEADERS]] }, // the app's Minutes / Order columns
    { range: "'Exercise Library'!K5:K5", values: [[LIB_ADDED_BY_HEADER]] }, // and who added each exercise
  ];
  if (o.me) {
    const m = o.me;
    const yn = (b: boolean) => (b ? "Yes" : "No");
    const d = m.days.reduce((c, day) => withCoachDay(c, day, true), { coachesMonday: false, coachesTuesday: false, coachesThursday: false, otherDays: "" });
    write.push(
      { range: "'Coach Profiles'!B6:C6", values: [[m.firstName.trim(), m.lastName.trim()]] },
      { range: "'Coach Profiles'!E6:N6", values: [[m.role.trim(), yn(d.coachesMonday), yn(d.coachesTuesday), yn(d.coachesThursday), d.otherDays, m.email.trim(), "", "", "", "Active"]] },
    );
  }
  return { clear, write };
}

/** The workbook's own groups, which its starter exercises are tagged with. */
export const TEMPLATE_GROUPS = ["Advanced", "Intermediate", "Developing"];

/**
 * Re-tags the starter exercises for the new team's groups, top to bottom: the workbook's
 * Advanced exercises go to the first group, Intermediate to the second, Developing to the
 * third. With fewer groups, the rest become "All Levels". Resolves to how many changed.
 */
export async function retagStarterLibrary(sheet: SheetWriter, team: TeamSetup): Promise<number> {
  const to = new Map(TEMPLATE_GROUPS.map((g, i) => [g.toLowerCase(), team.groups[i]?.name.trim() || ALL_LEVELS]));
  const tab = `'${TAB.library}'`;
  const rows = await sheet.read(`${tab}!C6:C`);
  const writes: ValueRange[] = [];
  rows.forEach((r, i) => {
    const next = to.get(String(r[0] ?? "").trim().toLowerCase());
    if (next !== undefined && next !== String(r[0]).trim()) writes.push({ range: `${tab}!C${6 + i}:C${6 + i}`, values: [[next]] });
  });
  if (writes.length) await sheet.write(writes);
  return writes.length;
}

// ---- the Drive upload body ------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 → bytes, without relying on atob/Buffer (so it behaves the same on every platform). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** A multipart/related body: JSON metadata, then the file. For Drive's uploadType=multipart. */
export function multipartBody(metadata: object, mediaType: string, media: Uint8Array, boundary: string): Uint8Array {
  const head = utf8(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`);
  const tail = utf8(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + media.length + tail.length);
  body.set(head, 0);
  body.set(media, head.length);
  body.set(tail, head.length + media.length);
  return body;
}
