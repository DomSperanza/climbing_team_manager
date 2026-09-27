import { beforeEach, describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type RawRanges, type Rows } from "../src/core/schema/parse";
import { coachesFor } from "../src/core/logic/rotation";
import { timesUsed } from "../src/core/logic/library";
import { ROW_CHANGED_MESSAGE, SaveError, saveChange, type AthleteInput, type BlockInput, type CoachInput, type SheetWriter, type ValueRange } from "../src/core/writes";

// Every save runs against a copy of the example workbook's cells, then the result is parsed
// back exactly as the app would after a refresh.
let raw: RawRanges;
let sheet: SheetWriter;
let writes: ValueRange[][];
let clears: string[][];
const team = () => parseTeamData(raw);

beforeEach(() => {
  raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const mem = memorySheet(raw);
  writes = [];
  clears = [];
  sheet = { read: mem.read, write: (d) => { writes.push(d); return mem.write(d); }, clear: (r) => { clears.push(r); return mem.clear(r); } };
});

const athleteCell = (row: number, col: number) => raw.athletes[row - 5]?.[col];

const newAthlete: AthleteInput = {
  firstName: " Riley ", lastName: "Chen", tier: "Intermediate", currentFlashGrade: "V3", goalGrade: "V5",
  strengths: "", growthAreas: "", currentFocus: "Footwork", joinDate: "2026-09-24", status: "Active", notes: "",
};

describe("athletes", () => {
  it("adds into the first empty row, trimmed, with the Sheet's formulas filling ID and Full Name", async () => {
    const row = await saveChange(sheet, { table: "athletes", row: null, value: newAthlete });
    expect(row).toBe(8);
    const a = team().athletes.find((x) => x.row === 8)!;
    expect(a).toMatchObject({ id: 3, fullName: "Riley Chen", tier: "Intermediate", joinDate: "2026-09-24", status: "Active" });
    // Never writes A (ID), D (Full Name) or E (Age).
    expect(writes[0].map((w) => w.range)).toEqual(["'Athlete Profiles'!B8:C8", "'Athlete Profiles'!F8:N8"]);
  });

  it("edits without touching the Age column", async () => {
    const was = team().athletes[0];
    const ageBefore = athleteCell(was.row, 4);
    await saveChange(sheet, { table: "athletes", row: was.row, was, value: { ...was, currentFlashGrade: "V7", notes: "Fingers sore — easy week" } });
    expect(team().athletes[0]).toMatchObject({ currentFlashGrade: "V7", notes: "Fingers sore — easy week", fullName: was.fullName });
    expect(athleteCell(was.row, 4)).toBe(ageBefore);
  });

  it("deletes by clearing the same cells as the Sheet's own delete, leaving the row reusable", async () => {
    const was = team().athletes[0];
    await saveChange(sheet, { table: "athletes", row: was.row, was, value: null });
    expect(clears[0]).toEqual(["'Athlete Profiles'!B6:C6", "'Athlete Profiles'!E6:N6"]);
    expect(team().athletes.map((a) => a.row)).toEqual([7]);
    expect(await saveChange(sheet, { table: "athletes", row: null, value: newAthlete })).toBe(6);
  });

  it("refuses to edit a row that now holds someone else", async () => {
    const was = team().athletes[0];
    raw.athletes[was.row - 5][1] = "Somebody"; // edited in the Sheet since the app last refreshed
    await expect(saveChange(sheet, { table: "athletes", row: was.row, was, value: { ...was, goalGrade: "V9" } })).rejects.toThrow(ROW_CHANGED_MESSAGE);
    expect(writes).toHaveLength(0);
  });

  it("stops at the last row the Sheet's formulas cover", async () => {
    for (let i = 0; i < 30; i++) await saveChange(sheet, { table: "athletes", row: null, value: { ...newAthlete, firstName: "A" + i } });
    await expect(saveChange(sheet, { table: "athletes", row: null, value: newAthlete })).rejects.toThrow(/full \(its formulas stop at row 37\)/);
  });

  it("requires both names", async () => {
    await expect(saveChange(sheet, { table: "athletes", row: null, value: { ...newAthlete, lastName: " " } })).rejects.toBeInstanceOf(SaveError);
  });
});

