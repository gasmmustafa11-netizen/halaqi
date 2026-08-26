#!/usr/bin/env bash

set +e

APP="src/server/app.ts"
AUTH="src/server/authMiddleware.ts"
CTX="src/context/AuthContext.tsx"

PASS=0
WARN=0
CRIT=0

pass() {
  echo "[PASS] $1"
  PASS=$((PASS+1))
}

warn() {
  echo "[WARNING] $1"
  WARN=$((WARN+1))
}

crit() {
  echo "[CRITICAL] $1"
  CRIT=$((CRIT+1))
}

section() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

echo "============================================================"
echo "             HALAQI SECURITY AUDIT"
echo "             READ-ONLY / NO FILE CHANGES"
echo "============================================================"
echo "Project: $(pwd)"
echo "Date:    $(date)"
echo

# ============================================================
section "1. ENVIRONMENT / GIT SECURITY"
# ============================================================

if [ -f .gitignore ] && grep -qE '(^|/)\.env\*' .gitignore; then
  pass ".env files are protected by .gitignore"
else
  crit ".env pattern is missing from .gitignore"
fi

if [ -f .env.example ]; then
  pass ".env.example exists"
else
  warn ".env.example not found"
fi

if [ -d .git ]; then
  TRACKED_ENV=$(git ls-files 2>/dev/null | grep -E '(^|/)\.env($|\.)' | grep -v '^\.env\.example$')
  if [ -n "$TRACKED_ENV" ]; then
    crit "Real .env file appears tracked by Git"
    echo "$TRACKED_ENV"
  else
    pass "No real .env files tracked by Git"
  fi
else
  warn ".git directory not found"
fi

# ============================================================
section "2. AUTHENTICATION"
# ============================================================

if grep -q "HALAQI_AUTH_SECRET" "$AUTH" 2>/dev/null; then
  pass "HALAQI_AUTH_SECRET is used"
else
  crit "HALAQI_AUTH_SECRET usage missing"
fi

if grep -qE "verifyToken|jwt\.verify" "$AUTH" 2>/dev/null; then
  pass "Token verification exists"
else
  crit "Token verification missing"
fi

if grep -q "exp:" "$AUTH" 2>/dev/null; then
  pass "JWT expiration exists"
else
  crit "JWT expiration missing"
fi

if grep -qE "generateToken\(user: User, expiresInDays: number = 365\)" "$AUTH" 2>/dev/null; then
  pass "Token lifetime is configured to 365 days"
else
  warn "Token lifetime is not exactly 365 days"
fi

# ============================================================
section "3. REFRESH / SESSION"
# ============================================================

REFRESH_LINE=$(grep -nF "app.post('/api/auth/refresh'" "$APP" 2>/dev/null | head -n1 | cut -d: -f1)

if [ -n "$REFRESH_LINE" ]; then
  pass "Refresh endpoint exists"

  REFRESH_BLOCK=$(sed -n "${REFRESH_LINE},$((REFRESH_LINE+15))p" "$APP")

  if echo "$REFRESH_BLOCK" | grep -q "requireAuth"; then
    pass "Refresh endpoint protected by authentication"
  else
    crit "Refresh endpoint may not require authentication"
  fi
else
  crit "Refresh endpoint missing"
fi

if grep -qF "api.refreshToken()" "$CTX" 2>/dev/null; then
  pass "Client refresh call exists"
else
  warn "Client refresh call not detected"
fi

if grep -q "setInterval" "$CTX" 2>/dev/null; then
  pass "Automatic session refresh interval exists"
else
  warn "Automatic refresh interval not detected"
fi

if grep -qF "setAuthToken(null)" "$CTX" 2>/dev/null; then
  pass "Logout clears authentication token"
else
  crit "Logout token clearing not detected"
fi

# ============================================================
section "4. ADMIN RBAC"
# ============================================================

if grep -qF "requireRole('admin')" "$APP" 2>/dev/null; then
  pass "Admin RBAC middleware exists"
else
  crit "Admin RBAC middleware missing"
fi

ADMIN_LINES=$(grep -nF "'/api/admin" "$APP" 2>/dev/null)

if [ -n "$ADMIN_LINES" ]; then
  ADMIN_TOTAL=0
  ADMIN_WARN=0

  while IFS= read -r line; do
    [ -z "$line" ] && continue

    n=$(echo "$line" | cut -d: -f1)
    block=$(sed -n "${n},$((n+12))p" "$APP")

    ADMIN_TOTAL=$((ADMIN_TOTAL+1))

    if echo "$block" | grep -qF "requireRole('admin')"; then
      pass "Admin route near line $n has admin-role protection"
    else
      warn "Admin route near line $n needs manual review"
      ADMIN_WARN=$((ADMIN_WARN+1))
    fi
  done <<< "$ADMIN_LINES"

  echo "Admin routes checked: $ADMIN_TOTAL"
else
  warn "No /api/admin routes found"
fi

# ============================================================
section "5. SALON OWNER ISOLATION"
# ============================================================

if grep -qF "requireSalonOwnerOrAdmin" "$AUTH" 2>/dev/null; then
  pass "Salon owner middleware exists"
