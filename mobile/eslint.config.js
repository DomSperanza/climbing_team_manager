// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*"],
  },
  {
    // An HTML rule: apostrophes in React Native <Text> are plain text, nothing to escape.
    rules: { "react/no-unescaped-entities": "off" },
  },
]);
