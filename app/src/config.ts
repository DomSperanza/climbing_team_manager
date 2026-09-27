// The OAuth client ID comes from app/.env.local (see README): VITE_GOOGLE_CLIENT_ID=...
// It is not a secret — a web app's client ID is always visible to the browser.
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

// Read-only for Phase 2a. Phase 2b (saving) switches this to .../auth/spreadsheets.
export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

/** Pulls the spreadsheet ID out of a pasted Sheet URL (or accepts a bare ID). */
export function spreadsheetIdFrom(input: string): string | null {
  const s = input.trim();
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}
