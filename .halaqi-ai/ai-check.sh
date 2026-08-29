#!/data/data/com.termux/files/usr/bin/bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".halaqi-ai/backups/$STAMP-before-ai"

mkdir -p "$BACKUP"

echo "=== Halaqi AI Safe Check ==="

echo "[1] Saving complete current state..."

git diff --binary > "$BACKUP/tracked.patch"
git status --short > "$BACKUP/status.txt"

git ls-files --others --exclude-standard -z | while IFS= read -r -d '' file; do
  mkdir -p "$BACKUP/untracked/$(dirname "$file")"
  cp -p "$file" "$BACKUP/untracked/$file"
done

echo "Checkpoint saved: $BACKUP"

echo
echo "[2] Running verification..."

if ./.halaqi-ai/verify.sh; then
  echo
  echo "ALL CHECKS PASSED."
  echo "No commit or push performed."
  exit 0
fi

echo
echo "CHECKS FAILED."
echo "Automatic destructive rollback is disabled."
echo "Your existing work has NOT been deleted."
echo
echo "Checkpoint available at:"
echo "$BACKUP"
echo
echo "No commit or push performed."
exit 1
