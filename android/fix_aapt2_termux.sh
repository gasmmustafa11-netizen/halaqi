#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "======================================"
echo " Halaqi - Termux ARM64 AAPT2 Fix"
echo "======================================"

echo "[1/5] إيقاف Gradle..."

./gradlew --stop || true

echo "[2/5] حذف نسخة AAPT2 الخاطئة من الكاش..."

rm -rf ~/.gradle/caches/8.14.3/transforms/*/transformed/aapt2-8.13.0-13719691-linux

echo "[3/5] البحث عن AAPT2..."

find ~/.gradle/caches -type f -name "aapt2" 2>/dev/null | head -20 || true

echo "[4/5] محاولة استخدام AAPT2 الموجود مع Android SDK..."

SDK_AAPT2=$(find "$ANDROID_HOME" "$ANDROID_SDK_ROOT" \
  -type f -name "aapt2" 2>/dev/null | head -1 || true)

if [ -n "$SDK_AAPT2" ]; then
    echo "وجدنا AAPT2:"
    echo "$SDK_AAPT2"

    file "$SDK_AAPT2" || true

    if "$SDK_AAPT2" version >/dev/null 2>&1; then
        echo "✓ AAPT2 يعمل على الجهاز"
    else
        echo "⚠️ AAPT2 الموجود لا يعمل مباشرة"
    fi
else
    echo "⚠️ لم نجد AAPT2 داخل Android SDK"
fi

echo "[5/5] تنظيف المشروع..."

./gradlew clean

echo ""
echo "======================================"
echo "تم التنظيف."
echo "======================================"
echo ""
echo "الآن جرّب:"
echo ""
echo "./gradlew assembleDebug"
echo ""
