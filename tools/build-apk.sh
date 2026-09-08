#!/bin/bash
# ============ Satlok Seva — from-scratch APK build (no Gradle) ============
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AT=${AT:-/var/tmp/at}
JDK=$AT/jdk
BT=$AT/bt
AJAR=$AT/plat/android.jar
[ -f "$AJAR" ] || AJAR=$(find $AT/plat -maxdepth 2 -name android.jar | head -1)
[ -x "$JDK/bin/javac" ] || { echo "toolchain missing at $AT — run tools/fetch-tools.sh"; exit 1; }
export PATH="$JDK/bin:$PATH"
B=$ROOT/build
rm -rf $B && mkdir -p $B/classes $B/gen $ROOT/dist

echo "== [1/7] aapt2 compile resources"
$BT/aapt2 compile --dir $ROOT/app/res -o $B/res.zip

echo "== [2/7] aapt2 link (manifest + resources + assets)"
$BT/aapt2 link -o $B/base.apk -I $AJAR \
  --manifest $ROOT/app/AndroidManifest.xml \
  --java $B/gen -A $ROOT/app/assets \
  --auto-add-overlay --min-sdk-version 23 --target-sdk-version 34 \
  --version-code ${VCODE:-2} --version-name ${VNAME:-1.0.1} \
  $B/res.zip

echo "== [3/7] javac"
find $ROOT/app/java $B/gen -name '*.java' > $B/srcs.txt
if ! javac -nowarn -source 8 -target 8 -bootclasspath $AJAR -classpath $AJAR \
  -d $B/classes @$B/srcs.txt > $B/javac.log 2>&1; then
  grep -E "error|warning" $B/javac.log | head -30
  echo 'FATAL: javac failed'; exit 1
fi
[ "$(find $B/classes -name '*.class' | wc -l)" -ge 6 ] || { echo 'FATAL: too few classes'; exit 1; }

echo "== [4/7] d8 dex"
find $B/classes -name '*.class' > $B/cls.txt
$JDK/bin/java -cp $BT/lib/d8.jar com.android.tools.r8.D8 --release --min-api 23 \
  --lib $AJAR --output $B $(cat $B/cls.txt)

echo "== [5/7] package dex into apk"
cd $B && cp base.apk pkg.apk && zip -q -X pkg.apk classes.dex; cd $ROOT
unzip -l $B/pkg.apk | grep -q classes.dex || { echo 'FATAL: classes.dex missing from apk'; exit 1; }

echo "== [6/7] zipalign"
$BT/zipalign -f -p 4 $B/pkg.apk $B/aligned.apk

echo "== [7/7] sign"
KS=$ROOT/keystore/seva.jks
if [ ! -f "$KS" ]; then
  mkdir -p $ROOT/keystore
  keytool -genkeypair -v -keystore $KS -alias satlok -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass satlok123 -keypass satlok123 \
    -dname "CN=Satlok Seva, OU=Seva, O=Satlok, L=Mumbai, ST=MH, C=IN" 2>/dev/null
fi
$BT/apksigner sign --ks $KS --ks-pass pass:satlok123 --key-pass pass:satlok123 \
  --ks-key-alias satlok --out $ROOT/dist/SatlokSeva-v${VNAME:-1.0.1}.apk $B/aligned.apk

echo "== verify"
$BT/apksigner verify --print-certs $ROOT/dist/SatlokSeva-v${VNAME:-1.0.1}.apk | head -4
$BT/aapt2 dump badging $ROOT/dist/SatlokSeva-v${VNAME:-1.0.1}.apk | head -6
ls -la $ROOT/dist/
