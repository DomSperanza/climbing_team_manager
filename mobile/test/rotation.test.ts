import { describe, expect, it } from "vitest";
import golden from "./fixtures/variant-golden.json";
import variant from "./fixtures/variant-batch.json";
import { teamFrom } from "./helpers";
import { serialToISO } from "../src/core/logic/dates";
import { coachesFor, practiceInfo, seasonWeeks, weekNumberFor } from "../src/core/logic/rotation";

// The variant workbook has 5 extra/renamed inputs (see scripts/extract-fixture.ts); the golden
// values are what the Sheet's own formulas computed for it in LibreOffice.
const team = teamFrom(variant);

describe("rotation matches the Sheet's formulas", () => {
  it("uses the renamed tiers and skips the inactive coach", () => {
    expect(team.settings.tierNames).toEqual(["Crushers", "Senders", "Rising"]);
    expect(coachesFor(team.coaches, "Thursday").map((c) => c.fullName)).toEqual(["Taylor Brooks", "Casey Park", "Morgan Diaz", "Avery Stone"]);
  });

  it("Rotation Schedule: date, cycle week, featured tier, Thursday lead", () => {
    const weeks = seasonWeeks(team.settings, team.coaches, golden.rotation.length);
    expect(weeks.map((w) => ({ week: w.week, date: w.thursday, cycle: w.cycle, tier: w.featuredTier, lead: w.thursdayLead })))
      .toEqual(golden.rotation.map((g) => ({ ...g, date: serialToISO(g.date as number) })));
  });

  it("Full Team Calendar: coach on duty for every Mon/Tue/Thu", () => {
    for (const g of golden.calendar) {
      const info = practiceInfo(team.settings, team.coaches, serialToISO(g.date as number));
      expect({ day: info.day, coach: info.lead, tier: info.featuredTier ?? "—" }).toEqual({ day: g.day, coach: g.coach, tier: g.tier });
    }
  });

  it("puts Mon/Tue in the same week as that week's Thursday, and nothing before the season", () => {
    expect(weekNumberFor(team.settings, "2026-09-21")).toBe(1); // Monday before the first Thursday
    expect(weekNumberFor(team.settings, "2026-10-01")).toBe(2);
    expect(weekNumberFor(team.settings, "2026-09-17")).toBeNull();
  });
});
