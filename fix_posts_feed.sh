#!/usr/bin/env bash
set -e

echo "========================================"
echo " Halaqi - Restore Stable Posts Feed"
echo "========================================"

FILE="src/components/posts/PostsView.tsx"
BACKUP="src/components/posts/PostsView.before-restore-$(date +%Y%m%d-%H%M%S).tsx"
SOURCE="src/components/posts/PostsView.before-feed-api-optimization.tsx"

echo
echo "===== CHECK FILES ====="

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "ERROR: $SOURCE not found"
  exit 1
fi

echo "Current: $FILE"
echo "Restore: $SOURCE"

echo
echo "===== BACKUP CURRENT ====="

cp "$FILE" "$BACKUP"

echo "Backup created:"
echo "$BACKUP"

echo
echo "===== RESTORE STABLE FEED ====="

cp "$SOURCE" "$FILE"

echo "PostsView.tsx restored from pre-optimization version."

echo
echo "===== VERIFY UNIFIED FEED REMOVED ====="

if grep -n "getUnifiedPostsFeed" "$FILE"; then
  echo
  echo "ERROR: Unified feed reference still exists."
  echo "Restoring original file..."
  cp "$BACKUP" "$FILE"
  exit 1
else
  echo "OK: getUnifiedPostsFeed removed from PostsView."
fi

echo
echo "===== VERIFY OLD FEED LOGIC ====="

if grep -n "getSalonPosts" "$FILE"; then
  echo "OK: salon posts loading restored."
else
  echo "WARNING: getSalonPosts not found."
fi

if grep -n "getUserPostsFeed" "$FILE"; then
  echo "OK: user posts feed restored."
else
  echo "WARNING: getUserPostsFeed not found."
fi

if grep -n "Promise.all" "$FILE"; then
  echo "OK: parallel feed loading detected."
fi

echo
echo "===== DIFF STAT ====="

git diff --stat -- "$FILE" || true

echo
echo "===== POSTS DIFF ====="

git diff -- "$FILE" || true

echo
echo "===== BUILD ====="

npm run build

echo
echo "========================================"
echo " SUCCESS"
echo "========================================"
echo
echo "Posts feed restored to the stable version."
echo
echo "Current file:"
echo "$FILE"
echo
echo "Backup:"
echo "$BACKUP"
echo
echo "IMPORTANT:"
echo "No git commit was created."
echo "No Vercel deployment was performed."
echo
echo "Next step:"
echo "Test the Posts page locally before deploying."
echo
