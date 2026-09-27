// Where everything lives in the Rock Team workbook. Mirrors the constants at the top of
// Team_Tools_Apps_Script.gs (ATH / CO / LIB / LOG / PROG) — if a tab or column moves in the
// Sheet, update both. Column numbers here are 0-based offsets from column A.

export const TAB = {
  settings: "Settings",
  athletes: "Athlete Profiles",
  coaches: "Coach Profiles",
  library: "Exercise Library",
  log: "Log a Workout",
  progress: "Progress Log",
} as const;

// Tabs the app adds itself when first needed, so a Sheet without them still connects.
export const OPTIONAL_TAB = {
  assignments: "Coach Assignments", // who has which group on a given day
  attendance: "Attendance", // who was at each practice, in which group, with brief notes
} as const;

export const ATH = { id: 0, first: 1, last: 2, full: 3, age: 4, group: 5, flash: 6, goal: 7,
  strengths: 8, growth: 9, focus: 10, join: 11, status: 12, notes: 13 } as const;
export const CO = { id: 0, first: 1, last: 2, full: 3, role: 4, mon: 5, tue: 6, thu: 7, other: 8,
  email: 9, phone: 10, specialties: 11, bio: 12, status: 13 } as const;
export const LIB = { id: 0, blockType: 1, tier: 2, name: 3, description: 4, setsReps: 5,
  equipment: 6, notes: 7, /* 8 = Times Used formula, 9 = delete checkbox */ addedBy: 10 } as const;
// Header of the column the app adds to Exercise Library (K) — written on first use.
export const LIB_ADDED_BY_HEADER = "Added by";
export const LOG = { date: 0, group: 1, libraryItem: 2, blockType: 3, description: 4, setsReps: 5,
  coach: 6, notes: 7, /* 8 = hidden "Day Rk" formula */ minutes: 9, order: 10 } as const;
// Headers of the two columns the app adds to Log a Workout (J, K) — written on first use.
export const LOG_TIME_HEADERS = ["Minutes", "Order"] as const;
export const PROG = { date: 0, athlete: 1, metric: 2, value: 3, notes: 4, loggedBy: 5 } as const;
export const ASSIGN = { date: 0, group: 1, coach: 2 } as const;
export const ASSIGNMENT_HEADERS = ["Date", "Group", "Coach"] as const;
export const ATTEND = { date: 0, athlete: 1, group: 2, here: 3, notes: 4 } as const;
export const ATTENDANCE_HEADERS = ["Date", "Athlete", "Group", "Here", "Notes"] as const;

// Each range starts at the tab's header row so validation and parsing share one fetch.
// Ranges are open-ended (no last row) so data past the Sheet's formula rows is still read.
export const RANGES = {
  settings: `'${TAB.settings}'!A1:C60`,
  athletes: `'${TAB.athletes}'!A5:N`,
  coaches: `'${TAB.coaches}'!A5:N`,
  library: `'${TAB.library}'!A5:K`,
  log: `'${TAB.log}'!A4:K`,
  progress: `'${TAB.progress}'!A4:F`,
  assignments: `'${OPTIONAL_TAB.assignments}'!A1:C`,
  attendance: `'${OPTIONAL_TAB.attendance}'!A1:E`,
} as const;

export type RangeKey = keyof typeof RANGES;
export const RANGE_KEYS = Object.keys(RANGES) as RangeKey[];
/** Every tab the app reads, required or optional, by range key. */
export const TAB_NAME: Record<RangeKey, string> = { ...TAB, ...OPTIONAL_TAB };

/** The ranges to fetch from a Sheet with these tabs (optional tabs only when they exist). */
export function rangeKeysFor(sheetTitles: string[]): RangeKey[] {
  return RANGE_KEYS.filter((k) => !(k in OPTIONAL_TAB) || sheetTitles.includes(TAB_NAME[k]));
}

// Settings cells (1-based rows as seen in the Sheet, 0-based columns).
export const SETTINGS = {
  tierRows: [5, 6, 7], // B5:B7
  practiceStartRow: 18, // B18 "5:30 PM"
  practiceEndRow: 19, // B19 "8:00 PM"
  warmupMinutesRow: 20, // B20
  tierBlockMinutesRow: 21, // B21
  cooldownMinutesRow: 22, // B22
  blockTypeFirstRow: 40, // A40 downward until a blank
  blockTypeLastRow: 60,
  valueCol: 1, // column B
  listCol: 0, // column A
} as const;

// Header labels checked when a Sheet is connected. Only the columns the app actually reads
// are checked, compared case-insensitively with whitespace collapsed.
export const EXPECTED_HEADERS: Record<Exclude<RangeKey, "settings" | keyof typeof OPTIONAL_TAB>, Record<number, string>> = {
  athletes: { [ATH.first]: "First Name", [ATH.last]: "Last Name", [ATH.group]: "Group", [ATH.status]: "Status" },
  coaches: { [CO.first]: "First Name", [CO.last]: "Last Name", [CO.mon]: "Mon?", [CO.tue]: "Tue?", [CO.thu]: "Thu?", [CO.status]: "Status" },
  library: { [LIB.blockType]: "Block Type", [LIB.tier]: "Tier", [LIB.name]: "Workout / Exercise Name" },
  log: { [LOG.date]: "Date", [LOG.group]: "Group", [LOG.blockType]: "Block Type", [LOG.coach]: "Coach" },
  progress: { [PROG.date]: "Date", [PROG.athlete]: "Athlete", [PROG.metric]: "Metric Type", [PROG.value]: "Value" },
};

export const ALL_TEAM = "All Team";
export const ALL_LEVELS = "All Levels";
export const ALL_COACHES = "All Coaches";

// Rows the Sheet's own formulas, dropdowns and named ranges cover (Team_Tools_Apps_Script.gs
// *_FIRST_ROW / *_LAST_ROW). The app reads past these but only ever writes inside them, so
// every row it fills still gets its ID / Full Name formulas and shows up in the dropdowns.
export const ROW_LIMITS = {
  athletes: { first: 6, last: 37 },
  coaches: { first: 6, last: 19 },
  library: { first: 6, last: 120 },
  log: { first: 5, last: 200 },
  progress: { first: 5, last: 260 },
} as const;

// The Progress Log's Metric Type dropdown (a fixed list in the Sheet, METRIC_TYPES in the .gs).
export const METRIC_TYPES = ["Flash Grade", "Project/Redpoint Send", "Comp Placement", "Strength Benchmark", "Attendance/Effort", "Coach Note"];
