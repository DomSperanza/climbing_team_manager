// Exercise Library lookups. The Sheet matches names with COUNTIF/MATCH, which ignore case,
// so these do too.

import { ALL_LEVELS } from "../schema/layout";
import type { ExerciseLibraryEntry, WorkoutBlock } from "../schema/model";

const key = (s: string) => s.trim().toLowerCase();

export function timesUsed(log: WorkoutBlock[], name: string): number {
  const k = key(name);
  return k ? log.filter((b) => key(b.libraryItem) === k).length : 0;
}

export function findExercise(library: ExerciseLibraryEntry[], name: string): ExerciseLibraryEntry | undefined {
  const k = key(name);
  return k ? library.find((e) => key(e.name) === k) : undefined;
}

/** Values to prefill when a library item is picked for a workout block (still editable afterwards). */
export function autofillFromLibrary(library: ExerciseLibraryEntry[], name: string) {
  const e = findExercise(library, name);
  return e ? { blockType: e.blockType, description: e.description, setsRepsDuration: e.setsRepsDuration } : null;
}

export interface LibraryFilter { query: string; blockType: string; tier: string }

/**
 * The Library tab's filters, also used when picking an exercise for a workout. Picking a tier
 * also shows "All Levels" exercises, since those suit every tier.
 */
export function filterLibrary(library: ExerciseLibraryEntry[], f: LibraryFilter): ExerciseLibraryEntry[] {
  const q = f.query.trim().toLowerCase();
  return library
    .filter((e) => !f.blockType || e.blockType === f.blockType)
    .filter((e) => !f.tier || e.tier === f.tier || (f.tier !== ALL_LEVELS && e.tier === ALL_LEVELS))
    .filter((e) => !q || [e.name, e.description, e.equipment].some((s) => s.toLowerCase().includes(q)));
}
