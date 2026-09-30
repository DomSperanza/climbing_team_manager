// The Sheet's own conveniences for people who edit it directly — its Group dropdowns and the
// row colors per group — kept in step with however many groups the team has (up to nine;
// the original workbook assumed exactly three). Pure: this builds the Sheets API
// "batchUpdate" requests from what the Sheet has now; google/sheets.ts sends them.
//
// None of this is needed for the app to work (it reads and writes values only), so the app
// sends it after saving, and a failure only means the Sheet's dropdowns are behind.
//
// What it sets up:
// - Dropdown lists: groups from Settings!B5:B13; groups + "All Team" (workout blocks) and
//   groups + "All Levels" (exercises) from two FILTER formulas in Settings!E34 / F34, so
//   renaming or adding a group right in the Sheet updates every dropdown too.
// - Row colors: one rule per group slot on Athlete Profiles, Exercise Library and Day View,
//   using the app's colors. Old group rules (any rule that mentions Settings) are replaced.
// - A new Sheet also loses the old Thursday rotation tabs, which the app doesn't use.

import { MAX_GROUPS, SETTINGS, TAB } from "./schema/layout";

export interface SheetInfo {
  sheets: { properties: { sheetId: number; title: string }; conditionalFormats?: ConditionalRule[] }[];
  namedRanges?: { namedRangeId: string; name: string }[];
}
interface ConditionalRule { booleanRule?: { condition?: { values?: { userEnteredValue?: string }[] } } }
type Request = Record<string, unknown>;

/** The light background of each group color in the app (ui/theme.ts), in Settings order. */
export const GROUP_FILLS = ["#fde9dd", "#e1ecfb", "#e2f2e3", "#fbe4ef", "#dcf2ef", "#fbf0cc", "#f3e6dc", "#ecf4d6", "#e5e9ef"];
const INPUT_YELLOW = "#fff2cc";

const ROTATION_TABS = ["Rotation Schedule", "Full Team Calendar"];
const HELPER_FIRST_ROW = 34; // E34:E43 and F34:F43 (nine groups + one "everyone" entry)
const HELPER_LAST_ROW = HELPER_FIRST_ROW + MAX_GROUPS;

const rgb = (hex: string) => ({
  red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255,
});
const col = (letter: string) => letter.charCodeAt(0) - 65;
/** A1-style box → GridRange (rows and columns 1-based and inclusive, like the Sheet shows them). */
const grid = (sheetId: number, c1: string, r1: number, c2: string, r2: number) =>
  ({ sheetId, startRowIndex: r1 - 1, endRowIndex: r2, startColumnIndex: col(c1), endColumnIndex: col(c2) + 1 });
const text = (s: string) => ({ userEnteredValue: { stringValue: s } });
const formula = (f: string) => ({ userEnteredValue: { formulaValue: f } });
const blank = {};

