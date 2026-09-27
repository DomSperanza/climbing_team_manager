import { parseTeamData, rawFromValueRanges, type Rows } from "../src/core/schema/parse";

export function teamFrom(fixture: { valueRanges: { values?: unknown[][] }[] }) {
  return parseTeamData(rawFromValueRanges(fixture.valueRanges as { values?: Rows }[]));
}
