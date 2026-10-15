# Google OAuth verification

Apple rejected build 2 because sign-in showed **"Google hasn't verified this app"**. The `spreadsheets` scope is *sensitive*, and that's what triggers the warning. `drive.file` and `drive.appdata` are non-sensitive. Verification is free and needs no security assessment, because none of the scopes is *restricted*.

## Done
- 2026-10-15: `dvssolutionsllc.com` verified in Google Search Console (Domain property, DNS TXT record at Northwest Registered Agent).
- 2026-10-15: CNAME `coach` → `domsperanza.github.io`, so the web app, homepage and privacy policy are served from the verified domain:
  - Homepage: https://coach.dvssolutionsllc.com/about.html
  - Privacy policy: https://coach.dvssolutionsllc.com/privacy.html
- 2026-10-15: web client origins and redirect URIs added; **brand verification passed** (the app name and branding now show on Google's sign-in screens). The sensitive-scope (data access) review is still needed to remove the warning.

## Google Cloud → Google Auth Platform

1. **Clients → the Web client**:
   - Authorized JavaScript origins: add `https://coach.dvssolutionsllc.com`
   - Authorized redirect URIs: add `https://coach.dvssolutionsllc.com/`
   - Keep the old github.io entries until the new address is confirmed working.
2. **Branding**:
   - App name: Climbing Coach Manager
   - User support email: an address you actually read
   - App logo: optional (120×120 PNG, e.g. `store/icon-512.png` scaled down)
   - Application home page: `https://coach.dvssolutionsllc.com/about.html`
   - Privacy policy: `https://coach.dvssolutionsllc.com/privacy.html`
   - Authorized domains: `dvssolutionsllc.com`. Remove `domsperanza.github.io` once the github.io links are no longer used.
   - Developer contact: your email
3. **Data Access**: exactly these three, nothing else:
   - `.../auth/spreadsheets` (sensitive)
   - `.../auth/drive.file` (non-sensitive)
   - `.../auth/drive.appdata` (non-sensitive)
4. **Verification Center → Prepare for verification**: work through each page, paste the text below and the video link, then submit.

## Scope justification (paste into the form)

**`https://www.googleapis.com/auth/spreadsheets`**

> Climbing Coach Manager is a free app for the volunteer coaches of a youth climbing team. All of the team's data (roster, practice plans, attendance and exercise library) lives in one Google Sheet that the head coach owns and shares with the other coaches. The app has no server and no database of its own: it reads and writes that Sheet directly with the Sheets API.
>
> Most coaches didn't create the Sheet. Another coach shared it with them, and they connect by opening the invite link or pasting the Sheet's link. The drive.file scope can't reach a Sheet the app didn't create, and the Google Picker isn't available in our native iOS and Android apps, so the app needs the spreadsheets scope to open the team Sheet a coach has been given. The app opens only the Sheet the coach chooses. Data is used only to show and update that Sheet in the app, is never sent to us or anyone else, and is never used for advertising.

**`https://www.googleapis.com/auth/drive.file`** (if asked)

> Used to create a new team Sheet in the coach's Drive when they choose "Create a new team Sheet", and to share that Sheet with the coaches they name, from the app's Share screen.

**`https://www.googleapis.com/auth/drive.appdata`** (if asked)

> Used to store the list of team Sheets the coach uses (names and IDs only) in the app's hidden app-data folder, so signing in on another device finds their Sheet.

## Demo video (YouTube, Unlisted, English)

Record it on a computer, using the web app at https://coach.dvssolutionsllc.com, so the browser's address bar shows the OAuth request. Two to four minutes is plenty. Narrate it, or add captions.

1. Open https://coach.dvssolutionsllc.com/about.html. Show the homepage and click the privacy policy link.
2. Open the web app. If it's already signed in, use More → **Sign out & clear data** first.
3. Tap **Sign in with Google**. On Google's page, **zoom in on the address bar** so `client_id=…` is readable. It must match the Web client ID in Google Cloud.
4. Pick the account. On the consent screen, show the **app name**, then **each permission**, and tick them all. Mention aloud that the screen says "Climbing Coach Manager".
5. **spreadsheets:** connect the team Sheet by pasting its link. Show the athletes and the Today timeline loading from it. Save a workout, then switch to the Sheet in Google Sheets and show the new row. That proves both reading and writing.
6. **drive.file:** More → **Create another team's Sheet**. Show it appearing in Google Drive. Then More → **Share this Sheet**, and add a coach's email.
7. **drive.appdata:** sign out, sign back in, and show that the Sheet list comes back without pasting the link.
8. Finish by showing how to revoke access at myaccount.google.com/permissions (optional, but reviewers like it).

If Google asks for an iOS video too, record the same steps in the iPhone app with screen recording. The iOS client ID appears on Google's page there too.

## After Google approves
- Sign in once with a fresh account, and confirm the warning screen is gone.
- Remove the "Google hasn't verified this app" bullet from `review-notes.md`.
- Reply to Apple in App Store Connect (Resolution Center) and resubmit.