/** Every request, in the order they must run (one batchUpdate is all-or-nothing). */
export function layoutRequests(info: SheetInfo, opts: { newSheet: boolean }): Request[] {
  const ids = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const id = (title: string) => ids.get(title);
  const settings = id(TAB.settings);
  if (settings === undefined) return [];
  const g1 = SETTINGS.groupFirstRow, g2 = SETTINGS.groupLastRow;
  const groups = `Settings!$B$${g1}:$B$${g2}`;
  const req: Request[] = [];

  // Helper lists for the dropdowns: labels in row 33, one spilling formula each in row 34.
  const helper = (everyone: string) => formula(`={FILTER(${groups},${groups}<>"");"${everyone}"}`);
  req.push({ updateCells: {
    range: grid(settings, "E", HELPER_FIRST_ROW - 1, "F", HELPER_LAST_ROW),
    rows: [
      { values: [text("Groups + All Team (for dropdowns)"), text("Groups + All Levels (for dropdowns)")] },
      { values: [helper("All Team"), helper("All Levels")] },
      ...Array.from({ length: HELPER_LAST_ROW - HELPER_FIRST_ROW }, () => ({ values: [blank, blank] })),
    ],
    fields: "userEnteredValue",
  } });

  // Named ranges (for anything in the Sheet that uses them), pointing at the full lists.
  const named = new Map((info.namedRanges ?? []).map((n) => [n.name, n.namedRangeId]));
  const setNamed = (name: string, range: object) => {
    const namedRangeId = named.get(name);
    req.push(namedRangeId
      ? { updateNamedRange: { namedRange: { namedRangeId, name, range }, fields: "range" } }
      : { addNamedRange: { namedRange: { name, range } } });
  };
  setNamed("GroupNamesRange", grid(settings, "B", g1, "B", g2));
  setNamed("GroupPlusAllTeam", grid(settings, "E", HELPER_FIRST_ROW, "E", HELPER_LAST_ROW));
  setNamed("GroupPlusAllLevels", grid(settings, "F", HELPER_FIRST_ROW, "F", HELPER_LAST_ROW));

  // Dropdowns. Not strict: the app writes shared blocks as "Intermediate, Developing".
  const dropdown = (title: string, c: string, r1: number, r2: number, source: string) => {
    const sheetId = id(title);
    if (sheetId === undefined) return;
    req.push({ setDataValidation: { range: grid(sheetId, c, r1, c, r2), rule: {
      condition: { type: "ONE_OF_RANGE", values: [{ userEnteredValue: "=" + source }] }, strict: false, showCustomUi: true,
    } } });
  };
  dropdown(TAB.athletes, "F", 6, 37, groups);
  dropdown(TAB.log, "B", 5, 200, `Settings!$E$${HELPER_FIRST_ROW}:$E$${HELPER_LAST_ROW}`);
  dropdown(TAB.library, "C", 6, 120, `Settings!$F$${HELPER_FIRST_ROW}:$F$${HELPER_LAST_ROW}`);

  // Row colors by group. Other sheets can only be reached through INDIRECT in a color rule.
  const colorRows = (title: string, box: [string, number, string, number], groupCol: string) => {
    const s = info.sheets.find((x) => x.properties.title === title);
    if (!s) return;
    const rules = s.conditionalFormats ?? [];
    const old = rules.map((r, i) => (mentionsSettings(r) ? i : -1)).filter((i) => i >= 0);
    for (const index of [...old].reverse()) req.push({ deleteConditionalFormatRule: { sheetId: s.properties.sheetId, index } });
    const kept = rules.length - old.length;
    const [c1, r1, c2, r2] = box;
    GROUP_FILLS.forEach((fill, i) => {
      const cell = `$${groupCol}${r1}`;
      req.push({ addConditionalFormatRule: { index: kept + i, rule: {
        ranges: [grid(s.properties.sheetId, c1, r1, c2, r2)],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: `=AND(${cell}<>"",${cell}=INDIRECT("Settings!B${g1 + i}"))` }] },
          format: { backgroundColor: rgb(fill) },
        },
      } } });
    });
  };
  colorRows(TAB.athletes, ["A", 6, "N", 37], "F");
  colorRows(TAB.library, ["A", 6, "I", 120], "C");
  colorRows("Day View", ["A", 9, "D", 53], "G");

  // The cells to fill in on Settings are yellow, including the new group rows and Practice days.
  const yellow = (c: string, r1: number, r2: number) => req.push({ repeatCell: {
    range: grid(settings, c, r1, c, r2), cell: { userEnteredFormat: { backgroundColor: rgb(INPUT_YELLOW) } }, fields: "userEnteredFormat.backgroundColor",
  } });
  yellow("B", g1, g2);
  yellow("B", SETTINGS.practiceDaysRow, SETTINGS.practiceDaysRow);

  // Athlete Profiles' head count, for every group rather than the first three.
  const athletes = id(TAB.athletes);
  if (athletes !== undefined) {
    req.push({ updateCells: {
      range: grid(athletes, "B", 3, "G", 3),
      rows: [{ values: [formula(`=TEXTJOIN("   ",TRUE,ARRAYFORMULA(IF(${groups}="","",${groups}&": "&COUNTIF($F$6:$F$200,${groups}))))`), blank, blank, blank, blank, blank] }],
      fields: "userEnteredValue",
    } });
  }

  if (opts.newSheet) {
    // The Thursday rotation (featured tier, lead-coach cycle) was dropped from the app; a new
    // team doesn't get its tabs. Day View's header line read from them, so it changes first.
    const dayView = id("Day View");
    if (dayView !== undefined) {
      req.push({ updateCells: { range: grid(dayView, "A", 5, "A", 5), rows: [{ values: [formula(`="Practice plan for "&TEXT($B$4,"dddd, mmmm d")`)] }], fields: "userEnteredValue" } });
    }
    for (const title of ROTATION_TABS) {
      const sheetId = id(title);
      if (sheetId !== undefined) req.push({ deleteSheet: { sheetId } });
    }
    // Settings rows only the rotation used, and the old three-group dropdown helpers.
    const clearBox = (c1: string, r1: number, c2: string, r2: number) =>
      req.push({ updateCells: { range: grid(settings, c1, r1, c2, r2), fields: "userEnteredValue" } });
    clearBox("A", 16, "B", 17);
    clearBox("A", 25, "C", 37);
    // Coach Profiles counted coaches per Mon/Tue/Thu; count active coaches instead.
    const coaches = id(TAB.coaches);
    if (coaches !== undefined) {
      req.push({ updateCells: {
        range: grid(coaches, "B", 3, "G", 3),
        rows: [{ values: [formula(`="Active coaches: "&COUNTIFS($B$6:$B$19,"<>",$N$6:$N$19,"Active")`), blank, blank, blank, blank, blank] }],
        fields: "userEnteredValue",
      } });
    }
  }
  return req;
}

function mentionsSettings(r: ConditionalRule): boolean {
  return (r.booleanRule?.condition?.values ?? []).some((v) => /Settings!/i.test(v.userEnteredValue ?? ""));
}
