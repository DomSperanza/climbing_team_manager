# Getting Rock Team into Google Play and the App Store

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
   - App name: *Rock Team*
   - Home page: `https://domsperanza.github.io/climbing_team_manager/`
   - Privacy policy: the URL above
2. **Data access**: the three scopes `spreadsheets`, `drive.file` and `drive.appdata` should be there. If `drive.appdata` is missing, add it.
3. **Clients**: delete any Android or iOS client made for the old ID `com.rockteam.coach`. Then create:
   - **Android** client #1: package `io.github.domsperanza.rockteam`, SHA-1 of **your upload key** (from `npm run make-upload-key`, step 2).
   - **Android** client #2: the same package, SHA-1 of **Google Play's app-signing key**. You get this after the first upload (step 2).
   - **iOS** client: bundle ID `io.github.domsperanza.rockteam` (step 3).
4. **Audience**: **In production, unverified** (done 2026-09-30).
   - Anyone can sign in, after a one-time "Google hasn't verified this app" notice (*Advanced → Go to Rock Team*).
   - There's a 100-user lifetime cap, and no 7-day re-sign-in.
   - Don't upload a logo on the Branding page: it would require Google's verification.
   - Full verification (free) removes the notice and the cap. It needs a YouTube demo video and proof that you own the website's domain.

## 2. Google Play

### One time

1. Sign up at https://play.google.com/console ($25). Choose a **personal** account, and have ID ready for identity verification. It can take a day or two.
2. **Create app**:
   - Name *Rock Team*, language English (US), **App**, **Free**.
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
npx expo start --clear     # once, then Ctrl+C, so the build picks up .env.local
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
3. In Google Cloud, create the **iOS client** (bundle ID `io.github.domsperanza.rockteam`), then create `mobile/.env.local`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=792823039150-2m0p04g7cu4vr6br9vaegkj5mqvvvmoc.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<the iOS client ID>
   ```
4. On the iPhone:
   - **Settings → Privacy & Security → Developer Mode → On** (it restarts). The option appears after the phone has been plugged into a Mac with Xcode open.

### Build and install

```bash
cd mobile
npx expo start --clear                 # once, then Ctrl+C (clears cached settings)
npx expo prebuild -p ios --clean       # generates ios/ with the iOS client ID in it
open ios/RockTeam.xcworkspace
```

In Xcode:

1. Click **RockTeam** (top of the left panel) → target **RockTeam** → **Signing & Capabilities**:
   - Tick *Automatically manage signing*.
   - **Team: (your name) (Personal Team)**.
2. **Product → Scheme → Edit Scheme → Run → Build Configuration: Release.** With a Release build, the app works without the Mac running anything.
3. Plug in the iPhone, pick it in the device menu at the top, and press **▶ Run**.
4. The first launch is blocked. On the iPhone, trust the developer: **Settings → General → VPN & Device Management → your Apple ID → Trust**. Then open Rock Team.

Doing this again after 7 days, or after code changes: `git pull`, then steps 1–3 of *Build and install* again.

**If the prebuild step warns that the workspace name differs:** open whichever `.xcworkspace` is in `ios/`.

### What to try

- [ ] **Try it with demo data** works, and the demo copy survives closing and reopening the app.
- [ ] **Sign in with Google** finds your team Sheet. Connecting by link works too.
- [ ] Save a workout block, a progress note and attendance, then check them in Google Sheets.
- [ ] Turn on Airplane mode: the app opens and shows the last copy.
- [ ] With a real Sheet connected, the app asks for Face ID (or the passcode) when it opens, and again after 5+ minutes in the background.
- [ ] Dark mode (Control Center) looks right.
- [ ] **More → Privacy policy** opens the policy.
- [ ] **Sign out & clear data** returns you to the Connect screen.

If all of that works, the $99 is worth it: the same build goes to the App Store.

## 4. App Store (after paying $99)

1. Join at https://developer.apple.com/programs/ with the **same Apple ID**, as an individual. Approval can take a day or two.
2. In Xcode, switch **Team** to the paid team (not "Personal Team"). Xcode registers the bundle ID.
   - If it says the ID isn't available, the free test's registration is still holding it. Wait until that 7-day profile expires, or delete the app from the phone and retry.
3. **App Store Connect** (https://appstoreconnect.apple.com) → **Apps → +**:
   - Platform iOS, name *Rock Team*.
   - Bundle ID `io.github.domsperanza.rockteam`, SKU `rockteam`.
   - If the name *Rock Team* is taken on the App Store, use e.g. *Rock Team Coach*. The name on the home screen stays "Rock Team".
4. **Upload a build**:
   - In Xcode, choose **Any iOS Device (arm64)** → **Product → Archive**.
   - When it finishes: **Distribute App → App Store Connect → Upload**.
   - Encryption questions are already answered by the app (standard HTTPS only).
5. **TestFlight** (optional, no review wait for your own team): add up to 100 people as *internal testers*. They must be App Store Connect users you invite. For other coaches, use an *external* group, which needs a short beta review.
6. **App Store listing and submission**:
   - **Text**: from [`listing.md`](listing.md). Category *Sports*.
   - **Screenshots**: 6.9" iPhone. The ones in `screenshots/iphone/` come from the web version. They'll likely pass, but screenshots taken from the real app are safer. Run the app in the **iPhone 16 Pro Max** simulator and press ⌘S, which saves 1320×2868 PNGs to the Desktop. Match the six in `screenshots/android/`.
   - **App Privacy**: see [`privacy-answers.md`](privacy-answers.md#apple--app-privacy).
   - **Age rating**: answer **None / No** to everything, which gives **4+**.
   - **Privacy policy URL**: the one above. **Support URL**: https://github.com/DomSperanza/climbing_team_manager/issues
   - **App Review Information**: paste [`review-notes.md`](review-notes.md). Sign-in required: **No**, because demo mode needs no account.
   - Price: **Free**. Then **Add for Review**.
7. **Each release**: bump `BUILD` (and `VERSION`) in `app.config.ts`, re-run `npx expo prebuild -p ios --clean`, and archive again.

## 5. The web version

Nothing here changes it. Pushing to `main` still rebuilds and redeploys https://domsperanza.github.io/climbing_team_manager/, and the privacy page deploys with it. Store builds and the web version share the same code and the same Google Sheet, so coaches can mix phones and browsers.
