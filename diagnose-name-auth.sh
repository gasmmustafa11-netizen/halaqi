#!/usr/bin/env bash

echo "=================================================="
echo " HALAQI - EXACT NAME UPDATE AUTH DIAGNOSIS"
echo "=================================================="

echo
echo "1) updateMyProfile -> fetchWithAuth"
echo "--------------------------------------------------"
grep -n -B10 -A35 "async updateMyProfile" src/services/api.ts

echo
echo "2) Token creation/storage"
echo "--------------------------------------------------"
grep -n -B5 -A12 "setAuthToken(token" src/services/api.ts

echo
echo "3) Token retrieval"
echo "--------------------------------------------------"
grep -n -B5 -A12 "getAuthToken()" src/services/api.ts

echo
echo "4) Authorization header creation"
echo "--------------------------------------------------"
grep -n -B12 -A35 "headers.set('Authorization'" src/services/api.ts

echo
echo "5) Places that DELETE the token"
echo "--------------------------------------------------"
grep -Rni \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "setAuthToken(null)\|removeItem('halaqi_auth_token')" src

echo
echo "6) Places that may reset the user"
echo "--------------------------------------------------"
grep -Rni \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "setUser(null)" src

echo
echo "7) Login"
echo "--------------------------------------------------"
grep -Rni -B15 -A35 \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "api/auth/login\|/api/auth/login" src

echo
echo "8) Profile route"
echo "--------------------------------------------------"
grep -Rni -B10 -A35 \
  --include="*.ts" \
  --exclude="*.backup*" \
  --exclude="*.before*" \
  "'/api/auth/me/profile'" src/server

echo
echo "9) requireAuth exact failure branches"
echo "--------------------------------------------------"
grep -n -B8 -A70 \
  "export async function requireAuth" \
  src/server/authMiddleware.ts

echo
echo "10) Production API"
echo "--------------------------------------------------"

API="https://halaqi.vercel.app"

echo "Testing:"
echo "$API/api/auth/me/profile"
echo

HTTP_CODE=$(curl -s -o /tmp/halaqi_auth_response.txt \
  -w "%{http_code}" \
  -X PUT \
  "$API/api/auth/me/profile" \
  -H "Content-Type: application/json" \
  --data '{"name":"AUTH_DIAGNOSTIC_TEST"}')

echo "HTTP STATUS: $HTTP_CODE"

echo
echo "SERVER RESPONSE:"
cat /tmp/halaqi_auth_response.txt

echo

if [ "$HTTP_CODE" = "401" ]; then
  if grep -q "UNAUTHORIZED" /tmp/halaqi_auth_response.txt; then
    echo
    echo ">>> DIAGNOSIS:"
    echo "Production endpoint correctly rejects requests WITHOUT Authorization."
    echo "This proves the server auth middleware is active."
    echo
    echo "The remaining problem is CLIENT-SIDE:"
    echo "The phone request is likely reaching the API without the token."
  elif grep -q "INVALID_TOKEN" /tmp/halaqi_auth_response.txt; then
    echo
    echo ">>> DIAGNOSIS:"
    echo "Server received an Authorization header but rejected the token."
  elif grep -q "USER_NOT_FOUND" /tmp/halaqi_auth_response.txt; then
    echo
    echo ">>> DIAGNOSIS:"
    echo "Token was accepted but its user no longer exists."
  else
    echo
    echo ">>> DIAGNOSIS:"
    echo "HTTP 401 received. Inspect server response above."
  fi
elif [ "$HTTP_CODE" = "400" ]; then
  echo
  echo ">>> DIAGNOSIS:"
  echo "Request reached profile route and passed authentication."
elif [ "$HTTP_CODE" = "200" ]; then
  echo
  echo ">>> WARNING:"
  echo "Unexpected 200 from unauthenticated profile update."
else
  echo
  echo ">>> SERVER STATUS:"
  echo "$HTTP_CODE"
fi

echo
echo "11) Production frontend API configuration"
echo "--------------------------------------------------"
grep -n "VITE_API_URL" .env .env.local .env.production 2>/dev/null \
  || echo "No VITE_API_URL found"

echo
echo "12) Build timestamp / dist"
echo "--------------------------------------------------"
if [ -f dist/api.cjs ]; then
  echo "dist/api.cjs EXISTS"
  echo
  echo "Profile route in dist:"
  grep -n -B5 -A20 '"/api/auth/me/profile"' dist/api.cjs | head -80
else
  echo "dist/api.cjs NOT FOUND"
fi

echo
echo "=================================================="
echo " END OF DIAGNOSIS"
echo "=================================================="
