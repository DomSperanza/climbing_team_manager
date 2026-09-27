// On-device copy of the team data for the web version: the browser's IndexedDB. A browser has
// nowhere safer than the data itself to keep an encryption key, so encrypting here would add
// no real protection; "Sign out & clear data" wipes it.

import { clear, get, set } from "idb-keyval";

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try { return await get<T>(key); } catch { return undefined; }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  try { await set(key, value); } catch { /* private mode etc. — the app still works, just without a cache */ }
}

export async function cacheClearAll(): Promise<void> {
  try { await clear(); } catch { /* ignore */ }
}
