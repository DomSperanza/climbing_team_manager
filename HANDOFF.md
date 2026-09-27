# Rock Team App — Handoff to Claude Code

**Context for whoever (whatever) picks this up:** This document was produced by Claude (Sonnet) working with a volunteer parent-coach on a youth climbing team over a long iterative conversation. Phase 1 — a Google Sheets–based practice management system — is fully built, tested, and working. This handoff exists because Phase 1 hit a real wall: **Google Sheets' extensibility (custom menus, pop-up dialogs, clickable buttons) simply does not run inside the Google Sheets mobile app**, and this team's coaches will mostly use their phones. Phase 2 is a native/cross-platform app that keeps Google Sheets as the data store but replaces the UI entirely. This document exists so Phase 2 can start from full context instead of re-deriving it.

Everything in Part 1 is **done and working**. Everything in Part 2 is **planning, not yet built** — treat it as a strong starting point, not gospel; flag anything that turns out to be wrong once you're actually building.

---

## PART 0 — The People and the Problem (why any of this exists)

- One parent volunteers as a Thursday-night coach for a youth competitive climbing team (~25 athletes, roughly 5 advanced / 12 mid-range / 8 developing).
- Practices run Monday, Tuesday, Thursday. The user coaches Thursday only; a head coach runs Monday/Tuesday; there are 6 coaches total with access to the system.
- The core proposal being pitched to the head coach: split the team into 3 skill tiers and give each tier a properly individualized 90-minute block on Thursdays, on a rotating 4-week cycle (3 weeks each featuring one tier + a 4th "All Team" week), instead of everyone doing the same workout regardless of level.
- Everything built so far is designed to **also work as a pitch document** — it needs to look thoughtful and complete enough that a somewhat skeptical head coach adopts it.
- Real-world usage will mostly happen on phones, standing at a climbing gym, between belaying kids. Desktop use (by the head coach, doing admin work) is secondary but not zero.
- Six coaches will have access. It's currently a private, explicitly-shared Google Sheet (not "anyone with the link").
- **Athletes are minors.** Deliberate data-minimization decisions were made (see Part 1.6) and must carry through into the app.

---

## PART 1 — What Exists Today (Google Sheets + Apps Script)

### 1.1 The two deliverable files

1. **`Climbing_Team_Tiered_Practice_System.xlsx`** — the workbook itself. Built with `openpyxl` in Python (not by hand in Sheets), uploaded to Google Drive, where Drive auto-converts it to a native Google Sheet. All formulas, data validation, and conditional formatting survive that conversion.
2. **`Team_Tools_Apps_Script.gs`** — a companion Google Apps Script file, pasted manually into Extensions > Apps Script inside the converted Sheet. Provides a custom menu, pop-up forms, and the mobile-compatible checkbox mechanism described below.

Both are attached to this handoff. Treat the `.xlsx` as the authoritative schema — the column-by-column reference below was re-extracted directly from the live file, not from memory.

### 1.2 Tabs, in order, and what's in each

The workbook deliberately front-loads the three tabs used constantly and pushes admin/reference tabs later. Tab order in the actual file:

`Read Me → Log a Workout → Day View → Athlete Profiles → Coach Profiles → Exercise Library → Rotation Schedule → Full Team Calendar → Progress Log → Settings`

**Read Me** — pure documentation, no data. Explains the system, has a table of suggested Apps Script buttons to wire up manually (see 1.5), color legend. Not relevant to the app's data model.

#### Athlete Profiles
Header row 5, data rows 6–37 (32 athlete slots). Columns:

