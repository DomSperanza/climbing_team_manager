// The web version has no app lock: a browser can't check the phone's fingerprint or PIN.

export const LOCK_SUPPORTED = false;
export const RELOCK_AFTER_MS = Infinity;
export async function canLock(): Promise<boolean> { return false; }
export async function unlock(): Promise<boolean> { return true; }
