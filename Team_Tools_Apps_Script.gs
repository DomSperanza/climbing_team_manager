/**
 * TEAM TOOLS — Apps Script macros for the "Rock Team — Tiered Practice System" workbook.
 *
 * SETUP (one time):
 *  1. Upload the workbook to Google Drive, then open it — Drive converts it to a native
 *     Google Sheet automatically.
 *  2. In the open Sheet: Extensions > Apps Script.
 *  3. Delete any starter code in the editor, paste this entire file in, and save.
 *  4. Close the Apps Script tab and reload the Sheet. A "Team Tools" menu appears next to
 *     Help. First use will ask you to authorize — that's normal, it only touches this sheet.
 *
 * WHAT'S IN HERE:
 *  - Checkboxes that work as real buttons ON A PHONE, unlike everything else in this file:
 *    "new row" jump-to-next-blank-row checkboxes on Athlete Profiles, Coach Profiles,
 *    Exercise Library, and Progress Log; "today" and "clear plan" on Day View; "start
 *    today's entry" on Log a Workout; "+4 weeks" on Rotation Schedule; and per-row
 *    "Delete?" checkboxes on Athlete Profiles, Coach Profiles, and Exercise Library. All of
 *    these run off Apps Script's onEdit trigger, which reacts to the spreadsheet DATA
 *    changing — not to a UI click — so they fire the same way whether tapped in a browser
 *    or in the Sheets phone app. There's no confirmation step possible from a checkbox, so
 *    the destructive ones (Delete, Clear Plan) are labeled with a warning right on the
 *    sheet instead of a dialog. For athletes/coaches, setting Status to "Inactive" is the
 *    safer, reversible alternative to the Delete checkbox.
 *  - Button functions (see that section below): plain navigation to any tab, a "Home"
 *    button, and one-click combos. None of these create the clickable button itself —
 *    that's a manual, one-time step per button (Insert > Drawing in Sheets, then its
 *    \u22ee menu > Assign script > type the function name). Every function here is also
 *    on the Team Tools menu.
 *  - Add/Edit forms for Athletes, Coaches, and Exercise Library entries — real pop-up
 *    forms with all fields at once. Desktop only (browser, including a phone's browser at
 *    sheets.google.com — just not the Sheets app). You don't need these to add something —
 *    typing into a blank row works everywhere — they're just a nicer desktop experience.
 *  - Add More Weeks (menu, any number) / Clear This Day's Plan (menu, with confirmation):
 *    desktop-only versions of the checkboxes above, for when you want the confirmation
 *    dialog or a custom week count.
 *
 * Tab names and layout this assumes (all produced by the build script — update the
 * constants below if you rename a tab or move things around):
 *   Athlete Profiles   header row 5, data rows 6-37,   cols A-N
 *   Coach Profiles     header row 5, data rows 6-19,   cols A-N (+ hidden O:V helpers)
 *   Exercise Library   header row 5, data rows 6-120,  cols A-I
 *   Log a Workout      B3 "start today" checkbox. header row 4, data rows 5-200, cols A-H
 *                       (Date, Group, Pick from Library, Block Type, Description, Sets/Reps,
 *                       Coach, Notes) + hidden col I
 *   Day View            B3 "jump to today" checkbox, B4 date. Feed starts row 9.
 *   Progress Log        header row 4, data rows 5-260, cols A-F
 *   Settings             B5/B6/B7 tier names, A40:A47 block types
 */

// =====================================================================================
// CONSTANTS
// =====================================================================================

const SHEET_ATHLETES = "Athlete Profiles";
const SHEET_COACHES = "Coach Profiles";
const SHEET_LIBRARY = "Exercise Library";
const SHEET_DAY_VIEW = "Day View";
const SHEET_LOG = "Log a Workout";
const SHEET_PROGRESS = "Progress Log";
const SHEET_ROTATION = "Rotation Schedule";
const SHEET_CALENDAR = "Full Team Calendar";
const SHEET_SETTINGS = "Settings";

const ATHLETE_FIRST_ROW = 6, ATHLETE_LAST_ROW = 37;
const ATH = { id: 1, first: 2, last: 3, full: 4, age: 5, group: 6, flash: 7, goal: 8,
              strengths: 9, growth: 10, focus: 11, join: 12, status: 13, notes: 14 };

const COACH_FIRST_ROW = 6, COACH_LAST_ROW = 19;
const CO = { id: 1, first: 2, last: 3, full: 4, role: 5, mon: 6, tue: 7, thu: 8, other: 9,
             email: 10, phone: 11, specialties: 12, bio: 13, status: 14 };

const LIB_FIRST_ROW = 6, LIB_LAST_ROW = 120;
const LIB = { id: 1, blockType: 2, tier: 3, name: 4, description: 5, setsReps: 6, equipment: 7, notes: 8 };

const LOG_FIRST_ROW = 5, LOG_LAST_ROW = 200;
const LOG = { date: 1, group: 2, libraryItem: 3, blockType: 4, description: 5, setsReps: 6, coach: 7, notes: 8 };

const PROG_FIRST_ROW = 5, PROG_LAST_ROW = 260;
const PROG = { date: 1, athlete: 2, metric: 3, value: 4, notes: 5, loggedBy: 6 };