| Col | Field | Notes |
|---|---|---|
| A | ID | Formula: `=IF(B6="","",ROW()-5)` — sequential, self-blanking. Don't try to write to this. |
| B | First Name | |
| C | Last Name | |
| D | Full Name | Formula: `=IF(B6="","",TRIM(B6&" "&C6))`. Used as the display name everywhere else (dropdowns, Progress Log, etc). |
| E | Age | **Slated to change** — see 1.6, this should become a USA Climbing category field instead. |
| F | Group | Dropdown sourced from `Settings!B5:B7` (the three tier names — configurable, don't hardcode "Advanced/Intermediate/Developing" as literal strings anywhere important). |
| G | Current Flash Grade | Free text, e.g. "V6" |
| H | Goal Grade | Free text |
| I | Strengths | Free text |
| J | Growth Areas | Free text |
| K | Current Focus / Goal | Free text |
| L | Join Date | Date |
| M | Status | Dropdown: Active / Inactive. **This is the "soft delete" — prefer this over removing a row.** |
| N | Notes | Free text — coaches were told to keep this climbing-specific, not medical/personal. |
| O | ⚠ Delete? | Checkbox (see 1.5). Hard-deletes the row's editable fields when checked. |

Row 3 = live COUNTIF summary by tier. Row 4 = a "New:" checkbox that jumps the cursor to the next blank row (mobile-compatible convenience). Named ranges: `RosterFullNames` = `D6:D37`, `RosterGroupCol` = `F6:F37`.

#### Coach Profiles
Header row 5, data rows 6–19 (14 coach slots). Columns A–N mirror the athlete pattern:

| Col | Field |
|---|---|
| A | ID (formula) |
| B | First Name |
| C | Last Name |
| D | Full Name (formula) |
| E | Role — free-typed, examples used: "Head Coach", "Coach" |
| F | Mon? — Yes/No dropdown |
| G | Tue? — Yes/No dropdown |
| H | Thu? — Yes/No dropdown |
| I | Other Days — free text |
| J | Email |
| K | Phone |
| L | Specialties / Certifications |
| M | Bio / Notes |
| N | Status — Active/Inactive |

Then **hidden helper columns** used purely to drive rotation logic (the app should either replicate this logic in code, or just read the *output*, not the mechanism):
- O = spacer (hidden, width 3)
- P, Q, R = "Mon Rk" / "Tue Rk" / "Thu Rk" — a running COUNTIFS rank of active coaches flagged Yes for that day, in row order. Formula pattern: `=IF(AND($F6="Yes",$N6="Active"),COUNTIFS($F$6:$F6,"Yes",$N$6:$N6,"Active"),"")`
- S = spacer (hidden)
- T, U, V = "Monday order" / "Tuesday order" / "Thursday order" — an 8-slot ordered list of coach names per day, built via `INDEX/MATCH` against the rank columns. This is what actually gets referenced elsewhere (named ranges `MondayCoachList`/`TuesdayCoachList`/`ThursdayCoachList` = `T6:T13`/`U6:U13`/`V6:V13`).
- W = "⚠ Delete?" checkbox (visible again, placed after the hidden block).

**Why this matters for the app:** "who's the lead coach this Thursday" is computed by cycling through `ThursdayCoachList` week-over-week with `MOD()`. The app needs equivalent logic — see 2.4.

Named range `AllCoachNames` = `D6:D19` (all coach full names, any day).

#### Exercise Library
Header row 5, data rows 6–120. This is a reusable catalog of workout blocks, seeded with ~21 real entries pulled from the team's actual historical practice plans.

| Col | Field |
|---|---|
| A | ID (formula) |
| B | Block Type | Dropdown from `Settings!A40:A47` (Warm-up, Strength, Power, Technique/Skill, Coordination/Balance, Core, Stretch/Cooldown, Other) |
| C | Tier | Dropdown: the 3 tier names + "All Levels" |
| D | Workout / Exercise Name | The short title used as the lookup key elsewhere |
| E | Description / Instructions | Free text, often long |
| F | Suggested Sets x Reps / Duration | |
| G | Equipment | |
| H | Notes / Source | |
| I | Times Used | Formula: `=COUNTIF('Log a Workout'!$C$5:$C$200,D6)` — counts how often this exact name has been picked in the log |
| J | ⚠ Delete? | Checkbox |

Named range `ExerciseNames` = `D6:D120`.

#### Log a Workout — the primary write-heavy data table
Header row 4, data rows 5–200. **This is functionally the "workouts logged" table** — one row per exercise block, per date, per group. This is the table the app will write to most.

| Col | Field |
|---|---|
| A | Date | |
| B | Group | Dropdown: 3 tiers + "All Team" |
| C | Pick from Library | Dropdown sourced from `ExerciseNames`. Optional — if set, columns D/E/F auto-fill via formula (see below); if left blank, D/E/F are typed directly. **This column doubles as the "which library item was used" field that drives Exercise Library's Times Used counter** — don't treat it as purely cosmetic. |
| D | Block Type | Formula when C is set: `=IFERROR(INDEX('Exercise Library'!$B$6:$B$120,MATCH(C5,ExerciseNames,0)),"")`; otherwise typed directly, overwriting the formula. |
| E | Description | Same auto-fill pattern, pulling from Exercise Library column E |
| F | Sets x Reps / Duration | Same pattern, pulling from column F |
| G | Coach | Dropdown from `AllCoachNames` |
| H | Notes | Free text |
| I | Day Rk (hidden) | Formula rank of this row among all rows matching Day View's currently-selected date — purely a spreadsheet-formula mechanism to let Day View pull "block 1, block 2..." for whichever date is selected there. **The app does not need to replicate this** — it's a workaround for spreadsheet formulas not having real query capability. The app should just filter/query rows by date directly. |

Named range `LogDayRank` = `I5:I200`.

Row 3 has a "Start today's entry:" checkbox — see 1.5.

**Important nuance already learned the hard way:** an earlier design had a *separate* "Build a Workout" staging sheet that required an Apps Script macro to copy finished rows into the log. This was removed specifically because the macro didn't work on mobile. Log a Workout is now written to *directly* — there is no staging/copy step. Do not reintroduce one.

#### Day View — read-only, mobile-optimized feed
This tab has no data of its own — it's a live formula-driven *view* over Log a Workout, deliberately built as a single narrow column (widths ~11 each, columns A–D only) so it reads top-to-bottom on a phone with zero horizontal scrolling.

- B3 = "Today" checkbox (see 1.5)
- B4 = the selected date (defaults to `=TODAY()`)
- B6 = "⚠ Clear plan" checkbox (see 1.5) — destructive, no confirmation possible from a checkbox, deliberately labeled with a warning
- A5 = a formula line: `"Coaches: X • Featured tier: Y"` pulled from Full Team Calendar
- A7 = a status line: "N block(s) planned" or "Nothing logged yet"
- Rows 9–53 = 15 repeating 3-row "slots" (header / description / meta), each pulling one matching Log a Workout row via the Day Rk mechanism, color-coded by tier.

**For the app: this entire tab is just "show me Log a Workout rows where Date = X, nicely formatted." Don't replicate the spreadsheet mechanism — just query.**

#### Rotation Schedule
Header row 4, data rows 5–20 (16 weeks by default). Thursday-only. Columns: Week #, Date (chained formula from `Settings!SeasonStart`, +7 each row), Cycle Week 1–4 (`=MOD(A5-1,4)+1`), Featured Tier (`=IF(C5=4,"All Team",INDEX(GroupNamesRange,C5))`), Lead Planning Coach (cycles through `ThursdayCoachList` via `MOD`), Other Groups This Week (free text — a real open question the coaches still need to settle), Notes.

Row 3 = "Add 4 weeks" checkbox (see 1.5).

**This tab is the actual source of truth for "which tier is featured this Thursday" — the core business logic of the whole proposal.** The app must replicate this rotation math exactly (see 2.4 for the exact formula translated to pseudocode).

#### Full Team Calendar
Header row 4, data rows 5–52 (16 weeks × 3 rows/week: Mon, Tue, Thu). Composed from Rotation Schedule (for Thursday rows) plus its own Mon/Tue coach-rotation logic (same `MOD`-over-ordered-list pattern, using `MondayCoachList`/`TuesdayCoachList`). Gives a full-season, all-three-days-a-week view. Monday/Tuesday format is intentionally left as free text — this proposal doesn't dictate what the head coach does those days, just gives it a place on the same calendar.

#### Progress Log
Header row 4, data rows 5–260. One row per data point: Date, Athlete (dropdown from `RosterFullNames`), Metric Type (dropdown: Flash Grade / Project-Redpoint Send / Comp Placement / Strength Benchmark / Attendance-Effort / Coach Note), Value, Notes/Context, Logged By (dropdown from `AllCoachNames`). Row 3 = "New row" checkbox.

#### Settings — the control panel
Not really "data" so much as configuration the rest of the workbook reads from:
- `B5:B7` — the three tier names (renamable; nothing elsewhere should hardcode "Advanced/Intermediate/Developing")
- `B16` — season start date (must be a Thursday)
- `B17` — number of weeks scheduled
- `B18:B22` — Thursday practice timing (start/end time, warm-up/block/cooldown minutes) — informational, not used in rotation math
- `A40:A47` — the 8 Block Types, editable list
- Full named-range list (all confirmed live in the file):

```
GroupAName          -> Settings!$B$5
GroupBName           -> Settings!$B$6
GroupCName           -> Settings!$B$7
GroupNamesRange      -> Settings!$B$5:$B$7
GroupPlusAllTeam     -> Settings!$A$34:$A$37
GroupPlusAllLevels   -> Settings!$C$34:$C$37
BlockTypesList       -> Settings!$A$40:$A$47
SeasonStart          -> Settings!$B$16
NumWeeks             -> Settings!$B$17
RosterFullNames      -> 'Athlete Profiles'!$D$6:$D$37
RosterGroupCol       -> 'Athlete Profiles'!$F$6:$F$37
AllCoachNames        -> 'Coach Profiles'!$D$6:$D$19
MondayCoachList      -> 'Coach Profiles'!$T$6:$T$13
TuesdayCoachList     -> 'Coach Profiles'!$U$6:$U$13
ThursdayCoachList    -> 'Coach Profiles'!$V$6:$V$13
LogDayRank           -> 'Log a Workout'!$I$5:$I$200
ExerciseNames        -> 'Exercise Library'!$D$6:$D$120
```

### 1.3 Design decisions already made about the Sheet itself (and why)

- **Every column with a fixed vocabulary (tier, block type, status, etc.) is a data-validation dropdown**, and every dropdown list is sourced from a named range that itself points back to Settings — so renaming a tier in one place propagates everywhere. The app's dropdown/picker options should be fetched live from these ranges too, not hardcoded, for the same reason.
- **No formula in the workbook ever hardcodes a computed business value** (like which week has which featured tier) — it's always derived live from Settings + Coach Profiles' day-flags. Rotation, coach ordering, and date math all cascade from `SeasonStart` and the coach day-flags. The app should treat those two things (season start date, per-coach day flags) as the real inputs and compute everything else, exactly like the Sheet does.
- **ID and Full-Name-style formula columns must never be overwritten**, including by any delete operation — clearing a row must leave those formula cells alone so a reused row keeps working. (This was a real bug caught and fixed during development — a naive "clear the whole row" delete wiped the ID formula permanently.)
- A hidden gotcha worth passing on: **openpyxl-authored rows with `wrap_text=True` must NOT have an explicit row height set**, or the row renders as a fixed height and clips wrapped text instead of auto-sizing. Not directly relevant to the app, but if Claude Code ever needs to touch the `.xlsx` generation script (`build_workbook.py`, also available), this bit them once already.

### 1.4 Apps Script (`Team_Tools_Apps_Script.gs`) — what it does and its one hard limitation

Two completely different mechanisms live in this file, and the distinction between them is the entire reason this handoff exists:

**A. Checkboxes driven by `onEdit(e)` — the ONLY thing confirmed to work on the Sheets phone app.** `onEdit` is a "simple trigger" that fires because a cell's *value* changed — a real data mutation that flows through Google's backend identically regardless of which client made the edit. It is not a UI-click handler, so it doesn't need the web client's JS layer that the phone app doesn't load. Checkboxes exist at:
- `Day View!B3` ("today"), `Day View!B6` ("clear plan")
- `Log a Workout!B3` ("start today's entry")
- `Athlete Profiles!B4` ("new row"), `Athlete Profiles!O6:O37` (per-row delete)
- `Coach Profiles!B4` ("new row"), `Coach Profiles!W6:W19` (per-row delete)
- `Exercise Library!B4` ("new row"), `Exercise Library!J6:J120` (per-row delete)
- `Progress Log!B3` ("new row")
- `Rotation Schedule!B3` ("add 4 weeks")

Implementation pattern: a `FIXED_ACTIONS` object keyed by sheet name → A1 cell → handler function, and a `DELETE_COLUMNS` object keyed by sheet name → column number → clear-function, both dispatched from one `onEdit(e)`. Checkboxes reset themselves to `false` after firing (confirmed safe against Google's own docs: programmatic `setValue()` calls do not re-trigger `onEdit`, so there's no infinite-loop risk).

**B. Everything else — custom menu ("Team Tools"), pop-up HTML forms (Add/Edit Athlete/Coach/Exercise), and "Assign Script" drawing-buttons — is desktop/browser-only.** Confirmed directly from Google's own docs: *"The script execution is only triggered by clicking the image or drawing in a web browser. The script doesn't execute if the image or drawing is clicked on mobile."* Custom menus and `HtmlService` dialogs have the identical limitation — none of it renders inside the Sheets phone app.

**This is the exact gap Phase 2 (the app) exists to close.** The app replaces all of Category B with real native UI, while Category A (the data itself, and the checkbox-driven actions) becomes redundant once the app exists — the app talks to the same underlying cells directly.

### 1.5 What actually got tested, and how (so you don't have to re-derive trust in this)

This system was built and verified in an environment without live Google Sheets access, so testing was done rigorously against mocks:
- The `.xlsx` was validated with a full formula-recalculation pass (LibreOffice headless) after every significant change — final state: 0 formula errors across ~1,750 formulas.
- The `.gs` file was syntax-checked with `node --check`, then functionally tested by loading it into a Node `vm` context with a hand-built mock `SpreadsheetApp`/sheet/range object graph, and literally invoking `onEdit()` and the form-submission handlers with realistic (including deliberately adversarial — quotes, apostrophes, HTML-like text) data, asserting on the resulting mock-sheet state. This caught several real bugs before they reached the user (a delete function that was destroying formula cells; a form-generation function assumed working that actually silently failed on save because of a client-side JS reference error only visible when the generated HTML was loaded into a real DOM via `jsdom` and clicked).
- **What was never verified: actual behavior inside a live Google Sheet.** Mocks are only as good as their fidelity to the real API. Google's `SpreadsheetApp` service has surface area no mock fully replicates (real auth flows, real quota behavior, real DOM sandboxing inside HtmlService dialogs, real mobile-app rendering). Treat this as "very likely correct, rigorously tested against the best available proxy," not "guaranteed."

### 1.6 Minors' data — decisions already made, must carry into the app

The athletes are minors. Deliberate choices, made after discussion in this conversation:

- **No birthdates, no exact age.** Currently the Sheet still has a raw numeric "Age" column (`Athlete Profiles!E`) — **this has NOT been updated in the actual file yet.** The agreed direction is to replace it with a **USA Climbing age category** field instead (e.g., U13/U15/U17/U19/U20 as of the 2025–26 season, plus U11 with no minimum age as of a recent rule change) — but **do not hardcode these category names.** USA Climbing has changed this exact taxonomy more than once recently (they used a Youth D/C/B/A/Jr system before the 2024–25 season, switched to the U-number system, and adjusted U11/U13 boundaries again for 2025–26). Build this the same way Block Types is built in the Sheet: an editable list in Settings that the category dropdown reads from, not a hardcoded enum. Verify the current official category list against USA Climbing's site at build time rather than trusting this document's snapshot of it.
- **No photos.** Not planned, treated as a deliberate line not to cross without a separate, explicit decision later.
- **Coach notes should stay climbing-specific.** The working example given for what belongs in a note: *"fingers are feeling more sore than normal, take it easy for a little while."* Not medical records, not family/personal circumstances. Consider a placeholder/hint in the app's note-entry UI reinforcing this norm.
- **Access is currently exactly 6 named coaches**, via the Sheet's own private sharing (explicitly added people only, not "anyone with the link"). This is intentionally the *entire* access-control mechanism — there is no separate permissions system layered on top, and the app should not build one either (see 2.5 — it should inherit this for free).
- **Legal framing (not legal advice, not verified by a lawyer):** COPPA is triggered by collecting information *from* a child; here, adults (coaches) enter data *about* children who never interact with the system themselves — closer to the posture of comparable real youth-sports-roster products (e.g., "children do not have accounts... we do not knowingly collect personal information directly from a child"). Likely outside COPPA's core trigger for a single-team internal tool, but if this ever becomes something other gyms/teams install and sign up for independently, revisit this with an actual lawyer — the calculus changes meaningfully at that point.

---

## PART 2 — What We Want Built Next (Phase 2: the app)

### 2.1 The one-sentence brief

A phone-first (and secondarily desktop-usable) app that replicates all of the Google Sheets system's functionality with real native UI, using the same Google Sheet purely as the data store — **no custom backend server, ever.**

### 2.2 Why no server, and why that's actually achievable (not just a cost-driven wish)

The user's primary motivation is avoiding an ongoing hosting bill. This turns out to be architecturally sound, not just cost-driven:

- **Auth:** Google explicitly supports OAuth 2.0 with PKCE for "Installed application" client types (Android / iOS / Desktop app, registered in Google Cloud Console). This flow is specifically designed for public clients that can't protect a secret — no backend is needed to broker the token exchange. Verified directly against Google's own OAuth documentation.
- **Data:** with a valid access token, the app calls the Google Sheets API (and Drive API, for letting the user pick which spreadsheet to connect) directly from the device over HTTPS. No proxy server needed.
- **Practical implication:** the app can be a genuinely static, serverless artifact. If distributed as a real native app (installed via app store or sideload), there is zero ongoing hosting cost or process. If distributed as a PWA instead (see 2.7), there's only free static-file hosting (GitHub Pages / Cloudflare Pages / Netlify free tier) for the app shell itself — not a running server.

### 2.3 Sync model — explicitly NOT full offline-first bidirectional sync

This was a deliberate, hard-fought scoping decision and should not be relitigated without good reason:

- **Reads are cached locally** for instant app startup and offline *viewing*. Pull-to-refresh re-fetches from the Sheets API when online.
- **Writes require an active connection and valid auth at the moment of writing.** They go straight through to the Sheets API. There is no offline write queue and no merge/conflict-resolution logic to build. If the device is offline, write actions are simply disabled/grayed out with a clear "reconnect to save this" message.
- **Why:** true offline-first editing (edit while offline, reconcile conflicting edits from multiple people later) is a genuinely hard, easy-to-underestimate distributed-systems problem — picture two coaches both offline, both editing the same athlete's notes on different days, then both syncing; whose edit wins, or how do you merge? For a team this size, "no signal for an entire practice" is a real but rare edge case, not the common case, so this complexity isn't worth taking on for v1. If real usage later proves this insufficient, revisit — don't build it speculatively.
- **Residual risk even in this simpler model:** two coaches, both online, both editing the same row within seconds of each other, can still race if writes are implemented as "read whole row → edit locally → write whole row back." Mitigate by writing to specific cell ranges via the Sheets API rather than whole-row overwrites — this shrinks the collision surface to "two people editing the literal same cell within seconds," which is an acceptable residual risk for a volunteer coaching staff.

### 2.4 Business logic that must move from spreadsheet formulas into real app code

This is the single most underestimated piece of this whole project. None of the following formulas transfer automatically just because the app reads the same cells — they need to become real functions:

- **Thursday rotation:** `cycleWeek = ((weekNumber - 1) mod 4) + 1`; if `cycleWeek == 4` → "All Team", else the featured tier is the `cycleWeek`-th entry in the ordered tier-names list (`Settings!B5:B7` equivalent).
- **Lead coach rotation (per day):** build an ordered list of coaches flagged active + "Yes" for that day (in whatever row order they appear in Coach Profiles — this order is the actual rotation order, so preserve it, e.g. by the row/creation order in the app's own coach table), then `leadCoach = orderedList[(weekIndex) mod orderedList.length]`. This exact pattern applies independently to Monday, Tuesday, and Thursday.
- **Season date math:** `date(week N) = SeasonStart + 7 * (N - 1)` for Thursdays; Monday/Tuesday of the same week are `SeasonStart - 3` and `SeasonStart - 2` respectively (relative to that week's Thursday).
- **Exercise Library auto-fill:** picking a library item by name should look up and prefill Block Type / Description / Sets-Reps, exactly like the Sheet's `INDEX/MATCH` does — but the app should let the coach still freely overwrite the prefilled values (matches the Sheet's UX: formula until you type over it).
- **Times Used counter:** count how many Log a Workout rows reference a given Exercise Library entry by name.

None of this is exotic, but all of it needs a real home in the app's code — it should not be re-derived from spreadsheet cell values at read time (that would mean re-reading and re-computing across potentially hundreds of rows on every screen load; better to store/compute it properly in the app's own data layer and treat the Sheet purely as flat storage for the underlying facts: season start date, per-coach day-flags, and logged workout rows).

### 2.5 Auth, sheet selection, and access control

- OAuth flow via a library that supports PKCE properly on React Native (e.g. `expo-auth-session` with PKCE, or `react-native-app-auth`) — client-side only, no server leg.
- After auth, use the Drive API to list the user's spreadsheets (or a proper file-picker UI) so they can select which sheet to connect.
- **Validate the selected sheet's schema before trusting it** — check that the expected tab names and header rows exist and match, and give a clear, specific error ("this doesn't look like a Rock Team sheet — missing an 'Athlete Profiles' tab") rather than a wall of API errors if someone picks the wrong file.
- **Access control is entirely inherited from the Sheet's own sharing permissions — do not build a separate permission system.** Because each user authenticates with their *own* Google account and every API call is made as that user, Google enforces whatever the Sheet's sharing list says automatically. Revoking someone's access (e.g., a lost phone) means removing them from the Sheet's sharing list — nothing app-side needs to change.
- Rate limits are not a practical concern at this scale (Sheets API defaults to roughly 300 read requests/minute/project, 60 write requests/minute/user) — just don't build anything that polls constantly; pull-to-refresh is the right pattern.

### 2.6 Local storage and security (device-side)

Two different things, two different protection mechanisms — don't conflate them:

- **Small secrets (OAuth tokens):** OS-level secure storage — iOS Keychain / Android Keystore, via `expo-secure-store`. Built for exactly this.
- **Bulk cached data (roster, logs, everything else):** an encrypted local store — `react-native-mmkv` with encryption enabled is the recommended starting point (fast key-value storage, each logical "table" as a JSON blob under its own key); step up to SQLite + SQLCipher only if real relational queries against the local cache turn out to be needed, which is unlikely at this data volume (a few dozen athletes, one season of logs).
- **The encryption key for the bulk store must itself live in the OS secure storage**, not hardcoded in the app (a hardcoded key protects nothing — anyone can pull it from the app bundle). Generate a random key per install, store it via `expo-secure-store`, use it to encrypt the MMKV store. Standard envelope-encryption shape.
- **Add an app-level lock** (biometric/PIN via `expo-local-authentication`) on app open. Device/file encryption doesn't protect against someone picking up an already-unlocked phone, and given what's stored here, that's worth the small extra friction.
- **Exclude the local encrypted data file from OS device backups** (iCloud/Google backup) — otherwise an encrypted-on-device copy can end up duplicated into cloud backup infrastructure without that ever being a deliberate decision.

### 2.7 Distribution — recommended starting point

Two real options, explicitly not equally recommended for v1:

- **React Native (Expo) native app** — the "real" long-term answer, and Expo's cloud build service (EAS Build) means an iOS build doesn't require owning a Mac. But real iPhone distribution still requires an Apple Developer Program membership ($99/year) and App Store (or at minimum TestFlight) review, which is friction and ongoing cost for what's currently a free volunteer project. Android is cheaper/easier (Play Store is a one-time $25, or sideload an APK entirely free, though sideloading is friction-y for non-technical coaches).
- **PWA (mobile web app, "Add to Home Screen")** — **recommended starting point.** No app-store fees, no review process, works passably on both iOS and Android via Add to Home Screen, deployable instantly, iterable without any review wait. Gets ~80% of the "feels like a real app" outcome for a fraction of the distribution overhead. React Native remains the right *upgrade* path later if the team outgrows a PWA's limitations (push notifications, deeper offline storage, a more native feel) — but shouldn't be the starting point given this is a volunteer project without dedicated engineering resources.

### 2.8 Recommended phasing for the build itself

1. **Phase 2a — read-only, fast, native-feeling viewer.** Day View (today's plan), Athlete Profiles (browse/search), Coach Profiles (browse), Exercise Library (browse). Pulled from the Sheet, cached locally for offline viewing. No writes at all. This alone solves the majority of the original complaint ("this looks terrible on my phone") for a fraction of the engineering of the full system, and has zero sync-conflict surface since nothing is written back.
2. **Phase 2b — online-required writes.** Log a workout entry, add/edit/delete an athlete or coach, add an exercise, log a progress entry. All direct write-through per 2.3 — no offline queue.
3. **Phase 2c — optional, likely unnecessary.** True offline-first editing with conflict resolution. Only build this if real usage after 2a/2b actually demonstrates it's needed.

### 2.9 Suggested data model (TypeScript-flavored, derived directly from the Sheet schema in Part 1)

```ts
type Tier = string; // one of Settings!B5:B7 at read time — never hardcode the 3 names
type BlockType = string; // one of Settings!A40:A47 at read time
type Status = "Active" | "Inactive";
type Weekday = "Monday" | "Tuesday" | "Thursday";

interface Athlete {
  id: number;             // Athlete Profiles!A (row-derived; stable within a season)
  firstName: string;
  lastName: string;
  usacCategory: string;   // REPLACES the old "age" column — see 1.6, keep this an open string driven by a configurable list, not an enum
  tier: Tier;
  currentFlashGrade: string;
  goalGrade: string;
  strengths: string;
  growthAreas: string;
  currentFocus: string;
  joinDate: string;        // ISO date
  status: Status;
  notes: string;
}

interface Coach {
  id: number;
  firstName: string;
  lastName: string;
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

interface ExerciseLibraryEntry {
  id: number;
  blockType: BlockType;
  tier: Tier | "All Levels";
  name: string;             // the lookup key used by WorkoutBlock.libraryItem
  description: string;
  setsRepsDuration: string;
  equipment: string;
  notesSource: string;
  // timesUsed: derive in-app by counting WorkoutBlock rows referencing this name — don't store redundantly
}

interface WorkoutBlock {          // one row of "Log a Workout"
  date: string;                   // ISO date
  group: Tier | "All Team";
  libraryItem?: string;           // name of an ExerciseLibraryEntry, if picked from the catalog
  blockType: BlockType;
  description: string;
  setsRepsDuration: string;
  coach?: string;                 // coach full name
  notes: string;
}

interface ProgressEntry {
  date: string;
  athleteFullName: string;
  metricType: "Flash Grade" | "Project/Redpoint Send" | "Comp Placement" | "Strength Benchmark" | "Attendance/Effort" | "Coach Note";
  value: string;
  notes: string;
  loggedBy: string;                // coach full name
}

interface SeasonSettings {
  tierNames: [Tier, Tier, Tier];   // Settings!B5:B7, in order — order matters for rotation math
  seasonStartDate: string;         // ISO date, must be a Thursday
  numberOfWeeks: number;
  blockTypes: BlockType[];         // Settings!A40:A47, editable
  usacCategories: string[];        // NEW — configurable list, see 1.6, do not hardcode
}
```

### 2.10 Open questions Claude Code (or whoever builds this) should resolve before/while building — not yet decided

1. **React Native vs. PWA for v1** — this document recommends PWA for speed/cost, but it's the user's call, not locked in.
2. **Does the Google Sheet stay "pretty" (formulas, conditional formatting) for anyone who still opens it directly on desktop, or does it get simplified into flatter data once the app is the primary interface?** Recommendation: keep the existing formulas — they don't hurt anything and preserve the desktop experience already built and tested — but this means the app's business logic (2.4) and the Sheet's formulas are now two independent implementations of the same rules, which can drift. Worth a conscious decision either way, not a default.
3. **Exact USA Climbing category list and boundary rules** — verify live against USA Climbing's current published categories before building the field; this document's snapshot (U11/U13/U15/U17/U19/U20-ish, as of the 2025–26 season) should not be trusted as current without a fresh check, given how often USAC has revised this recently.
4. **Single-team tool vs. multi-team product** — everything in this document assumes this is being built for this one team. If it's ever meant to be installed independently by other gyms/teams, revisit: the OAuth "testing mode" 100-user ceiling becomes a real constraint, the minors'-data legal posture in 1.6 gets meaningfully more serious, and the schema-validation-on-sheet-selection work in 2.5 goes from a nice-to-have to essential (each team will have their own copy of the sheet).

---

## Files attached alongside this document

- `Climbing_Team_Tiered_Practice_System.xlsx` — the live, current workbook (schema reference for everything in Part 1)
- `Team_Tools_Apps_Script.gs` — the current Apps Script file (reference for the business logic in 2.4, and for what NOT to try to reimplement, per 1.4's Category A vs B distinction)
