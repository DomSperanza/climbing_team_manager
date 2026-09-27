/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import demo from "../src/data/demo-fixture.json";
import { TEMPLATE_XLSX_BASE64 } from "../src/data/template-xlsx";
import { memorySheet } from "../src/core/memorySheet";
import { parseTeamData, rawFromValueRanges, type Rows } from "../src/core/schema/parse";
import { validateSheet } from "../src/core/schema/validate";
import { TAB } from "../src/core/schema/layout";
import { coachesFor, featuredTier } from "../src/core/logic/rotation";
import { base64ToBytes, multipartBody, nextThursday, setupPlan, utf8, validateNewSheet, type NewSheetOptions } from "../src/core/setup";

const options: NewSheetOptions = {
  name: "Rock Team 2026–27",
  tierNames: ["Crushers", "Senders", "Rising"],
  seasonStart: "2026-10-01",
  numberOfWeeks: 20,
  keepLibrary: true,
  me: { firstName: "Dana", lastName: "Reyes", role: "Head Coach", email: "dana@example.com", coachesMonday: false, coachesTuesday: false, coachesThursday: true },
};

/** Runs the setup plan on a copy of the example workbook's cells, then parses the result. */
async function setUp(o: NewSheetOptions) {
  const raw = rawFromValueRanges(structuredClone(demo.valueRanges) as { values?: Rows }[]);
  const sheet = memorySheet(raw);
  const plan = setupPlan(o);
  await sheet.clear(plan.clear);
  await sheet.write(plan.write);
  return { raw, team: parseTeamData(raw) };
}

describe("setting up a new team Sheet", () => {
  it("fills in Settings and clears every example row", async () => {
    const { team, raw } = await setUp(options);
    expect(team.settings).toMatchObject({ tierNames: ["Crushers", "Senders", "Rising"], seasonStartDate: "2026-10-01", numberOfWeeks: 20 });
    expect(team.athletes).toEqual([]);
    expect(team.log).toEqual([]);
    expect(team.progress).toEqual([]);
    expect(team.library.length).toBeGreaterThan(15); // starter library kept
    expect(featuredTier(team.settings, 2)).toBe("Senders");
    // Still a valid Rock Team sheet — headers untouched.
    expect(validateSheet(Object.values(TAB), raw)).toEqual([]);
  });

  it("adds the creator as the first coach, so Thursdays have a lead", async () => {
    const { team } = await setUp(options);
    expect(team.coaches.map((c) => [c.row, c.fullName, c.role, c.email])).toEqual([[6, "Dana Reyes", "Head Coach", "dana@example.com"]]);
    expect(coachesFor(team.coaches, "Thursday").map((c) => c.fullName)).toEqual(["Dana Reyes"]);
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
    expect(validateNewSheet({ ...options, seasonStart: "2026-10-02" })).toMatch(/Thursday/);
    expect(validateNewSheet({ ...options, tierNames: ["A", "a", "B"] })).toMatch(/different names/);
    expect(validateNewSheet({ ...options, tierNames: ["A", "All Team", "B"] })).toMatch(/already used/);
    expect(validateNewSheet({ ...options, name: " " })).toMatch(/name/);
    expect(nextThursday("2026-09-27")).toBe("2026-10-01");
    expect(nextThursday("2026-10-01")).toBe("2026-10-01");
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
