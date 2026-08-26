#!/usr/bin/env bash

echo "=================================================="
echo " HALAQI - TOKEN FLOW DIAGNOSIS"
echo "=================================================="

echo
echo "1) All token writes"
echo "--------------------------------------------------"
grep -Rni \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "setAuthToken(" src

echo
echo "2) All localStorage token operations"
echo "--------------------------------------------------"
grep -Rni \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "halaqi_auth_token" src

echo
echo "3) AuthContext initial user state"
echo "--------------------------------------------------"
sed -n '1,80p' src/context/AuthContext.tsx

echo
echo "4) AuthContext logout/reset sections"
echo "--------------------------------------------------"
grep -n -B15 -A25 \
  "setAuthToken(null)" \
  src/context/AuthContext.tsx

echo
echo "5) Profile save path"
echo "--------------------------------------------------"
grep -n -B15 -A35 \
  "handleSaveProfile" \
  src/components/profile/UserProfileView.tsx

echo
echo "6) updateMyProfile token availability"
echo "--------------------------------------------------"
grep -n -B10 -A45 \
  "async updateMyProfile" \
  src/services/api.ts

echo
echo "7) fetchWithAuth token logic"
echo "--------------------------------------------------"
sed -n '43,93p' src/services/api.ts

echo
echo "8) Login token assignment"
echo "--------------------------------------------------"
grep -n -B10 -A20 \
  "setAuthToken(data.token)" \
  src/services/api.ts

echo
echo "9) Production API"
echo "--------------------------------------------------"
grep -n "^VITE_API_URL" \
  .env .env.local .env.production 2>/dev/null || true

echo
echo "=================================================="
echo " TOKEN FLOW DATA COMPLETE"
echo "=================================================="
