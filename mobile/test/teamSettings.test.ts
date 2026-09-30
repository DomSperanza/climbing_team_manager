import { beforeEach, describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "../src/core/schema/parse";
import { saveAssignment } from "../src/core/logic/assignments";
import { saveDay } from "../src/core/logic/attendance";
import { coachDays, otherDaysNote, withCoachDay } from "../src/core/logic/coachDays";
import { saveChange, SaveError, type SheetWriter } from "../src/core/writes";
import { saveTeamSetup, setupFromSettings, validateTeamSetup, type TeamSetup } from "../src/core/teamSettings";
import { GROUP_FILLS, layoutRequests, type SheetInfo } from "../src/core/sheetLayout";

// Team settings are saved to a copy of the example workbook — the original three-group,
// Mon/Tue/Thu layout, exactly like the team's real Sheet — then parsed back.
let raw: RawRanges;
let sheet: SheetWriter;
const team = () => parseTeamData(raw);
const DAY = "2026-09-22";

beforeEach(() => {
  raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  sheet = memorySheet(raw);
});

const edit = (fn: (t: TeamSetup) => TeamSetup) => fn(setupFromSettings(team().settings));
const save = (t: TeamSetup) => saveTeamSetup(sheet, t, team().settings, { assignments: raw.assignments.length > 0, attendance: raw.attendance.length > 0 });

describe("team settings", () => {
  it("reads the original workbook's settings back unchanged when nothing is edited", async () => {
    const before = team().settings;
    await save(setupFromSettings(before));
    expect(team().settings).toEqual({ ...before });
    expect(team().settings.practiceDays).toEqual(["Monday", "Tuesday", "Thursday"]);
  });

  it("adds groups, changes days and times", async () => {
    await save(edit((t) => ({
      ...t,
      groups: [...t.groups, { name: "Youth", was: null }, { name: "Masters", was: null }],
      practiceDays: ["Wednesday", "Monday"],
      start: 16 * 60, end: 18 * 60, warmupMinutes: 20, cooldownMinutes: 10,
    })));
    const s = team().settings;
    expect(s.tierNames).toEqual(["Advanced", "Intermediate", "Developing", "Youth", "Masters"]);
    expect(s.practiceDays).toEqual(["Monday", "Wednesday"]);
    expect(s.practice).toEqual({ start: 960, end: 1080, warmupMinutes: 20, tierBlockMinutes: 90, cooldownMinutes: 10 });
    // The Sheet shows it in words.
    const cell = (r: number, c: number) => raw.settings[r - 1][c];
    expect([cell(8, 0), cell(8, 1), cell(24, 0), cell(24, 1), cell(18, 1)]).toEqual(["Group 4", "Youth", "Practice days", "Mon, Wed", "4:00 PM"]);
  });

  it("renames a group everywhere it's used", async () => {
    const data = team();
    // Give the day some history: a shared block, a claim and attendance, all using "Developing".
    await saveChange(sheet, { table: "log", row: null, value: {
      date: DAY, group: "Intermediate, Developing", libraryItem: "", blockType: "Power", description: "Shared",
      setsRepsDuration: "", coach: "", notes: "", minutes: 30, order: 9,
    } });
    await saveAssignment(sheet, DAY, "Developing", "Taylor Brooks", false);
    await saveDay(sheet, team(), DAY, false);
    const libraryDeveloping = data.library.filter((e) => e.tier === "Developing").length;

    const renamed = await save(edit((t) => ({ ...t, groups: t.groups.map((g) => (g.name === "Developing" ? { ...g, name: "Foundations" } : g)) })));

    const after = team();
    expect(after.settings.tierNames).toEqual(["Advanced", "Intermediate", "Foundations"]);
    expect(after.athletes.find((a) => a.fullName === "Sam Nguyen")!.tier).toBe("Foundations");
    expect(after.library.filter((e) => e.tier === "Foundations")).toHaveLength(libraryDeveloping);
    expect(after.library.some((e) => e.tier === "Developing")).toBe(false);
    expect(after.log.find((b) => b.description === "Shared")!.group).toBe("Intermediate, Foundations");
    expect(after.assignments.map((a) => a.group)).toEqual(["Foundations"]);
    expect(after.attendance.find((a) => a.athlete === "Sam Nguyen")!.group).toBe("Foundations");
    expect(after.log.filter((b) => b.group === "All Team").length).toBe(data.log.filter((b) => b.group === "All Team").length);
    expect(renamed).toBeGreaterThan(libraryDeveloping);
  });

  it("reorders groups without renaming anything", async () => {
    const renamed = await save(edit((t) => ({ ...t, groups: [...t.groups].reverse() })));
    expect(renamed).toBe(0);
    expect(team().settings.tierNames).toEqual(["Developing", "Intermediate", "Advanced"]);
  });

  it("won't remove a group that still has active athletes, but removes an empty one", () => {
    const t = team();
    const without = (name: string) => edit((x) => ({ ...x, groups: x.groups.filter((g) => g.was !== name) }));
    expect(validateTeamSetup(without("Developing"), t.athletes, t.settings.tierNames)).toMatch(/1 active athlete is still in Developing/);
    expect(validateTeamSetup(without("Intermediate"), t.athletes, t.settings.tierNames)).toBeNull();
  });

  it("saves nothing if another coach changed the groups meanwhile", async () => {
    const mine = edit((t) => ({ ...t, groups: t.groups.map((g, i) => (i === 0 ? { ...g, name: "Elite" } : g)) }));
    const startedFrom = team().settings;
    await sheet.write([{ range: "'Settings'!B7:B7", values: [["Rising"]] }]); // someone renames in the Sheet
    await expect(saveTeamSetup(sheet, mine, startedFrom, { assignments: false, attendance: false })).rejects.toThrow(SaveError);
    expect(team().settings.tierNames).toEqual(["Advanced", "Intermediate", "Rising"]);
    expect(team().athletes[0].tier).toBe("Advanced");
  });
});

describe("coach days", () => {
  const coach = { coachesMonday: true, coachesTuesday: false, coachesThursday: false, otherDays: "some Saturdays" };

  it("combines the Mon/Tue/Thu columns with days named in Other Days", () => {
    expect(coachDays(coach)).toEqual(["Monday", "Saturday"]);
  });

  it("puts days without a column in Other Days, keeping whatever else it said", () => {
    const wed = withCoachDay(coach, "Wednesday", true);
    expect(wed.otherDays).toBe("some Saturdays, Wed");
    expect(coachDays(wed)).toEqual(["Monday", "Wednesday", "Saturday"]);
    expect(withCoachDay(wed, "Wednesday", false).otherDays).toBe("some Saturdays");
    expect(withCoachDay({ ...coach, otherDays: "Wed, Fri" }, "Wednesday", false).otherDays).toBe("Fri");
    expect(withCoachDay(coach, "Thursday", true)).toMatchObject({ coachesThursday: true, otherDays: "some Saturdays" });
    expect(withCoachDay(coach, "Monday", false).coachesMonday).toBe(false);
  });

  it("tells a note apart from a list of days", () => {
    expect(otherDaysNote("Wed, Fri")).toBe("");
    expect(otherDaysNote("Tuesdays and Thursdays")).toBe("");
    expect(otherDaysNote("some Saturdays")).toBe("some");
  });
});

describe("the Sheet's own dropdowns and colors", () => {
  const info = (withOld: boolean): SheetInfo => ({
    sheets: [
      { properties: { sheetId: 1, title: "Settings" } },
      { properties: { sheetId: 2, title: "Athlete Profiles" }, conditionalFormats: [
        { booleanRule: { condition: { values: [{ userEnteredValue: "=O6=TRUE" }] } } },
        ...(withOld ? [1, 2, 3].map((n) => ({ booleanRule: { condition: { values: [{ userEnteredValue: `=$F6=Settings!$B$${n + 4}` }] } } })) : []),
      ] },
      { properties: { sheetId: 3, title: "Log a Workout" } },
      { properties: { sheetId: 4, title: "Exercise Library" } },
      { properties: { sheetId: 5, title: "Rotation Schedule" } },
      { properties: { sheetId: 6, title: "Full Team Calendar" } },
      { properties: { sheetId: 7, title: "Day View" } },
    ],
    namedRanges: [{ namedRangeId: "g", name: "GroupNamesRange" }],
  });
  const kinds = (reqs: object[]) => reqs.map((r) => Object.keys(r)[0]);

  it("replaces the old three group colors with one rule per group slot, after the rules it keeps", () => {
    const reqs = layoutRequests(info(true), { newSheet: false });
    const deletes = reqs.filter((r) => "deleteConditionalFormatRule" in r).map((r) => (r as { deleteConditionalFormatRule: { index: number } }).deleteConditionalFormatRule);
    expect(deletes.filter((d) => (d as unknown as { sheetId: number }).sheetId === 2).map((d) => d.index)).toEqual([3, 2, 1]); // highest first
    const adds = reqs.filter((r) => "addConditionalFormatRule" in r) as { addConditionalFormatRule: { index: number; rule: { ranges: { sheetId: number }[] } } }[];
    const athleteAdds = adds.filter((a) => a.addConditionalFormatRule.rule.ranges[0].sheetId === 2);
    expect(athleteAdds.map((a) => a.addConditionalFormatRule.index)).toEqual(GROUP_FILLS.map((_, i) => 1 + i));
    expect(JSON.stringify(athleteAdds[8])).toContain('INDIRECT(\\"Settings!B13\\")');
    // Running it again replaces its own rules rather than piling up more.
    expect(JSON.stringify(reqs)).toContain("GroupNamesRange");
  });

  it("updates named ranges that exist and adds the ones that don't", () => {
    const reqs = layoutRequests(info(false), { newSheet: false });
    expect(reqs.filter((r) => "updateNamedRange" in r)).toHaveLength(1);
    expect(reqs.filter((r) => "addNamedRange" in r)).toHaveLength(2);
    expect(reqs.filter((r) => "setDataValidation" in r)).toHaveLength(3);
  });

  it("removes the rotation tabs only from a brand-new Sheet, after Day View stops using them", () => {
    expect(kinds(layoutRequests(info(false), { newSheet: false }))).not.toContain("deleteSheet");
    const reqs = layoutRequests(info(false), { newSheet: true });
    const k = kinds(reqs);
    expect(reqs.filter((r) => "deleteSheet" in r)).toEqual([{ deleteSheet: { sheetId: 5 } }, { deleteSheet: { sheetId: 6 } }]);
    const dayViewFix = reqs.findIndex((r) => JSON.stringify(r).includes("Practice plan for"));
    expect(dayViewFix).toBeGreaterThanOrEqual(0);
    expect(dayViewFix).toBeLessThan(k.indexOf("deleteSheet"));
  });

  it("does nothing to a spreadsheet without a Settings tab", () => {
    expect(layoutRequests({ sheets: [{ properties: { sheetId: 1, title: "Other" } }] }, { newSheet: true })).toEqual([]);
  });
});