const METRIC_TYPES = ["Flash Grade", "Project/Redpoint Send", "Comp Placement", "Strength Benchmark", "Attendance/Effort", "Coach Note"];

// =====================================================================================
// MOBILE-COMPATIBLE CHECKBOX BUTTONS (onEdit simple trigger)
// =====================================================================================
// This is the part of the file that also works from the Sheets phone app. It fires
// because a CELL VALUE changed (a real edit, made the same way whether you tapped a
// checkbox on a phone or clicked one on a laptop) — not because something was clicked in
// a browser-only UI layer, which is what makes menus/dialogs/drawing-buttons desktop-only.
// Confirmed against Apps Script's own docs: programmatic setValue() calls (like the reset
// below) do not re-trigger onEdit, so this can't loop on itself.
//
// Two kinds of checkbox here:
//  - FIXED_ACTIONS: one specific cell per tab (e.g. Day View!B3) that runs something and
//    resets itself. No confirmation step is possible on mobile, so the risky ones (delete,
//    clear) are labeled with a warning right on the sheet instead.
//  - Per-row "Delete?" columns on Athlete Profiles, Coach Profiles, and Exercise Library —
//    checking the box in a given row clears that row and resets itself. For athletes and
//    coaches, changing Status to "Inactive" is the safer, reversible way to retire someone
//    without losing their history — the delete checkbox is for rows you genuinely want gone.

const FIXED_ACTIONS = {};
FIXED_ACTIONS[SHEET_DAY_VIEW] = {
  "B3": function(sheet) { sheet.getRange("B4").setValue(new Date()); },
  "B6": function(sheet) { clearDayPlanSilent_(sheet); },
};
FIXED_ACTIONS[SHEET_LOG] = {
  "B3": function(sheet) { startTodaysEntry_(sheet); },
};
FIXED_ACTIONS[SHEET_ATHLETES] = {
  "B4": function(sheet) { jumpToNextBlankRow_(sheet, ATH.first, ATHLETE_FIRST_ROW, ATHLETE_LAST_ROW, ATH.first); },
};
FIXED_ACTIONS[SHEET_COACHES] = {
  "B4": function(sheet) { jumpToNextBlankRow_(sheet, CO.first, COACH_FIRST_ROW, COACH_LAST_ROW, CO.first); },
};
FIXED_ACTIONS[SHEET_LIBRARY] = {
  "B4": function(sheet) { jumpToNextBlankRow_(sheet, LIB.name, LIB_FIRST_ROW, LIB_LAST_ROW, LIB.blockType); },
};
FIXED_ACTIONS[SHEET_PROGRESS] = {
  "B3": function(sheet) { jumpToNextBlankRow_(sheet, PROG.athlete, PROG_FIRST_ROW, PROG_LAST_ROW, PROG.date); },
};
FIXED_ACTIONS[SHEET_ROTATION] = {
  "B3": function(sheet) { addWeeksSilent_(4); },
};

// Per-row "Delete?" checkbox columns: sheet name -> { col: <1-based column number>, clear: fn(sheet, row) }
const DELETE_COLUMNS = {};
DELETE_COLUMNS[SHEET_ATHLETES] = { col: 15, first: ATHLETE_FIRST_ROW, last: ATHLETE_LAST_ROW, clear: clearAthleteRow_ };
DELETE_COLUMNS[SHEET_COACHES] = { col: 23, first: COACH_FIRST_ROW, last: COACH_LAST_ROW, clear: clearCoachRow_ };
DELETE_COLUMNS[SHEET_LIBRARY] = { col: 10, first: LIB_FIRST_ROW, last: LIB_LAST_ROW, clear: clearExerciseRow_ };

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (e.range.getValue() !== true) return; // only react to a box being CHECKED

    const a1 = e.range.getA1Notation();
    const fixed = FIXED_ACTIONS[name] && FIXED_ACTIONS[name][a1];
    if (fixed) {
      fixed(sheet);
      e.range.setValue(false);
      return;
    }

    const delCol = DELETE_COLUMNS[name];
    if (delCol && e.range.getColumn() === delCol.col) {
      const row = e.range.getRow();
      if (row >= delCol.first && row <= delCol.last) {
        delCol.clear(sheet, row);
        e.range.setValue(false);
      }
    }
  } catch (err) {
    // a simple trigger shouldn't throw an error into someone else's editing session
  }
}

// Finds the next row where `checkCol` is blank, moves the cursor to `landCol` in that row.
function jumpToNextBlankRow_(sheet, checkCol, firstRow, lastRow, landCol) {
  const row = findFirstEmptyRow_(sheet, checkCol, firstRow, lastRow);
  if (row === -1) return;
  try { sheet.setActiveRange(sheet.getRange(row, landCol)); } catch (err) { /* ignore */ }
}

// Finds the next fully-blank row in Log a Workout, dates it today, and — on platforms
// where this is supported — moves the cursor to that row's Group cell so typing can start
// right away. (The date-filling part is the important bit and works everywhere; the
// cursor-jump is a bonus that may not visibly scroll on every client.)
function startTodaysEntry_(sheet) {
  const row = findFirstEmptyRow_(sheet, LOG.date, LOG_FIRST_ROW, LOG_LAST_ROW);
  if (row === -1) return;
  sheet.getRange(row, LOG.date).setValue(new Date());
  try { sheet.setActiveRange(sheet.getRange(row, LOG.group)); } catch (err) { /* ignore */ }
}

