// App config for Android, iOS and web. Google client IDs come from mobile/.env.local (see
// README). None of them are secrets: every installed app and web page exposes its client ID.
import type { ExpoConfig } from "expo/config";

// The app's permanent ID in both stores and in its Google sign-in clients. It's based on the
// GitHub Pages address the web version lives at, so nobody else can own it. Don't change it
// after the first store upload — the stores treat a new ID as a different app.
const APP_ID = "io.github.domsperanza.rockteam";

// Bump VERSION for each release people see ("1.0.1"), and BUILD for every upload to either
// store — both stores reject a build number they've already seen.
const VERSION = "1.0.0";
const BUILD = 1;

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
// Google's iOS sign-in returns to the app on the "reversed" client ID as a URL scheme.
// The plugin insists on one, so a placeholder stands in until an iOS client exists.
const iosUrlScheme = iosClientId
  ? "com.googleusercontent.apps." + iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")
  : "com.googleusercontent.apps.not-configured";

const config: ExpoConfig = {
  name: "Rock Team",
  slug: "rock-team",
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "rockteam",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: APP_ID,
    buildNumber: String(BUILD),
    // iPhone only for now: iPad support means iPad screenshots and iPad review too.
    supportsTablet: false,
    // The app's only encryption is the standard kind (HTTPS, and protecting its own on-device
    // copy of the data), which is exempt from export paperwork.
    config: { usesNonExemptEncryption: false },
    // Apple's required "privacy manifest": why the app (React Native and Expo underneath)
    // uses certain system APIs. The app collects no data for its developer and doesn't track.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
    },
  },
  android: {
    package: APP_ID,
    versionCode: BUILD,
    // Team data stays on the phone only — never copied into Google's device backups (HANDOFF §2.6).
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: "#2f6f5e",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // Permissions libraries ask for that the app never uses (Play asks about each one).
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.VIBRATE",
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
    name: "Rock Team",
    shortName: "Rock Team",
    themeColor: "#2f6f5e",
    backgroundColor: "#f6f5f2",
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#2f6f5e", image: "./assets/images/splash-icon.png", imageWidth: 96 }],
    ["expo-secure-store", { configureAndroidBackup: false, faceIDPermission: "Rock Team uses Face ID to unlock the team's data." }],
    ["expo-local-authentication", { faceIDPermission: "Rock Team uses Face ID to unlock the team's data." }],
    ["react-native-nitro-google-signin", { iosUrlScheme }],
    "@react-native-community/datetimepicker",
    "./plugins/with-gradle-jdk17",
    "./plugins/with-android-release-signing",
  ],
  // WEB_BASE_URL=/rock-team when the web version is hosted in a sub-folder (e.g. GitHub Pages).
  experiments: { typedRoutes: false, reactCompiler: true, baseUrl: process.env.WEB_BASE_URL || undefined },
};

export default config;
