// Runs before `npm run build:aab` / `build:apk`: stops a store build that would be useless —
// one without Google sign-in configured, or (for Google Play) not signed with your upload key.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const forPlay = process.argv.includes("--play");
const problems = [];

const env = { ...readEnv(".env"), ...readEnv(".env.local"), ...process.env };
const clients = JSON.parse(readFileSync("google-clients.json", "utf8"));
if (!env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && !clients.web) {
  problems.push("No web client ID in google-clients.json (or mobile/.env.local), so Google sign-in wouldn't work in this build.");
}

const props = readEnv(join(process.env.GRADLE_USER_HOME || join(homedir(), ".gradle"), "gradle.properties"));
const keyFile = props.ROCKTEAM_UPLOAD_STORE_FILE;
if (!keyFile && forPlay) {
  problems.push("No upload key is set up, and Google Play rejects debug-signed builds. Run `npm run make-upload-key` first.");
} else if (!keyFile) {
  console.warn("Note: no upload key set up, so this APK is signed with the debug key (fine for your own phone).");
} else if (!existsSync(keyFile)) {
  problems.push(`The upload key file ${keyFile} (from ~/.gradle/gradle.properties) doesn't exist. Restore it from your backup.`);
}

if (problems.length) {
  console.error("\nCan't build yet:\n" + problems.map((p) => "  • " + p).join("\n") + "\n");
  process.exit(1);
}
console.log("Release checks passed. Tip: if you changed .env.local, run `npx expo start --clear` once first.");

function readEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_.]+)\s*=\s*(.*?)\s*$/i);
    if (m && m[2]) out[m[1]] = m[2];
  }
  return out;
}
