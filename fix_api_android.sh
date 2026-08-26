#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "======================================"
echo " Halaqi - Android Production API Fix"
echo "======================================"

VERCEL_URL="https://halaqi.vercel.app"

echo "[1/6] فحص المشروع..."
test -f src/services/api.ts || {
  echo "❌ لم يتم العثور على src/services/api.ts"
  exit 1
}

echo "[2/6] إنشاء إعدادات الإنتاج..."

cat > .env.production <<ENV
VITE_API_URL=${VERCEL_URL}
ENV

echo "✓ تم إنشاء .env.production"

echo "[3/6] أخذ نسخة احتياطية من api.ts..."

cp src/services/api.ts \
  "src/services/api.ts.before_android_api_fix_$(date +%Y%m%d_%H%M%S)"

echo "✓ تم إنشاء النسخة الاحتياطية"

echo "[4/6] تعديل اتصال API..."

python3 - <<'PY'
from pathlib import Path

p = Path("src/services/api.ts")
s = p.read_text()

marker = "let currentAuthToken: string | null"

if "const API_BASE" not in s:
    s = s.replace(
        marker,
        """const API_BASE =
  import.meta.env.VITE_API_URL || '';

"""
        + marker,
        1
    )

old = """  const response = await fetch(url, {
    ...options,
    headers,
  });"""

new = """  const fullUrl =
    url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${API_BASE}${url}`;

  console.log('[API REQUEST]', {
    url: fullUrl,
    method: options.method || 'GET',
  });

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });"""

if old in s:
    s = s.replace(old, new, 1)
    print("✓ تم تعديل fetchWithAuth")
else:
    print("⚠️ لم يتم العثور على fetch block — قد يكون التعديل موجودًا مسبقًا")

p.write_text(s)
PY

echo "[5/6] التحقق من الإعداد..."

echo ""
echo "API URL:"
cat .env.production

echo ""
grep -n "API_BASE\|fullUrl" src/services/api.ts || true

echo ""
echo "[6/6] تشغيل build..."

npm run build

echo ""
echo "======================================"
echo "✓ BUILD COMPLETED SUCCESSFULLY"
echo "======================================"
echo ""
echo "إذا ظهر أعلاه BUILD ناجح، نفذ:"
echo ""
echo "git add .env.production src/services/api.ts"
echo 'git commit -m "fix Android production API connection"'
echo "git push origin main"
echo ""
