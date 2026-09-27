// A practice day's timeline. Each block has a length (Minutes, Log a Workout column J) and a
// place in the order (Order, column K); start and end times are worked out from those and
// the practice start time in Settings, so changing one block's minutes moves everything
// after it. "All Team" blocks span every tier; tier blocks run side by side, each tier on
// its own clock, and the next All Team block starts once every tier is done. A closing
// stretch/cooldown is pinned to the end of practice, leaving any unplanned time before it
// as an "open" gap.

import type { PracticeTiming, WorkoutBlock } from "../schema/model";

export const DEFAULT_PRACTICE: PracticeTiming = { start: 17 * 60 + 30, end: 20 * 60, warmupMinutes: 45, tierBlockMinutes: 90, cooldownMinutes: 15 };

/** A time cell → minutes after midnight: "5:30 PM", "17:30", or a Sheets time (fraction of a day). */
export function parseTimeOfDay(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) {
    const frac = v - Math.floor(v);
    return frac > 0 || v === 0 ? Math.round(frac * 24 * 60) : null;
  }
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.toLowerCase();
  if (h > 23 || min > 59 || (ap && (h < 1 || h > 12))) return null;
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return h * 60 + min;
}

/** 1050 → "5:30", or "5:30 PM" with `withSuffix`. */
export function formatClock(minutes: number, withSuffix = false): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 || 12;
  const t = `${h12}:${String(m % 60).padStart(2, "0")}`;
  return withSuffix ? `${t} ${h24 < 12 ? "AM" : "PM"}` : t;
}

/** 150 → "2 h 30 min", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** "10 min", "3 x 10min", "45 minutes" → 10 / 10 / 45 — for prefilling from the library. */
export function minutesFromText(s: string): number | null {
  const m = s.match(/(\d+)\s*(?:min|minutes?|mins)\b/i);
  return m ? Number(m[1]) : null;
}

/** Sort key: the Order column, then (for rows typed into the Sheet without one) Sheet row order. */
const sortKey = (b: WorkoutBlock) => (b.order ?? 1e6 + b.row);

export function inPlanOrder(blocks: WorkoutBlock[]): WorkoutBlock[] {
  return [...blocks].sort((a, b) => sortKey(a) - sortKey(b) || a.row - b.row);
}

export interface TimedBlock { block: WorkoutBlock; start: number; end: number; lane: string | null }

export interface DayTimeline {
  blocks: TimedBlock[]; // in time order: by start, then All Team before tiers, tiers in Settings order
  start: number;
  end: number; // when the last block finishes (practice start if nothing is timed)
  plannedMinutes: number;
  availableMinutes: number;
  overBy: number; // minutes past the practice end time (0 when it fits)
  untimed: number; // blocks with no minutes set
  open: { start: number; end: number } | null; // unplanned time before the closing stretch
  openBeforeRow: number | null; // the block that comes right after the open gap
}

export function dayTimeline(blocks: WorkoutBlock[], practice: PracticeTiming, tierNames: string[]): DayTimeline {
  const tiers = new Set(tierNames.filter(Boolean));
  const laneEnd = new Map<string, number>();
  let allEnd = practice.start; // when the last All Team block ends
  const timed: TimedBlock[] = [];
  const seq = inPlanOrder(blocks);
  const closing = closingStart(seq);
  const closingMinutes = seq.slice(closing).reduce((sum, b) => sum + (b.minutes ?? 0), 0);
  let open: DayTimeline["open"] = null;
  for (let i = 0; i < seq.length; i++) {
    const b = seq[i];
    if (i === closing && closing > 0) {
      const busyUntil = Math.max(allEnd, ...laneEnd.values());
      const pinned = practice.end - closingMinutes;
      if (pinned > busyUntil) {
        open = { start: busyUntil, end: pinned };
        allEnd = pinned;
        for (const k of laneEnd.keys()) laneEnd.set(k, pinned);
      }
    }
    const len = b.minutes ?? 0;
    if (tiers.has(b.group)) {
      const start = Math.max(laneEnd.get(b.group) ?? allEnd, allEnd);
      laneEnd.set(b.group, start + len);
      timed.push({ block: b, start, end: start + len, lane: b.group });
    } else {
      const start = Math.max(allEnd, ...laneEnd.values());
      allEnd = start + len;
      for (const k of laneEnd.keys()) laneEnd.set(k, allEnd);
      timed.push({ block: b, start, end: allEnd, lane: null });
    }
  }
  const end = Math.max(allEnd, ...laneEnd.values());
  const gap = open ? open.end - open.start : 0;
  return {
    blocks: byTime(timed, tierNames),
    start: practice.start,
    end,
    plannedMinutes: end - practice.start - gap,
    availableMinutes: practice.end - practice.start,
    overBy: Math.max(0, end - practice.end),
    untimed: blocks.filter((b) => b.minutes === null).length,
    open,
    openBeforeRow: open ? seq[closing].row : null,
  };
}

