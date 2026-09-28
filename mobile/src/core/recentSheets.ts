// The team Sheets a device has connected to, most recent first, so reconnecting is one tap.
// Only the Sheet's name and ID are kept — no team data — and a Google sign-in is still needed.

export interface KnownSheet { id: string; title: string; lastUsed: number }

const MAX = 5;

export function parseKnown(json: string | null): KnownSheet[] {
  try {
    const list = JSON.parse(json ?? "[]");
    return Array.isArray(list) ? list.filter((s) => s && typeof s.id === "string" && typeof s.title === "string") : [];
  } catch {
    return [];
  }
}

/** Adds or moves `sheet` to the front. */
export function remember(list: KnownSheet[], sheet: { id: string; title: string }, now = Date.now()): KnownSheet[] {
  return [{ ...sheet, lastUsed: now }, ...list.filter((s) => s.id !== sheet.id)].slice(0, MAX);
}

export function forget(list: KnownSheet[], id: string): KnownSheet[] {
  return list.filter((s) => s.id !== id);
}

/** The Sheet ID in an invite link to the app (…/climbing_team_manager/?sheet=ID), if any. */
export function sheetFromAppLink(search: string): string | null {
  const id = new URLSearchParams(search).get("sheet");
  return id && /^[a-zA-Z0-9_-]{20,}$/.test(id) ? id : null;
}
