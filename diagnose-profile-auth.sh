#!/usr/bin/env bash

echo "=============================================="
echo " HALAQI - Profile Name Change Auth Diagnosis"
echo "=============================================="
echo

echo "1) API updateMyProfile"
echo "----------------------------------------------"
grep -n -B8 -A35 "updateMyProfile" src/services/api.ts

echo
echo "2) fetchWithAuth"
echo "----------------------------------------------"
grep -n -B5 -A55 "async function fetchWithAuth" src/services/api.ts

echo
echo "3) Auth token storage"
echo "----------------------------------------------"
grep -n -B5 -A12 "setAuthToken" src/services/api.ts

echo
echo "4) AuthContext token/session handling"
echo "----------------------------------------------"
grep -n -B8 -A25 "getAuthToken()" src/context/AuthContext.tsx

echo
echo "5) Profile API route"
echo "----------------------------------------------"
grep -Rni -B15 -A45 \
  --include="*.ts" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "/api/auth/me/profile" src/server

echo
echo "6) requireAuth"
echo "----------------------------------------------"
grep -n -B8 -A65 "export async function requireAuth" src/server/authMiddleware.ts

echo
echo "7) Login token generation"
echo "----------------------------------------------"
grep -n -B8 -A30 "generateToken" src/server/authMiddleware.ts

echo
echo "8) Login API"
echo "----------------------------------------------"
grep -n -B15 -A45 "/api/auth/login" src/server

echo
echo "9) All places clearing auth token"
echo "----------------------------------------------"
grep -Rni \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "setAuthToken(null)\|removeItem('halaqi_auth_token')" src

echo
echo "10) Build output verification"
echo "----------------------------------------------"
if [ -f dist/api.cjs ]; then
  echo "dist/api.cjs: EXISTS"

  echo
  echo "Profile route in dist:"
  grep -n -B10 -A35 \
    "/api/auth/me/profile" dist/api.cjs | head -120

  echo
  echo "requireAuth in dist:"
  grep -n -B5 -A55 \
    "Bearer" dist/api.cjs | head -150
else
  echo "dist/api.cjs: NOT FOUND"
fi

echo
echo "11) Environment API configuration"
echo "----------------------------------------------"
echo "VITE_API_URL:"
grep -n "^VITE_API_URL" .env .env.local .env.production 2>/dev/null || echo "Not found in env files"

echo
echo "12) Git status"
echo "----------------------------------------------"
git status --short 2>/dev/null || echo "Git unavailable"

echo
echo "=============================================="
echo " DIAGNOSIS DATA COMPLETE"
echo "=============================================="
