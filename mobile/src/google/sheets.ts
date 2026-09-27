// Minimal Google Sheets API client — just fetch, no SDK. Works the same on Android, iOS and web.

import { RANGE_KEYS, RANGES } from "@/core/schema/layout";
import type { Rows } from "@/core/schema/parse";
import type { SheetWriter, ValueRange } from "@/core/writes";

const API = "https://sheets.googleapis.com/v4/spreadsheets/";

export type SheetsErrorKind = "auth" | "access" | "notFound" | "layout" | "network" | "other";

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

/** One request for every tab the app reads, in RANGE_KEYS order. */
export async function fetchAllRanges(spreadsheetId: string, token: string): Promise<{ values?: Rows }[]> {
  const params = new URLSearchParams(READ_OPTIONS);
  RANGE_KEYS.forEach((k) => params.append("ranges", RANGES[k]));
  const data = await call<{ valueRanges: { values?: Rows }[] }>(sheetUrl(spreadsheetId) + "/values:batchGet?" + params, token);
  return data.valueRanges;
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
    async clear(ranges: string[]) {
      await call(sheetUrl(spreadsheetId) + "/values:batchClear", token, { method: "POST", body: { ranges } });
    },
  };
}
