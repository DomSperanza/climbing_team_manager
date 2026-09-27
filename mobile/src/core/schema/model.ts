// Typed shapes of the Sheet's rows (HANDOFF.md §2.9). Tier and block-type names are plain
// strings read from Settings at load time — never hardcode them.

import type { ISODate } from "../logic/dates";

export type Status = "Active" | "Inactive";

export interface Athlete {
  row: number; // 1-based Sheet row — where a future write goes
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  tier: string;
  currentFlashGrade: string;
  goalGrade: string;
  strengths: string;
  growthAreas: string;
  currentFocus: string;
  joinDate: ISODate | null;
  status: Status;
  notes: string;
  // The Sheet's "Age" column is deliberately not read (minors' data — HANDOFF.md §1.6).
}

export interface Coach {
  row: number;
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  coachesMonday: boolean;
  coachesTuesday: boolean;
  coachesThursday: boolean;
  otherDays: string;
  email: string;
  phone: string;
  specialties: string;
  bio: string;
  status: Status;
}

export interface ExerciseLibraryEntry {
  row: number;
  id: number;
  blockType: string;
  tier: string; // a tier name or "All Levels"
  name: string;
  description: string;
  setsRepsDuration: string;
  equipment: string;
  notesSource: string;
  addedBy: string; // the coach who put it in the library (column K) — who to ask about it
}

export interface WorkoutBlock {
  row: number;
  date: ISODate;
  group: string; // a tier name or "All Team"
  libraryItem: string;
  blockType: string;
  description: string;
  setsRepsDuration: string;
  coach: string;
  notes: string;
  minutes: number | null; // J — how long the block runs
  order: number | null; // K — its place in the practice (blank on rows typed straight into the Sheet)
}

export interface ProgressEntry {
  row: number;
  date: ISODate | null;
  athleteFullName: string;
  metricType: string;
  value: string;
  notes: string;
  loggedBy: string;
}

/** Who has which group on one practice day ("Coach Assignments" tab). Group "All Team" = the day's lead. */
export interface Assignment {
  row: number;
  date: ISODate;
  group: string;
  coach: string; // full name
}

/** One athlete at one practice ("Attendance" tab). What they did = that day's plan for `group` plus All Team blocks. */
export interface AttendanceEntry {
  row: number;
  date: ISODate;
  athlete: string; // full name, like the Progress Log
  group: string; // their group that day (usually their tier; can be changed for the day)
  here: boolean; // false = marked absent
  notes: string;
}

export interface SeasonSettings {
  tierNames: string[]; // Settings!B5:B7, the groups athletes are split into
  blockTypes: string[];
  practice: PracticeTiming; // Settings!B18:B22
}

/** Times are minutes after midnight (17:30 = 1050). */
export interface PracticeTiming {
  start: number;
  end: number;
  warmupMinutes: number;
  tierBlockMinutes: number;
  cooldownMinutes: number;
}

export interface TeamData {
  settings: SeasonSettings;
  athletes: Athlete[];
  coaches: Coach[];
  library: ExerciseLibraryEntry[];
  log: WorkoutBlock[];
  progress: ProgressEntry[];
  assignments: Assignment[];
  attendance: AttendanceEntry[];
}
