import { parseTeamData, rawFromValueRanges, type Rows } from "../src/schema/parse";

export function teamFrom(fixture: { valueRanges: { values?: unknown[][] }[] }) {
  return parseTeamData(rawFromValueRanges(fixture.valueRanges as { values?: Rows }[]));
}