// Shared "clear the editable columns, leave the ID/computed-column formulas alone" logic —
// used by both the checkbox path (silent) and the Team Tools menu path (with confirmation).
function clearAthleteRow_(sheet, row) {
  sheet.getRange(row, 2, 1, 2).clearContent();  // First, Last
  sheet.getRange(row, 5, 1, 10).clearContent(); // Age through Notes
}
function clearCoachRow_(sheet, row) {
  sheet.getRange(row, 2, 1, 2).clearContent();  // First, Last
  sheet.getRange(row, 5, 1, 10).clearContent(); // Role through Status
}
function clearExerciseRow_(sheet, row) {
  sheet.getRange(row, LIB.blockType, 1, 7).clearContent(); // Block Type through Notes (leaves ID, Times Used)
}

// Same clearing logic as clearDayPlan(), without the confirmation dialog — there is no
// dialog available when this runs from a checkbox tap, mobile included.
function clearDayPlanSilent_(dayViewSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const date = dayViewSheet.getRange("B4").getValue();
  if (!date) return;
  const log = ss.getSheetByName(SHEET_LOG);
  const dates = log.getRange(LOG_FIRST_ROW, LOG.date, LOG_LAST_ROW - LOG_FIRST_ROW + 1, 1).getValues();
  const targetTime = new Date(date).toDateString();
  for (let i = 0; i < dates.length; i++) {
    const cellDate = dates[i][0];
    if (cellDate && new Date(cellDate).toDateString() === targetTime) {
      log.getRange(LOG_FIRST_ROW + i, 1, 1, 8).clearContent();
    }
  }
}

// Same extension logic as addRotationWeeks(), for a fixed number of weeks and no prompt.
function addWeeksSilent_(n) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rotation = ss.getSheetByName(SHEET_ROTATION);
  const rLastRow = rotation.getLastRow();
  rotation.getRange(rLastRow, 1, 1, 7).copyTo(rotation.getRange(rLastRow + 1, 1, n, 7));

  const calendar = ss.getSheetByName(SHEET_CALENDAR);
  const cLastRow = calendar.getLastRow();
  const sourceBlock = calendar.getRange(cLastRow - 2, 1, 3, 5);
  for (let i = 0; i < n; i++) {
    sourceBlock.copyTo(calendar.getRange(cLastRow + 1 + i * 3, 1, 3, 5));
  }
}

// =====================================================================================
// MENU (desktop only — see note at top of file)
// =====================================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Team Tools")
    .addItem("Today's Workout", "openTodaysWorkout")
    .addItem("Start New Workout Entry", "startNewWorkoutEntry")
    .addItem("Clear This Day's Plan\u2026", "clearDayPlan")
    .addSeparator()
    .addSubMenu(ui.createMenu("Go To")
      .addItem("Home (Read Me)", "goHome")
      .addItem("Day View", "goToDayView")
      .addItem("Log a Workout", "goToLogAWorkout")
      .addItem("Athlete Profiles", "goToAthleteProfilesPage")
      .addItem("Coach Profiles", "goToCoachProfilesPage")
      .addItem("Exercise Library", "goToExerciseLibraryPage")
      .addItem("Rotation Schedule", "goToRotationSchedulePage")
      .addItem("Full Team Calendar", "goToFullTeamCalendarPage")
      .addItem("Progress Log", "goToProgressLogPage")
      .addItem("Settings", "goToSettingsPage"))
    .addSeparator()
    .addSubMenu(ui.createMenu("Athletes")
      .addItem("Add New Athlete\u2026", "showAddAthleteForm")
      .addItem("Edit Selected Athlete\u2026", "showEditAthleteForm")
      .addItem("Delete Selected Athlete\u2026", "deleteSelectedAthlete"))
    .addSubMenu(ui.createMenu("Coaches")
      .addItem("Add New Coach\u2026", "showAddCoachForm")
      .addItem("Edit Selected Coach\u2026", "showEditCoachForm")
      .addItem("Delete Selected Coach\u2026", "deleteSelectedCoach"))
    .addSubMenu(ui.createMenu("Exercise Library")
      .addItem("Add New Exercise\u2026", "showAddExerciseForm")
      .addItem("Edit Selected Exercise\u2026", "showEditExerciseForm")
      .addItem("Delete Selected Exercise\u2026", "deleteSelectedExercise"))
    .addSeparator()
    .addItem("Log Progress Entry\u2026", "showAddProgressForm")
    .addSeparator()
    .addItem("Add More Weeks to Season\u2026", "addRotationWeeks")
    .addToUi();
}

// =====================================================================================
// SMALL SHARED HELPERS
// =====================================================================================

