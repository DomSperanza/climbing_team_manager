# Notes for the store reviewers

Paste this into **Play Console → App content → App access** (as the instructions) and **App Store Connect → App Review Information → Notes**.

---

Rock Team is a free app for the volunteer coaches of a youth climbing team. It reads and writes the team's own Google Sheet in the coach's Google account. There is no server and no account system of our own.

**How to review without an account:** on the first screen, tap **"Try it with demo data"**. This opens the full app with sample data saved only on the device, with no sign-in needed. Every feature works in demo mode:
- Today: the practice plan and timeline, claiming groups, adding and editing blocks
- Save workout: attendance
- Athletes: profiles and history
- Library: add an exercise
- More: settings and the privacy policy

To leave demo mode, use More → Sign out & clear data.

**Google sign-in** is only used to reach the coach's own Google Sheet (Google Sheets and Drive APIs). The Google Cloud project is in testing, limited to the team's coaches, so a reviewer's Google account can't sign in. Demo mode shows the same screens with sample data.

**Sign in with Apple (App Store guideline 4.8):** the app offers only Google sign-in because it is a client for Google Sheets. Signing in with Google is how it reaches the user's own Sheet stored in Google Drive, the exemption for apps that are a client for a specific third-party service. It doesn't use Google sign-in to create an account, and it has no login of its own.

**Account deletion (guideline 5.1.1(v)):** the app doesn't create accounts. "Sign out & clear data" removes everything from the device, and Google access can be revoked at myaccount.google.com/permissions.

Privacy policy: https://domsperanza.github.io/climbing_team_manager/privacy.html
