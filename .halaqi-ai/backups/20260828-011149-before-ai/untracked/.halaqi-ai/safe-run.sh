#!/data/data/com.termux/files/usr/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="ai/safe-$STAMP"

echo "=== Halaqi AI Safe Runner ==="

# Safety: never work directly on main
if [ "$(git branch --show-current)" = "main" ]; then
  git switch -c "$BRANCH"
else
  echo "Already on branch: $(git branch --show-current)"
fi

# Save current state before AI changes
git diff > ".halaqi-ai/backups/$STAMP.diff"
git status --short > ".halaqi-ai/backups/$STAMP.status"

echo "Backup created: .halaqi-ai/backups/$STAMP.diff"
echo "AI branch: $(git branch --show-current)"
echo
echo "Safety checkpoint ready."
echo "AI changes may now be made on this branch."
echo "Commit and push remain disabled."