/** Time order for showing a day: start time, then All Team first, then tiers in Settings order. */
function byTime(timed: TimedBlock[], tierNames: string[]): TimedBlock[] {
  const rank = (t: TimedBlock) => (t.lane === null ? -1 : tierNames.indexOf(t.lane));
  return timed.map((t, i) => ({ t, i })) // i = plan position, the final tie-break
    .sort((a, b) => a.t.start - b.t.start || rank(a.t) - rank(b.t) || a.i - b.i)
    .map(({ t }) => t);
}

const isCooldown = (b: WorkoutBlock) => /stretch|cool/i.test(`${b.blockType} ${b.libraryItem}`);

/** Index where the day's closing stretch/cooldown blocks begin (seq.length if there are none). */
function closingStart(seq: WorkoutBlock[]): number {
  let i = seq.length;
  while (i > 0 && isCooldown(seq[i - 1])) i--;
  return i;
}

/**
 * Order number for a block being added to a day: at the end, but before a closing
 * stretch/cooldown, so building out an outline fills in the middle.
 */
export function orderForNew(dayBlocks: WorkoutBlock[]): number {
  const seq = inPlanOrder(dayBlocks);
  if (!seq.length) return 1;
  const eff = seq.map((b, i) => b.order ?? i + 1);
  const firstCool = closingStart(seq);
  if (firstCool === seq.length) return Math.floor(Math.max(...eff)) + 1; // no closing cooldown
  if (firstCool === 0) return eff[0] - 1; // the day is only cooldown so far
  return (eff[firstCool - 1] + eff[firstCool]) / 2;
}

/**
 * Moves one block one step earlier or later in its day, the way it looks on the timeline:
 * - a tier block swaps with the previous/next block of the same tier, or crosses the All Team
 *   block it runs into (into the neighbouring stretch of side-by-side tier blocks);
 * - an All Team block swaps with the neighbouring All Team block, or jumps a whole stretch of
 *   side-by-side tier blocks.
 * Returns the new Order for every block whose number changes (the day is renumbered 1, 2, 3…
 * so rows typed into the Sheet get numbers too). Empty when it can't move that way.
 */
export function reorder(dayBlocks: WorkoutBlock[], row: number, direction: -1 | 1, tierNames: string[]): { block: WorkoutBlock; order: number }[] {
  const tiers = new Set(tierNames.filter(Boolean));
  const seq = inPlanOrder(dayBlocks);
  const i = seq.findIndex((b) => b.row === row);
  if (i < 0) return [];
  const b = seq[i];
  const isTeam = (x: WorkoutBlock) => !tiers.has(x.group);
  // Walk from i in `direction` to the nearest block in b's lane (same tier, or any All Team block).
  let j = i + direction;
  const inLane = (x: WorkoutBlock) => (isTeam(b) ? isTeam(x) : isTeam(x) || x.group === b.group);
  while (j >= 0 && j < seq.length && !inLane(seq[j])) j += direction;
  const skipped = Math.abs(j - i) - 1; // tier blocks passed on the way (only when b is All Team)

  let target: number; // where b ends up in the sequence
  if (j < 0 || j >= seq.length) {
    if (!isTeam(b) || skipped === 0) return []; // already first/last in its lane
    target = direction < 0 ? 0 : seq.length - 1; // an All Team block jumps the last stretch
  } else if (isTeam(b) && skipped > 0) {
    target = direction < 0 ? j + 1 : j - 1; // jump the stretch of tier blocks, stop at the next All Team block
  } else if (!isTeam(b) && isTeam(seq[j])) {
    target = j; // cross the All Team block into the neighbouring stretch
  } else {
    target = j; // swap with the neighbour in the same lane
  }
  if (target === i) return [];
  const moved = [...seq];
  if (isTeam(b) && skipped === 0 || !isTeam(b) && !isTeam(seq[j] ?? b)) {
    [moved[i], moved[target]] = [moved[target], moved[i]]; // a straight swap keeps both blocks' positions
  } else {
    moved.splice(i, 1);
    moved.splice(target, 0, b);
  }
  return moved.map((block, k) => ({ block, order: k + 1 })).filter(({ block, order }) => block.order !== order);
}

/** The standard outline for an empty day, from Settings: team warm-up first, stretch last. */
export function standardOutline(practice: PracticeTiming, blockTypes: string[]) {
  const pick = (re: RegExp, fallback: string) => blockTypes.find((t) => re.test(t)) ?? fallback;
  return [
    { blockType: pick(/warm/i, "Warm-up"), description: "Team warm-up", minutes: practice.warmupMinutes, order: 1 },
    { blockType: pick(/stretch|cool/i, "Stretch/Cooldown"), description: "Team stretch / cooldown", minutes: practice.cooldownMinutes, order: 2 },
  ];
}
