// A SheetWriter over the app's own copy of the Sheet's cells (RawRanges). Demo mode saves
// through it, and the tests use it as a stand-in Sheet, so both exercise the exact same
// ranges and values the real Sheets API receives.

import { RANGES, RANGE_KEYS, TAB_NAME, type RangeKey } from "./schema/layout";
import type { Cell, RawRanges, Rows } from "./schema/parse";
import type { SheetWriter, ValueRange } from "./writes";

const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function locate(range: string): { key: RangeKey; r1: number; c1: number; r2: number; c2: number } {
  const m = range.match(/^'(.+)'!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) throw new Error("memorySheet: unsupported range " + range);
  const key = RANGE_KEYS.find((k) => TAB_NAME[k] === m[1]);
  if (!key) throw new Error("memorySheet: unknown tab " + m[1]);
  return { key, c1: colIndex(m[2]), r1: Number(m[3]), c2: colIndex(m[4]), r2: Number(m[5]) };
}

/** First Sheet row held in raw[key] (the header row of that tab's range). */
const startRow = (key: RangeKey) => Number(RANGES[key].match(/!A(\d+):/)![1]);

/**
 * Stands in for the Sheet's own per-row formulas that the app reads back: IDs (=ROW()-5)
 * and Full Name (=TRIM(First&" "&Last)), which go blank when the row is emptied.
 */
function recompute(raw: RawRanges, key: RangeKey, row: number) {
  const r = raw[key][row - startRow(key)];
  if (!r) return;
  if (key === "athletes" || key === "coaches") {
    const first = String(r[1] ?? ""), last = String(r[2] ?? "");
    r[0] = first ? row - 5 : "";
    r[3] = first ? `${first} ${last}`.trim() : "";
  } else if (key === "library") {
    r[0] = String(r[3] ?? "") ? row - 5 : "";
  }
}

export function memorySheet(raw: RawRanges): SheetWriter {
  const cellRef = (key: RangeKey, row: number, col: number, create: boolean): { rows: Rows; i: number } | null => {
    const i = row - startRow(key);
    const rows = raw[key];
    if (!create && !rows[i]) return null;
    while (rows.length <= i) rows.push([]);
    while (rows[i].length <= col) rows[i].push("");
    return { rows, i };
  };
  const set = (key: RangeKey, row: number, col: number, v: Cell) => {
    const ref = cellRef(key, row, col, true)!;
    ref.rows[ref.i][col] = v;
  };

  const self: SheetWriter = {
    async addTab() { /* every tab the app knows already has a place in RawRanges */ },
    async readMany(ranges) {
      return Promise.all(ranges.map((r) => self.read(r)));
    },
    async read(range) {
      const { key, r1, c1, r2, c2 } = locate(range);
      const out: Rows = [];
      for (let r = r1; r <= r2; r++) {
        const src = raw[key][r - startRow(key)] ?? [];
        const row: Cell[] = [];
        for (let c = c1; c <= c2; c++) row.push(src[c] ?? "");
        out.push(row);
      }
      return out;
    },
    async write(data: ValueRange[]) {
      for (const { range, values } of data) {
        const { key, r1, c1, r2, c2 } = locate(range);
        if (values.length !== r2 - r1 + 1 || values.some((v) => v.length !== c2 - c1 + 1)) {
          throw new Error(`memorySheet: ${values.length}x${values[0]?.length} values don't fit ${range}`);
        }
        values.forEach((v, dr) => v.forEach((cell, dc) => set(key, r1 + dr, c1 + dc, cell)));
        for (let r = r1; r <= r2; r++) recompute(raw, key, r);
      }
    },
    async clear(ranges: string[]) {
      for (const range of ranges) {
        const { key, r1, c1, r2, c2 } = locate(range);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) set(key, r, c, "");
        for (let r = r1; r <= r2; r++) recompute(raw, key, r);
      }
    },
  };
  return self;
}
