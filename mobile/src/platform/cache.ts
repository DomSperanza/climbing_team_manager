// On-device copy of the team data for Android and iOS (HANDOFF.md §2.6):
// - an MMKV store encrypted with AES-256,
// - its key generated randomly per install and kept in the OS keystore (Android Keystore /
//   iOS Keychain, "this device only" so it never migrates to another phone),
// - the store file kept in the app's cache directory, which iOS excludes from iCloud
//   backups; Android backups are switched off for the whole app in app.config.ts.
// The web version is cache.web.ts.

import * as Crypto from "expo-crypto";
import { Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { createMMKV, deleteMMKV, type MMKV } from "react-native-mmkv";

const STORE_ID = "rock-team-cache";
const KEY_NAME = "rock-team-cache-key";
const KEYCHAIN = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let store: Promise<MMKV> | null = null;

function storePath(): string {
  return decodeURI(Paths.cache.uri.replace(/^file:\/\//, ""));
}

async function open(): Promise<MMKV> {
  let key = await SecureStore.getItemAsync(KEY_NAME, KEYCHAIN);
  if (!key) {
    // No key means any existing store is unreadable (e.g. restored without its key) — start clean.
    try { deleteMMKV(STORE_ID); } catch { /* nothing to delete */ }
    key = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, "0")).join(""); // 32 chars = 128 random bits
    await SecureStore.setItemAsync(KEY_NAME, key, KEYCHAIN);
  }
  return createMMKV({ id: STORE_ID, path: storePath(), encryptionKey: key, encryptionType: "AES-256", recoveryStrategy: "discard-on-error" });
}

function db(): Promise<MMKV> {
  store ??= open().catch((e) => { store = null; throw e; });
  return store;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const s = (await db()).getString(key);
  return s === undefined ? undefined : (JSON.parse(s) as T);
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  (await db()).set(key, JSON.stringify(value));
}

/** Wipes everything stored. The key stays: it protects nothing on its own, and one key per
 *  install avoids re-opening a store MMKV still holds in memory under a different key. */
export async function cacheClearAll(): Promise<void> {
  (await db()).clearAll();
}
