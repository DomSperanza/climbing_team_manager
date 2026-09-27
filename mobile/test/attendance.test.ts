import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "../src/core/schema/parse";
import { athleteHistory, recordFor, saveAthleteDay, saveDay, unrecorded, workoutFor } from "../src/core/logic/attendance";
import { saveChange, type SheetWriter } from "../src/core/writes";

// The demo day: Tue Sep 22 has four Advanced blocks. Alex Rivera is Advanced, Sam Nguyen Developing.
const DAY = "2026-09-22";

function setUp() {
  const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const mem = memorySheet(raw);
  const tabsAdded: string[] = [];
  const sheet: SheetWriter = { ...mem, addTab: async (t) => { tabsAdded.push(t); } };
  return { raw, sheet, tabsAdded, team: () => parseTeamData(raw) };
}
const filledRows = (raw: RawRanges) => raw.attendance.slice(1).filter((r) => r.some((c) => String(c ?? "") !== ""));

describe("saving a practice for the athletes", () => {
  it("records every active athlete in their usual group, adding the tab once", async () => {
    const { raw, sheet, tabsAdded, team } = setUp();
    expect(await saveDay(sheet, team(), DAY, false)).toBe(2);
    expect(tabsAdded).toEqual(["Attendance"]);
    expect(raw.attendance[0]).toEqual(["Date", "Athlete", "Group", "Here", "Notes"]);
    expect(recordFor(team(), DAY, "Alex Rivera")).toMatchObject({ group: "Advanced", here: true, notes: "" });
    expect(recordFor(team(), DAY, "Sam Nguyen")).toMatchObject({ group: "Developing", here: true });
  });

  it("each athlete gets their group's blocks plus All Team ones, in time order", async () => {
    const { sheet, team } = setUp();
    // Add an All Team block and a Developing block to the day.
    await saveChange(sheet, { table: "log", row: null, value: { date: DAY, group: "All Team", libraryItem: "", blockType: "Stretch/Cooldown", description: "Team stretch", setsRepsDuration: "", coach: "", notes: "", minutes: 10, order: 5 } });
    await saveChange(sheet, { table: "log", row: null, value: { date: DAY, group: "Developing", libraryItem: "", blockType: "Technique/Skill", description: "Footwork", setsRepsDuration: "", coach: "", notes: "", minutes: 30, order: 6 } });
    const adv = workoutFor(team(), DAY, "Advanced").map((t) => t.block.libraryItem || t.block.blockType);
    const dev = workoutFor(team(), DAY, "Developing").map((t) => t.block.blockType);
    expect(adv).toEqual(["Warm-up", "Power", "Foot Cut Drill", "Core", "Stretch/Cooldown"]);
    expect(dev).toEqual(["Stretch/Cooldown", "Technique/Skill"]);
  });

  it("saving again only adds who's missing — absences and group changes stay", async () => {
    const { raw, sheet, team } = setUp();
    await saveDay(sheet, team(), DAY, false);
    await saveAthleteDay(sheet, DAY, "Sam Nguyen", { group: "Developing", here: false, notes: "" }, true);
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { group: "Intermediate", here: true, notes: "Fingers sore, skipped hangs" }, true);
    expect(await saveDay(sheet, team(), DAY, true)).toBe(0);
    expect(filledRows(raw)).toHaveLength(2);
    expect(recordFor(team(), DAY, "Sam Nguyen")?.here).toBe(false);
    expect(recordFor(team(), DAY, "Alex Rivera")).toMatchObject({ group: "Intermediate", notes: "Fingers sore, skipped hangs" });
    expect(unrecorded(team(), DAY)).toEqual([]);
  });

  it("an athlete's history: newest first, with what they did; absent days have no blocks", async () => {
    const { sheet, team } = setUp();
    await saveDay(sheet, team(), DAY, false);
    await saveAthleteDay(sheet, "2026-09-24", "Alex Rivera", { group: "Advanced", here: false, notes: "" }, true);
    const alex = team().athletes.find((a) => a.fullName === "Alex Rivera")!;
    const history = athleteHistory(team(), alex);
    expect(history.map((h) => [h.entry.date, h.entry.here, h.blocks.length])).toEqual([["2026-09-24", false, 0], [DAY, true, 4]]);
    // Moved to Developing for the day → only All Team blocks (none on the demo day besides Advanced ones).
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { group: "Developing", here: true, notes: "" }, true);
    expect(athleteHistory(team(), alex).find((h) => h.entry.date === DAY)!.blocks).toEqual([]);
  });

  it("doesn't record inactive athletes", async () => {
    const { raw, sheet, team } = setUp();
    raw.athletes[2][12] = "Inactive"; // Sam Nguyen (row 7) → Status column
    expect(unrecorded(team(), DAY).map((a) => a.fullName)).toEqual(["Alex Rivera"]);
    expect(await saveDay(sheet, team(), DAY, false)).toBe(1);
  });
});
