#!/data/data/com.termux/files/usr/bin/bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Halaqi AI Safety Verification ==="

FAILED=0

echo
echo "[1/3] TypeScript check..."
if node node_modules/typescript/bin/tsc --noEmit; then
  echo "PASS: TypeScript"
else
  echo "FAIL: TypeScript"
  FAILED=1
fi

echo
echo "[2/3] Tests..."
if npm test; then
  echo "PASS: Tests"
else
  echo "FAIL: Tests"
  FAILED=1
fi

echo
echo "[3/3] Production build..."
if node node_modules/vite/bin/vite.js build && node build-server.cjs; then
  echo "PASS: Production build"
else
  echo "FAIL: Production build"
  FAILED=1
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "================================"
  echo "ALL CHECKS PASSED"
  echo "================================"
  exit 0
else
  echo "================================"
  echo "CHECKS FAILED"
  echo "AI changes must NOT be committed."
  echo "================================"
  exit 1
fi
