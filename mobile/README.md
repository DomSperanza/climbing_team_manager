# Rock Team app — Android, iPhone and web

One codebase ([Expo](https://expo.dev) / React Native) that builds:

- **an Android app**: an APK you install directly, with no Play Store needed;
- **an iPhone app**: this needs a Mac, or Expo's cloud build service, once. See [iPhone](#iphone);
- **a web app** that installs from the browser ("Add to Home Screen") and works offline.

It covers today's plan, who's coaching which group, the roster with progress, the exercise library, and the coaches. It also **saves to the Sheet**, which is Phase 2b. A coach can add, edit and delete workout blocks, progress entries, athletes, coaches and exercises from their phone.

It can also **create the team Sheet** in your Google Drive, already set up, and **share it** with coaches by email. See [Creating and sharing the team Sheet](#creating-and-sharing-the-team-sheet).

The Google Sheet is still the only place the data lives. There is no server.

## Try it now (no Google setup needed)

Everything needs **Node 22**. It's installed through nvm, and your default Node is still 18.

```bash
cd mobile
nvm use 22            # reads .nvmrc
npm install
npm run web           # opens http://localhost:8081, then tap "Try it with demo data"
```

Demo mode runs on the example rows from `Climbing_Team_Tiered_Practice_System.xlsx`. It saves to a copy on the device, so you can try every form without touching a real Sheet.

## Android

### Put it on your phone (quickest)

```bash
cd mobile && nvm use 22
npm run build:apk      # ~15 min the first time, a couple of minutes after that
```

The APK is at `mobile/android/app/build/outputs/apk/release/app-release.apk`. It works without a computer attached. To install it:

- **USB:** turn on *Developer options → USB debugging* on the phone, plug it in, then run `~/Android/Sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk`.
- **No cable:** copy the APK to the phone (Drive, email to yourself, etc.) and open it. Android asks you to allow installing from that app the first time.

### Android Studio

```bash
cd mobile
npm run studio         # opens mobile/android in Android Studio with Node 22 on the PATH
```

Close any open Android Studio window first. Always open the project this way, not from the desktop menu: Expo's Gradle steps run `node` directly, and a menu-launched Android Studio only finds the system Node 12.

In Android Studio:

1. Let Gradle sync. The project pins itself to **JDK 17**, and Android Studio honours that. Its bundled JDK 25 breaks React Native's native build with *"A restricted method in java.lang.System has been called"*.
2. Pick a device and press **Run**. `RockTeam_Pixel` is an emulator that's already set up. Your phone shows up once USB debugging is on.
3. A **debug** build loads its JavaScript from your computer, so first run `npx expo start` in `mobile/`. After that, code edits appear on the device live. A **release** build (`npm run build:apk`) has everything inside and needs nothing running.

`npm run android` does all of this from the terminal: it builds, installs on the connected phone or emulator, and starts the dev server.

**About `mobile/android/`:** Expo generates this folder from `app.config.ts` and the `plugins/` folder (`npx expo prebuild`). Don't hand-edit it. Change the config and re-run prebuild instead, or run `npx expo prebuild --clean` to start the folder over.

## Google Cloud setup (to use the real Sheet)

This builds on the Phase 2a setup in `../app/README.md`: same Cloud project, same test users. Four things change:

1. **APIs & Services → Library:** also enable the **Google Drive API**. The app uses it to create and share the team Sheet.
   **Data access:** remove `.../auth/spreadsheets.readonly` and add two scopes:
   - **`.../auth/spreadsheets`**: read and save Sheets the coach can already open. Coaches who can only view get a clear "you can view but not edit" message.
   - **`.../auth/drive.file`**: only the files this app creates. This lets it make the team Sheet and manage who it's shared with. It can't see anything else in anyone's Drive.
2. **Clients → Create client → Android:**
   - Package name: `com.rockteam.coach`
   - SHA-1 certificate fingerprint: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

     This is the fingerprint of the key the builds are signed with for now: React Native's standard debug key, which is fine for testing. See [Sharing the app with the other coaches](#sharing-the-app-with-the-other-coaches).
3. **Test users:** every coach who'll sign in must be on the list (Audience → Test users) while the app is in Testing mode. Sharing the Sheet doesn't add them there automatically.
4. **Web client:** keep the one from Phase 2a. Android sign-in needs its ID too. For the web version, add `http://localhost:8081` to its Authorized JavaScript origins and `http://localhost:8081/` to its redirect URIs.

Then put the IDs in `mobile/.env.local` (copy `.env.example`):

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=            # only for the iPhone build
```

**Rebuild after changing these.** They're baked into the app, and the bundler can cache the old values, so run `npx expo start --clear` once (then stop it) before `npm run build:apk`. Until they're set, the Connect screen explains that sign-in isn't set up, and demo mode still works.

If Android sign-in says *"Google rejected this copy of the app"*, the package name or SHA-1 in the Android client doesn't match the build.

## Creating and sharing the team Sheet

**Create:** on the first screen, tap **Create a new team Sheet**, then choose:
- a name;
- the three group names;
- whether to start with the ~20-exercise starter library;
- whether to add yourself as the first coach.

Then sign in. What the app does next:

1. It uploads the team workbook (`Climbing_Team_Tiered_Practice_System.xlsx`, built into the app) to your Google Drive. Drive converts it into a Google Sheet, the same way the original Sheet was made, so every tab, formula, dropdown, color rule and named range comes across.
2. It fills in the group names in Settings, clears the example rows, and adds you as a coach. It uses the same "clear the editable cells, keep the formulas" rule as deleting.
3. It connects to the new Sheet.

The new Sheet is **private**: it's in your Drive, and nobody else can open it until you share it.

**Share:** go to **More → Share this Sheet**. Enter a coach's Google account email and choose **Can edit** or **Can view**. Google emails them the link. They install the app, choose **Connect an existing Sheet**, and paste it. The same screen lists everyone who has access and can remove someone (a lost phone, a coach who left). This is the Sheet's own Google sharing list; the app keeps no separate one.

**Things to know:**
- The app can only manage sharing for Sheets **it created**. That's the price of the narrow `drive.file` permission. For any other Sheet, including the one you uploaded by hand earlier, the Share screen says so and opens the Sheet in Google Sheets, where you share it as usual. Connecting and saving work for any Sheet either way.
- A created Sheet doesn't include the Apps Script (`Team_Tools_Apps_Script.gs`), so its checkboxes do nothing until someone pastes the script in via *Extensions → Apps Script*. The app doesn't need the script.
- After changing the workbook, run `npm run template` to rebuild the copy built into the app, then rebuild.

## Sharing the app with the other coaches

For your own testing, the debug-key APK above is fine. Before giving the app to the other five coaches, sign it with a key of your own. Anyone can sign an app with the shared debug key, and Android only installs updates signed with the same key as the original.

1. Create a key once and **back it up somewhere safe**. If it's lost, coaches have to uninstall and reinstall to get updates:
   ```bash
   ~/.gradle/jdks/eclipse_adoptium-17-amd64-linux.2/bin/keytool -genkeypair -v -keystore rock-team-release.jks \
     -alias rock-team -keyalg RSA -keysize 2048 -validity 10000
   ```
   (`*.jks` files are git-ignored.)
2. Add its SHA-1 (`keytool -list -v -keystore rock-team-release.jks`) to the Android OAuth client. You can list both fingerprints.
3. Wire it into the release build. Ask Claude to add the signing config plugin, so it survives `expo prebuild`.

Alternatively, [EAS Build](https://docs.expo.dev/build/introduction/) (free tier) builds and signs in the cloud and keeps the key for you.

## iPhone

The same code runs on iPhone. Building it needs Xcode, which only runs on macOS. Two options:

- **With the Mac you have access to:** install Xcode, copy this folder, then run `npm install && npx expo run:ios --device`. A free Apple ID can install on your own iPhone for testing (the app expires after 7 days).
- **Without a Mac:** `npx eas-cli build -p ios` builds in Expo's cloud.

Either way, installing on *other people's* iPhones (TestFlight or the App Store) needs the Apple Developer Program ($99/year). In the meantime, the **web version works on iPhone**: open it in Safari, then Share → Add to Home Screen.

For iPhone sign-in, create an **iOS** OAuth client in Google Cloud with bundle ID `com.rockteam.coach`, and put its ID in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

## Web

**Live site:** <https://domsperanza.github.io/climbing_team_manager/>

Every push to `main` that touches `mobile/` rebuilds and publishes it, via `.github/workflows/pages.yml` (the run is under the repo's **Actions** tab). To turn on Google sign-in there:

1. In GitHub, go to **Settings → Secrets and variables → Actions → Variables** and add `GOOGLE_WEB_CLIENT_ID` (your web client ID). Then re-run the workflow.
2. In Google Cloud, on the web OAuth client:
   - add `https://domsperanza.github.io` to *Authorized JavaScript origins*;
   - add `https://domsperanza.github.io/climbing_team_manager/` to *Authorized redirect URIs*.

Until then, the site runs in demo mode.

To build it yourself instead:

```bash
npm run build:web                        # → mobile/dist/, a folder of static files
WEB_BASE_URL=/rock-team npm run build:web   # when it's hosted in a sub-folder, e.g. GitHub Pages
```

Upload `dist/` to any static host (Cloudflare Pages, GitHub Pages, Netlify), then add that URL to the web OAuth client's origins and redirect URIs. `dist/` includes an offline service worker, a web app manifest, and a `404.html` so deep links work on GitHub Pages.

The web version has no app lock and doesn't encrypt its cache: a browser has nowhere safer to keep a key. Its sign-in also expires after about an hour. The phone apps don't have these limits.

## How it protects the team's data (HANDOFF.md §1.6, §2.6)

| | Android / iPhone | Web |
|---|---|---|
| Sign-in | The phone's own Google account picker. The OS keeps the sign-in; the app only holds short-lived access tokens in memory. | Google redirect; the token lasts about an hour, for this browser session only |
| Saved copy of the Sheet | Encrypted (AES-256). The key is random per install and kept in the Android Keystore / iOS Keychain, on this device only. | IndexedDB |
| Device backups | Off (Android). On iOS the file is in the cache folder, which iCloud doesn't back up. | n/a |
| App lock | Fingerprint / face / PIN at launch and after 5 minutes in the background | none |
| Who can see what | The Sheet's own sharing list. The app adds no permission system. | same |
| Minors | The Age column is never shown or edited. Note fields remind coaches to keep notes climbing-specific. | same |

"Sign out & clear data" (under More) signs out of Google and wipes the saved copy.

## Who's coaching

Today lists everyone on that day: every Active coach with that weekday ticked in Coach Profiles. Below them are the day's **lead** and one row per **tier**.

- **Any coach can claim a group, or hand it to someone else,** on any day. Tap its row, then pick a coach. Coaches who are on that weekday are listed first, and "Me" is at the top when your Google account's email matches your Coach Profiles entry.
- **The lead and every group start open** each day until a coach claims them.
- **Building a group's workout:** tap that group's chip above the plan to see just its blocks plus the All Team ones. **Add a block** then starts with that group and its coach.

**In the Sheet** claims live in a small tab, **Coach Assignments** (Date | Group | Coach, where Group "All Team" is the lead). The app adds the tab the first time someone claims a group, and you can edit it in Google Sheets too.

## Saving a workout for the athletes

After practice, tap **Save workout** at the bottom of Today. Every active athlete gets that day in their profile: their group's blocks plus the All Team ones. The **Who was there** list then opens:
- **Switch someone off** if they weren't there. It's kept as a missed practice.
- **Tap a name** to put them in a different group for that day (e.g. an Intermediate climber joining Advanced), or add a brief note.

Saving again later only adds anyone who wasn't recorded yet. Absences, group changes and notes stay as they are.

On an athlete's profile, **Workouts** shows their recent practices, and **See all** lists every saved day. You can filter to missed days, days in another group, or days with notes. Tap any day to change it.

**In the Sheet** this is the **Attendance** tab (Date | Athlete | Group | Here | Notes). The app adds it the first time you save a workout. What an athlete did is looked up from that day's plan in *Log a Workout*, so fixing the plan afterwards fixes their history too. Athletes are matched by name, like the Progress Log.

## Planning a practice

Today shows the day as a timeline against the practice time in the Sheet's Settings tab: start and end time in B18–B19, and warm-up, tiered-block and cooldown minutes in B20–B22.

- **Each block has a length and a place in the order.** Start and end times are worked out from those, so making one block longer pushes everything after it back. "All Team" blocks span every tier. Tier blocks run side by side, each tier on its own clock.
- **The time bar** shows what's planned against the 2½ hours, and warns when the plan runs over.
- **A closing stretch/cooldown stays at the end of practice.** Any unplanned time before it shows as an open slot you can tap to fill.
- **Empty day:** "Start with the standard outline" adds the team warm-up and stretch from Settings in one tap.
- **The whole day is listed in time order.** Tier blocks that run at the same time appear together: All Team first, then tiers in Settings order.
- **Rearrange:** move blocks earlier or later, or make them 5 minutes shorter or longer. Each tap saves straight away, so plans can change mid-practice. Moves follow each block's own group:
  - A tier block swaps with that tier's previous or next block, or crosses the All Team block it reaches.
  - An All Team block jumps over the whole side-by-side stretch of tier blocks.
- **Picking an exercise** uses the Library tab's filters (block type, tier, search), starting on the block's own tier.

**In the Sheet** these are two new columns on *Log a Workout*: **J = Minutes** and **K = Order**. The app adds their headers the first time it saves a block, and new Sheets have them from the start. You can also type them in Google Sheets. Rows without an Order come after the rest, in row order. The Sheet's own *Day View* tab still lists blocks in row order, not by the app's Order.

## When two coaches save at the same time

Nothing is queued on the phone: every save goes straight to Google (HANDOFF.md §2.3). These are the safeguards when two coaches overlap:

- **Only what you changed is written.** Each form remembers the record as it was when you opened it. On Save, the app re-reads that row and writes only the fields you changed. If another coach changed a different field of the same athlete, block or day meanwhile, both changes are kept.
- **Same field, different values: you choose.** If they changed the very field you changed, nothing is overwritten. The form shows both versions ("Theirs … / Yours …") with **Use mine** and **Keep theirs**, and your other changes save either way. One-tap actions (the "was there" switch, ±5 minutes, claiming a group) ask the same question in a short prompt.
- **Adding rows can't collide.** A new athlete, coach, exercise, block or progress entry is re-checked just after it's written. If another coach took the same empty row in the same moment, yours moves to the next free row. Attendance and Coach Assignments rows are added by Google itself, one request at a time. If two coaches tap **Save workout** together, any duplicate rows are cleared.
- **Rows that moved are caught.** If someone sorted or deleted rows in the Sheet since your last refresh, the app stops and asks you to refresh rather than write into the wrong row.
- **Phones catch up on their own.** Every save re-reads the Sheet, and so does coming back to the app after 30 seconds or more away.

## How saving works (HANDOFF.md §2.3)

- Saves go straight to the Sheet and **need a connection**. When the phone is offline, Save is disabled and says why. Nothing is queued on the phone.
- Only the cells a form covers are written, never whole rows. The formula columns (ID, Full Name, Times Used and the hidden helpers) are never touched, and neither is Age.
- New rows go in the first empty row inside the rows the Sheet's formulas cover. If a tab is full (for example, 32 athletes), the app says so rather than writing past the formulas.
- **Before editing or deleting**, the app re-reads that row. If someone has changed, sorted or deleted it in the Sheet since the last refresh, the app stops and asks you to refresh rather than overwrite someone else's row.
- Deleting clears the same cells as the Sheet's own delete checkboxes, so the row can be reused. For athletes and coaches, switching them to **Inactive** is gentler and keeps their history.
- After every save the app reloads the whole Sheet, so what you see is what the Sheet now holds.

## Development

```bash
npm test          # parsing, validation, dates, timeline, coach claims, saving, new-Sheet setup
npm run typecheck
npm run lint
```

`test/setup.test.ts` runs the new-Sheet setup against the example workbook and checks that the embedded workbook matches the real file byte-for-byte. `test/writes.test.ts` runs every kind of save against the example workbook's cells (`src/core/memorySheet.ts`). It checks exactly which cells are written, that formulas and Age are left alone, row-limit and row-changed handling, and that the result parses back correctly.

```
src/
  core/            plain TypeScript, no React Native, fully tested
    schema/        where everything lives in the Sheet, parsing, validation
    logic/         dates, timeline, coach claims, library lookups
    writes.ts      what each save writes, and the save sequence
    setup.ts       setting up a newly created Sheet, and the Drive upload body
    memorySheet.ts the Sheet stand-in used by demo mode and the tests
  google/sheets.ts the Sheets API calls (fetch; the same on every platform)
  google/drive.ts  creating the Sheet (upload + convert) and sharing it
  data/template-xlsx.ts  the team workbook, embedded (npm run template)
  platform/        one file per platform where they differ: *.ts = Android/iOS, *.web.ts = web
    auth           Google sign-in
    cache          the saved copy (encrypted MMKV vs. IndexedDB)
    lock           app lock
    network        online/offline
  data/store.ts    app state: cache-first loading, refresh, save, lock
  ui/              shared components (theme, lists, forms, date picker)
  app/             the screens. Expo Router: each file is a route.
plugins/           Expo config plugins (JDK 17 pin for Gradle)
scripts/           web post-build step, Android Studio launcher
```

`../app/` is the Phase 2a web app. This project replaces it, and it can be retired once the web build here is hosted.

## Known limitations

- **Links between tabs use names**, as in the Sheet. Renaming an athlete disconnects their past progress entries, and renaming an exercise disconnects its Times Used count. The edit forms warn about this.
- **No USA Climbing category field yet** (HANDOFF.md §1.6). It needs a column change in the Sheet and a check of the current official category list first.
- A plain `npm audit` reports warnings in Expo's development tooling. They don't affect the built app.
- **No rotation.** The app doesn't use the Sheet's *Rotation Schedule* or *Full Team Calendar* tabs (the featured tier and lead-coach cycle). Coaches claim the lead and groups day by day instead. Those tabs still work in Google Sheets, and nothing in the app writes to them.
