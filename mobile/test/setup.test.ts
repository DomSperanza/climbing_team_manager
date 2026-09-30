/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { TEMPLATE_XLSX_BASE64 } from "../src/data/template-xlsx";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type Rows } from "../src/core/schema/parse";
import { validateSheet } from "../src/core/schema/validate";
import { TAB } from "../src/core/schema/layout";
import { coachesOn } from "../src/core/logic/assignments";
import { base64ToBytes, multipartBody, retagStarterLibrary, setupPlan, utf8, validateNewSheet, type NewSheetOptions } from "../src/core/setup";
import type { TeamSetup } from "../src/core/teamSettings";

const team = (names: string[], extra: Partial<TeamSetup> = {}): TeamSetup => ({
  groups: names.map((name) => ({ name, was: null })),
  practiceDays: ["Monday", "Tuesday", "Thursday"], start: 17 * 60 + 30, end: 20 * 60, warmupMinutes: 45, cooldownMinutes: 15,
  ...extra,
});

const options: NewSheetOptions = {
  name: "Rock Team 2026–27",
  team: team(["Crushers", "Senders", "Rising"]),
  keepLibrary: true,
  me: { firstName: "Dana", lastName: "Reyes", role: "Head Coach", email: "dana@example.com", days: ["Thursday"] },
};

/** Runs the setup plan on a copy of the example workbook's cells, then parses the result. */
async function setUp(o: NewSheetOptions) {
  const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const sheet = memorySheet(raw);
  const plan = setupPlan(o);
  await sheet.clear(plan.clear);
  await sheet.write(plan.write);
  if (o.keepLibrary) await retagStarterLibrary(sheet, o.team);
  return { raw, team: parseTeamData(raw) };
}

describe("setting up a new team Sheet", () => {
  it("fills in Settings and clears every example row", async () => {
    const { team, raw } = await setUp(options);
    expect(team.settings.tierNames).toEqual(["Crushers", "Senders", "Rising"]);
    expect(team.athletes).toEqual([]);
    expect(team.log).toEqual([]);
    expect(team.progress).toEqual([]);
    expect(team.library.length).toBeGreaterThan(15); // starter library kept
    // Still a valid Rock Team sheet — headers untouched.
    expect(validateSheet(Object.values(TAB), raw)).toEqual([]);
  });

  it("adds the creator as the first coach, on the days they chose", async () => {
    const { team } = await setUp(options);
    expect(team.coaches.map((c) => [c.row, c.fullName, c.role, c.email])).toEqual([[6, "Dana Reyes", "Head Coach", "dana@example.com"]]);
    expect(coachesOn(team.coaches, "Thursday").map((c) => c.fullName)).toEqual(["Dana Reyes"]);
    expect(coachesOn(team.coaches, "Monday")).toEqual([]);
  });

  it("leaves the formula columns alone and can drop the starter library", async () => {
    const plan = setupPlan({ ...options, keepLibrary: false, me: null });
    expect(plan.clear.join(" ")).not.toMatch(/!A6|!D6|Log a Workout'!D/);
    const { team } = await setUp({ ...options, keepLibrary: false, me: null });
    expect(team.library).toEqual([]);
    expect(team.coaches).toEqual([]);
  });

  it("checks the options", () => {
    expect(validateNewSheet(options)).toBeNull();
    expect(validateNewSheet({ ...options, team: team(["A", "a", "B"]) })).toMatch(/different name/);
    expect(validateNewSheet({ ...options, team: team(["A", "All Team", "B"]) })).toMatch(/already means everyone/);
    expect(validateNewSheet({ ...options, team: team(["A, B"]) })).toMatch(/commas/);
    expect(validateNewSheet({ ...options, team: team([]) })).toMatch(/at least one group/);
    expect(validateNewSheet({ ...options, team: team(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]) })).toMatch(/up to 9/);
    expect(validateNewSheet({ ...options, team: team(["A"], { practiceDays: [] }) })).toMatch(/practice day/);
    expect(validateNewSheet({ ...options, team: team(["A"], { end: 17 * 60 }) })).toMatch(/end after it starts/);
    expect(validateNewSheet({ ...options, team: team(["A"], { warmupMinutes: 100, cooldownMinutes: 60 }) })).toMatch(/longer than the whole practice/);
    expect(validateNewSheet({ ...options, name: " " })).toMatch(/name/);
  });

  it("sets up any number of groups, other practice days and a different time", async () => {
    // A younger team: two groups, Wednesdays and Saturdays, 4:00–5:15 with no stretch block.
    const youth = team(["Minis", "Juniors"], { practiceDays: ["Saturday", "Wednesday"], start: 16 * 60, end: 17 * 60 + 15, warmupMinutes: 15, cooldownMinutes: 0 });
    const { team: t, raw } = await setUp({ ...options, team: youth, me: { ...options.me!, days: ["Wednesday", "Saturday"] } });
    expect(t.settings.tierNames).toEqual(["Minis", "Juniors"]);
    expect(t.settings.practiceDays).toEqual(["Wednesday", "Saturday"]);
    expect(t.settings.practice).toEqual({ start: 960, end: 1035, warmupMinutes: 15, tierBlockMinutes: 60, cooldownMinutes: 0 });
    // Days without their own Coach Profiles column go in Other Days.
    expect(t.coaches[0]).toMatchObject({ coachesMonday: false, coachesTuesday: false, coachesThursday: false, otherDays: "Wed, Sat" });
    expect(coachesOn(t.coaches, "Saturday").map((c) => c.fullName)).toEqual(["Dana Reyes"]);
    expect(validateSheet(Object.values(TAB), raw)).toEqual([]);

    const nine = team(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect((await setUp({ ...options, team: nine })).team.settings.tierNames).toEqual(nine.groups.map((g) => g.name));
  });

  it("tags the starter exercises for the new groups, top to bottom", async () => {
    const before = parseTeamData(rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[])).library;
    const count = (lib: typeof before, tier: string) => lib.filter((e) => e.tier === tier).length;
    const { team: t } = await setUp({ ...options, team: team(["Minis", "Juniors"]) });
    expect(count(t.library, "Minis")).toBe(count(before, "Advanced"));
    expect(count(t.library, "Juniors")).toBe(count(before, "Intermediate"));
    // No third group: Developing exercises are for everyone.
    expect(count(t.library, "All Levels")).toBe(count(before, "All Levels") + count(before, "Developing"));
    expect(t.library.map((e) => e.name)).toEqual(before.map((e) => e.name));
  });
});

describe("the Drive upload", () => {
  it("embeds the current workbook byte-for-byte", () => {
    const file = readFileSync(new URL("../../Climbing_Team_Tiered_Practice_System.xlsx", import.meta.url));
    expect(Buffer.from(base64ToBytes(TEMPLATE_XLSX_BASE64)).equals(file)).toBe(true);
  });

  it("builds a multipart/related body: metadata, then the file", () => {
    const media = Uint8Array.from([0, 255, 1, 2]);
    const body = multipartBody({ name: "Rock Team 2026–27" }, "application/x-test", media, "BOUNDARY");
    const text = Buffer.from(body).toString("latin1");
    expect(text.startsWith("--BOUNDARY\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n")).toBe(true);
    expect(Buffer.from(body).toString("utf8")).toContain('{"name":"Rock Team 2026–27"}');
    expect(text).toContain("Content-Type: application/x-test\r\n\r\n\u0000ÿ\u0001\u0002\r\n--BOUNDARY--\r\n");
    expect(Buffer.from(utf8("é–😀")).equals(Buffer.from("é–😀", "utf8"))).toBe(true);
  });
});
