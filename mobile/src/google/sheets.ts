// Minimal Google Sheets API client — just fetch, no SDK. Works the same on Android, iOS and web.

import { RANGES, type RangeKey } from "@/core/schema/layout";
import type { Rows } from "@/core/schema/parse";
import { layoutRequests, type SheetInfo } from "@/core/sheetLayout";
import type { SheetWriter, ValueRange } from "@/core/writes";

const API = "https://sheets.googleapis.com/v4/spreadsheets/";

// "scope": signed in, but this Google sign-in hasn't granted a permission the app now asks for.
export type SheetsErrorKind = "auth" | "access" | "scope" | "notFound" | "layout" | "network" | "other";

export class SheetsError extends Error {
  constructor(message: string, readonly kind: SheetsErrorKind) {
    super(message);
  }
}

async function call<T>(url: string, token: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: { Authorization: "Bearer " + token, ...(init ? { "Content-Type": "application/json" } : {}) },
      body: init ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new SheetsError("Couldn't reach Google — check your connection and try again.", "network");
  }
  if (res.ok) return res.json() as Promise<T>;
  if (res.status === 401) throw new SheetsError("Your Google sign-in has expired.", "auth");
  if (res.status === 403) {
    throw new SheetsError(init
      ? "Your Google account can view this Sheet but not edit it. Ask the head coach to give you edit access."
      : "Your Google account doesn't have access to this Sheet. Ask the head coach to share it with you.", "access");
  }
  if (res.status === 404) throw new SheetsError("No Sheet found at that link. Check the link and try again.", "notFound");
  if (res.status === 400) throw new SheetsError("The Sheet's layout doesn't match what this app expects.", "layout");
  throw new SheetsError(`Google Sheets returned an error (${res.status}). Try again in a moment.`, "other");
}

const sheetUrl = (id: string) => API + encodeURIComponent(id);

export async function fetchSheetInfo(spreadsheetId: string, token: string): Promise<{ title: string; sheetTitles: string[] }> {
  const data = await call<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>(
    sheetUrl(spreadsheetId) + "?fields=properties.title,sheets.properties.title", token);
  return { title: data.properties.title, sheetTitles: data.sheets.map((s) => s.properties.title) };
}

const READ_OPTIONS = { valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER", majorDimension: "ROWS" };

/** One request for every tab the app reads, in the order of `keys`. */
export async function fetchAllRanges(spreadsheetId: string, token: string, keys: RangeKey[]): Promise<{ values?: Rows }[]> {
  const params = new URLSearchParams(READ_OPTIONS);
  keys.forEach((k) => params.append("ranges", RANGES[k]));
  const data = await call<{ valueRanges: { values?: Rows }[] }>(sheetUrl(spreadsheetId) + "/values:batchGet?" + params, token);
  return data.valueRanges;
}

/**
 * Brings the Sheet's own dropdowns and group colors in line with its Settings (see
 * core/sheetLayout.ts). `newSheet` also removes the old rotation tabs from a just-created Sheet.
 */
export async function tidySheetLayout(spreadsheetId: string, token: string, newSheet: boolean): Promise<void> {
  const info = await call<SheetInfo>(sheetUrl(spreadsheetId) +
    "?fields=" + encodeURIComponent("sheets(properties(sheetId,title),conditionalFormats),namedRanges(namedRangeId,name)"), token);
  const requests = layoutRequests(info, { newSheet });
  if (requests.length) await call(sheetUrl(spreadsheetId) + ":batchUpdate", token, { method: "POST", body: { requests } });
}

/** The reads and writes a save needs, bound to one Sheet and token. */
export function sheetWriter(spreadsheetId: string, token: string): SheetWriter {
  return {
    async read(range) {
      const params = new URLSearchParams(READ_OPTIONS);
      const data = await call<{ values?: Rows }>(sheetUrl(spreadsheetId) + "/values/" + encodeURIComponent(range) + "?" + params, token);
      return data.values ?? [];
    },
    async readMany(ranges) {
      const params = new URLSearchParams(READ_OPTIONS);
      ranges.forEach((r) => params.append("ranges", r));
      const data = await call<{ valueRanges: { values?: Rows }[] }>(sheetUrl(spreadsheetId) + "/values:batchGet?" + params, token);
      return ranges.map((_, i) => data.valueRanges[i]?.values ?? []);
    },
    async write(data: ValueRange[]) {
      // RAW: text is stored exactly as typed ("3/5" stays text, "=..." is never a formula);
      // dates arrive as serial numbers, which the Sheet's date columns display as dates.
      await call(sheetUrl(spreadsheetId) + "/values:batchUpdate", token,
        { method: "POST", body: { valueInputOption: "RAW", data } });
    },
    async addTab(title: string) {
      // Creating a tab that someone else just created is fine — the goal is only that it exists.
      try {
        await call(sheetUrl(spreadsheetId) + ":batchUpdate", token, { method: "POST", body: { requests: [{ addSheet: { properties: { title } } }] } });
      } catch (e) {
        if (!(e instanceof SheetsError && e.kind === "layout")) throw e; // 400 = it already exists
      }
    },
    async append(range, values) {
      // Google finds the end of the table itself, one request at a time, so two coaches
      // appending together each get their own rows.
      const params = new URLSearchParams({ valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" });
      const res = await call<{ updates?: { updatedRange?: string } }>(
        sheetUrl(spreadsheetId) + "/values/" + encodeURIComponent(range) + ":append?" + params, token, { method: "POST", body: { values } });
      const at = res.updates?.updatedRange ?? range;
      return at.startsWith("'") ? at : at.replace(/^([^!]+)!/, "'$1'!"); // same quoting as the app's own ranges
    },
    async clear(ranges: string[]) {
      await call(sheetUrl(spreadsheetId) + "/values:batchClear", token, { method: "POST", body: { ranges } });
    },
  };
}
