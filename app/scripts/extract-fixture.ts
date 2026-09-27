// Builds test/demo data from the real workbook. Run with `npm run fixture` (needs LibreOffice).
//
// The .xlsx is authored by openpyxl, so its formula cells have no cached values. LibreOffice
// (headless) recalculates it, and the computed values are shaped exactly like a Sheets API
// values:batchGet response (UNFORMATTED_VALUE + SERIAL_NUMBER dates) so the app's parser is
// exercised the same way in demo mode, in tests, and against the live Sheet.
//
// Outputs:
//   src/data/demo-fixture.json          the workbook as-is, used by Demo mode
//   test/fixtures/variant-batch.json    a variant with 5 coaches + renamed tiers ...
//   test/fixtures/variant-golden.json   ... and what the Sheet's own formulas computed for it
//                                        (Rotation Schedule + Full Team Calendar), used to
//                                        check logic/rotation.ts against the spreadsheet.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { RANGES, RANGE_KEYS, TAB } from "../src/schema/layout";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const WORKBOOK = resolve(appDir, "../Climbing_Team_Tiered_Practice_System.xlsx");

// SheetJS's ESM build has no filesystem access of its own, so files go through buffers.
function readWorkbook(path: string, opts: XLSX.ParsingOptions = {}): XLSX.WorkBook {
  return XLSX.read(readFileSync(path), { type: "buffer", ...opts });
}

// Returns the path of the recalculated copy.
function recalc(srcPath: string, workDir: string): string {
  const outDir = join(workDir, "out");
  mkdirSync(outDir, { recursive: true });
  // A private LibreOffice profile avoids clashing with a LibreOffice window that's already open,
  // and lets us force "always recalculate on load" — otherwise LibreOffice trusts whatever
  // cached values are in the file (the variant below carries stale ones).
  const profileDir = join(workDir, "lo-profile");
  mkdirSync(join(profileDir, "user"), { recursive: true });
  writeFileSync(join(profileDir, "user/registrymodifications.xcu"),
    '<?xml version="1.0" encoding="UTF-8"?>\n<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
    '<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>\n</oor:items>\n');
  const profile = "-env:UserInstallation=file://" + profileDir;
  const log = execFileSync("soffice", [profile, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", outDir, srcPath], { encoding: "utf8" });
  const outPath = join(outDir, srcPath.split("/").pop()!);
  if (!existsSync(outPath)) throw new Error("LibreOffice didn't produce " + outPath + ":\n" + log);
  return outPath;
}

// "'Athlete Profiles'!A5:N" -> sheet name + a bounded SheetJS range
function parseRange(a1: string): { sheet: string; range: string } {
  const m = a1.match(/^'(.+)'!([A-Z]+\d+):([A-Z]+)(\d*)$/);
  if (!m) throw new Error("bad range " + a1);
  return { sheet: m[1], range: `${m[2]}:${m[3]}${m[4] || "2000"}` };
}

// Mimic the Sheets API: interior blanks become "", trailing blank cells/rows are dropped.
function apiValues(wb: XLSX.WorkBook, a1: string): unknown[][] {
  const { sheet, range } = parseRange(a1);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, range, raw: true, defval: null, blankrows: true });
  const out = rows.map((r) => {
    const row = r.map((v) => (v === null || v === undefined ? "" : v));
    while (row.length && row[row.length - 1] === "") row.pop();
    return row;
  });
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}

function batchResponse(wb: XLSX.WorkBook) {
  return {
    sheetTitles: wb.SheetNames,
    valueRanges: RANGE_KEYS.map((k) => ({ range: RANGES[k], values: apiValues(wb, RANGES[k]) })),
  };
}

const work = mkdtempSync(join(tmpdir(), "rockteam-fixture-"));
try {
  // 1. Demo fixture: the workbook exactly as authored.
  const basePath = recalc(WORKBOOK, join(work, "base"));
  const base = readWorkbook(basePath);
  writeFileSync(join(appDir, "src/data/demo-fixture.json"), JSON.stringify(batchResponse(base), null, 1));

  // 2. Variant: more coaches (incl. an Inactive one and mixed day flags) and renamed tiers,
  //    so the rotation formulas have something non-trivial to compute. Built from the
  //    recalculated copy: SheetJS drops formula cells that have no cached value, and the
  //    openpyxl original has none.
  const wb = readWorkbook(basePath, { cellFormula: true });
  const set = (sheet: string, addr: string, v: string) => { wb.Sheets[sheet][addr] = { t: "s", v }; };
  set(TAB.settings, "B5", "Crushers");
  set(TAB.settings, "B6", "Senders");
  set(TAB.settings, "B7", "Rising");
  const extraCoaches: [string, string, string, string, string, string][] = [
    // first, last, Mon, Tue, Thu, Status
    ["Casey", "Park", "No", "Yes", "Yes", "Active"],
    ["Riley", "Chen", "Yes", "No", "Yes", "Inactive"],
    ["Morgan", "Diaz", "Yes", "Yes", "Yes", "Active"],
    ["Avery", "Stone", "No", "No", "Yes", "Active"],
  ];
  extraCoaches.forEach(([first, last, mon, tue, thu, status], i) => {
    const r = 8 + i;
    set(TAB.coaches, `B${r}`, first);
    set(TAB.coaches, `C${r}`, last);
    set(TAB.coaches, `E${r}`, "Coach");
    set(TAB.coaches, `F${r}`, mon);
    set(TAB.coaches, `G${r}`, tue);
    set(TAB.coaches, `H${r}`, thu);
    set(TAB.coaches, `N${r}`, status);
  });
  const variantPath = join(work, "variant.xlsx");
  writeFileSync(variantPath, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  const variant = readWorkbook(recalc(variantPath, join(work, "variant")));

  const rotation = XLSX.utils.sheet_to_json<unknown[]>(variant.Sheets["Rotation Schedule"], { header: 1, range: "A5:E20", raw: true })
    .map(([week, date, cycle, tier, lead]) => ({ week, date, cycle, tier, lead }));
  const calendar = XLSX.utils.sheet_to_json<unknown[]>(variant.Sheets["Full Team Calendar"], { header: 1, range: "A5:D52", raw: true })
    .map(([date, day, coach, tier]) => ({ date, day, coach, tier }));

  mkdirSync(join(appDir, "test/fixtures"), { recursive: true });
  writeFileSync(join(appDir, "test/fixtures/variant-batch.json"), JSON.stringify(batchResponse(variant), null, 1));
  writeFileSync(join(appDir, "test/fixtures/variant-golden.json"), JSON.stringify({ rotation, calendar }, null, 1));
  console.log(`demo fixture + variant (${rotation.length} weeks, ${calendar.length} calendar rows) written`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
