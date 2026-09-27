#!/usr/bin/env bash
# Opens mobile/android in Android Studio with Node 22 on the PATH. Expo's Gradle steps run
# `node` directly, and an Android Studio started from the desktop menu only sees the system
# Node (too old). Close any open Android Studio window first, or it will reuse that one.
set -euo pipefail
source "$HOME/.nvm/nvm.sh"
nvm use 22 >/dev/null
cd "$(dirname "$0")/.."
[ -d android ] || npx expo prebuild --platform android --no-install
STUDIO="${STUDIO:-/opt/android-studio/bin/studio.sh}"
nohup "$STUDIO" "$PWD/android" >/dev/null 2>&1 &
echo "Opening Android Studio (Node $(node --version))…"
