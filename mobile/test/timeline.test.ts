import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { teamFrom } from "./helpers";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type Rows } from "../src/core/schema/parse";
import { filterLibrary } from "../src/core/logic/library";
import { blockGroups, dayTimeline, formatClock, formatDuration, groupText, minutesFromText, orderForNew, parseTimeOfDay, reorder, standardOutline } from "../src/core/logic/timeline";
import { recording, saveOrder, ROW_CHANGED_MESSAGE } from "../src/core/writes";
import type { WorkoutBlock } from "../src/core/schema/model";

const team = teamFrom(demo);
const tiers = team.settings.tierNames;
let nextRow = 100;
const block = (group: string, minutes: number | null, order: number | null, blockType = "Strength"): WorkoutBlock => ({
  row: nextRow++, date: "2026-10-01", group, libraryItem: "", blockType, description: "", setsRepsDuration: "", coach: "", notes: "", minutes, order,
});

describe("practice timing from Settings", () => {
  it("reads 5:30–8:00 PM with a 45 min warm-up", () => {
    expect(team.settings.practice).toEqual({ start: 1050, end: 1200, warmupMinutes: 45, tierBlockMinutes: 90, cooldownMinutes: 15 });
  });

  it("understands the ways a time can be written", () => {
    expect(parseTimeOfDay("5:30 PM")).toBe(1050);
    expect(parseTimeOfDay("5:30pm")).toBe(1050);
    expect(parseTimeOfDay("17:30")).toBe(1050);
    expect(parseTimeOfDay("12:15 AM")).toBe(15);
    expect(parseTimeOfDay(0.72916666)).toBe(1050); // a Sheets time value
    expect(parseTimeOfDay("soon")).toBeNull();
    expect(formatClock(1050)).toBe("5:30");
    expect(formatClock(1200, true)).toBe("8:00 PM");
    expect(formatDuration(150)).toBe("2 h 30 min");
    expect(minutesFromText("3 x 10 min")).toBe(10);
  });
});

describe("a day's timeline", () => {
  it("the example day fills the practice exactly", () => {
    const tl = dayTimeline(team.log, team.settings.practice, tiers);
    expect(tl.blocks.map((b) => [formatClock(b.start), formatClock(b.end)])).toEqual([["5:30", "6:15"], ["6:15", "7:00"], ["7:00", "7:45"], ["7:45", "8:00"]]);
    expect(tl).toMatchObject({ plannedMinutes: 150, availableMinutes: 150, overBy: 0, untimed: 0 });
  });

  it("runs tiers side by side between All Team blocks, listed in time order", () => {
    const [adv, int, dev] = tiers;
    // Planned tier by tier (Developing first), but shown by start time; ties list tiers in Settings order.
    const day = [block("All Team", 45, 1), block(dev, 45, 2), block(dev, 45, 3), block(adv, 60, 4), block(adv, 30, 5), block(int, 90, 6), block("All Team", 15, 7)];
    const tl = dayTimeline(day, team.settings.practice, tiers);
    expect(tl.blocks.map((b) => `${formatClock(b.start)}-${formatClock(b.end)} ${b.block.group}`)).toEqual([
      "5:30-6:15 All Team", `6:15-7:15 ${adv}`, `6:15-7:45 ${int}`, `6:15-7:00 ${dev}`, `7:00-7:45 ${dev}`, `7:15-7:45 ${adv}`, "7:45-8:00 All Team",
    ]);
    expect(tl.overBy).toBe(0);
  });

  it("says how far over the practice runs, and counts blocks without a length", () => {
    const tl = dayTimeline([block("All Team", 100, 1), block("All Team", 60, 2), block("All Team", null, 3)], team.settings.practice, tiers);
    expect(tl.overBy).toBe(10);
    expect(tl.untimed).toBe(1);
  });

  it("pins the closing stretch to the end of practice and shows the time before it as open", () => {
    const outline = [block("All Team", 45, 1, "Warm-up"), block("All Team", 15, 2, "Stretch/Cooldown")];
    let tl = dayTimeline(outline, team.settings.practice, tiers);
    expect(tl.blocks.map((b) => formatClock(b.start))).toEqual(["5:30", "7:45"]);
    expect(tl.open).toEqual({ start: 1095, end: 1185 }); // 6:15–7:45
    expect(tl.openBeforeRow).toBe(outline[1].row);
    expect([tl.plannedMinutes, tl.overBy]).toEqual([60, 0]);
    // Fill part of the gap: the stretch stays at 7:45 and the open time shrinks.
    tl = dayTimeline([...outline, block(tiers[0], 60, 1.5)], team.settings.practice, tiers);
    expect(tl.open).toEqual({ start: 1155, end: 1185 });
    // Overfill it: the stretch follows the last block, and the day runs over.
    tl = dayTimeline([...outline, block("All Team", 100, 1.5)], team.settings.practice, tiers);
    expect([tl.open, formatClock(tl.blocks[2].start), tl.overBy]).toEqual([null, "7:55", 10]);
  });

  it("orders rows typed straight into the Sheet (no Order) after the rest, by row", () => {
    const a = block("All Team", 10, null), b = block("All Team", 10, 1);
    expect(dayTimeline([a, b], team.settings.practice, tiers).blocks.map((x) => x.block)).toEqual([b, a]);
  });
});

