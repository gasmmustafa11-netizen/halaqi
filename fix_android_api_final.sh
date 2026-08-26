#!/data/data/com.termux/files/usr/bin/bash

set -e

cd ~/downloads/halaqi

VERCEL_URL="https://halaqi.vercel.app"

echo "======================================"
echo " Halaqi - FINAL Android API FIX"
echo "======================================"

echo "[1/7] إنشاء .env.production..."

cat > .env.production <<ENV
VITE_API_URL=${VERCEL_URL}
ENV

echo "✓ VITE_API_URL=${VERCEL_URL}"

echo "[2/7] أخذ نسخة احتياطية..."

cp src/services/api.ts \
"src/services/api.ts.before_final_android_fix_$(date +%Y%m%d_%H%M%S)"

echo "✓ Backup created"

echo "[3/7] تعديل api.ts..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/services/api.ts")
s = p.read_text()

# إضافة API_BASE إذا غير موجود
if "const API_BASE" not in s:
    marker = "let currentAuthToken: string | null"
    s = s.replace(
        marker,
        """const API_BASE =
  import.meta.env.VITE_API_URL || '';

""" + marker,
        1
    )

# إصلاح login
s = s.replace(
    "fetch('/api/auth/login', {",
    "fetch(`${API_BASE}/api/auth/login`, {"
)

# إصلاح register
s = s.replace(
    "fetch('/api/auth/register', {",
    "fetch(`${API_BASE}/api/auth/register`, {"
)

# أي fetch مباشر يبدأ بـ /api
# نعالج فقط الحالات الواضحة الموجودة في الملف
import re

s = re.sub(
    r"fetch\('/api/([^']+)'",
    r"fetch(`${API_BASE}/api/\1`",
    s
)

p.write_text(s)
PY

echo "✓ api.ts updated"

echo "[4/7] عرض أماكن API..."

grep -nE "API_BASE|fetch.*api/" src/services/api.ts | head -80 || true

echo "[5/7] Build..."

npm run build

echo "✓ BUILD OK"

echo "[6/7] مزامنة Capacitor..."

npx cap sync android

echo "✓ Capacitor sync OK"

echo "[7/7] Git..."

git add src/services/api.ts

git add -f .env.production

git commit -m "fix Android production API base URL" || true

git push origin main

echo ""
echo "======================================"
echo "✓ FINAL FIX COMPLETED"
echo "======================================"
echo ""
echo "الرابط:"
echo "${VERCEL_URL}"
echo ""
echo "الآن ابنِ APK من مجلد android."
