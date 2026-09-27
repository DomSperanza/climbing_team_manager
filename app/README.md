# Rock Team app (Phase 2a — read-only)

> **Superseded by [`../mobile`](../mobile/README.md)**: one codebase for Android, iPhone and the web, which also saves to the Sheet. Keep this until the new web build is hosted.

A phone-first web app (PWA) over the team's Google Sheet. It shows today's plan, the season rotation, the roster with progress, the exercise library and the coaches. It works offline after the first load. There's no server: each coach signs in with their own Google account, and the Sheet's own sharing list decides who can see it.

Nothing here writes to the Sheet yet. Editing still happens in Google Sheets (Phase 2b adds saving from the app).

## Try it (no Google setup needed)

```bash
cd app
npm install
npm run dev          # open the printed http://localhost:5173 link, then "Try it with demo data"
```

Demo mode runs on the example rows from `Climbing_Team_Tiered_Practice_System.xlsx`. To demo on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the printed Network address.

## One-time Google setup (for connecting the real Sheet)

It takes about 15 minutes, and nothing needs a credit card.

1. Go to <https://console.cloud.google.com> → **New project** (e.g. "Rock Team").
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **Google Auth Platform** (called "OAuth consent screen" on some accounts):
   - **Branding:** app name "Rock Team", plus your email as the support/developer contact.
   - **Audience:** user type **External**, publishing status **Testing**. Under **Test users**, add the Google account of each of the 6 coaches.
   - **Data access:** add the scope `.../auth/spreadsheets.readonly`.
4. **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `http://localhost:5173`, plus where you'll host it, e.g. `https://YOURNAME.github.io`.
   - **Authorized redirect URIs:** the exact app address including the trailing slash, e.g. `http://localhost:5173/` and `https://YOURNAME.github.io/rock-team/`.
5. Copy the **Client ID** into a new file `app/.env.local`:
   ```
   VITE_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
   ```
   The client ID isn't secret (every web app exposes it). There is no client secret, and none is needed.

What coaches will see: because the app stays in **Testing** mode, Google shows a "Google hasn't verified this app" screen the first time. They tap **Continue**. Only the test users you listed can sign in (up to 100). Sign-in lasts about an hour. After that the app keeps showing the saved data and asks them to sign in again only when they refresh.

## Put it online (free)

```bash
npm run build        # outputs app/dist/ — a folder of static files
```

Upload `dist/` to any static host. For example:
- **Cloudflare Pages:** create a project, then drag and drop the `dist` folder.
- **GitHub Pages:** push the contents of `dist/` to a `gh-pages` branch, or use the "Static HTML" Pages workflow pointed at `app/dist`.

The app uses relative paths, so it works from a sub-folder like `/rock-team/`. Add that URL to the OAuth client (step 4).

**Installing on phones.** iPhone: open the link in Safari, tap Share, then **Add to Home Screen**. Android: open it in Chrome, open the ⋮ menu, then **Install app**.

## Development

```bash
npm test             # rotation logic vs. the Sheet's own formulas, parsing, validation, dates
npm run build        # type-check + production build
npm run fixture      # regenerate demo/test data from the .xlsx (needs LibreOffice installed)
```

`npm run fixture` recalculates the workbook in headless LibreOffice. It also builds a variant with extra coaches and renamed tiers, and saves what the Sheet's formulas compute for it. `test/rotation.test.ts` checks the app's rotation code against those values, so if the app and the Sheet ever disagree, the test fails.

```
src/
  schema/layout.ts     where everything lives in the Sheet (mirrors the .gs constants)
  schema/parse.ts      Sheets API values → typed rows
  schema/validate.ts   "is this really a Rock Team sheet?" with specific error messages
  logic/rotation.ts    featured tier + lead coach per day (ported from the Sheet's formulas)
  logic/dates.ts       timezone-safe date helpers
  logic/library.ts     Times Used + library autofill
  google/auth.ts       Google sign-in (client-side redirect flow, token in sessionStorage)
  google/sheets.ts     two API calls: sheet info + one batchGet of every tab
  data/store.ts        cache-first state (IndexedDB), refresh, demo mode
  ui/                  the screens
vite.config.ts         also generates the offline service worker (dist/sw.js)
```

This uses Node 18, which is what's installed. Upgrading to Node 20+ (`nvm install 22`) would allow current Vite and Vitest and clear the `npm audit` warnings, which only affect the local dev server.

## Deliberate decisions and known limitations

- **Rotation quirk, matching the Sheet on purpose.** The Thursday lead-coach turn advances on "All Team" weeks too. With 4 Thursday coaches, the 4th coach's turn always lands on an All Team week, so they never lead. With 2 coaches, the second leads half as often. Fixing this means changing the Sheet's formula and `logic/rotation.ts` together.
- **Links between tabs use names.** Progress entries match athletes by full name, and workouts match library items by name. Renaming someone or something disconnects their history.
- **Row limits in the Sheet** (Log a Workout rows 5–200, 32 athlete slots, 14 coach slots) don't limit the app, which reads whole columns. The Sheet's own formulas stop at those rows, though.
- **Age column is ignored.** Following HANDOFF.md §1.6 (minors' data), the app never reads it. A configurable USA Climbing category field is planned for Phase 2b.
- **On-device data.** The last-downloaded copy sits in the browser's IndexedDB for offline use. The Google token is kept only for the browser session. **Sign out & clear data** (under More) wipes both. There is no app-level PIN or biometric lock in v1; in a browser, encrypting the cache with a key stored alongside it wouldn't add real protection.