function esc_(v) {
  return String(v === null || v === undefined ? "" : v)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function findFirstEmptyRow_(sheet, col, firstRow, lastRow) {
  for (let r = firstRow; r <= lastRow; r++) {
    if (!sheet.getRange(r, col).getValue()) return r;
  }
  return -1;
}

function selectedRowOn_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const active = ss.getActiveSheet();
  if (active.getName() !== sheetName) return -1;
  return ss.getActiveRange().getRow();
}

function tierNames_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  return [s.getRange("B5").getValue(), s.getRange("B6").getValue(), s.getRange("B7").getValue()];
}

function blockTypes_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  return s.getRange("A40:A47").getValues().map(function(r) { return r[0]; }).filter(String);
}

function optionsHtml_(values, selected) {
  return values.map(function(v) {
    const sel = (String(v) === String(selected)) ? " selected" : "";
    return '<option value="' + esc_(v) + '"' + sel + '>' + esc_(v) + '</option>';
  }).join("");
}

// shared dialog chrome — every form uses this wrapper for consistent styling
function wrapForm_(title, bodyHtml, submitFnName, hiddenFields) {
  const hidden = (hiddenFields || []).map(function(kv) {
    return '<input type="hidden" name="' + kv[0] + '" value="' + esc_(kv[1]) + '">';
  }).join("");
  return '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:16px;}' +
    'h2{font-size:16px;margin:0 0 14px 0;color:#1F3864;}' +
    'label{display:block;font-weight:bold;margin:10px 0 3px 0;}' +
    'input[type=text],input[type=number],input[type=date],select,textarea{width:100%;box-sizing:border-box;padding:6px;font-size:13px;border:1px solid #ccc;border-radius:4px;font-family:Arial,sans-serif;}' +
    'textarea{resize:vertical;min-height:44px;}' +
    '.row2{display:flex;gap:10px;} .row2>div{flex:1;}' +
    '.chk{font-weight:normal;display:inline-flex;align-items:center;gap:5px;margin-right:14px;}' +
    '.chk input{width:auto;}' +
    '.btnbar{margin-top:18px;text-align:right;}' +
    'button{font-size:13px;padding:8px 16px;border-radius:4px;border:1px solid #ccc;background:#f4f4f4;cursor:pointer;margin-left:8px;}' +
    'button.primary{background:#38761D;color:#fff;border-color:#38761D;}' +
    'button:disabled{opacity:0.6;cursor:default;}' +
    '#msg{font-size:12px;margin-top:8px;min-height:14px;}' +
    '#msg.error{color:#B00020;} #msg.pending{color:#666;}' +
    '</style></head><body>' +
    '<h2>' + esc_(title) + '</h2>' +
    '<form id="f">' + hidden + bodyHtml +
    '<div id="msg"></div>' +
    '<div class="btnbar"><button type="button" id="cancelBtn" onclick="google.script.host.close()">Cancel</button>' +
    '<button type="button" class="primary" id="saveBtn" onclick="submitForm()">Save</button></div>' +
    '</form>' +
    '<script>' +
    'function setMsg(text, cls) {' +
    '  var m = document.getElementById("msg");' +
    '  m.textContent = text || "";' +
    '  m.className = cls || "";' +
    '}' +
    'function setBusy(busy) {' +
    '  document.getElementById("saveBtn").disabled = busy;' +
    '  document.getElementById("cancelBtn").disabled = busy;' +
    '}' +
    'function submitForm(){' +
    '  try {' +
    '    if (typeof google === "undefined" || !google.script || !google.script.run) {' +
    '      setMsg("Can\\u2019t reach Google Apps Script from this dialog. Close this, reload the spreadsheet tab, and try again.", "error");' +
    '      return;' +
    '    }' +
    '    var f = document.getElementById("f");' +
    '    var data = {};' +
    '    Array.prototype.forEach.call(f.elements, function(el){' +
    '      if (!el.name) return;' +
    '      if (el.type === "checkbox") { data[el.name] = el.checked; }' +
    '      else { data[el.name] = el.value; }' +
    '    });' +
    '    setBusy(true);' +
    '    setMsg("Saving\\u2026", "pending");' +
    '    google.script.run' +
    '      .withSuccessHandler(function(){ setMsg("Saved.", "pending"); google.script.host.close(); })' +
    '      .withFailureHandler(function(err){ setBusy(false); setMsg((err && err.message) || String(err), "error"); })' +
    '      .' + submitFnName + '(data);' +
    '  } catch (e) {' +
    '    setBusy(false);' +
    '    setMsg("Something went wrong before this could even be sent: " + (e && e.message ? e.message : e), "error");' +
    '  }' +
    '}' +
    '</script></body></html>';
}

function showDialog_(html, title, width, height) {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(width).setHeight(height), title);
}

// =====================================================================================
// ATHLETES
// =====================================================================================

