# Changelog

Releases of Climbing Coach Manager (the phone apps and the web version). The version is set in
`app.config.ts`, and the More screen shows it at the bottom.

## 1.0.1 (build 2): Login improvements, 2026-10-14

- The Connect screen shows which Google account is signed in, with a **Sign out** link. Signing out also withdraws the app's Google access, so the next sign-in shows the account picker.
- If Google's "Google Sheets" permission box is left unticked at sign-in, the app says so and offers **Allow**, instead of reporting every Sheet as "not found".
- Connect errors name the signed-in account ("Couldn't find that Sheet for you@gmail.com…").
- The web version always shows Google's account chooser when signing in.
- More shows the app version.

Nothing changes for coaches already using the app. Their sign-in, their saved data and the Sheet all stay as they were.

## 1.0.0 (build 1), 2026-10-04

First TestFlight and App Store submission.