describe("blocks shared by several groups", () => {
  it("reads and writes the Group cell", () => {
    expect(blockGroups("Intermediate, Developing", tiers)).toEqual(["Intermediate", "Developing"]);
    expect(blockGroups("developing,intermediate", tiers)).toEqual(["Intermediate", "Developing"]); // any case/order
    expect(blockGroups("Advanced", tiers)).toEqual(["Advanced"]);
    expect(blockGroups("All Team", tiers)).toBeNull();
    expect(blockGroups("Advanced, Intermediate, Developing", tiers)).toBeNull(); // everyone
    expect(groupText(["Developing", "Intermediate"], tiers)).toBe("Intermediate, Developing");
    expect(groupText(["Advanced", "Intermediate", "Developing"], tiers)).toBe("All Team");
    expect(groupText([], tiers)).toBe("All Team");
  });

  it("starts once all its groups are free and holds only those groups", () => {
    const [adv, int, dev] = tiers;
    const day = [block("All Team", 45, 1), block(int, 30, 2), block(dev, 15, 3), block(`${int}, ${dev}`, 30, 4), block(adv, 90, 5), block("All Team", 15, 6)];
    const tl = dayTimeline(day, team.settings.practice, tiers);
    expect(tl.blocks.map((b) => `${formatClock(b.start)}-${formatClock(b.end)} ${b.block.group}`)).toEqual([
      "5:30-6:15 All Team", `6:15-7:45 ${adv}`, `6:15-6:45 ${int}`, `6:15-6:30 ${dev}`, `6:45-7:15 ${int}, ${dev}`, "7:45-8:00 All Team",
    ]);
    expect(tl.blocks[4].lanes).toEqual([int, dev]);
  });

  it("moving a shared block jumps its groups' own blocks; single-group blocks cross it", () => {
    const [adv, int, dev] = tiers;
    const W = block("All Team", 45, 1, "Warm-up"), I1 = block(int, 30, 2), D1 = block(dev, 30, 3), ID = block(`${int}, ${dev}`, 30, 4), A1 = block(adv, 60, 5);
    const day = [W, I1, D1, ID, A1];
    const order = (moves: { block: WorkoutBlock; order: number }[]) => {
      const m = new Map(moves.map((x) => [x.block.row, x.order]));
      return inPlanOrderRows(day.map((b) => ({ ...b, order: m.get(b.row) ?? b.order })));
    };
    const inPlanOrderRows = (bs: WorkoutBlock[]) => [...bs].sort((a, b) => a.order! - b.order!).map((b) => b.row);
    expect(order(reorder(day, ID.row, -1, tiers))).toEqual([W.row, ID.row, I1.row, D1.row, A1.row]); // before both its groups' blocks
    expect(order(reorder(day, I1.row, 1, tiers))).toEqual([W.row, D1.row, ID.row, I1.row, A1.row]); // Intermediate crosses the shared block
    expect(reorder(day, A1.row, -1, tiers).length).toBeGreaterThan(0); // Advanced isn't blocked by the shared block
  });
});

