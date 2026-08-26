from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

ROOT = Path(".")
POSTS = ROOT / "src/components/posts/PostsView.tsx"
API = ROOT / "src/services/api.ts"
DB = ROOT / "src/server/db.ts"

def fail(msg):
    print(f"\n❌ {msg}")
    sys.exit(1)

def backup(path):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = path.with_name(path.name + f".before-unified-feed-{stamp}")
    shutil.copy2(path, out)
    print(f"📦 Backup: {out}")

print("=" * 60)
print(" Halaqi - Safe Unified Feed Fix")
print("=" * 60)

if not POSTS.exists():
    fail(f"غير موجود: {POSTS}")

if not API.exists():
    fail(f"غير موجود: {API}")

if not DB.exists():
    fail(f"غير موجود: {DB}")

posts_text = POSTS.read_text(encoding="utf-8")
api_text = API.read_text(encoding="utf-8")
db_text = DB.read_text(encoding="utf-8")

print("\n🔎 فحص Unified Feed...")

if "getUnifiedPostsFeed" not in api_text:
    fail("getUnifiedPostsFeed غير موجود في services/api.ts")

m = re.search(
    r"async\s+getUnifiedPostsFeed\s*\([^)]*\)[\s\S]{0,5000}?",
    api_text
)

if not m:
    fail("تعذر قراءة getUnifiedPostsFeed().")

if "fetchWithAuth('/api/posts/feed')" not in m.group(0):
    fail("getUnifiedPostsFeed لا يستخدم /api/posts/feed بالشكل المتوقع.")

print("✅ Unified Feed API موجود.")

print("\n🔎 فحص postType في Backend...")

db_start = db_text.find("async getUnifiedPostsFeed")
if db_start == -1:
    fail("getUnifiedPostsFeed غير موجود في db.ts")

db_section = db_text[db_start:db_start + 10000]

if "postType" not in db_section:
    fail(
        "Backend Unified Feed لا يحتوي postType.\n"
        "لن أعدل PostsView حتى لا نكسر Like/Comments."
    )

print("✅ postType موجود في Unified Feed.")

print("\n🔎 فحص PostsView...")

if "api.getUnifiedPostsFeed()" in posts_text:
    print("ℹ️ PostsView مربوط مسبقاً بالـUnified Feed.")
    print("لن أكرر التعديل.")
    sys.exit(0)

old_block = """        const [salonResults, userPostsResult] = await Promise.all([
          Promise.allSettled(
            salons.map((salon) => api.getSalonPosts(salon.id))
          ),
          api.getUserPostsFeed(),
        ]);

        const results = salonResults
          .filter(
            (result): result is PromiseFulfilledResult<any> =>
              result.status === 'fulfilled'
          )
          .map((result) => result.value);

        const loadedUserPosts = userPostsResult.success
          ? (userPostsResult.posts || []).map((post) => ({
              ...post,
              likeCount: Number(post.likeCount || 0),
            }))
          : [];

        if (!cancelled) {
          setUserPosts(loadedUserPosts);
        }

        if (cancelled) return;

        const merged = [
          ...results.flat(),
          ...loadedUserPosts,
        ].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        setPosts(merged as SalonPost[]);

        const likeEntries = await Promise.all(
          merged.map(async (post) => {
            const result = await api.getUserPostLikeStatus(post.id);
            return [post.id, !!result.liked] as const;
          })
        );

        if (!cancelled) {
          setLikedPosts(Object.fromEntries(likeEntries));
        }
"""

if old_block not in posts_text:
    fail(
        "لم أجد البلوك المتوقع داخل PostsView.tsx.\n"
        "لن أعدل الملف حتى لا يحصل تعديل خاطئ."
    )

backup(POSTS)

new_block = """        const feedResult = await api.getUnifiedPostsFeed();

        if (cancelled) return;

        if (!feedResult.success) {
          console.error(
            '[PostsView] Unified Feed Error:',
            feedResult.error
          );

          setPosts([]);
          setUserPosts([]);
          return;
        }

        const merged = Array.isArray(feedResult.posts)
          ? feedResult.posts.map((post: any) => ({
              ...post,
              likeCount: Number(post.likeCount || 0),
              commentCount: Number(post.commentCount || 0),
            }))
          : [];

        merged.sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        if (!cancelled) {
          setPosts(merged as SalonPost[]);

          setUserPosts(
            merged.filter(
              (post: any) => post.postType === 'user'
            ) as UserPost[]
          );
        }

        if (cancelled) return;

        /*
         * Like status:
         * نستخدم endpoint الصحيح حسب نوع المنشور.
         * لا نطلب user-post endpoint لمنشورات الصالونات.
         */
        const likeEntries = await Promise.all(
          merged.map(async (post: any) => {
            try {
              const result =
                post.postType === 'user'
                  ? await api.getUserPostLikeStatus(post.id)
                  : await api.getPostLikeStatus(post.id);

              return [post.id, !!result.liked] as const;
            } catch {
              return [post.id, false] as const;
            }
          })
        );

        if (!cancelled) {
          setLikedPosts(Object.fromEntries(likeEntries));
        }
"""

posts_text = posts_text.replace(old_block, new_block)

POSTS.write_text(posts_text, encoding="utf-8")

print("\n" + "=" * 60)
print("✅ تم ربط PostsView بالـ Unified Feed")
print("=" * 60)
print("تم أيضاً:")
print("  • إيقاف طلب getSalonPosts لكل صالون من PostsView")
print("  • استخدام /api/posts/feed")
print("  • الحفاظ على ترتيب المنشورات حسب createdAt")
print("  • استخدام postType لتحديد Like endpoint")
print("  • إنشاء Backup تلقائي قبل التعديل")
print()
print("⚠️ لم يتم تعديل:")
print("  • types/index.ts")
print("  • App.tsx")
print("  • Bottom Navigation")
print("  • التصميم")
print("  • Server API")
print()
print("الخطوة التالية:")
print("  npm run build")
print("=" * 60)
