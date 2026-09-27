import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "../src/core/schema/parse";
import { RANGE_KEYS, rangeKeysFor } from "../src/core/schema/layout";
import { coachForGroup, dayCoaching, saveAssignment } from "../src/core/logic/assignments";
import type { SheetWriter } from "../src/core/writes";

const THU = "2026-09-24"; // Taylor Brooks is the only Thursday coach
const TUE = "2026-09-22";

function setUp() {
  const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const mem = memorySheet(raw);
  const tabsAdded: string[] = [];
  const sheet: SheetWriter = { ...mem, addTab: async (t) => { tabsAdded.push(t); } };
  return { raw, sheet, tabsAdded, team: () => parseTeamData(raw) };
}
const assignmentRows = (raw: RawRanges) => raw.assignments.slice(1).filter((r) => r.some((c) => String(c ?? "") !== ""));

describe("who's coaching a day", () => {
  it("everyone set for that weekday is on; the lead and groups start open", () => {
    const { team } = setUp();
    const thu = dayCoaching(team(), THU);
    expect(thu.onDuty.map((c) => c.fullName)).toEqual(["Taylor Brooks"]);
    expect(thu.lead).toBeNull();
    expect(thu.groups).toEqual([{ group: "Advanced", coach: null }, { group: "Intermediate", coach: null }, { group: "Developing", coach: null }]);
    expect(dayCoaching(team(), TUE).onDuty.map((c) => c.fullName)).toEqual(["Jordan Lee"]);
  });

  it("claiming a group adds the tab (once) and a row; claiming again updates that row", async () => {
    const { raw, sheet, tabsAdded, team } = setUp();
    await saveAssignment(sheet, THU, "Advanced", "Jordan Lee", false);
    expect(tabsAdded).toEqual(["Coach Assignments"]);
    expect(raw.assignments[0]).toEqual(["Date", "Group", "Coach"]);
    expect(coachForGroup(team(), THU, "Advanced")).toBe("Jordan Lee");

    await saveAssignment(sheet, THU, "advanced", "Taylor Brooks", true, "Jordan Lee"); // same group, any case
    expect(assignmentRows(raw)).toHaveLength(1);
    expect(coachForGroup(team(), THU, "Advanced")).toBe("Taylor Brooks");
    expect(tabsAdded).toHaveLength(1);
  });

  it("setting and clearing the lead", async () => {
    const { sheet, team } = setUp();
    await saveAssignment(sheet, THU, "All Team", "Jordan Lee", false);
    expect(dayCoaching(team(), THU).lead).toBe("Jordan Lee");
    expect(coachForGroup(team(), THU, "All Team")).toBe("Jordan Lee");
    await saveAssignment(sheet, THU, "All Team", null, true, "Jordan Lee");
    expect(dayCoaching(team(), THU).lead).toBeNull();
  });

  it("claims are per date and reuse emptied rows", async () => {
    const { raw, sheet, team } = setUp();
    await saveAssignment(sheet, THU, "Intermediate", "Jordan Lee", false);
    await saveAssignment(sheet, TUE, "Intermediate", "Taylor Brooks", true);
    expect(coachForGroup(team(), THU, "Intermediate")).toBe("Jordan Lee");
    expect(coachForGroup(team(), TUE, "Intermediate")).toBe("Taylor Brooks");
    await saveAssignment(sheet, THU, "Intermediate", null, true, "Jordan Lee");
    await saveAssignment(sheet, THU, "Developing", "Jordan Lee", true);
    expect(assignmentRows(raw)).toHaveLength(2); // the cleared row was reused
  });
});

describe("Sheets without the Coach Assignments tab", () => {
  it("still load — the tab is only fetched when it exists", () => {
    expect(rangeKeysFor(["Settings", "Log a Workout"])).not.toContain("assignments");
    expect(rangeKeysFor(["Coach Assignments"])).toContain("assignments");
    const keys = RANGE_KEYS.filter((k) => k !== "assignments");
    const raw = rawFromValueRanges(demo.valueRanges.slice(0, keys.length) as { values?: Rows }[], keys);
    expect(parseTeamData(raw).assignments).toEqual([]);
  });
});
