#!/bin/bash

echo "============================================================"
echo "        HALAQI NOTIFICATION - ROOT CAUSE TEST"
echo "============================================================"

echo ""
echo "=== 1. CHECK FOLLOWER LOOKUP ==="
grep -n -A 12 -B 8 "const follower =" src/server/app.ts

echo ""
echo "=== 2. CHECK IF EMPTY FOLLOWER IS SILENTLY IGNORED ==="
grep -n -A 12 -B 3 "if (follower)" src/server/app.ts

echo ""
echo "=== 3. CHECK CREATE NOTIFICATION ==="
sed -n '1850,1910p' src/server/db.ts

echo ""
echo "=== 4. CHECK NEON READ ==="
sed -n '4350,4378p' src/server/db.ts

echo ""
echo "=== 5. CHECK AUTH ==="
grep -n -A 45 -B 5 "function requireAuth" src/server/authMiddleware.ts

echo ""
echo "=== 6. CHECK NOTIFICATION API ==="
sed -n '965,997p' src/server/app.ts

echo ""
echo "=== 7. CHECK FRONTEND API ==="
sed -n '945,978p' src/services/api.ts

echo ""
echo "=== 8. CHECK NAVBAR ==="
sed -n '35,145p' src/components/layout/Navbar.tsx

echo ""
echo "=== 9. ALL CREATE NOTIFICATION CALLS ==="
grep -Rni -B 5 -A 15 \
"createNotification(" \
src \
--include='*.ts' \
--include='*.tsx' \
--exclude='*.backup*' \
--exclude='*.before_*'

echo ""
echo "=== 10. ALL NOTIFICATION DATABASE OPERATIONS ==="
grep -Rni -E \
"INSERT INTO notifications|FROM notifications|UPDATE notifications|DELETE FROM notifications" \
src/server \
--include='*.ts' \
--exclude='*.backup*' \
--exclude='*.before_*'

echo ""
echo "=== 11. TYPESCRIPT ==="
npx tsc --noEmit --pretty false 2>&1 | head -n 100

echo ""
echo "=== 12. LOCAL DATABASE ENV ==="
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL: PRESENT"
else
  echo "DATABASE_URL: MISSING IN CURRENT SHELL"
fi

echo ""
echo "=== 13. VERCEL ENV ==="
if command -v vercel >/dev/null 2>&1; then
  vercel env ls 2>&1 | head -n 80
else
  echo "Vercel CLI not installed"
fi

echo ""
echo "============================================================"
echo "                    ROOT TEST END"
echo "============================================================"