function athleteFormBody_(d) {
  d = d || {};
  const tiers = tierNames_();
  return (
    '<div class="row2"><div><label>First name *</label><input type="text" name="firstName" value="' + esc_(d.first) + '"></div>' +
    '<div><label>Last name *</label><input type="text" name="lastName" value="' + esc_(d.last) + '"></div></div>' +
    '<div class="row2"><div><label>Age</label><input type="number" name="age" value="' + esc_(d.age) + '"></div>' +
    '<div><label>Tier</label><select name="group">' + optionsHtml_(tiers, d.group) + '</select></div></div>' +
    '<div class="row2"><div><label>Current flash grade</label><input type="text" name="flash" value="' + esc_(d.flash) + '"></div>' +
    '<div><label>Goal grade</label><input type="text" name="goal" value="' + esc_(d.goal) + '"></div></div>' +
    '<label>Strengths</label><textarea name="strengths">' + esc_(d.strengths) + '</textarea>' +
    '<label>Growth areas</label><textarea name="growth">' + esc_(d.growth) + '</textarea>' +
    '<label>Current focus / goal</label><textarea name="focus">' + esc_(d.focus) + '</textarea>' +
    '<div class="row2"><div><label>Status</label><select name="status">' + optionsHtml_(["Active", "Inactive"], d.status || "Active") + '</select></div><div></div></div>' +
    '<label>Notes</label><textarea name="notes">' + esc_(d.notes) + '</textarea>'
  );
}

function showAddAthleteForm() {
  const html = wrapForm_("Add New Athlete", athleteFormBody_(null), "saveAthlete", [["row", ""]]);
  showDialog_(html, "Add New Athlete", 440, 620);
}

