#!/usr/bin/env bash
# =============================================================================
#  Satlok Seva — reproducible APK build, no Gradle required.
#  aapt2 -> javac -> d8 -> zip -> zipalign -> apksigner (v1+v2+v3)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS="$(dirname "$ROOT")/tools"
export JAVA_HOME="$TOOLS/jdk17"
export PATH="$JAVA_HOME/bin:$PATH"
BT="$TOOLS/sdk/build-tools/android-14"
PLATFORM="$TOOLS/sdk/platforms/android-34/android.jar"

APP="$ROOT/app"
WORK="$ROOT/.build"
OUT="$ROOT/dist"
CFG="$ROOT/build.json"

VERSION_NAME=$(python3 -c "import json;print(json.load(open('$CFG'))['versionName'])")
VERSION_CODE=$(python3 -c "import json;print(json.load(open('$CFG'))['versionCode'])")
WEB_VERSION=$(python3 -c "import json;print(json.load(open('$CFG'))['webVersion'])")
WEB_BUILD=$(python3 -c "import json;print(json.load(open('$CFG'))['webBuild'])")

echo "▸ Satlok Seva  shell $VERSION_NAME ($VERSION_CODE)  web $WEB_VERSION ($WEB_BUILD)"

rm -rf "$WORK"; mkdir -p "$WORK/compiled" "$WORK/classes" "$WORK/dex" "$OUT"

# ---- 0. keys ---------------------------------------------------------------
mkdir -p "$ROOT/keys"
if [ ! -f "$ROOT/keys/release.keystore" ]; then
  echo "▸ generating release signing key"
  keytool -genkeypair -v -keystore "$ROOT/keys/release.keystore" \
    -alias satlokseva -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass satlokseva2026 -keypass satlokseva2026 \
    -dname "CN=Satlok Seva, OU=Sangat, O=Satlok Seva, L=Barwala, ST=Haryana, C=IN" >/dev/null 2>&1
fi

# stamp version into the bundle so the UI can show it even in a browser
python3 - "$APP/assets/www" "$WEB_VERSION" "$WEB_BUILD" <<'PY'
import sys, os, io
root, ver, build = sys.argv[1], sys.argv[2], sys.argv[3]
p = os.path.join(root, "js", "version.js")
io.open(p, "w", encoding="utf-8").write(
    "window.APP_VERSION=%r;window.APP_BUILD=%s;\n" % (ver, build))
PY

# ---- 1. web bundle lockfile (SHA-256 per file) ------------------------------
echo "▸ hashing web bundle"
python3 - "$APP/assets/www" "$WEB_VERSION" "$WEB_BUILD" <<'PY'
import hashlib, json, os, sys
root, ver, build = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = {}
for dp, dn, fn in os.walk(root):
    for f in sorted(fn):
        if f == "_lock.json": continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, root).replace(os.sep, "/")
        files[rel] = {"sha256": hashlib.sha256(open(p, "rb").read()).hexdigest(),
                      "size": os.path.getsize(p)}
lock = {"version": ver, "build": build, "files": files,
        "totalBytes": sum(v["size"] for v in files.values())}
json.dump(lock, open(os.path.join(root, "_lock.json"), "w"), indent=1, sort_keys=True)
print("   %d files, %.1f KB" % (len(files), lock["totalBytes"]/1024))
PY

# ---- 2. compile resources --------------------------------------------------
echo "▸ aapt2 compile"
"$BT/aapt2" compile --dir "$APP/res" -o "$WORK/res.zip"

# ---- 3. link ---------------------------------------------------------------
echo "▸ aapt2 link"
python3 - "$APP/AndroidManifest.xml" "$WORK/AndroidManifest.xml" "$VERSION_CODE" "$VERSION_NAME" <<'PY'
import re, sys, io
src, dst, code, name = sys.argv[1:5]
s = io.open(src, encoding="utf-8").read()
s = re.sub(r'android:versionCode="\d+"', 'android:versionCode="%s"' % code, s)
s = re.sub(r'android:versionName="[^"]*"', 'android:versionName="%s"' % name, s)
io.open(dst, "w", encoding="utf-8").write(s)
PY

"$BT/aapt2" link \
  -o "$WORK/base.apk" \
  -I "$PLATFORM" \
  --manifest "$WORK/AndroidManifest.xml" \
  -A "$APP/assets" \
  --java "$WORK/gen" \
  --min-sdk-version 23 \
  --target-sdk-version 34 \
  --version-code "$VERSION_CODE" \
  --version-name "$VERSION_NAME" \
  --auto-add-overlay \
  "$WORK/res.zip"

# ---- 4. javac --------------------------------------------------------------
echo "▸ javac"
find "$APP/java" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
# Compile against android.jar on the *classpath* (not bootclasspath) so javac can
# still see java.lang.invoke.LambdaMetafactory; D8 desugars the lambdas afterwards.
javac -source 8 -target 8 -encoding UTF-8 -nowarn \
  -cp "$PLATFORM" \
  -d "$WORK/classes" @"$WORK/sources.txt" 2>&1 | grep -v -e 'bootstrap class path' -e 'source value 8' -e 'target value 8' -e 'deprecat' || true
if [ ! -f "$WORK/classes/org/satlok/seva/MainActivity.class" ]; then
  echo "❌ javac failed"; exit 1
fi

# ---- 5. dex ----------------------------------------------------------------
echo "▸ d8"
find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
"$JAVA_HOME/bin/java" -Xmx1536m -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
  --release --min-api 23 --lib "$PLATFORM" \
  --output "$WORK/dex" $(cat "$WORK/classes.txt")

# ---- 6. package ------------------------------------------------------------
echo "▸ package"
cp "$WORK/base.apk" "$WORK/unsigned.apk"
( cd "$WORK/dex" && zip -q -X "$WORK/unsigned.apk" classes*.dex )

# store images already compressed -> keep them deflated, but alignment matters
"$BT/zipalign" -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"

# ---- 7. sign ---------------------------------------------------------------
echo "▸ apksigner"
APK="$OUT/SatlokSeva-$VERSION_NAME-$VERSION_CODE.apk"
"$BT/apksigner" sign \
  --ks "$ROOT/keys/release.keystore" \
  --ks-key-alias satlokseva \
  --ks-pass pass:satlokseva2026 \
  --key-pass pass:satlokseva2026 \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$APK" "$WORK/aligned.apk"

"$BT/apksigner" verify --print-certs "$APK" | head -6
"$BT/zipalign" -c -v 4 "$APK" >/dev/null && echo "▸ alignment OK"

cp "$APK" "$OUT/SatlokSeva-latest.apk"
SHA=$(python3 -c "import hashlib;print(hashlib.sha256(open('$APK','rb').read()).hexdigest())")
SIZE=$(stat -c%s "$APK")
echo "$SHA" > "$OUT/SatlokSeva-latest.apk.sha256"

python3 - "$OUT/build-info.json" "$VERSION_NAME" "$VERSION_CODE" "$WEB_VERSION" "$WEB_BUILD" "$SHA" "$SIZE" <<'PY'
import json, sys, time
p, vn, vc, wv, wb, sha, size = sys.argv[1:8]
json.dump({"versionName": vn, "versionCode": int(vc), "webVersion": wv, "webBuild": int(wb),
           "apk": "SatlokSeva-%s-%s.apk" % (vn, vc), "sha256": sha, "size": int(size),
           "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
          open(p, "w"), indent=2)
PY

echo ""
echo "✅ $APK"
echo "   size: $(du -h "$APK" | cut -f1)   sha256: ${SHA:0:16}…"
