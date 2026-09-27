// Checks that a connected spreadsheet really is a Rock Team sheet, and says specifically
// what's wrong when it isn't (HANDOFF.md §2.5).

import { EXPECTED_HEADERS, TAB } from "./layout";
import type { RawRanges } from "./parse";

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Problems with the tab list alone — run before fetching values, since a missing tab fails the whole batchGet. */
export function missingTabs(sheetTitles: string[]): string[] {
  const have = new Set(sheetTitles);
  return Object.values(TAB).filter((t) => !have.has(t));
}

export function validateSheet(sheetTitles: string[], raw?: RawRanges): string[] {
  const missing = missingTabs(sheetTitles);
  if (missing.length === 1) return [`This doesn't look like a Rock Team sheet — missing a '${missing[0]}' tab.`];
  if (missing.length) return [`This doesn't look like a Rock Team sheet — missing these tabs: ${missing.map((t) => `'${t}'`).join(", ")}.`];
  if (!raw) return [];
  const problems: string[] = [];
  for (const [key, expected] of Object.entries(EXPECTED_HEADERS) as [keyof typeof EXPECTED_HEADERS, Record<number, string>][]) {
    const header = raw[key]?.[0] ?? [];
    for (const [col, label] of Object.entries(expected)) {
      const got = header[Number(col)];
      if (norm(got) !== norm(label)) {
        const colLetter = String.fromCharCode(65 + Number(col));
        problems.push(`'${TAB[key]}' column ${colLetter} should be "${label}" but is "${got ?? ""}". Were columns moved?`);
      }
    }
  }
  return problems;
}
