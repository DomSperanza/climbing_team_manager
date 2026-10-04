# Getting SCC Coach into Google Play and the App Store

Everything the stores ask for is in this folder:

| File | What it's for |
|---|---|
| [`listing.md`](listing.md) | Store name, descriptions, keywords, category |
| [`privacy-answers.md`](privacy-answers.md) | Play's **Data safety** form, Apple's **App Privacy** form, content rating |
| [`review-notes.md`](review-notes.md) | Notes to paste for the reviewers (how to get in, the Sign in with Apple exemption) |
| `screenshots/android/` | 6 phone screenshots, 1080×2160, for Play |
| `screenshots/iphone/` | 6 screenshots, 1320×2868 (6.9" iPhone). Provisional: see [App Store](#4-app-store-after-paying-99) |
| `feature-graphic.png` | Play's 1024×500 banner |
| `icon-512.png` | Play's 512×512 app icon |

**Privacy policy URL** (both stores ask for it):
https://domsperanza.github.io/climbing_team_manager/privacy.html
It's `mobile/public/privacy.html`, and it deploys with the web app. It's also linked from **More → Privacy policy** in the app.

**App ID** (both stores, and the Google sign-in clients): `io.github.domsperanza.rockteam`. It's permanent once uploaded.

**Costs:**
- Google Play is a one-time **$25**.
- Apple is **$99/year**, but step 3 below tests on your own iPhone for free first.
- The web version on GitHub Pages stays free and unaffected.

---

## 1. Google Cloud (do this first, for both stores)

In the Cloud project you already use for the web version (**APIs & Services**):

1. **Branding**:
   - App name: *SCC Coach*
   - Home page: `https://domsperanza.github.io/climbing_team_manager/`
   - Privacy policy: the URL above
2. **Data access**: the three scopes `spreadsheets`, `drive.file` and `drive.appdata` should be there. If `drive.appdata` is missing, add it.
3. **Clients**: delete any Android or iOS client made for the old ID `com.rockteam.coach`. Then create:
   - **Android** client #1: package `io.github.domsperanza.rockteam`, SHA-1 of **your upload key** (from `npm run make-upload-key`, step 2).
   - **Android** client #2: the same package, SHA-1 of **Google Play's app-signing key**. You get this after the first upload (step 2).
   - **iOS** client: bundle ID `io.github.domsperanza.rockteam`. Done 2026-09-30; its ID is in `mobile/google-clients.json`.
4. **Audience**: **In production, unverified** (done 2026-09-30).
   - Anyone can sign in, after a one-time "Google hasn't verified this app" notice (*Advanced → Go to SCC Coach*).
   - There's a 100-user lifetime cap, and no 7-day re-sign-in.
   - Don't upload a logo on the Branding page: it would require Google's verification.
   - Full verification (free) removes the notice and the cap. It needs a YouTube demo video and proof that you own the website's domain.

## 2. Google Play

### One time

1. Sign up at https://play.google.com/console ($25). Choose a **personal** account, and have ID ready for identity verification. It can take a day or two.
2. **Create app**:
   - Name *SCC Coach*, language English (US), **App**, **Free**.
   - Accept the declarations.
3. **Make your upload key** on this computer:
   ```bash
   cd mobile && nvm use 22
   npm run make-upload-key
   ```
   - It asks for a password, creates `~/.android-keys/rock-team-upload.jks`, and saves the settings in `~/.gradle/gradle.properties`.
   - It prints the SHA-1, which goes in Android client #1 above.
   - **Back up the .jks file and the password** (a password manager, plus a copy off this computer).
4. **App content** (left menu → *Policy and programs → App content*). Answers:
   - **Privacy policy**: the URL above.
   - **App access**: *All or some functionality is restricted*. Add instructions and paste the text from [`review-notes.md`](review-notes.md).
   - **Ads**: No.
   - **Content rating**: category *All other app types*, then answer the questionnaire. See [`privacy-answers.md`](privacy-answers.md#content-rating).
   - **Target audience**: **18 and over** only. The coaches are the users. Choosing under-13 brings in the Families policy, which the app isn't built for.
   - **Data safety**: see [`privacy-answers.md`](privacy-answers.md#google-play--data-safety).
   - **Government app**: No. **Financial features**: None. **Health**: none. **News**: No.
5. **Store listing** (*Grow users → Store presence → Main store listing*):
   - Text from [`listing.md`](listing.md).
   - Graphics: `icon-512.png`, `feature-graphic.png`, and the six `screenshots/android/*.png`.
   - Category *Sports*.
   - Contact email: required, and shown publicly. Use one you're happy to show.

### Each release

```bash
cd mobile && nvm use 22
npm run build:aab          # → android/app/build/outputs/bundle/release/app-release.aab
```

1. **Test and release → Testing → Internal testing → Create new release**:
   - The first time, accept **Play App Signing**. Google keeps the real signing key, and yours only uploads.
   - Upload `app-release.aab` and add release notes ("First test release").
   - **Save → Review release → Start rollout**.
2. **First time only**: go to **Test and release → App integrity → App signing** and copy the **App signing key certificate SHA-1**. Put it in Android client #2 in Google Cloud. Until then, Google sign-in fails in copies installed from Play with *"Google rejected this copy of the app"*.
3. **Testers**: on the Internal testing page, open **Testers**. Create an email list with the coaches' Google accounts, then copy the **join link** and send it to them. They open it on their phone, accept, and install from Play. Updates arrive automatically.
4. **Next release**: bump `BUILD` in `app.config.ts`, and `VERSION` too if people will notice the change. Play rejects a build number it has seen before.

**Internal testing is probably all the team needs.** It holds up to 100 testers with no review wait. Everything else is optional:
- **Public release**: a personal Play account made after Nov 2023 must first run a **closed test** with at least 12 testers for 14 days, then apply for production access.
- **Sideloading** still works: `npm run build:apk` gives an APK signed with the same upload key.

## 3. iPhone: free test on the Mac (before paying Apple)

A free Apple ID can install the app on **your own iPhone** for 7 days at a time. You can repeat that as often as you like. It's a real, full build, so it tests everything, including Google sign-in, Face ID and offline use.

### On the Mac, once

1. Install **Xcode** from the App Store, open it once, and let it install its components.
   - Xcode → Settings → Accounts → **+** → sign in with your Apple ID. This creates a free *Personal Team*.
   - Command line tools: `xcode-select --install` if you're asked.
2. Install **Node 22**, then the project:
   ```bash
   # https://github.com/nvm-sh/nvm, then:
   nvm install 22
   git clone https://github.com/DomSperanza/climbing_team_manager.git
   cd climbing_team_manager/mobile && npm ci
   ```
   Installing **CocoaPods** is also needed if prebuild says it's missing: `brew install cocoapods`.
3. Google sign-in is already set up. The iOS client (`792823039150-8gmc…`, bundle ID `io.github.domsperanza.rockteam`) exists in Google Cloud, and its ID is in `mobile/google-clients.json`, so there's no file to create on the Mac.
4. On the iPhone:
   - **Settings → Privacy & Security → Developer Mode → On** (it restarts). The option appears after the phone has been plugged into a Mac with Xcode open.

### Build and install

```bash
cd mobile
npx expo prebuild -p ios --clean       # generates ios/ with the iOS client ID in it
open ios/SCCCoach.xcworkspace
```

In Xcode:

1. Click **SCCCoach** (top of the left panel) → target **SCCCoach** → **Signing & Capabilities**:
   - Tick *Automatically manage signing*.
   - **Team: (your name) (Personal Team)**.
2. **Product → Scheme → Edit Scheme → Run → Build Configuration: Release.** With a Release build, the app works without the Mac running anything.
3. Plug in the iPhone, pick it in the device menu at the top, and press **▶ Run**.
4. The first launch is blocked. On the iPhone, trust the developer: **Settings → General → VPN & Device Management → your Apple ID → Trust**. Then open SCC Coach.

Doing this again after 7 days, or after code changes: `git pull`, then steps 1–3 of *Build and install* again.

**If the prebuild step warns that the workspace name differs:** open whichever `.xcworkspace` is in `ios/`.

### What to try

- [ ] **Try it with demo data** works, and the demo copy survives closing and reopening the app.
- [ ] **Sign in with Google** finds your team Sheet. Connecting by link works too.
- [ ] Save a workout block, a progress note and attendance, then check them in Google Sheets.
- [ ] Turn on Airplane mode: the app opens and shows the last copy.
- [ ] With a real Sheet connected, the app asks for Face ID (or the passcode) when it opens, and again after 5+ minutes in the background.
- [ ] Dark mode (Control Center) looks right.
- [ ] **More → Team settings**: rename a group, change a practice day, save. Check that athletes show the new group name, and that Today steps between the new days.
- [ ] **More → Privacy policy** opens the policy.
- [ ] **Sign out & clear data** returns you to the Connect screen.

If all of that works, the $99 is worth it: the same build goes to the App Store.

## 4. App Store, with your own Apple developer account

### Enroll (a day or two)

Enroll at https://developer.apple.com/programs/enroll/ as an **Individual**, with your personal Apple Account ($99/year).
- The paid program is needed for TestFlight and the App Store, even for a free app. A free account only covers the 7-day install on your own phone (section 3).
- The App Store lists **your legal name** as the seller. The app and privacy policy still say it's made by DVS Solutions LLC, which is fine.
- **Moving it to the LLC later:** enroll the LLC as an Organization (that needs a D-U-N-S number, the LLC's website and an @dvssolutionsllc.com email). Then either transfer the app to it (App Store Connect → App → App Information → Transfer App; users and reviews move with it), or ask Apple to convert this membership.

Separately, fix the Contact link on dvssolutionsllc.com: it points to **dom@dvssolutions.com**, which is a *different* company's domain, so those messages won't reach you. The Support URL below uses that site.

### Before you submit

1. **Springs Climbing Center's OK.** The app's name uses the gym's name, and Apple rejects apps that use someone else's name or brand without permission (guidelines 4.1 and 5.2.1). Get a short signed letter or email from the gym's owner or manager. For example: "Springs Climbing Center permits DVS Solutions LLC to publish the app 'SCC Coach' using the name SCC, for our coaching staff." Attach it in App Review Information.
2. **Google Cloud → Branding → App name**: change it to **SCC Coach**, so Google's sign-in screens match the app.
3. **A review Google account** (strongly recommended; reviewers often reject sign-in apps without one):
   - Make a new Gmail, e.g. `scccoach.review@gmail.com`, with **2-Step Verification off**.
   - In SCC Coach, sign in with it, choose **Create a new team Sheet**, name it "SCC Coach Review Team", and add a few sample athletes and a practice. Signing in on your iPhone once also makes Google less likely to challenge the reviewer.
   - Put the email and password in App Review Information (the sign-in fields) and in `review-notes.md`.
4. **Screenshots**: run the app in the **iPhone 16 Pro Max** simulator in demo mode and press ⌘S on the six screens in `screenshots/android/`. That gives 1320×2868 images.

### Submit

1. In Xcode, set **Team** to your paid developer team (your name, *not* the one marked "Personal Team"). Xcode registers the bundle ID.
   - If it says the ID isn't available, the free test's registration is still holding it. Wait until that 7-day profile expires, or delete the app from the phone and retry.
2. **App Store Connect** (https://appstoreconnect.apple.com) → **Apps → +**:
   - Platform iOS, name **SCC Coach** (or **SCC Coach: Climbing Team** if it's taken).
   - Bundle ID `io.github.domsperanza.rockteam`, SKU `scccoach`.
3. **Upload a build**:
   - In Xcode, choose **Any iOS Device (arm64)** → **Product → Archive**.
   - When it finishes: **Distribute App → App Store Connect → Upload**.
   - Encryption questions are already answered by the app.
4. **TestFlight first** (recommended): add yourself and the coaches as internal testers (up to 100, no review wait), and install the build on your phone through the TestFlight app. That's the same build Apple will review.
5. **Listing**: text from [`listing.md`](listing.md), including the copyright line "2026 DVS Solutions LLC" (fine under a personal account).
   - **App Privacy**: see [`privacy-answers.md`](privacy-answers.md#apple--app-privacy).
   - **Age rating**: answer **None / No** to everything.
   - **Support URL**: https://dvssolutionsllc.com/. **Privacy policy URL**: the one above.
6. **App Review Information**:
   - **Sign-in required: Yes**, with the review account.
   - Paste [`review-notes.md`](review-notes.md) into Notes.
   - Attach the gym's letter.
7. **Pricing and Availability**: Free. Then **Add for Review**.
8. **Unlisted distribution**: right after submitting, request it at https://developer.apple.com/contact/request/unlisted-app/.
   - The app is then approved normally, but it doesn't show in search; only people with the link can install it. That's Apple's option for apps meant for one organization's people, and it avoids a "limited audience" rejection.
   - You can ask Apple to make it public later.
9. **Each release**: bump `BUILD` (and `VERSION`) in `app.config.ts`, re-run `npx expo prebuild -p ios --clean`, and archive again.

## 5. The web version

Nothing here changes it. Pushing to `main` still rebuilds and redeploys https://domsperanza.github.io/climbing_team_manager/, and the privacy page deploys with it. Store builds and the web version share the same code and the same Google Sheet, so coaches can mix phones and browsers.
