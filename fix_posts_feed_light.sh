#!/usr/bin/env bash
set -e

FILE="src/components/posts/PostsView.tsx"
BACKUP="${FILE}.before-light-feed-$(date +%Y%m%d-%H%M%S)"

echo "===== Halaqi Light Feed Fix ====="

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

echo "[1/5] Creating backup..."
cp "$FILE" "$BACKUP"
echo "Backup: $BACKUP"

python3 - "$FILE" <<'PY'
from pathlib import Path
import sys

file = Path(sys.argv[1])
text = file.read_text()

# ------------------------------------------------------------
# 1) Remove the N-request like-status loading block
# ------------------------------------------------------------

old = r"""
      const likeEntries = await Promise.all(
        unifiedPosts.map(async (post) => {
          const like = await api.getUnifiedPostLikeStatus(
            post.id,
            post.postType
          );

          return [post.id, !!like.liked] as const;
        })
      );

      if (!cancelled) {
        setLikedPosts(Object.fromEntries(likeEntries));
      }
"""

if old not in text:
    print("WARNING: like-status block not found.")
    print("The file may already have the optimization.")
else:
    text = text.replace(
        old,
        r"""
      /*
       * LIGHT FEED:
       * لا نجلب حالة الـLike لكل منشور عند فتح الـFeed.
       *
       * سابقاً:
       * N posts = N إضافية API requests
       *
       * الآن:
       * Feed = request واحد
       * Like = request فقط عند ضغط المستخدم
       *
       * إذا رجع السيرفر لاحقاً likedByCurrentUser مع المنشور
       * يمكن تعبئتها هنا بدون أي requests إضافية.
       */
      if (!cancelled) {
        const initialLikes: Record<string, boolean> = {};

        unifiedPosts.forEach((post: any) => {
          if (typeof post.likedByCurrentUser === 'boolean') {
            initialLikes[post.id] = post.likedByCurrentUser;
          } else if (typeof post.liked === 'boolean') {
            initialLikes[post.id] = post.liked;
          }
        });

        setLikedPosts(initialLikes);
      }
"""
    )

# ------------------------------------------------------------
# 2) Make direct-post load update the unified post correctly
# ------------------------------------------------------------

old_direct = r"""
          setLikedPosts((current) => ({
            ...current,
            [result.post!.id]: false,
          }));
"""

new_direct = r"""
          /*
           * لا نسوي API request إضافي لمعرفة الـLike.
           * المنشور المباشر يدخل بحالة افتراضية، وتتحدث عند الضغط.
           */
          setLikedPosts((current) => ({
            ...current,
            [result.post!.id]:
              typeof (result.post as any).likedByCurrentUser === 'boolean'
                ? !!(result.post as any).likedByCurrentUser
                : !!(result.post as any).liked,
          }));
"""

if old_direct in text:
    text = text.replace(old_direct, new_direct)

file.write_text(text)
PY

echo "[2/5] Checking remaining like-status calls..."
COUNT=$(grep -o "getUnifiedPostLikeStatus" "$FILE" | wc -l || true)

echo "Remaining getUnifiedPostLikeStatus references: $COUNT"

if [ "$COUNT" -gt 0 ]; then
  echo "WARNING: getUnifiedPostLikeStatus still exists in PostsView."
else
  echo "OK: no per-post like-status request remains in PostsView."
fi

# ------------------------------------------------------------
# 3) Show the important feed section
# ------------------------------------------------------------

echo
echo "===== NEW FEED LOADER ====="
grep -n -A 75 -B 10 "const loadPosts" "$FILE" | head -n 100

# ------------------------------------------------------------
# 4) TypeScript/build sanity check
# ------------------------------------------------------------

echo
echo "[3/5] Checking package scripts..."

if [ -f package.json ]; then
  node -e '
    const p=require("./package.json");
    console.log("build:", p.scripts?.build || "not defined");
    console.log("typecheck:", p.scripts?.typecheck || "not defined");
  '
fi

echo
echo "[4/5] Running TypeScript check if available..."

if [ -f node_modules/.bin/tsc ]; then
  if node_modules/.bin/tsc --noEmit; then
    echo "TypeScript: OK"
  else
    echo "TypeScript: FAILED"
    echo "Backup remains at: $BACKUP"
    exit 1
  fi
else
  echo "tsc not found; skipping TypeScript check."
fi

# ------------------------------------------------------------
# 5) Final diff
# ------------------------------------------------------------

echo
echo "[5/5] Final diff..."
git diff -- "$FILE"

echo
echo "=============================================="
echo "DONE"
echo "=============================================="
echo
echo "Changed:"
echo "  $FILE"
echo
echo "Backup:"
echo "  $BACKUP"
echo
echo "Important:"
echo "  Feed opening no longer performs one Like-status request per post."
echo "  Likes are checked/changed only when the user interacts."
echo
echo "Next:"
echo "  npm run build"
echo
echo "If build is OK, test the Posts page before deploying."
