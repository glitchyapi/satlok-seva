#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#  Satlok Seva — reproducible APK build (no Gradle required)
#  aapt2 → javac → d8 → zipalign → apksigner (v1+v2+v3)
# ═══════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"
PROJ="$PWD"

source /home/user/tools/env.sh
BT="${BT:-/home/user/tools/android/bt/android-14}"
PLATFORM="${PLATFORM:-/home/user/tools/android/platform/android-34/android.jar}"

PKG="org.satlok.seva"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
WEB_VERSION="${WEB_VERSION:-1}"
OUT="$PROJ/build"
DIST="$PROJ/dist"
KEYS="$PROJ/keys"

mkdir -p "$OUT"/{gen,obj,dex,flat} "$DIST" "$KEYS"
rm -rf "$OUT/flat" "$OUT/obj" "$OUT/dex" "$OUT/gen"
mkdir -p "$OUT"/{gen,obj,dex,flat}

echo "▸ [1/8] Generating web bundle manifest + config"
python3 "$PROJ/scripts/gen-bundle.py" \
  --www "$PROJ/assets/www" \
  --web-version "$WEB_VERSION" \
  --version-name "$VERSION_NAME" \
  --version-code "$VERSION_CODE"

echo "▸ [2/8] aapt2 compile (resources)"
"$BT/aapt2" compile --dir "$PROJ/android/res" -o "$OUT/flat/res.zip"

echo "▸ [3/8] aapt2 link (manifest + resources + assets)"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$PROJ/android/AndroidManifest.xml" \
  -A "$PROJ/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 23 \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --auto-add-overlay \
  "$OUT/flat/res.zip"

echo "▸ [4/8] javac"
find "$PROJ/android/java" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
set +e
javac -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$PLATFORM" -classpath "$PLATFORM" \
  -d "$OUT/obj" -nowarn @"$OUT/sources.txt" > "$OUT/javac.log" 2>&1
JAVAC_RC=$?
set -e
grep -v -e 'bootstrap class path' -e 'deprecat' "$OUT/javac.log" || true
if [ "$JAVAC_RC" -ne 0 ]; then
  echo "✖ javac FAILED (exit $JAVAC_RC) — aborting build"; cat "$OUT/javac.log"; exit 1
fi
for cls in MainActivity Bridge SecureStore OtaManager Notifier ShareProvider Http ReminderReceiver BootReceiver; do
  if [ ! -f "$OUT/obj/org/satlok/seva/$cls.class" ]; then
    echo "✖ missing compiled class: $cls — aborting"; exit 1
  fi
done
echo "  · $(find "$OUT/obj" -name '*.class' | wc -l) classes compiled"

echo "▸ [5/8] d8 → classes.dex"
find "$OUT/obj" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --release --min-api 23 --lib "$PLATFORM" \
  --output "$OUT/dex" $(cat "$OUT/classes.txt")

echo "▸ [6/8] packaging"
cd "$OUT"
cp base.apk unsigned.apk
cd "$OUT/dex" && zip -q -X "$OUT/unsigned.apk" classes.dex
cd "$PROJ"

echo "▸ [7/8] zipalign"
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo "▸ [8/8] apksigner"
KS="$KEYS/satlok-release.jks"
if [ ! -f "$KS" ]; then
  echo "  · creating release keystore"
  keytool -genkeypair -v -keystore "$KS" -alias satlok \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass satlokseva -keypass satlokseva \
    -dname "CN=Satlok Seva, OU=Seva, O=Satlok, L=Barwala, ST=Haryana, C=IN" >/dev/null 2>&1
fi
APK="$DIST/SatlokSeva-v${VERSION_NAME}.apk"
"$BT/apksigner" sign \
  --ks "$KS" --ks-key-alias satlok \
  --ks-pass pass:satlokseva --key-pass pass:satlokseva \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$APK" "$OUT/aligned.apk"

echo "▸ verifying package structure"
python3 - "$APK" <<'PYCHECK'
import sys, zipfile
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
names = set(z.namelist())
required = ['AndroidManifest.xml','classes.dex','resources.arsc','assets/www/index.html','assets/www/config.js']
missing = [r for r in required if r not in names]
if missing:
    print("✖ APK missing required entries:", missing); sys.exit(1)
dex = z.read('classes.dex')
if not dex.startswith(b'dex\n'):
    print("✖ classes.dex has bad magic"); sys.exit(1)
for cls in [b'MainActivity', b'Bridge', b'SecureStore', b'OtaManager', b'ShareProvider']:
    if cls not in dex:
        print("✖ dex missing class:", cls.decode()); sys.exit(1)
import os
if os.path.getsize(apk) < 50_000:
    print("✖ APK suspiciously small — refusing to ship"); sys.exit(1)
print("  · structure OK: %d entries, dex %.1f KB" % (len(names), len(dex)/1024))
PYCHECK
"$BT/apksigner" verify --verbose "$APK" | head -8
echo
echo "✅ Built: $APK"
ls -lh "$APK"
sha256sum "$APK"