describe("workout log", () => {
  const block: BlockInput = {
    date: "2026-10-01", group: "Advanced", libraryItem: "", blockType: "Strength", description: "Weighted pull-ups",
    setsRepsDuration: "3 x 5", coach: "Jordan Lee", notes: "",
  };

  it("adds a block that shows on that day, stored as a real date", async () => {
    const row = await saveChange(sheet, { table: "log", row: null, value: block });
    expect(writes[0][0].values[0][0]).toBeTypeOf("number"); // a date serial, not text
    expect(team().log.filter((b) => b.date === "2026-10-01")).toEqual([{ row, ...block }]);
  });

  it("counts toward the library's Times Used when picked from the library", async () => {
    const ex = team().library[0];
    const before = timesUsed(team().log, ex.name);
    await saveChange(sheet, { table: "log", row: null, value: { ...block, libraryItem: ex.name } });
    expect(timesUsed(team().log, ex.name)).toBe(before + 1);
  });

  it("edits and deletes a block, checking the row first", async () => {
    const was = team().log[0];
    await saveChange(sheet, { table: "log", row: was.row, was, value: { ...was, notes: "Moved to the cave" } });
    expect(team().log[0].notes).toBe("Moved to the cave");
    const now = team().log[0];
    await saveChange(sheet, { table: "log", row: now.row, was: now, value: null });
    expect(clears.at(-1)).toEqual([`'Log a Workout'!A${now.row}:H${now.row}`]);
    expect(team().log.find((b) => b.row === now.row)).toBeUndefined();
  });

  it("needs a date, a group and something to do", async () => {
    await expect(saveChange(sheet, { table: "log", row: null, value: { ...block, group: "" } })).rejects.toThrow("Pick a group.");
    await expect(saveChange(sheet, { table: "log", row: null, value: { ...block, blockType: "", description: "" } })).rejects.toThrow(/Pick an exercise/);
  });
});

describe("coaches, library and progress", () => {
  it("a new Thursday coach joins the Thursday rotation in row order", async () => {
    const coach: CoachInput = {
      firstName: "Casey", lastName: "Park", role: "Coach", coachesMonday: false, coachesTuesday: false, coachesThursday: true,
      otherDays: "", email: "", phone: "", specialties: "", bio: "", status: "Active",
    };
    const before = coachesFor(team().coaches, "Thursday").map((c) => c.fullName);
    await saveChange(sheet, { table: "coaches", row: null, value: coach });
    expect(coachesFor(team().coaches, "Thursday").map((c) => c.fullName)).toEqual([...before, "Casey Park"]);
    expect(writes[0][1].values[0].slice(1, 4)).toEqual(["No", "No", "Yes"]);
  });

  it("adds, renames and deletes a library exercise", async () => {
    const value = { blockType: "Core", tier: "All Levels", name: "Hollow hold", description: "", setsRepsDuration: "3 x 30s", equipment: "", notesSource: "" };
    const row = await saveChange(sheet, { table: "library", row: null, value });
    let e = team().library.find((x) => x.row === row)!;
    expect(e.name).toBe("Hollow hold");
    await saveChange(sheet, { table: "library", row, was: e, value: { ...value, name: "Hollow body hold" } });
    e = team().library.find((x) => x.row === row)!;
    expect(e.name).toBe("Hollow body hold");
    await saveChange(sheet, { table: "library", row, was: e, value: null });
    expect(team().library.find((x) => x.row === row)).toBeUndefined();
  });

  it("logs progress for an athlete", async () => {
    const before = team().progress.length;
    await saveChange(sheet, { table: "progress", row: null, value: {
      date: "2026-09-24", athleteFullName: "Sam Nguyen", metricType: "Flash Grade", value: "V4", notes: "", loggedBy: "Jordan Lee",
    } });
    expect(team().progress).toHaveLength(before + 1);
    expect(team().progress.at(-1)).toMatchObject({ athleteFullName: "Sam Nguyen", value: "V4", date: "2026-09-24" });
  });
});
