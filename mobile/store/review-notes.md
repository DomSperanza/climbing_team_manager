# Notes for the store reviewers

Paste the text between the lines into **App Store Connect → App Review Information → Notes** (and **Play Console → App content → App access**). Fill in the review account first, or delete that part if you don't make one (see `README.md`, "Before you submit").

---

Climbing Coach Manager is a free app for the coaches of youth climbing teams. It reads and writes the team's own Google Sheet in the coach's Google account. There is no server and no account system of our own. Published by DVS Solutions LLC.

**Quickest way to review: demo mode, no sign-in.** On the first screen, tap **"Try it with demo data"**. This opens the app with sample data saved only on the device. Everything below works in demo mode:
- **Today:** the practice timeline, claiming the lead or a group, adding, editing, timing and reordering blocks
- **Save workout:** recording who was there, changing an athlete's group for the day, notes
- **Athletes:** profiles, progress entries and practice history
- **Library:** browsing, filtering and adding exercises
- **More:** coaches, **Team settings** (groups, practice days, practice time), the privacy policy

To leave demo mode, use More → Leave demo.

**With Google sign-in (the real use).** Three features need a real Google account, because they act on a Google Sheet: **Sign in with Google**, **Create a new team Sheet**, and **More → Share this Sheet**.
- A review account is provided below (or any Google account works).
- Google shows a one-time "Google hasn't verified this app" notice. That's expected for a small app; tap **Advanced → Go to Climbing Coach Manager**, then tick every permission box.
- **Review account:** `REVIEW-ACCOUNT-EMAIL` / password `REVIEW-ACCOUNT-PASSWORD`. That account owns a sample team Sheet ("Climbing Coach Manager Review Team"), and **Sign in with Google** opens it directly.

**Sign in with Apple (guideline 4.8).** The app offers only Google sign-in because it is a client for Google Sheets. Signing in with Google is how it reaches the user's own Sheet in Google Drive, the exemption for apps that are a client for a specific third-party service. It doesn't use Google sign-in to create an account, and it has no login of its own.

**Account deletion (guideline 5.1.1(v)).** The app doesn't create accounts. "Sign out & clear data" removes everything from the device, and Google access can be revoked at myaccount.google.com/permissions.

**Distribution.** For now this app is used by one team's coaching staff, so we're requesting **unlisted distribution**.

Privacy policy: https://domsperanza.github.io/climbing_team_manager/privacy.html
Contact: DVS Solutions LLC, https://dvssolutionsllc.com/

---
