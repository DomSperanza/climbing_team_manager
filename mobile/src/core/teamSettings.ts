// Team settings: the groups athletes are split into, which days the team practices, and the
// practice times. They live in the Sheet's Settings tab (see SETTINGS in schema/layout.ts), so
// coaches can also change them there. Used by "Create a new team Sheet" and by More → Team
// settings. Pure functions (plus a SheetWriter), so they're tested against a simulated Sheet.
//
// Renaming a group also renames it everywhere it's written: athletes, exercises, workout
// blocks (including shared ones, "Intermediate, Developing"), group claims and attendance.
// Otherwise every athlete in it would drop out of the group the moment it was renamed.

import { formatClock } from "./logic/timeline";
import { shortDay, sortDays, type Weekday } from "./logic/dates";
import { MAX_GROUPS, OPTIONAL_TAB, RESERVED_GROUP_NAMES, SETTINGS, TAB } from "./schema/layout";
import type { Athlete, SeasonSettings } from "./schema/model";
import { SaveError, type SheetWriter, type ValueRange } from "./writes";

/** One group in the form. `was` = its name in the Sheet when the form opened (null = new). */
export interface GroupEdit { name: string; was: string | null }

export interface TeamSetup {
  groups: GroupEdit[]; // top to bottom; the order sets the colors and the order everywhere
  practiceDays: Weekday[];
  start: number; // minutes after midnight
  end: number;
  warmupMinutes: number;
  cooldownMinutes: number;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function setupFromSettings(s: SeasonSettings): TeamSetup {
  return {
    groups: s.tierNames.map((name) => ({ name, was: name })),
    practiceDays: s.practiceDays,
    start: s.practice.start,
    end: s.practice.end,
    warmupMinutes: s.practice.warmupMinutes,
    cooldownMinutes: s.practice.cooldownMinutes,
  };
}

/** Groups that were in the Sheet and aren't in the form anymore. */
export function removedGroups(t: TeamSetup, current: string[]): string[] {
  const kept = new Set(t.groups.map((g) => g.was).filter((w): w is string => w !== null));
  return current.filter((name) => !kept.has(name));
}

/** Old name → new name, for groups whose name changed. */
export function renames(t: TeamSetup): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of t.groups) if (g.was !== null && g.was !== g.name.trim()) m.set(g.was, g.name.trim());
  return m;
}

/** A problem that should stop the save, in words for the coach — or null. */
export function validateTeamSetup(t: TeamSetup, athletes: Athlete[] = [], current: string[] = []): string | null {
  const names = t.groups.map((g) => g.name.trim());
  if (!names.length) return "Add at least one group.";
  if (names.length > MAX_GROUPS) return `A team can have up to ${MAX_GROUPS} groups.`;
  if (names.some((n) => !n)) return "Every group needs a name.";
  if (new Set(names.map(norm)).size !== names.length) return "Each group needs a different name.";
  const reserved = names.find((n) => RESERVED_GROUP_NAMES.some((r) => norm(r) === norm(n)));
  if (reserved) return `"${reserved}" already means everyone in the Sheet — pick another group name.`;
  if (names.some((n) => n.includes(","))) return "Group names can't have commas in them (the Sheet uses commas to list groups that train together).";
  for (const gone of removedGroups(t, current)) {
    const inIt = athletes.filter((a) => a.status === "Active" && norm(a.tier) === norm(gone)).length;
    if (inIt) return `${inIt} active athlete${inIt === 1 ? " is" : "s are"} still in ${gone}. Move them to another group (or mark them inactive) before removing it.`;
  }
  if (!t.practiceDays.length) return "Pick at least one practice day.";
  if (t.end <= t.start) return "Practice has to end after it starts.";
  const mins = [t.warmupMinutes, t.cooldownMinutes];
  if (mins.some((m) => !Number.isInteger(m) || m < 0 || m > 300)) return "Warm-up and stretch should be between 0 and 300 minutes.";
  if (t.warmupMinutes + t.cooldownMinutes > t.end - t.start) return "The warm-up and stretch are longer than the whole practice.";
  return null;
}

const S = `'${TAB.settings}'`;

