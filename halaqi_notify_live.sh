#!/bin/bash

echo "============================================================"
echo "        HALAQI NOTIFICATION LIVE DIAGNOSTIC"
echo "============================================================"

echo ""
echo "=== 1. FOLLOW ROUTE ==="
sed -n '520,625p' src/server/app.ts

echo ""
echo "=== 2. USER LOOKUP ==="
grep -n -A 35 -B 8 "getUserByIdFromNeon" src/server/db.ts

echo ""
echo "=== 3. CREATE NOTIFICATION ==="
sed -n '1845,1910p' src/server/db.ts

echo ""
echo "=== 4. NOTIFICATION READ ==="
sed -n '4348,4380p' src/server/db.ts

echo ""
echo "=== 5. AUTH USER ID ==="
sed -n '90,155p' src/server/authMiddleware.ts

echo ""
echo "=== 6. NOTIFICATION API ==="
sed -n '960,1000p' src/server/app.ts

echo ""
echo "=== 7. FRONTEND NOTIFICATION REQUEST ==="
sed -n '945,980p' src/services/api.ts

echo ""
echo "=== 8. ALL NOTIFICATION CALLS ==="
grep -Rni -B 10 -A 20 \
"createNotification(" \
src \
--include='*.ts' \
--include='*.tsx' \
--exclude='*.backup*' \
--exclude='*.before_*'

echo ""
echo "=== 9. ALL NOTIFICATION DATABASE QUERIES ==="
grep -Rni -E \
"INSERT INTO notifications|FROM notifications|UPDATE notifications|DELETE FROM notifications" \
src/server \
--include='*.ts' \
--exclude='*.backup*' \
--exclude='*.before_*'

echo ""
echo "=== 10. ALL FOLLOW NOTIFICATION LOGS ==="
grep -RniE \
"FOLLOW NOTIFICATION|NOTIFICATION SAVED TO NEON|NOTIFICATIONS GET ERROR|FOLLOW NOTIFICATION ERROR" \
src/server \
--include='*.ts' \
--exclude='*.backup*' \
--exclude='*.before_*'

echo ""
echo "=== 11. ENVIRONMENT ==="
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL = PRESENT"
else
  echo "DATABASE_URL = MISSING IN CURRENT SHELL"
fi

echo ""
echo "=== 12. TYPESCRIPT ==="
npx tsc --noEmit --pretty false 2>&1 | head -n 100

echo ""
echo "============================================================"
echo "                  DIAGNOSTIC END"
echo "============================================================"
