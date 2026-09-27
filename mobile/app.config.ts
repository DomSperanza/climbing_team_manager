// App config for Android, iOS and web. Google client IDs come from mobile/.env (see README).
// None of them are secrets: every installed app and web page exposes its client ID.
import type { ExpoConfig } from "expo/config";

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
// Google's iOS sign-in returns to the app on the "reversed" client ID as a URL scheme.
// The plugin insists on one, so a placeholder stands in until an iOS client exists.
const iosUrlScheme = iosClientId
  ? "com.googleusercontent.apps." + iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")
  : "com.googleusercontent.apps.not-configured";

const config: ExpoConfig = {
  name: "Rock Team",
  slug: "rock-team",
  version: "0.2.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "rockteam",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.rockteam.coach",
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.rockteam.coach",
    // Team data stays on the phone only — never copied into Google's device backups (HANDOFF §2.6).
    allowBackup: false,
    adaptiveIcon: {
      backgroundColor: "#2f6f5e",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
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
  ],
  // WEB_BASE_URL=/rock-team when the web version is hosted in a sub-folder (e.g. GitHub Pages).
  experiments: { typedRoutes: false, reactCompiler: true, baseUrl: process.env.WEB_BASE_URL || undefined },
};

export default config;
