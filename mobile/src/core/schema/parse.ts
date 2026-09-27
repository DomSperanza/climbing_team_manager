// Raw Sheets API values (valueRenderOption=UNFORMATTED_VALUE, dateTimeRenderOption=SERIAL_NUMBER)
// -> typed models. Each range starts at its tab's header row (see RANGES in layout.ts).

import { cellToISO } from "../logic/dates";
import { DEFAULT_PRACTICE, parseTimeOfDay } from "../logic/timeline";
import { ASSIGN, ATTEND, ATH, CO, LIB, LOG, PROG, RANGES, RANGE_KEYS, SETTINGS, type RangeKey } from "./layout";
import type { Assignment, AttendanceEntry, Athlete, Coach, ExerciseLibraryEntry, ProgressEntry, SeasonSettings, Status, TeamData, WorkoutBlock } from "./model";

export type Cell = string | number | boolean;
export type Rows = Cell[][];
export type RawRanges = Record<RangeKey, Rows>;

const str = (v: Cell | undefined): string => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: Cell | undefined): number => (typeof v === "number" ? v : Number(v) || 0);
/** A number, or null when the cell is blank or not a number. */
const optNum = (v: Cell | undefined): number | null => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return isFinite(n) ? n : null;
};
const status = (v: Cell | undefined): Status => (str(v).toLowerCase() === "inactive" ? "Inactive" : "Active");
const yes = (v: Cell | undefined): boolean => str(v).toLowerCase() === "yes";

/** First row number of each range, from its A1 notation (e.g. "'Log a Workout'!A4:H" -> 4). */
function firstRow(key: RangeKey): number {
  return Number(RANGES[key].match(/!A(\d+):/)![1]);
}

/** Data rows (header skipped) paired with their 1-based Sheet row numbers. */
function dataRows(raw: RawRanges, key: RangeKey): { row: number; v: Cell[] }[] {
  const start = firstRow(key);
  return (raw[key] ?? []).slice(1).map((v, i) => ({ row: start + 1 + i, v }));
}

export function parseSettings(rows: Rows): SeasonSettings {
  const at = (sheetRow: number, col: number) => rows[sheetRow - 1]?.[col];
  const blockTypes: string[] = [];
  for (let r = SETTINGS.blockTypeFirstRow; r <= SETTINGS.blockTypeLastRow; r++) {
    const v = str(at(r, SETTINGS.listCol));
    if (!v) break;
    blockTypes.push(v);
  }
  return {
    tierNames: SETTINGS.tierRows.map((r) => str(at(r, SETTINGS.valueCol))),
    blockTypes,
    practice: parsePractice(at),
  };
}

function parsePractice(at: (row: number, col: number) => Cell | undefined) {
  const d = DEFAULT_PRACTICE;
  const start = parseTimeOfDay(at(SETTINGS.practiceStartRow, SETTINGS.valueCol)) ?? d.start;
  const end = parseTimeOfDay(at(SETTINGS.practiceEndRow, SETTINGS.valueCol));
  const mins = (row: number, fallback: number) => optNum(at(row, SETTINGS.valueCol)) ?? fallback;
  return {
    start,
    end: end !== null && end > start ? end : start + (d.end - d.start),
    warmupMinutes: mins(SETTINGS.warmupMinutesRow, d.warmupMinutes),
    tierBlockMinutes: mins(SETTINGS.tierBlockMinutesRow, d.tierBlockMinutes),
    cooldownMinutes: mins(SETTINGS.cooldownMinutesRow, d.cooldownMinutes),
  };
}

