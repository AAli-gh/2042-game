#!/usr/bin/env bash
# Builds a signed, installable APK without Gradle or the Android SDK manager.
#
# Requires (Debian/Ubuntu):
#   apt-get install aapt apksigner dalvik-exchange zipalign android-sdk-platform-23 default-jdk
#
# Usage: android/build.sh [output.apk]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/android"
OUT="${1:-$ROOT/dist/2042.apk}"
BUILD="$APP/build"
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
KEYSTORE="${KEYSTORE:-$APP/debug.keystore}"
KS_PASS="${KS_PASS:-android}"
KS_ALIAS="${KS_ALIAS:-game2042}"

[ -f "$ANDROID_JAR" ] || { echo "android.jar not found at $ANDROID_JAR"; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/assets" "$(dirname "$OUT")"

echo "==> staging web assets"
cp "$ROOT/index.html" "$ROOT/icon.svg" "$BUILD/assets/"

echo "==> generating R.java"
aapt package -f -m \
  -J "$BUILD/gen" \
  -M "$APP/AndroidManifest.xml" \
  -S "$APP/res" \
  -I "$ANDROID_JAR"

echo "==> compiling java"
javac -source 8 -target 8 -nowarn -encoding UTF-8 \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD/classes" \
  $(find "$APP/src" "$BUILD/gen" -name '*.java') 2>&1 | grep -v 'bootstrap class path' || true

echo "==> dexing"
dalvik-exchange --dex --output="$BUILD/classes.dex" "$BUILD/classes"

echo "==> packaging resources"
aapt package -f \
  -M "$APP/AndroidManifest.xml" \
  -S "$APP/res" \
  -A "$BUILD/assets" \
  -I "$ANDROID_JAR" \
  -F "$BUILD/app.unaligned.apk"

echo "==> adding classes.dex"
( cd "$BUILD" && aapt add -f app.unaligned.apk classes.dex >/dev/null )

echo "==> aligning"
zipalign -f 4 "$BUILD/app.unaligned.apk" "$BUILD/app.aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "==> creating signing key ($KEYSTORE)"
  keytool -genkeypair -v -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=2042 Game, OU=Dev, O=2042, C=US" >/dev/null
fi

echo "==> signing"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --ks-key-alias "$KS_ALIAS" --out "$OUT" "$BUILD/app.aligned.apk"
apksigner verify --print-certs "$OUT" | head -4

echo
echo "APK ready: $OUT ($(du -h "$OUT" | cut -f1))"
