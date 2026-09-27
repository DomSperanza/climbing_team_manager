import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { teamFrom } from "./helpers";
import { rawFromValueRanges, type Rows } from "../src/core/schema/parse";
import { validateSheet } from "../src/core/schema/validate";
import { autofillFromLibrary, timesUsed } from "../src/core/logic/library";
import { cellToISO, nextPracticeDay, stepPracticeDay, thursdayOfWeek } from "../src/core/logic/dates";

const team = teamFrom(demo);

describe("parsing the real workbook", () => {
  it("reads settings", () => {
    expect(team.settings).toMatchObject({
      tierNames: ["Advanced", "Intermediate", "Developing"],
      seasonStartDate: "2026-09-24",
      numberOfWeeks: 16,
    });
    expect(team.settings.blockTypes).toHaveLength(8);
  });

  it("reads filled rows only, with Sheet row numbers, and never the Age column", () => {
    expect(team.athletes.map((a) => [a.row, a.fullName, a.tier])).toEqual([[6, "Alex Rivera", "Advanced"], [7, "Sam Nguyen", "Developing"]]);
    expect(team.athletes[0]).not.toHaveProperty("age");
    expect(team.athletes[0].joinDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(team.coaches.map((c) => c.fullName)).toEqual(["Jordan Lee", "Taylor Brooks"]);
    expect(team.library.length).toBeGreaterThan(15);
    expect(team.log.every((b) => b.date === "2026-09-22")).toBe(true);
    expect(team.log[0].row).toBe(5);
    expect(team.progress).toHaveLength(3);
  });

  it("counts library use and autofills like the Sheet's INDEX/MATCH (case-insensitive)", () => {
    expect(timesUsed(team.log, "foot cut drill")).toBe(1);
    expect(autofillFromLibrary(team.library, "Foot Cut Drill")).toMatchObject({ blockType: "Technique/Skill" });
    expect(autofillFromLibrary(team.library, "nope")).toBeNull();
  });
});

describe("schema validation", () => {
  const raw = rawFromValueRanges(demo.valueRanges as { values?: Rows }[]);

  it("accepts the real workbook", () => {
    expect(validateSheet(demo.sheetTitles, raw)).toEqual([]);
  });

  it("names the missing tab", () => {
    expect(validateSheet(demo.sheetTitles.filter((t) => t !== "Athlete Profiles"))).toEqual([
      "This doesn't look like a Rock Team sheet — missing a 'Athlete Profiles' tab.",
    ]);
  });

  it("lists several missing tabs in one message", () => {
    expect(validateSheet(["Sheet1"])).toEqual([
      "This doesn't look like a Rock Team sheet — missing these tabs: 'Settings', 'Athlete Profiles', 'Coach Profiles', 'Exercise Library', 'Log a Workout', 'Progress Log'.",
    ]);
  });

  it("names a moved column", () => {
    const moved = { ...raw, coaches: [["ID", "First Name", "Last Name", "Full Name", "Role", "Tue?", "Mon?"], ...raw.coaches.slice(1)] };
    expect(validateSheet(demo.sheetTitles, moved)).toEqual([
      `'Coach Profiles' column F should be "Mon?" but is "Tue?". Were columns moved?`,
      `'Coach Profiles' column G should be "Tue?" but is "Mon?". Were columns moved?`,
      `'Coach Profiles' column H should be "Thu?" but is "". Were columns moved?`,
      `'Coach Profiles' column N should be "Status" but is "". Were columns moved?`,
    ]);
  });
});

describe("dates", () => {
  it("reads serials (dropping time of day) and typed-in text dates", () => {
    expect(cellToISO(46289)).toBe("2026-09-24");
    expect(cellToISO(46289.75)).toBe("2026-09-24");
    expect(cellToISO("9/24/2026")).toBe("2026-09-24");
    expect(cellToISO("")).toBeNull();
  });

  it("steps between practice days", () => {
    expect(nextPracticeDay("2026-09-25")).toBe("2026-09-28"); // Fri -> Mon
    expect(stepPracticeDay("2026-09-24", 1)).toBe("2026-09-28"); // Thu -> Mon
    expect(stepPracticeDay("2026-09-24", -1)).toBe("2026-09-22"); // Thu -> Tue
    expect(thursdayOfWeek("2026-09-27")).toBe("2026-09-24"); // Sunday belongs to the week before
  });
});
