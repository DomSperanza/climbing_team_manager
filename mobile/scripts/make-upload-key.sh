#!/usr/bin/env bash
# Creates your Google Play upload key (once) and tells Gradle where it is.
#
# Google Play signs the app people install with its own key ("Play App Signing"); this key
# only proves uploads come from you. Keep the .jks file and its password backed up (e.g. in a
# password manager). If it's lost, Google can reset it, but that takes a support request.
set -euo pipefail
umask 077   # the key and the file holding its password are readable by you only

KEYDIR="${1:-$HOME/.android-keys}"
KEYSTORE="$KEYDIR/rock-team-upload.jks"
ALIAS="rock-team-upload"
PROPS="$HOME/.gradle/gradle.properties"
KEYTOOL="${KEYTOOL:-$(ls -d "$HOME"/.gradle/jdks/*17*/bin/keytool 2>/dev/null | head -1)}"
KEYTOOL="${KEYTOOL:-keytool}"

if [ -f "$KEYSTORE" ]; then
  echo "An upload key already exists at $KEYSTORE — not making another."
  exit 1
fi
mkdir -p "$KEYDIR" "$(dirname "$PROPS")"
chmod 700 "$KEYDIR"

read -r -s -p "Choose a password for the upload key (at least 6 characters): " PASS; echo
read -r -s -p "Type it again: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "Passwords don't match."; exit 1; }
[ ${#PASS} -ge 6 ] || { echo "Too short."; exit 1; }
# Handed to keytool through the environment, so it never shows in the process list.
export ROCKTEAM_KEY_PASS="$PASS"

"$KEYTOOL" -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass:env ROCKTEAM_KEY_PASS -keypass:env ROCKTEAM_KEY_PASS -dname "CN=Rock Team, O=Rock Team"
chmod 600 "$KEYSTORE"

touch "$PROPS"; chmod 600 "$PROPS"
grep -v '^ROCKTEAM_UPLOAD_' "$PROPS" > "$PROPS.tmp" || true
cat >> "$PROPS.tmp" <<PROPS_END
ROCKTEAM_UPLOAD_STORE_FILE=$KEYSTORE
ROCKTEAM_UPLOAD_STORE_PASSWORD=$PASS
ROCKTEAM_UPLOAD_KEY_ALIAS=$ALIAS
ROCKTEAM_UPLOAD_KEY_PASSWORD=$PASS
PROPS_END
mv "$PROPS.tmp" "$PROPS"
chmod 600 "$PROPS"

echo
echo "Upload key: $KEYSTORE  (back it up, with its password)"
echo "Gradle settings: $PROPS"
echo
echo "Its SHA-1 fingerprint — add it to the Android OAuth client in Google Cloud:"
"$KEYTOOL" -list -v -keystore "$KEYSTORE" -storepass:env ROCKTEAM_KEY_PASS -alias "$ALIAS" | grep -E "SHA1:"
