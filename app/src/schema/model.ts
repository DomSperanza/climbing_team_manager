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

export interface SeasonSettings {
  tierNames: string[]; // Settings!B5:B7, in order — order drives the rotation
  seasonStartDate: ISODate | null;
  numberOfWeeks: number;
  blockTypes: string[];
}

export interface TeamData {
  settings: SeasonSettings;
  athletes: Athlete[];
  coaches: Coach[];
  library: ExerciseLibraryEntry[];
  log: WorkoutBlock[];
  progress: ProgressEntry[];
}