describe("adding and moving blocks", () => {
  it("a new block goes before the closing stretch", () => {
    const outline = standardOutline(team.settings.practice, team.settings.blockTypes);
    expect(outline.map((o) => [o.blockType, o.minutes])).toEqual([["Warm-up", 45], ["Stretch/Cooldown", 15]]);
    const day = [block("All Team", 45, 1, "Warm-up"), block("All Team", 15, 2, "Stretch/Cooldown")];
    expect(orderForNew(day)).toBe(1.5);
    expect(orderForNew([block("All Team", 45, 1, "Warm-up")])).toBe(2);
    expect(orderForNew([])).toBe(1);
  });

  it("moving renumbers the day 1, 2, 3 and only touches rows that change", () => {
    const [a, b, c] = [block("All Team", 10, 1), block("All Team", 10, 2), block("All Team", 10, 3)];
    expect(reorder([a, b, c], c.row, -1, tiers).map((m) => [m.block.row, m.order])).toEqual([[c.row, 2], [b.row, 3]]);
    expect(reorder([a, b, c], a.row, -1, tiers)).toEqual([]); // already first
  });

  it("moves follow each block's own group on the timeline", () => {
    const [adv, int] = tiers;
    const W = block("All Team", 45, 1, "Warm-up"), A1 = block(adv, 30, 2), A2 = block(adv, 30, 3), I1 = block(int, 60, 4), S = block("All Team", 15, 5, "Stretch/Cooldown");
    const day = [W, A1, A2, I1, S];
    const after = (row: number, dir: -1 | 1) => {
      const moves = new Map(reorder(day, row, dir, tiers).map((m) => [m.block.row, m.order]));
      const moved = day.map((b) => ({ ...b, order: moves.get(b.row) ?? b.order }));
      return dayTimeline(moved, team.settings.practice, tiers).blocks.map((t) => `${formatClock(t.start)} ${t.block.row === W.row ? "W" : t.block.row === S.row ? "S" : t.block.row === A1.row ? "A1" : t.block.row === A2.row ? "A2" : "I1"}`);
    };
    expect(after(A2.row, -1)).toEqual(["5:30 W", "6:15 A2", "6:15 I1", "6:45 A1", "7:45 S"]); // swap within Advanced
    expect(after(I1.row, 1)).toEqual(["5:30 W", "6:15 A1", "6:45 A2", "7:15 S", "7:30 I1"]); // crosses the stretch
    expect(after(S.row, -1)).toEqual(["5:30 W", "6:15 S", "6:30 A1", "6:30 I1", "7:00 A2"]); // jumps the whole tier stretch
    expect(reorder(day, W.row, -1, tiers)).toEqual([]);
    expect(reorder(day, S.row, 1, tiers)).toEqual([]);
    expect(reorder(day, A1.row, -1, tiers)).not.toEqual([]); // can cross the warm-up if wanted
  });

  it("saves only the Order cells, after checking each row, and replays onto the local copy", async () => {
    const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
    const day = parseTeamData(raw).log;
    const moves = reorder(day, day[3].row, -1, tiers);
    const sheetRaw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
    const rec = recording(memorySheet(sheetRaw));
    await saveOrder(rec.writer, moves);
    await rec.replayOnto(memorySheet(raw));
    const names = (r: typeof raw) => dayTimeline(parseTeamData(r).log, team.settings.practice, tiers).blocks.map((b) => b.block.libraryItem || b.block.blockType);
    expect(names(sheetRaw)).toEqual(["Warm-up", "Power", "Core", "Foot Cut Drill"]);
    expect(names(raw)).toEqual(names(sheetRaw));
    // Someone changed one of the moved rows in the Sheet meanwhile → nothing is written.
    sheetRaw.log[moves[0].block.row - 4][1] = "Intermediate"; // raw.log starts at header row 4
    await expect(saveOrder(memorySheet(sheetRaw), moves)).rejects.toThrow(ROW_CHANGED_MESSAGE);
  });
});

describe("filtering the library (Library tab and the exercise picker)", () => {
  it("filters by block type and tier, keeping All Levels", () => {
    const adv = filterLibrary(team.library, { query: "", blockType: "", tier: "Advanced" });
    expect(adv.length).toBeGreaterThan(0);
    expect(adv.every((e) => e.tier === "Advanced" || e.tier === "All Levels")).toBe(true);
    const advStrength = filterLibrary(team.library, { query: "", blockType: "Strength", tier: "Advanced" });
    expect(advStrength.every((e) => e.blockType === "Strength")).toBe(true);
    expect(filterLibrary(team.library, { query: "ladder", blockType: "", tier: "" }).map((e) => e.name)).toContain("Ladder Drill");
  });
});