export function parseTeamData(raw: RawRanges): TeamData {
  const athletes: Athlete[] = dataRows(raw, "athletes")
    .filter(({ v }) => str(v[ATH.first]) || str(v[ATH.last]))
    .map(({ row, v }) => ({
      row,
      id: num(v[ATH.id]),
      firstName: str(v[ATH.first]),
      lastName: str(v[ATH.last]),
      fullName: str(v[ATH.full]) || `${str(v[ATH.first])} ${str(v[ATH.last])}`.trim(),
      tier: str(v[ATH.group]),
      currentFlashGrade: str(v[ATH.flash]),
      goalGrade: str(v[ATH.goal]),
      strengths: str(v[ATH.strengths]),
      growthAreas: str(v[ATH.growth]),
      currentFocus: str(v[ATH.focus]),
      joinDate: cellToISO(v[ATH.join]),
      status: status(v[ATH.status]),
      notes: str(v[ATH.notes]),
    }));

  const coaches: Coach[] = dataRows(raw, "coaches")
    .filter(({ v }) => str(v[CO.first]) || str(v[CO.last]))
    .map(({ row, v }) => ({
      row,
      id: num(v[CO.id]),
      firstName: str(v[CO.first]),
      lastName: str(v[CO.last]),
      fullName: str(v[CO.full]) || `${str(v[CO.first])} ${str(v[CO.last])}`.trim(),
      role: str(v[CO.role]),
      coachesMonday: yes(v[CO.mon]),
      coachesTuesday: yes(v[CO.tue]),
      coachesThursday: yes(v[CO.thu]),
      otherDays: str(v[CO.other]),
      email: str(v[CO.email]),
      phone: str(v[CO.phone]),
      specialties: str(v[CO.specialties]),
      bio: str(v[CO.bio]),
      status: status(v[CO.status]),
    }));

  const library: ExerciseLibraryEntry[] = dataRows(raw, "library")
    .filter(({ v }) => str(v[LIB.name]))
    .map(({ row, v }) => ({
      row,
      id: num(v[LIB.id]),
      blockType: str(v[LIB.blockType]),
      tier: str(v[LIB.tier]),
      name: str(v[LIB.name]),
      description: str(v[LIB.description]),
      setsRepsDuration: str(v[LIB.setsReps]),
      equipment: str(v[LIB.equipment]),
      notesSource: str(v[LIB.notes]),
      addedBy: str(v[LIB.addedBy]),
    }));

  const log: WorkoutBlock[] = [];
  for (const { row, v } of dataRows(raw, "log")) {
    const date = cellToISO(v[LOG.date]);
    if (!date) continue; // a block with no date can't be shown on any day
    log.push({
      row,
      date,
      group: str(v[LOG.group]),
      libraryItem: str(v[LOG.libraryItem]),
      blockType: str(v[LOG.blockType]),
      description: str(v[LOG.description]),
      setsRepsDuration: str(v[LOG.setsReps]),
      coach: str(v[LOG.coach]),
      notes: str(v[LOG.notes]),
      minutes: optNum(v[LOG.minutes]),
      order: optNum(v[LOG.order]),
    });
  }

  const progress: ProgressEntry[] = dataRows(raw, "progress")
    .filter(({ v }) => str(v[PROG.athlete]))
    .map(({ row, v }) => ({
      row,
      date: cellToISO(v[PROG.date]),
      athleteFullName: str(v[PROG.athlete]),
      metricType: str(v[PROG.metric]),
      value: str(v[PROG.value]),
      notes: str(v[PROG.notes]),
      loggedBy: str(v[PROG.loggedBy]),
    }));

  const assignments: Assignment[] = [];
  for (const { row, v } of dataRows(raw, "assignments")) {
    const date = cellToISO(v[ASSIGN.date]);
    if (date && str(v[ASSIGN.group]) && str(v[ASSIGN.coach])) assignments.push({ row, date, group: str(v[ASSIGN.group]), coach: str(v[ASSIGN.coach]) });
  }

  const attendance: AttendanceEntry[] = [];
  for (const { row, v } of dataRows(raw, "attendance")) {
    const date = cellToISO(v[ATTEND.date]);
    if (!date || !str(v[ATTEND.athlete])) continue;
    attendance.push({
      row, date, athlete: str(v[ATTEND.athlete]), group: str(v[ATTEND.group]),
      here: str(v[ATTEND.here]).toLowerCase() !== "no", notes: str(v[ATTEND.notes]),
    });
  }

  return { settings: parseSettings(raw.settings ?? []), athletes, coaches, library, log, progress, assignments, attendance };
}

/** Sheets API batchGet valueRanges (in RANGE_KEYS order) -> RawRanges. */
/** Sheets API batchGet valueRanges, fetched for `keys` in that order → RawRanges (missing tabs → no rows). */
export function rawFromValueRanges(valueRanges: { values?: Rows }[], keys: RangeKey[] = RANGE_KEYS): RawRanges {
  const out = {} as RawRanges;
  RANGE_KEYS.forEach((k) => { out[k] = []; });
  keys.forEach((k, i) => { out[k] = valueRanges[i]?.values ?? []; });
  return out;
}