function showEditAthleteForm() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_ATHLETES);
  if (row < ATHLETE_FIRST_ROW || row > ATHLETE_LAST_ROW) {
    ui.alert("Click a cell in an athlete's row on Athlete Profiles first, then use Edit Selected Athlete.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATHLETES);
  if (!sheet.getRange(row, ATH.first).getValue()) {
    ui.alert("That row is empty — pick a row with an athlete in it, or use Add New Athlete instead.");
    return;
  }
  const v = sheet.getRange(row, 1, 1, 14).getValues()[0];
  const d = { first: v[ATH.first - 1], last: v[ATH.last - 1], age: v[ATH.age - 1], group: v[ATH.group - 1],
              flash: v[ATH.flash - 1], goal: v[ATH.goal - 1], strengths: v[ATH.strengths - 1],
              growth: v[ATH.growth - 1], focus: v[ATH.focus - 1], status: v[ATH.status - 1], notes: v[ATH.notes - 1] };
  const html = wrapForm_("Edit Athlete", athleteFormBody_(d), "saveAthlete", [["row", row]]);
  showDialog_(html, "Edit Athlete", 440, 620);
}

function saveAthlete(data) {
  const first = (data.firstName || "").trim();
  const last = (data.lastName || "").trim();
  if (!first || !last) throw new Error("First and last name are required.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATHLETES);
  let row = parseInt(data.row, 10);
  const isNew = !row;
  if (isNew) {
    row = findFirstEmptyRow_(sheet, ATH.first, ATHLETE_FIRST_ROW, ATHLETE_LAST_ROW);
    if (row === -1) throw new Error("Athlete Profiles is full. Insert more rows (copying formulas down) and try again.");
  }

  sheet.getRange(row, ATH.first).setValue(first);
  sheet.getRange(row, ATH.last).setValue(last);
  sheet.getRange(row, ATH.age).setValue(data.age || "");
  sheet.getRange(row, ATH.group).setValue(data.group || "");
  sheet.getRange(row, ATH.flash).setValue(data.flash || "");
  sheet.getRange(row, ATH.goal).setValue(data.goal || "");
  sheet.getRange(row, ATH.strengths).setValue(data.strengths || "");
  sheet.getRange(row, ATH.growth).setValue(data.growth || "");
  sheet.getRange(row, ATH.focus).setValue(data.focus || "");
  sheet.getRange(row, ATH.status).setValue(data.status || "Active");
  sheet.getRange(row, ATH.notes).setValue(data.notes || "");
  if (isNew) sheet.getRange(row, ATH.join).setValue(new Date());

  SpreadsheetApp.getActiveSpreadsheet().toast(first + " " + last + " saved.", "Athlete Profiles", 4);
}

function deleteSelectedAthlete() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_ATHLETES);
  if (row < ATHLETE_FIRST_ROW || row > ATHLETE_LAST_ROW) {
    ui.alert("Click a cell in an athlete's row on Athlete Profiles first, then use Delete Selected Athlete.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATHLETES);
  const name = sheet.getRange(row, ATH.full).getValue();
  if (!name) { ui.alert("That row is already empty."); return; }
  const resp = ui.alert("Delete Athlete", "Remove " + name + " from the roster? This can't be undone.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  clearAthleteRow_(sheet, row); // shared with the checkbox path — see that section above
  ui.alert(name + " removed.");
}

// =====================================================================================
// COACHES
// =====================================================================================

function coachFormBody_(d) {
  d = d || {};
  const monChk = d.mon ? " checked" : "", tueChk = d.tue ? " checked" : "", thuChk = d.thu ? " checked" : "";
  return (
    '<div class="row2"><div><label>First name *</label><input type="text" name="firstName" value="' + esc_(d.first) + '"></div>' +
    '<div><label>Last name *</label><input type="text" name="lastName" value="' + esc_(d.last) + '"></div></div>' +
    '<label>Role</label><select name="role">' + optionsHtml_(["Head Coach", "Assistant Coach", "Coach"], d.role) + '</select>' +
    '<label>Days coached</label>' +
    '<span class="chk"><input type="checkbox" name="mon"' + monChk + '> Monday</span>' +
    '<span class="chk"><input type="checkbox" name="tue"' + tueChk + '> Tuesday</span>' +
    '<span class="chk"><input type="checkbox" name="thu"' + thuChk + '> Thursday</span>' +
    '<label>Other days (optional)</label><input type="text" name="other" value="' + esc_(d.other) + '">' +
    '<div class="row2"><div><label>Email</label><input type="text" name="email" value="' + esc_(d.email) + '"></div>' +
    '<div><label>Phone</label><input type="text" name="phone" value="' + esc_(d.phone) + '"></div></div>' +
    '<label>Specialties / certifications</label><textarea name="specialties">' + esc_(d.specialties) + '</textarea>' +
    '<label>Bio / notes</label><textarea name="bio">' + esc_(d.bio) + '</textarea>' +
    '<div class="row2"><div><label>Status</label><select name="status">' + optionsHtml_(["Active", "Inactive"], d.status || "Active") + '</select></div><div></div></div>'
  );
}

function showAddCoachForm() {
  const html = wrapForm_("Add New Coach", coachFormBody_(null), "saveCoach", [["row", ""]]);
  showDialog_(html, "Add New Coach", 440, 620);
}

function showEditCoachForm() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_COACHES);
  if (row < COACH_FIRST_ROW || row > COACH_LAST_ROW) {
    ui.alert("Click a cell in a coach's row on Coach Profiles first, then use Edit Selected Coach.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COACHES);
  if (!sheet.getRange(row, CO.first).getValue()) {
    ui.alert("That row is empty — pick a row with a coach in it, or use Add New Coach instead.");
    return;
  }
  const v = sheet.getRange(row, 1, 1, 14).getValues()[0];
  const d = { first: v[CO.first - 1], last: v[CO.last - 1], role: v[CO.role - 1],
              mon: v[CO.mon - 1] === "Yes", tue: v[CO.tue - 1] === "Yes", thu: v[CO.thu - 1] === "Yes",
              other: v[CO.other - 1], email: v[CO.email - 1], phone: v[CO.phone - 1],
              specialties: v[CO.specialties - 1], bio: v[CO.bio - 1], status: v[CO.status - 1] };
  const html = wrapForm_("Edit Coach", coachFormBody_(d), "saveCoach", [["row", row]]);
  showDialog_(html, "Edit Coach", 440, 620);
}

function saveCoach(data) {
  const first = (data.firstName || "").trim();
  const last = (data.lastName || "").trim();
  if (!first || !last) throw new Error("First and last name are required.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COACHES);
  let row = parseInt(data.row, 10);
  const isNew = !row;
  if (isNew) {
    row = findFirstEmptyRow_(sheet, CO.first, COACH_FIRST_ROW, COACH_LAST_ROW);
    if (row === -1) throw new Error("Coach Profiles is full. Insert more rows (copying formulas down, including hidden columns O:V) and try again.");
  }

  sheet.getRange(row, CO.first).setValue(first);
  sheet.getRange(row, CO.last).setValue(last);
  sheet.getRange(row, CO.role).setValue(data.role || "");
  sheet.getRange(row, CO.mon).setValue(data.mon ? "Yes" : "No");
  sheet.getRange(row, CO.tue).setValue(data.tue ? "Yes" : "No");
  sheet.getRange(row, CO.thu).setValue(data.thu ? "Yes" : "No");
  sheet.getRange(row, CO.other).setValue(data.other || "");
  sheet.getRange(row, CO.email).setValue(data.email || "");
  sheet.getRange(row, CO.phone).setValue(data.phone || "");
  sheet.getRange(row, CO.specialties).setValue(data.specialties || "");
  sheet.getRange(row, CO.bio).setValue(data.bio || "");
  sheet.getRange(row, CO.status).setValue(data.status || "Active");

  SpreadsheetApp.getActiveSpreadsheet().toast(first + " " + last + " saved.", "Coach Profiles", 4);
}

function deleteSelectedCoach() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_COACHES);
  if (row < COACH_FIRST_ROW || row > COACH_LAST_ROW) {
    ui.alert("Click a cell in a coach's row on Coach Profiles first, then use Delete Selected Coach.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COACHES);
  const name = sheet.getRange(row, CO.full).getValue();
  if (!name) { ui.alert("That row is already empty."); return; }
  const resp = ui.alert("Delete Coach", "Remove " + name + " from Coach Profiles? This can't be undone.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  clearCoachRow_(sheet, row); // shared with the checkbox path — see that section above
  ui.alert(name + " removed.");
}

// =====================================================================================
// EXERCISE LIBRARY
// =====================================================================================

function exerciseFormBody_(d) {
  d = d || {};
  const tiers = tierNames_().concat(["All Levels"]);
  return (
    '<div class="row2"><div><label>Block type</label><select name="blockType">' + optionsHtml_(blockTypes_(), d.blockType) + '</select></div>' +
    '<div><label>Tier</label><select name="tier">' + optionsHtml_(tiers, d.tier) + '</select></div></div>' +
    '<label>Name *</label><input type="text" name="name" value="' + esc_(d.name) + '">' +
    '<label>Description / instructions</label><textarea name="description">' + esc_(d.description) + '</textarea>' +
    '<div class="row2"><div><label>Suggested sets x reps / duration</label><input type="text" name="setsReps" value="' + esc_(d.setsReps) + '"></div>' +
    '<div><label>Equipment</label><input type="text" name="equipment" value="' + esc_(d.equipment) + '"></div></div>' +
    '<label>Notes / source</label><input type="text" name="notes" value="' + esc_(d.notes) + '">'
  );
}

function showAddExerciseForm() {
  const html = wrapForm_("Add Exercise to Library", exerciseFormBody_(null), "saveExercise", [["row", ""]]);
  showDialog_(html, "Add Exercise to Library", 440, 560);
}

function showEditExerciseForm() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_LIBRARY);
  if (row < LIB_FIRST_ROW || row > LIB_LAST_ROW) {
    ui.alert("Click a cell in an exercise's row on Exercise Library first, then use Edit Selected Exercise.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LIBRARY);
  if (!sheet.getRange(row, LIB.name).getValue()) {
    ui.alert("That row is empty — pick a row with an exercise in it, or use Add New Exercise instead.");
    return;
  }
  const v = sheet.getRange(row, 1, 1, 8).getValues()[0];
  const d = { blockType: v[LIB.blockType - 1], tier: v[LIB.tier - 1], name: v[LIB.name - 1],
              description: v[LIB.description - 1], setsReps: v[LIB.setsReps - 1],
              equipment: v[LIB.equipment - 1], notes: v[LIB.notes - 1] };
  const html = wrapForm_("Edit Exercise", exerciseFormBody_(d), "saveExercise", [["row", row]]);
  showDialog_(html, "Edit Exercise", 440, 560);
}

function saveExercise(data) {
  const name = (data.name || "").trim();
  if (!name) throw new Error("Name is required.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LIBRARY);
  let row = parseInt(data.row, 10);
  const isNew = !row;
  if (isNew) {
    row = findFirstEmptyRow_(sheet, LIB.name, LIB_FIRST_ROW, LIB_LAST_ROW);
    if (row === -1) throw new Error("Exercise Library is full. Insert more rows (copying formulas down) and try again.");
  }

  sheet.getRange(row, LIB.blockType).setValue(data.blockType || "");
  sheet.getRange(row, LIB.tier).setValue(data.tier || "");
  sheet.getRange(row, LIB.name).setValue(name);
  sheet.getRange(row, LIB.description).setValue(data.description || "");
  sheet.getRange(row, LIB.setsReps).setValue(data.setsReps || "");
  sheet.getRange(row, LIB.equipment).setValue(data.equipment || "");
  sheet.getRange(row, LIB.notes).setValue(data.notes || "");

  SpreadsheetApp.getActiveSpreadsheet().toast('"' + name + '" saved.', "Exercise Library", 4);
}

function deleteSelectedExercise() {
  const ui = SpreadsheetApp.getUi();
  const row = selectedRowOn_(SHEET_LIBRARY);
  if (row < LIB_FIRST_ROW || row > LIB_LAST_ROW) {
    ui.alert("Click a cell in an exercise's row on Exercise Library first, then use Delete Selected Exercise.");
    return;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LIBRARY);
  const name = sheet.getRange(row, LIB.name).getValue();
  if (!name) { ui.alert("That row is already empty."); return; }
  const resp = ui.alert("Delete Exercise", 'Remove "' + name + '" from the library? Existing Day View entries that already used it are unaffected.', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  clearExerciseRow_(sheet, row); // shared with the checkbox path — see that section above
  ui.alert('"' + name + '" removed.');
}

// =====================================================================================
// PROGRESS LOG
// =====================================================================================

function athleteFullNames_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATHLETES);
  return s.getRange(ATHLETE_FIRST_ROW, ATH.full, ATHLETE_LAST_ROW - ATHLETE_FIRST_ROW + 1, 1)
    .getValues().map(function(r) { return r[0]; }).filter(String);
}

function showAddProgressForm() {
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const body =
    '<label>Date</label><input type="date" name="date" value="' + today + '">' +
    '<label>Athlete</label><select name="athlete">' + optionsHtml_(athleteFullNames_(), "") + '</select>' +
    '<label>Metric type</label><select name="metric">' + optionsHtml_(METRIC_TYPES, "") + '</select>' +
    '<label>Value</label><input type="text" name="value" placeholder="e.g. V6, 2nd place">' +
    '<label>Notes</label><textarea name="notes"></textarea>' +
    '<label>Logged by</label><select name="loggedBy">' + optionsHtml_(coachFullNames_(), "") + '</select>';
  const html = wrapForm_("Log Progress Entry", body, "saveProgress", []);
  showDialog_(html, "Log Progress Entry", 420, 540);
}

function coachFullNames_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COACHES);
  return s.getRange(COACH_FIRST_ROW, CO.full, COACH_LAST_ROW - COACH_FIRST_ROW + 1, 1)
    .getValues().map(function(r) { return r[0]; }).filter(String);
}

function saveProgress(data) {
  if (!data.athlete) throw new Error("Pick an athlete.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PROGRESS);
  const row = findFirstEmptyRow_(sheet, PROG.athlete, PROG_FIRST_ROW, PROG_LAST_ROW);
  if (row === -1) throw new Error("Progress Log is full. Add more rows and try again.");

  sheet.getRange(row, PROG.date).setValue(data.date ? new Date(data.date) : new Date());
  sheet.getRange(row, PROG.athlete).setValue(data.athlete);
  sheet.getRange(row, PROG.metric).setValue(data.metric || "");
  sheet.getRange(row, PROG.value).setValue(data.value || "");
  sheet.getRange(row, PROG.notes).setValue(data.notes || "");
  sheet.getRange(row, PROG.loggedBy).setValue(data.loggedBy || "");

  SpreadsheetApp.getActiveSpreadsheet().toast("Logged for " + data.athlete + ".", "Progress Log", 4);
}

// =====================================================================================
// BUTTON FUNCTIONS — assign any of these to a drawing/image (Insert > Drawing, then the
// drawing's \u22ee menu > Assign script > type the function name). Desktop/browser only —
// same limitation as the rest of Team Tools; see the note at the top of this file. Each
// one is plain navigation or a dialog trigger, safe to wire up in any order.
// =====================================================================================

function goToSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (sheet) ss.setActiveSheet(sheet);
}

// "Home" button — put this on every tab if you want a way back to Read Me from anywhere.
function goHome() { goToSheet_("Read Me"); }

// Plain navigation, no side effects.
function goToDayView() { goToSheet_(SHEET_DAY_VIEW); }
function goToLogAWorkout() { goToSheet_(SHEET_LOG); }
function goToAthleteProfilesPage() { goToSheet_(SHEET_ATHLETES); }
function goToCoachProfilesPage() { goToSheet_(SHEET_COACHES); }
function goToExerciseLibraryPage() { goToSheet_(SHEET_LIBRARY); }
function goToRotationSchedulePage() { goToSheet_(SHEET_ROTATION); }
function goToFullTeamCalendarPage() { goToSheet_(SHEET_CALENDAR); }
function goToProgressLogPage() { goToSheet_(SHEET_PROGRESS); }
function goToSettingsPage() { goToSheet_(SHEET_SETTINGS); }

// One-click combo buttons — these are the ones that match "open today's workout" /
// "build a workout for today": they navigate AND do the useful thing in a single click,
// the button equivalent of the mobile checkboxes above.
function openTodaysWorkout() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dv = ss.getSheetByName(SHEET_DAY_VIEW);
  dv.getRange("B4").setValue(new Date());
  ss.setActiveSheet(dv);
}

function startNewWorkoutEntry() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(SHEET_LOG);
  ss.setActiveSheet(log);
  startTodaysEntry_(log);
}

// =====================================================================================
// DAY VIEW HELPERS (desktop menu versions — the checkbox above covers mobile)
// =====================================================================================

function jumpToToday() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const active = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (active.getName() === SHEET_DAY_VIEW) {
    active.getRange("B4").setValue(new Date());
  } else {
    ui.alert("Switch to Day View first, then run this again.");
  }
}

