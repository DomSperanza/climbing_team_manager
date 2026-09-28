// Small settings kept on the phone apart from the team data, so they survive "Sign out &
// clear data": the team Sheets this phone has connected to (their name and ID only — the
// Sheet itself still needs a Google sign-in). Android/iOS keep it in the OS keystore; the
// web version is prefs.web.ts.

import * as SecureStore from "expo-secure-store";

const KEY = "rock-team-sheets";

export async function readPref(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(KEY); } catch { return null; }
}

export async function writePref(value: string): Promise<void> {
  try { await SecureStore.setItemAsync(KEY, value); } catch { /* not critical — the link still works */ }
}