else
  crit "Salon owner middleware missing"
fi

if grep -qF "isApprovedSalonOwnerFromNeon" "$AUTH" 2>/dev/null; then
  pass "Salon ownership verified against Neon"
else
  crit "Neon salon ownership verification missing"
fi

if grep -qF "CROSS_SALON_ACCESS_BLOCKED" "$AUTH" 2>/dev/null; then
  pass "Cross-salon access is audited/blocked"
else
  warn "Cross-salon audit marker missing"
fi

# ============================================================
section "6. SERVICES / BARBERS"
# ============================================================

for pattern in \
  "app.put('/api/services/:id'" \
  "app.delete('/api/services/:id'" \
  "app.put('/api/barbers/:id'" \
  "app.delete('/api/barbers/:id'"
do

  line=$(grep -nF "$pattern" "$APP" 2>/dev/null | head -n1 | cut -d: -f1)

  if [ -z "$line" ]; then
    warn "$pattern route not found"
    continue
  fi

  block=$(sed -n "${line},$((line+35))p" "$APP")

  if echo "$block" | grep -qE "isApprovedSalonOwner|role !== 'admin'"; then
    pass "$pattern has ownership/role protection"
  else
    crit "$pattern may lack ownership protection"
  fi

done

# ============================================================
section "7. BOOKINGS"
# ============================================================

BOOKING_LINES=$(grep -nE "app\.(post|put|patch|delete).*\/api\/bookings" "$APP" 2>/dev/null)

if [ -z "$BOOKING_LINES" ]; then

  warn "No booking mutation routes detected"

else

  while IFS= read -r line; do
    [ -z "$line" ] && continue

    n=$(echo "$line" | cut -d: -f1)
    block=$(sed -n "${n},$((n+25))p" "$APP")

    if echo "$block" | grep -q "requireAuth"; then
      pass "Booking mutation line $n requires authentication"
    else
      crit "Booking mutation line $n may be unprotected"
    fi

  done <<< "$BOOKING_LINES"

fi

# ============================================================
section "8. PROJECT DOWNLOAD EXPOSURE"
# ============================================================

DOWNLOAD_LINES=$(grep -nE \
  "download-project-zip|HALAQI-Android-Project\.zip|app\.get\('/download'" \
  "$APP" 2>/dev/null)

if [ -n "$DOWNLOAD_LINES" ]; then

  crit "Project ZIP download endpoint exists in server source"

  echo "$DOWNLOAD_LINES"

else

  pass "No project ZIP download endpoint detected"

fi

# ============================================================
section "9. SECURITY HEADERS"
# ============================================================

if grep -qF "Content-Security-Policy" "$APP" 2>/dev/null; then
  pass "Content-Security-Policy detected"
else
  warn "Content-Security-Policy not detected"
fi

if grep -qF "X-Frame-Options" "$APP" 2>/dev/null; then
  pass "X-Frame-Options detected"
else
  warn "X-Frame-Options not detected"
fi

if grep -qF "X-Content-Type-Options" "$APP" 2>/dev/null; then
  pass "X-Content-Type-Options detected"
else
  warn "X-Content-Type-Options not detected"
fi

if grep -qF "Strict-Transport-Security" "$APP" 2>/dev/null; then
  pass "Strict-Transport-Security detected"
else
  warn "Strict-Transport-Security not detected"
fi

# ============================================================
section "10. CORS"
# ============================================================

CORS_LINES=$(grep -nE "cors\(|Access-Control-Allow-Origin" "$APP" 2>/dev/null)

if [ -n "$CORS_LINES" ]; then
  pass "CORS configuration detected"
  echo "$CORS_LINES" | head -n 20
else
  warn "CORS configuration not detected"
fi

# ============================================================
section "11. RATE LIMITING"
# ============================================================

if grep -qE "loginRateLimiter|express-rate-limit|rateLimit" "$APP" "$AUTH" 2>/dev/null; then
  pass "Rate limiting mechanism detected"
else
  crit "Login/API rate limiting not detected"
fi

# ============================================================
section "12. DANGEROUS SERVER FUNCTIONS"
# ============================================================

DANGEROUS=$(grep -R -nE \
  'eval\(|new Function|child_process|exec\(|execSync|spawn\(|spawnSync|shell:true' \
  src/server \
  --exclude='*.backup*' \
  --exclude='*.bak' \
  --exclude='*.before_*' \
  --exclude='*.notifications-backup' \
  --exclude-dir=node_modules \
  2>/dev/null)

if [ -n "$DANGEROUS" ]; then
  warn "Potentially dangerous server execution functions detected"
  echo "$DANGEROUS" | head -n 100
else
  pass "No obvious dangerous execution functions found"
fi

# ============================================================
section "13. HARDCODED SECRETS"
# ============================================================

HARDCODED=$(grep -R -nE \
  '(password|passwd|secret|token|api[_-]?key|private[_-]?key)[[:space:]]*[:=][[:space:]]*["'\''][^"'\'']{12,}["'\'']' \
  src \
  --exclude='*.backup*' \
  --exclude='*.bak' \
  --exclude='*.before_*' \
  --exclude='*.notifications-backup' \
  --exclude-dir=node_modules \
  2>/dev/null | head -n 100)

