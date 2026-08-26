#!/data/data/com.termux/files/usr/bin/bash

set -e

SDK="$HOME/android-sdk"

echo "======================================"
echo " Halaqi - Android SDK Termux Fix"
echo "======================================"

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

echo "[1/5] ضبط Android SDK..."
echo "ANDROID_HOME=$ANDROID_HOME"
echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"

AAPT2="$SDK/build-tools/35.0.0/aapt2"

echo "[2/5] فحص AAPT2..."

if [ ! -f "$AAPT2" ]; then
  echo "❌ AAPT2 غير موجود"
  exit 1
fi

file "$AAPT2"

echo "[3/5] اختبار AAPT2..."
"$AAPT2" version

echo "✓ AAPT2 يعمل"

echo "[4/5] حفظ إعدادات SDK..."

echo 'export ANDROID_HOME=$HOME/android-sdk' >> "$HOME/.bashrc"
echo 'export ANDROID_SDK_ROOT=$HOME/android-sdk' >> "$HOME/.bashrc"

export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0:$PATH"

echo "[5/5] تنظيف Gradle..."

./gradlew --stop || true
rm -rf "$HOME/.gradle/caches/8.14.3/transforms"

./gradlew clean

echo ""
echo "======================================"
echo "✓ انتهى الإصلاح"
echo "======================================"
echo ""
echo "إذا ما ظهر خطأ، نفذ:"
echo "./gradlew assembleDebug"
