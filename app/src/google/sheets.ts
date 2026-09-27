// Minimal Google Sheets API client — just fetch, no SDK.

import { RANGE_KEYS, RANGES } from "../schema/layout";
import type { Rows } from "../schema/parse";

const API = "https://sheets.googleapis.com/v4/spreadsheets/";

export class SheetsError extends Error {
  constructor(message: string, readonly kind: "auth" | "access" | "notFound" | "layout" | "network" | "other") {
    super(message);
  }
}

async function get<T>(url: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  } catch {
    throw new SheetsError("Couldn't reach Google — check your connection and try again.", "network");
  }
  if (res.ok) return res.json() as Promise<T>;
  if (res.status === 401) throw new SheetsError("Your Google sign-in has expired.", "auth");
  if (res.status === 403) throw new SheetsError("Your Google account doesn't have access to this Sheet. Ask the head coach to share it with you.", "access");
  if (res.status === 404) throw new SheetsError("No Sheet found at that link. Check the link and try again.", "notFound");
  if (res.status === 400) throw new SheetsError("The Sheet's layout doesn't match what this app expects.", "layout");
  throw new SheetsError(`Google Sheets returned an error (${res.status}). Try again in a moment.`, "other");
}

export async function fetchSheetInfo(spreadsheetId: string, token: string): Promise<{ title: string; sheetTitles: string[] }> {
  const data = await get<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>(
    API + encodeURIComponent(spreadsheetId) + "?fields=properties.title,sheets.properties.title", token);
  return { title: data.properties.title, sheetTitles: data.sheets.map((s) => s.properties.title) };
}

/** One request for every tab the app reads, in RANGE_KEYS order. */
export async function fetchAllRanges(spreadsheetId: string, token: string): Promise<{ values?: Rows }[]> {
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER", majorDimension: "ROWS" });
  RANGE_KEYS.forEach((k) => params.append("ranges", RANGES[k]));
  const data = await get<{ valueRanges: { values?: Rows }[] }>(API + encodeURIComponent(spreadsheetId) + "/values:batchGet?" + params, token);
  return data.valueRanges;
}
