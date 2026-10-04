// App lock for Android and iOS (HANDOFF.md §2.6): the phone's own fingerprint / face /
// PIN check before team data is shown, on launch and after the app has been in the
// background for a while. Phone encryption doesn't help when an unlocked phone is handed
// around a gym. The web version (lock.web.ts) has no lock.

import * as LocalAuthentication from "expo-local-authentication";

export const LOCK_SUPPORTED = true;

/** Re-lock after this long in the background, so switching apps mid-practice doesn't nag. */
export const RELOCK_AFTER_MS = 5 * 60_000;

/** false when the phone has no screen lock at all — then there's nothing to check against. */
export async function canLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export async function unlock(): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Climb Coach", disableDeviceFallback: false });
  return res.success;
}
