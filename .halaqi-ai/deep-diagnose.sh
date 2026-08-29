#!/data/data/com.termux/files/usr/bin/bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT=".halaqi-ai/diagnostics/deep-$STAMP.txt"

{
  echo "=== HALAQI DEEP MEDIA DIAGNOSIS ==="
  echo "READ-ONLY — NO FILES WILL BE MODIFIED"
  echo
  echo "=== GIT STATE ==="
  git status --short
  echo
  echo "=== RECENT COMMITS ==="
  git log -8 --oneline --decorate
  echo
  echo "=== CURRENT DIFF ==="
  git diff -- src/server/app.ts src/server/_debug_media.ts
  echo
  echo "=== MEDIA/MESSAGE FILES ==="
  find src -type f | grep -Ei 'message|chat|media|image|audio|voice|upload|attachment' | sort
  echo
  echo "=== MEDIA REFERENCES ==="
  grep -RniE 'image|audio|voice|media|upload|attachment|multipart|FormData|contentType|mimeType|mediaUrl|imageUrl|audioUrl' src \
    --exclude='*.test.*' --exclude-dir=node_modules 2>/dev/null | head -1000
  echo
  echo "=== MESSAGE REFERENCES ==="
  grep -RniE 'message|messages|conversation|chat' src/server src/services src/components \
    --exclude-dir=node_modules 2>/dev/null | head -1000
  echo
  echo "=== PACKAGE SCRIPTS ==="
  node -e 'console.log(JSON.stringify(require("./package.json").scripts,null,2))'
  echo
  echo "=== TYPESCRIPT CHECK ==="
  node node_modules/typescript/bin/tsc --noEmit
} > "$OUT" 2>&1

echo "Deep diagnosis created:"
echo "$OUT"
echo
echo "READ-ONLY: no project source files were modified."
