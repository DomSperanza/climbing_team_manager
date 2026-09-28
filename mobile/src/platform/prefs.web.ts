// Small settings kept in the browser apart from the team data (see prefs.ts): the team
// Sheets this browser has connected to, by name and ID.

const KEY = "rt.sheets";

export async function readPref(): Promise<string | null> {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export async function writePref(value: string): Promise<void> {
  try { localStorage.setItem(KEY, value); } catch { /* private mode — the link still works */ }
}