/** The Settings cells for these settings: labels in A, values in B. */
export function settingsWrites(t: TeamSetup): ValueRange[] {
  const { groupFirstRow: g1, groupLastRow: g2 } = SETTINGS;
  const groups = Array.from({ length: g2 - g1 + 1 }, (_, i) => [`Group ${i + 1}`, t.groups[i]?.name.trim() ?? ""]);
  const middle = t.end - t.start - t.warmupMinutes - t.cooldownMinutes;
  return [
    { range: `${S}!A4:A4`, values: [["GROUPS (top to bottom; leave the rest blank)"]] },
    { range: `${S}!A${g1}:B${g2}`, values: groups },
    { range: `${S}!A14:A15`, values: [["PRACTICE DAYS & TIMES"], ["Change these in the app (More → Team settings), or here. Practice days are day names, e.g. Mon, Wed, Fri."]] },
    { range: `${S}!A18:B22`, values: [
      ["Practice start time", formatClock(t.start, true)],
      ["Practice end time", formatClock(t.end, true)],
      ["Team warm-up (minutes)", t.warmupMinutes],
      ["Group time in between (minutes)", middle],
      ["Team stretch / cooldown (minutes)", t.cooldownMinutes],
    ] },
    { range: `${S}!A${SETTINGS.practiceDaysRow}:B${SETTINGS.practiceDaysRow}`, values: [["Practice days", sortDays(t.practiceDays).map(shortDay).join(", ")]] },
  ];
}

/** A group cell with renames applied. Handles shared blocks ("Intermediate, Developing"). */
function renamed(cell: unknown, map: Map<string, string>, list: boolean): string | null {
  const text = String(cell ?? "");
  if (!text.trim()) return null;
  const byNorm = new Map([...map].map(([from, to]) => [norm(from), to]));
  const parts = list ? text.split(",") : [text];
  let changed = false;
  const out = parts.map((p) => {
    const to = byNorm.get(norm(p));
    if (to === undefined) return p.trim();
    changed = true;
    return to;
  });
  return changed ? out.join(", ") : null;
}

/** Where group names are written, and whether the cell can list several ("A, B"). */
function groupColumns(tabs: { assignments: boolean; attendance: boolean }) {
  const cols: { tab: string; col: string; first: number; list: boolean }[] = [
    { tab: TAB.athletes, col: "F", first: 6, list: false },
    { tab: TAB.library, col: "C", first: 6, list: false },
    { tab: TAB.log, col: "B", first: 5, list: true },
  ];
  if (tabs.assignments) cols.push({ tab: OPTIONAL_TAB.assignments, col: "B", first: 2, list: false });
  if (tabs.attendance) cols.push({ tab: OPTIONAL_TAB.attendance, col: "C", first: 2, list: false });
  return cols;
}

/**
 * Saves team settings to the Sheet, renaming groups everywhere they're used. `current` is
 * what the form started from. If another coach changed the groups meanwhile, nothing is
 * saved: renaming from a list that's out of date could rename the wrong things.
 * Resolves to how many cells were renamed.
 */
export async function saveTeamSetup(sheet: SheetWriter, t: TeamSetup, current: SeasonSettings,
  tabs: { assignments: boolean; attendance: boolean }): Promise<number> {
  const clean: TeamSetup = { ...t, groups: t.groups.map((g) => ({ ...g, name: g.name.trim() })) };
  const inSheet = (await sheet.read(`${S}!B${SETTINGS.groupFirstRow}:B${SETTINGS.groupLastRow}`))
    .map((r) => String(r[0] ?? "").trim()).filter(Boolean);
  if (inSheet.map(norm).join("|") !== current.tierNames.map(norm).join("|")) {
    throw new SaveError("Another coach changed the groups while you were editing, so nothing was saved. Close this, and open Team settings again to see their change.");
  }

  const writes: ValueRange[] = [];
  const map = renames(clean);
  if (map.size) {
    const cols = groupColumns(tabs);
    const values = await sheet.readMany(cols.map((c) => `'${c.tab}'!${c.col}${c.first}:${c.col}`));
    cols.forEach((c, i) => values[i].forEach((row, k) => {
      const to = renamed(row[0], map, c.list);
      if (to !== null) writes.push({ range: `'${c.tab}'!${c.col}${c.first + k}:${c.col}${c.first + k}`, values: [[to]] });
    }));
  }
  // One request: the new names and every renamed cell land together.
  await sheet.write([...settingsWrites(clean), ...writes]);
  return writes.length;
}
