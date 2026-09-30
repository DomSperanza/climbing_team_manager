// Signs Android release builds (the .aab for Google Play, and the release .apk) with your own
// upload key instead of React Native's shared debug key — Google Play rejects debug-signed
// uploads. The key's location and passwords come from Gradle properties, normally kept in
// ~/.gradle/gradle.properties (outside the repo, so they're never committed):
//
//   ROCKTEAM_UPLOAD_STORE_FILE=/home/you/keys/rock-team-upload.jks
//   ROCKTEAM_UPLOAD_STORE_PASSWORD=…
//   ROCKTEAM_UPLOAD_KEY_ALIAS=rock-team-upload
//   ROCKTEAM_UPLOAD_KEY_PASSWORD=…
//
// scripts/make-upload-key.sh creates the key and writes these. Without them, release builds
// fall back to the debug key (fine for testing on your own phone) and Gradle says so.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "ROCKTEAM_UPLOAD_STORE_FILE";

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;

    const signingConfigs = "    signingConfigs {\n";
    const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!gradle.includes(signingConfigs) || !releaseUsesDebug.test(gradle)) {
      throw new Error("with-android-release-signing: android/app/build.gradle doesn't look as expected — update the plugin.");
    }
    gradle = gradle.replace(signingConfigs, `${signingConfigs}        release {
            // Your upload key (see plugins/with-android-release-signing.js).
            if (project.hasProperty('${MARK}')) {
                storeFile file(${MARK})
                storePassword ROCKTEAM_UPLOAD_STORE_PASSWORD
                keyAlias ROCKTEAM_UPLOAD_KEY_ALIAS
                keyPassword ROCKTEAM_UPLOAD_KEY_PASSWORD
            }
        }
`);
    gradle = gradle.replace(releaseUsesDebug, `$1if (project.hasProperty('${MARK}')) {
                signingConfig signingConfigs.release
            } else {
                logger.warn("Rock Team: no upload key configured, so this release build is signed with the debug key. Google Play won't accept it (see mobile/store/README.md).")
                signingConfig signingConfigs.debug
            }`);
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