if [ -n "$HARDCODED" ]; then
  warn "Possible hardcoded credentials/secrets detected"
  echo "$HARDCODED"
else
  pass "No obvious hardcoded secrets detected"
fi

# ============================================================
section "14. SECRET FILES IN PROJECT"
# ============================================================

SECRET_FILES=$(find . -type f \
  \( \
    -name ".env" \
    -o -name ".env.*" \
    -o -name "*.pem" \
    -o -name "*.key" \
    -o -name "*.p12" \
    -o -name "*.pfx" \
    -o -iname "*credentials*" \
    -o -iname "*secret*" \
  \) \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -not -path "./halaqi_security_audit.sh" \
  2>/dev/null)

if [ -n "$SECRET_FILES" ]; then
  warn "Sensitive-looking files exist in project tree"
  echo "$SECRET_FILES"
else
  pass "No suspicious secret files detected"
fi

# ============================================================
section "15. PROJECT ZIP CONTENTS"
# ============================================================

ZIP_FOUND=0

for ZIP in \
  "HALAQI-Android-Project.zip" \
  "public/HALAQI-Android-Project.zip"
do

  if [ -f "$ZIP" ]; then

    ZIP_FOUND=1

    echo "--- $ZIP ---"

    SENSITIVE_ZIP=$(unzip -l "$ZIP" 2>/dev/null | grep -E \
      '(^|/)(\.env|\.env\.|.*\.pem|.*\.key|.*credentials.*|.*secret.*|node_modules/|\.git/)' \
      | head -n 100)

    if [ -n "$SENSITIVE_ZIP" ]; then
      crit "Sensitive content detected inside ZIP"
      echo "$SENSITIVE_ZIP"
    else
      pass "No obvious secrets/.git/node_modules inside ZIP"
    fi

  fi

done

if [ "$ZIP_FOUND" -eq 0 ]; then
  warn "Project ZIP not found"
fi

# ============================================================
section "16. NPM SECURITY AUDIT"
# ============================================================

NPM_LOG="halaqi_security_npm.txt"

if npm audit --omit=dev >"$NPM_LOG" 2>&1; then

  pass "npm audit passed"

else

  if grep -qiE "found 0 vulnerabilities|0 vulnerabilities" "$NPM_LOG"; then
    pass "npm audit reports 0 vulnerabilities"
  else
    warn "npm audit reported vulnerabilities"
    tail -n 30 "$NPM_LOG"
  fi

fi

# ============================================================
section "17. TYPESCRIPT"
# ============================================================

TSC_LOG="halaqi_security_tsc.txt"

if npx tsc --noEmit >"$TSC_LOG" 2>&1; then

  pass "TypeScript compilation check passed"

else

  crit "TypeScript compilation check failed"
  tail -n 100 "$TSC_LOG"

fi

# ============================================================
section "18. API ROUTE INVENTORY"
# ============================================================

TOTAL_ROUTES=$(grep -Ec \
  "app\.(get|post|put|patch|delete)\(" \
  "$APP" 2>/dev/null)

PROTECTED_ROUTES=$(grep -E \
  "app\.(get|post|put|patch|delete)\(" \
  "$APP" 2>/dev/null | \
  grep -E "requireAuth|requireRole|requireSalonOwnerOrAdmin" | \
  wc -l)

echo "Total API routes detected     : $TOTAL_ROUTES"
echo "Protected API routes detected : $PROTECTED_ROUTES"

if [ "$PROTECTED_ROUTES" -gt 0 ]; then
  pass "Authentication middleware is actively used"
else
  crit "No protected API routes detected"
fi

# ============================================================
section "19. GIT STATUS"
# ============================================================

if [ -d .git ]; then

  GIT_STATUS=$(git status --short 2>/dev/null)

  if [ -z "$GIT_STATUS" ]; then
    pass "Git working tree is clean"
  else
    warn "Git working tree contains changes"
    echo "$GIT_STATUS" | head -n 50
  fi

else

  warn "Git repository not detected"

fi

# ============================================================
section "20. FINAL REPORT"
# ============================================================

TOTAL=$((PASS+WARN+CRIT))

echo
echo "============================================================"
echo "                    FINAL SECURITY REPORT"
echo "============================================================"
echo
echo "TOTAL CHECKS : $TOTAL"
echo "PASS         : $PASS"
echo "WARNING      : $WARN"
echo "CRITICAL     : $CRIT"
echo

if [ "$CRIT" -gt 0 ]; then

  echo "RESULT       : CRITICAL"
  echo "ACTION       : Fix all CRITICAL findings before production deployment."

elif [ "$WARN" -gt 0 ]; then

  echo "RESULT       : WARNING"
  echo "ACTION       : Review WARNING findings before production deployment."

else

  echo "RESULT       : PASS"
  echo "ACTION       : No critical or warning findings detected by this audit."

fi

echo
echo "============================================================"
echo "Audit complete."
echo "============================================================"

echo
echo "Temporary audit logs:"
echo "  $NPM_LOG"
echo "  $TSC_LOG"
echo

