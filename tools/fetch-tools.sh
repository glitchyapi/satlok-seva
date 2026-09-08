#!/bin/bash
# Download + unpack the minimal Android toolchain (JDK17 + build-tools 34 + platform 34)
# Usage: AT=/tmp/at bash tools/fetch-tools.sh
set -e
AT=${AT:-/var/tmp/at}
mkdir -p $AT/dl && cd $AT/dl
[ -f $AT/READY ] && { echo "toolchain already at $AT"; exit 0; }
echo "downloading (~320MB)…"
curl -sL -o bt.zip https://dl.google.com/android/repository/build-tools_r34-linux.zip &
curl -sL -o pl.zip https://dl.google.com/android/repository/platform-34-ext7_r03.zip &
curl -sL -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" &
wait
mkdir -p $AT/bt $AT/plat $AT/jdk
unzip -q -o bt.zip -d btx && (mv btx/android-14/* $AT/bt/ 2>/dev/null || mv btx/* $AT/bt/) && rm -rf btx
unzip -q -o pl.zip -d $AT/plat
tar -xzf jdk.tar.gz -C $AT/jdk --strip-components=1
rm -f bt.zip pl.zip jdk.tar.gz
echo DONE > $AT/READY
echo "toolchain ready at $AT"