/**
 * Clears every Log a Workout row matching Day View's current date — removes that day's
 * plan entirely so it can be rebuilt from scratch.
 */
function clearDayPlan() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dayView = ss.getSheetByName(SHEET_DAY_VIEW);
  const date = dayView.getRange("B4").getValue();
  if (!date) { ui.alert("Pick a date on Day View first."); return; }

  const log = ss.getSheetByName(SHEET_LOG);
  const dates = log.getRange(LOG_FIRST_ROW, LOG.date, LOG_LAST_ROW - LOG_FIRST_ROW + 1, 1).getValues();
  const targetTime = new Date(date).toDateString();
  const rowsToClear = [];
  for (let i = 0; i < dates.length; i++) {
    const cellDate = dates[i][0];
    if (cellDate && new Date(cellDate).toDateString() === targetTime) {
      rowsToClear.push(LOG_FIRST_ROW + i);
    }
  }
  if (rowsToClear.length === 0) { ui.alert("Nothing logged for this date."); return; }

  const label = Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "MMM d, yyyy");
  const resp = ui.alert("Clear This Day's Plan", "Remove all " + rowsToClear.length + " block(s) logged for " + label + "? This can't be undone.", ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;

  rowsToClear.forEach(function(r) { log.getRange(r, 1, 1, 8).clearContent(); });
  ui.alert("Cleared " + rowsToClear.length + " block(s) for " + label + ".");
}

// =====================================================================================
// SEASON LENGTH
// =====================================================================================

/**
 * Extends the season by copying the last week's formulas down N more weeks in BOTH
 * Rotation Schedule (1 row/week) and Full Team Calendar (3 rows/week), so they stay in sync.
 */
function addRotationWeeks() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt("Add More Weeks", "How many additional weeks to schedule?", ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const n = parseInt(resp.getResponseText().trim(), 10);
  if (!n || n < 1) { ui.alert("Enter a positive number of weeks."); return; }

  addWeeksSilent_(n); // shared with the checkbox path — see that section above

  ui.alert("Added " + n + " more week(s) to both Rotation Schedule and Full Team Calendar.");
}
