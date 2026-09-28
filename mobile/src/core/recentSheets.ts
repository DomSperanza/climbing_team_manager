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
export function remember(list: KnownSheet[], sheet: { id: string; title: string }, now = Date.now(), max = MAX): KnownSheet[] {
  return [{ ...sheet, lastUsed: now }, ...list.filter((s) => s.id !== sheet.id)].slice(0, max);
}

/** Several lists as one: each Sheet once (its latest name and use), most recent first. */
export function mergeKnown(lists: { id: string; title: string; lastUsed?: number }[][], max = 10): KnownSheet[] {
  const byId = new Map<string, KnownSheet>();
  for (const list of lists) for (const s of list) {
    const had = byId.get(s.id);
    const lastUsed = s.lastUsed ?? 0;
    if (!had || lastUsed > had.lastUsed) byId.set(s.id, { id: s.id, title: s.title, lastUsed });
  }
  return [...byId.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, max);
}

export function forget(list: KnownSheet[], id: string): KnownSheet[] {
  return list.filter((s) => s.id !== id);
}

/** The Sheet ID in an invite link to the app (…/climbing_team_manager/?sheet=ID), if any. */
export function sheetFromAppLink(search: string): string | null {
  const id = new URLSearchParams(search).get("sheet");
  return id && /^[a-zA-Z0-9_-]{20,}$/.test(id) ? id : null;
}
