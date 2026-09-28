// Google Drive calls for creating and sharing a team Sheet. The app only asks for the
// "drive.file" permission: it can see and share the files it created, nothing else in the
// coach's Drive. Sharing goes through Drive's own sharing, so Google sends the invite email
// and the Sheet's sharing list stays the one place that decides who can see it.

import { multipartBody } from "@/core/setup";
import { SheetsError } from "./sheets";

const DRIVE = "https://www.googleapis.com/drive/v3/files/";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function call<T>(url: string, token: string, init: { method?: string; body?: BodyInit; contentType?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { Authorization: "Bearer " + token, ...(init.contentType ? { "Content-Type": init.contentType } : {}) },
      body: init.body,
    });
  } catch {
    throw new SheetsError("Couldn't reach Google — check your connection and try again.", "network");
  }
  if (res.ok) return (res.status === 204 ? undefined : res.json()) as Promise<T>;
  let reason = "";
  try { reason = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ""; } catch { /* no details */ }
  if (res.status === 401) throw new SheetsError("Your Google sign-in has expired.", "auth");
  if (res.status === 404) {
    throw new SheetsError("This app can only manage sharing for Sheets it created. Share this one from Google Sheets instead.", "notFound");
  }
  if (res.status === 403 && /insufficient|scope/i.test(reason)) throw new SheetsError("Rock Team needs one more permission from Google.", "scope");
  if (res.status === 403) throw new SheetsError(reason || "Google didn't allow that. Only people who can edit the Sheet can share it.", "access");
  if (res.status === 400) throw new SheetsError(reason || "Google rejected that request.", "other");
  throw new SheetsError(`Google Drive returned an error (${res.status}). Try again in a moment.`, "other");
}

/**
 * Uploads the team workbook and has Drive convert it into a Google Sheet. The new file is
 * private: only the signed-in coach can open it until they share it.
 */
export async function createSheetFromWorkbook(token: string, name: string, workbook: Uint8Array): Promise<string> {
  const boundary = "rock-team-" + Math.random().toString(36).slice(2);
  const body = multipartBody(
    { name, mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { rockTeam: "1" } },
    XLSX, workbook, boundary);
  const file = await call<{ id: string }>(UPLOAD + "?uploadType=multipart&fields=id", token, {
    method: "POST", body: body as unknown as BodyInit, contentType: `multipart/related; boundary=${boundary}`,
  });
  return file.id;
}

/**
 * Team Sheets this app created (marked when created). With the narrow "drive.file" permission
 * Google only returns files the app itself made or opened, so this finds your own team Sheets,
 * not every spreadsheet in your Drive.
 */
export async function listTeamSheets(token: string): Promise<{ id: string; title: string }[]> {
  const params = new URLSearchParams({
    q: "appProperties has { key='rockTeam' and value='1' } and trashed = false",
    orderBy: "modifiedTime desc", pageSize: "20", fields: "files(id,name)",
    includeItemsFromAllDrives: "true", supportsAllDrives: "true",
  });
  const data = await call<{ files?: { id: string; name: string }[] }>(DRIVE.replace(/\/$/, "") + "?" + params, token);
  return (data.files ?? []).map((f) => ({ id: f.id, title: f.name }));
}

// ---- the team Sheets saved to the coach's Google account ------------------------------------
// A small JSON file in the app's hidden settings folder (appDataFolder) of the coach's Drive.

const ACCOUNT_FILE = "rock-team-sheets.json";
export interface SavedSheet { id: string; title: string; lastUsed: number }

async function accountFileId(token: string): Promise<string | null> {
  const params = new URLSearchParams({ spaces: "appDataFolder", q: `name = '${ACCOUNT_FILE}'`, fields: "files(id)", pageSize: "1" });
  const data = await call<{ files?: { id: string }[] }>(DRIVE.replace(/\/$/, "") + "?" + params, token);
  return data.files?.[0]?.id ?? null;
}

/** The team Sheets saved to this Google account (empty if none yet). */
export async function readAccountSheets(token: string): Promise<SavedSheet[]> {
  const id = await accountFileId(token);
  if (!id) return [];
  const data = await call<{ sheets?: SavedSheet[] }>(DRIVE + encodeURIComponent(id) + "?alt=media", token);
  return Array.isArray(data.sheets) ? data.sheets : [];
}

/** Replaces the saved list (callers read, merge, then write). */
export async function writeAccountSheets(token: string, sheets: SavedSheet[]): Promise<void> {
  const body = JSON.stringify({ sheets });
  const id = await accountFileId(token);
  if (id) {
    await call(UPLOAD + "/" + encodeURIComponent(id) + "?uploadType=media", token, { method: "PATCH", body, contentType: "application/json" });
    return;
  }
  const boundary = "rock-team-" + Math.random().toString(36).slice(2);
  const text = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: ACCOUNT_FILE, parents: ["appDataFolder"] })}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--\r\n`;
  await call(UPLOAD + "?uploadType=multipart&fields=id", token, { method: "POST", body: text, contentType: `multipart/related; boundary=${boundary}` });
}

export type Role = "writer" | "reader";
export interface Person { id: string; email: string; name: string; role: "owner" | "writer" | "commenter" | "reader" | string; type: string }

export async function listPeople(token: string, fileId: string): Promise<Person[]> {
  const data = await call<{ permissions: { id: string; emailAddress?: string; displayName?: string; role: string; type: string }[] }>(
    DRIVE + encodeURIComponent(fileId) + "/permissions?fields=permissions(id,emailAddress,displayName,role,type)", token);
  return data.permissions.map((p) => ({ id: p.id, email: p.emailAddress ?? "", name: p.displayName ?? "", role: p.role, type: p.type }));
}

/** Shares the Sheet with one person; Google emails them a link. */
export async function addPerson(token: string, fileId: string, email: string, role: Role): Promise<void> {
  // With the app's web address known, the email links straight to it with this Sheet ready.
  const app = process.env.EXPO_PUBLIC_APP_URL;
  const params = new URLSearchParams({
    sendNotificationEmail: "true",
    emailMessage: app
      ? `You've been added to the Rock Team Sheet. Open the team app here — it's ready to connect: ${app.replace(/\/?$/, "/")}?sheet=${fileId}`
      : "You've been added to the Rock Team Sheet. Open the Rock Team app, choose \"Connect an existing Sheet\", and paste this link.",
  });
  await call(DRIVE + encodeURIComponent(fileId) + "/permissions?" + params, token, {
    method: "POST", contentType: "application/json", body: JSON.stringify({ type: "user", role, emailAddress: email }),
  });
}

export async function removePerson(token: string, fileId: string, permissionId: string): Promise<void> {
  await call(DRIVE + encodeURIComponent(fileId) + "/permissions/" + encodeURIComponent(permissionId), token, { method: "DELETE" });
}
