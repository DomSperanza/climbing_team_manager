// Pins the Android build to JDK 17 via Gradle's daemon JVM criteria, which Android Studio also
// honours. Its bundled JDK (25 in current releases) fails React Native's native (CMake) build
// steps with "A restricted method in java.lang.System has been called".
// Gradle uses any JDK 17 it can find on the machine (including ones it downloaded itself
// into ~/.gradle/jdks); see mobile/README.md if none is installed.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withGradleJdk17(config) {
  return withDangerousMod(config, ["android", (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, "gradle", "gradle-daemon-jvm.properties");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "# Written by plugins/with-gradle-jdk17.js during `expo prebuild`\ntoolchainVersion=17\n");
    return cfg;
  }]);
};
