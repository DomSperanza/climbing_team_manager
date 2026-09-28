// What the app asks Google for:
// - read and write the Sheets the signed-in coach can already open (Google enforces the
//   Sheet's own sharing list on every call), and
// - "drive.file": only the Drive files this app itself created — so it can create a new team
//   Sheet and manage who it's shared with. It can't see anything else in the coach's Drive.
// - "drive.appdata": the app's own hidden settings folder in the coach's Drive, where it keeps
//   the list of team Sheets they use — so signing in on any device finds their Sheet. The
//   folder doesn't show in Drive and nothing else can read it.
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export const GOOGLE_SCOPES = [SHEETS_SCOPE, DRIVE_FILE_SCOPE, APPDATA_SCOPE];

/** Pulls the spreadsheet ID out of a pasted Sheet URL (or accepts a bare ID). */
export function spreadsheetIdFrom(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}
