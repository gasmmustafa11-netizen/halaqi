#!/data/data/com.termux/files/usr/bin/bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT=".halaqi-ai/diagnostics/diagnosis-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "=== HALAQI AI READ-ONLY DIAGNOSIS ==="
  echo
  echo "Problem: الصوت والصور داخل الرسائل"
  echo
  echo "=== GIT STATUS ==="
  git status --short
  echo
  echo "=== RELEVANT FILES ==="
  find src -type f \( -iname '*message*' -o -iname '*chat*' -o -iname '*media*' -o -iname '*upload*' \) | sort
  echo
  echo "=== API REFERENCES ==="
  grep -RniE 'message|messages|media|image|audio|voice|upload' src/server src/services 2>/dev/null | head -300
} > "$OUT"

echo "Diagnosis input collected:"
echo "$OUT"
echo
echo "READ-ONLY: no project files were modified."
