// Two coaches saving at about the same time, against one simulated Sheet.
import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type Rows } from "../src/core/schema/parse";
import { recordFor, saveAthleteDay, saveDay } from "../src/core/logic/attendance";
import { coachForGroup, saveAssignment } from "../src/core/logic/assignments";
import { ConflictError, saveChange, type AthleteInput, type SheetWriter, type ValueRange } from "../src/core/writes";

function setUp() {
  const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const sheet = memorySheet(raw);
  const writes: ValueRange[][] = [];
  const watched: SheetWriter = { ...sheet, write: (d) => { writes.push(d); return sheet.write(d); } };
  return { raw, sheet: watched, writes, team: () => parseTeamData(raw) };
}
const input = (a: ReturnType<ReturnType<typeof setUp>["team"]>["athletes"][number]): AthleteInput => {
  const { row: _r, id: _i, fullName: _f, ...rest } = a;
  return rest;
};

describe("two coaches editing the same row", () => {
  it("different fields: both changes are kept, and only changed cells are written", async () => {
    const { sheet, writes, team } = setUp();
    const opened = team().athletes[0]; // both coaches open Alex's profile
    await saveChange(sheet, { table: "athletes", row: opened.row, was: opened, value: { ...input(opened), notes: "B: working on slab" } });
    await saveChange(sheet, { table: "athletes", row: opened.row, was: opened, value: { ...input(opened), currentFlashGrade: "V7" } });
    expect(team().athletes[0]).toMatchObject({ notes: "B: working on slab", currentFlashGrade: "V7" });
    expect(writes.map((w) => w.map((r) => r.range))).toEqual([["'Athlete Profiles'!N6:N6"], ["'Athlete Profiles'!G6:G6"]]);
  });

  it("the same field: stops with both versions, then keeps whichever the coach picks", async () => {
    const { sheet, team } = setUp();
    const opened = team().athletes[0];
    await saveChange(sheet, { table: "athletes", row: opened.row, was: opened, value: { ...input(opened), notes: "Theirs" } });
    const mine = { table: "athletes" as const, row: opened.row, was: opened, value: { ...input(opened), notes: "Mine", goalGrade: "V9" } };
    const err = await saveChange(sheet, mine).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).conflicts).toEqual([{ label: "Notes", theirs: "Theirs", mine: "Mine" }]);
    expect(team().athletes[0].notes).toBe("Theirs"); // nothing written yet

    await saveChange(sheet, mine, { resolve: "theirs" });
    expect(team().athletes[0]).toMatchObject({ notes: "Theirs", goalGrade: "V9" }); // my other change still saved
    await saveChange(sheet, mine, { resolve: "mine" });
    expect(team().athletes[0].notes).toBe("Mine");
  });

  it("a workout block: moving it 5 minutes while someone edits its notes keeps both", async () => {
    const { sheet, team } = setUp();
    const b = team().log[0];
    const { row: _r, ...v } = b;
    await saveChange(sheet, { table: "log", row: b.row, was: b, value: { ...v, notes: "Use the cave" } });
    await saveChange(sheet, { table: "log", row: b.row, was: b, value: { ...v, minutes: 50 } });
    expect(team().log[0]).toMatchObject({ notes: "Use the cave", minutes: 50 });
  });
});

describe("two coaches adding at the same moment", () => {
  it("if both land on the same empty row, the second record moves to the next free row", async () => {
    const { raw, team } = setUp();
    const mem = memorySheet(raw);
    let first = true;
    // Coach A's write is immediately followed by coach B writing the same row (B got there too).
    const coachA: SheetWriter = { ...mem, write: async (d) => {
      await mem.write(d);
      if (first) { first = false; await mem.write([{ range: "'Athlete Profiles'!B8:C8", values: [["Blake", "Kim"]] }]); }
    } };
    const riley: AthleteInput = { firstName: "Riley", lastName: "Chen", tier: "Intermediate", currentFlashGrade: "", goalGrade: "", strengths: "", growthAreas: "", currentFocus: "", joinDate: null, status: "Active", notes: "" };
    expect(await saveChange(coachA, { table: "athletes", row: null, value: riley })).toBe(9);
    expect(team().athletes.map((a) => [a.row, a.fullName])).toEqual([[6, "Alex Rivera"], [7, "Sam Nguyen"], [8, "Blake Kim"], [9, "Riley Chen"]]);
  });

  it("two coaches tapping Save workout together record each athlete once", async () => {
    const { raw, sheet, team } = setUp();
    const data = team();
    await Promise.all([saveDay(sheet, data, "2026-09-22", false), saveDay(sheet, data, "2026-09-22", false)]);
    const rows = raw.attendance.slice(1).filter((r) => r.some((c) => String(c ?? "") !== ""));
    expect(rows.map((r) => r[1]).sort()).toEqual(["Alex Rivera", "Sam Nguyen"]);
  });
});

describe("attendance and group claims", () => {
  const DAY = "2026-09-22";
  it("one coach marks an athlete absent while another adds a note: both kept", async () => {
    const { sheet, team } = setUp();
    await saveDay(sheet, team(), DAY, false);
    const start = { group: "Advanced", here: true, notes: "" };
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { ...start, notes: "Left early" }, start, true);
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { ...start, here: false }, start, true);
    expect(recordFor(team(), DAY, "Alex Rivera")).toMatchObject({ here: false, notes: "Left early" });
  });

  it("two notes on the same athlete-day conflict", async () => {
    const { sheet, team } = setUp();
    await saveDay(sheet, team(), DAY, false);
    const start = { group: "Advanced", here: true, notes: "" };
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { ...start, notes: "Theirs" }, start, true);
    await expect(saveAthleteDay(sheet, DAY, "Alex Rivera", { ...start, notes: "Mine" }, start, true)).rejects.toBeInstanceOf(ConflictError);
    await saveAthleteDay(sheet, DAY, "Alex Rivera", { ...start, notes: "Mine" }, start, true, "mine");
    expect(recordFor(team(), DAY, "Alex Rivera")?.notes).toBe("Mine");
  });

  it("claiming a group someone just claimed asks first", async () => {
    const { sheet, team } = setUp();
    await saveAssignment(sheet, DAY, "Advanced", "Jordan Lee", false, null);
    await expect(saveAssignment(sheet, DAY, "Advanced", "Taylor Brooks", true, null)).rejects.toBeInstanceOf(ConflictError);
    expect(coachForGroup(team(), DAY, "Advanced")).toBe("Jordan Lee");
    await saveAssignment(sheet, DAY, "Advanced", "Taylor Brooks", true, null, "mine");
    expect(coachForGroup(team(), DAY, "Advanced")).toBe("Taylor Brooks");
  });
});

