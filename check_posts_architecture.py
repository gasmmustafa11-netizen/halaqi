from pathlib import Path
import re
import sys

ROOT = Path(".")
POSTS = ROOT / "src/components/posts/PostsView.tsx"
API = ROOT / "src/services/api.ts"
APP = ROOT / "src/server/app.ts"
DB = ROOT / "src/server/db.ts"

print("=" * 70)
print(" Halaqi - Posts Architecture Diagnostic")
print(" READ ONLY - لا يتم تعديل أي ملف")
print("=" * 70)

files = {
    "PostsView.tsx": POSTS,
    "api.ts": API,
    "app.ts": APP,
    "db.ts": DB,
}

for name, path in files.items():
    if not path.exists():
        print(f"❌ {name}: غير موجود")
        sys.exit(1)
    print(f"✅ {name}: موجود")

pt = POSTS.read_text(encoding="utf-8")
at = API.read_text(encoding="utf-8")
appt = APP.read_text(encoding="utf-8")
dt = DB.read_text(encoding="utf-8")

print("\n" + "=" * 70)
print("1) Unified Feed")
print("=" * 70)

checks = {
    "PostsView يستخدم Unified Feed":
        "api.getUnifiedPostsFeed()" in pt,

    "API يحتوي getUnifiedPostsFeed":
        "async getUnifiedPostsFeed" in at,

    "API يستخدم /api/posts/feed":
        "/api/posts/feed" in at,

    "Backend يحتوي /api/posts/feed":
        "/api/posts/feed" in appt,

    "DB يحتوي getUnifiedPostsFeed":
        "async getUnifiedPostsFeed" in dt,

    "DB يحتوي postType":
        "postType" in dt[dt.find("async getUnifiedPostsFeed"):
                              dt.find("async getUnifiedPostsFeed") + 12000],
}

for label, result in checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("2) Pagination")
print("=" * 70)

db_start = dt.find("async getUnifiedPostsFeed")
db_section = dt[db_start:db_start + 15000] if db_start != -1 else ""

api_start = at.find("async getUnifiedPostsFeed")
api_section = at[api_start:api_start + 8000] if api_start != -1 else ""

pagination_checks = {
    "DB يحتوي LIMIT داخل Unified Feed":
        bool(re.search(r"\bLIMIT\b", db_section, re.I)),

    "DB يحتوي OFFSET داخل Unified Feed":
        bool(re.search(r"\bOFFSET\b", db_section, re.I)),

    "DB يحتوي cursor داخل Unified Feed":
        bool(re.search(r"\bcursor\b", db_section, re.I)),

    "API يستقبل limit":
        bool(re.search(r"\blimit\b", api_section, re.I)),

    "API يستقبل cursor":
        bool(re.search(r"\bcursor\b", api_section, re.I)),

    "PostsView يحتوي nextCursor":
        "nextCursor" in pt,

    "PostsView يحتوي hasMore":
        "hasMore" in pt,

    "PostsView يحتوي IntersectionObserver":
        "IntersectionObserver" in pt,
}

for label, result in pagination_checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("3) Feed Loading")
print("=" * 70)

loading_checks = {
    "setPosts(merged) موجود":
        "setPosts(merged" in pt,

    "إضافة منشورات للقديم [...prev":
        "[...prev" in pt,

    "Unified Feed يرجع كل النتائج بدون LIMIT":
        (
            "ORDER BY created_at DESC" in db_section
            and not re.search(r"\bLIMIT\b", db_section, re.I)
        ),

    "طلب Like جماعي عند فتح الصفحة":
        "merged.map(async" in pt
        and "getUserPostLikeStatus" in pt,

    "v3 Lazy Like مطبق":
        "POSTS_LIKE_STATUS_LAZY_V3" in pt,
}

for label, result in loading_checks.items():
    symbol = "⚠️ " if (
        "بدون LIMIT" in label or
        "Like جماعي" in label
    ) and result else ("✅ " if result else "❌ ")
    print(symbol + label)

print("\n" + "=" * 70)
print("4) Images")
print("=" * 70)

img_matches = re.findall(r"<img[\s\S]*?/>", pt)

print(f"عدد عناصر <img> التي وجدها الفحص: {len(img_matches)}")

image_checks = {
    "post.imageUrl مستخدم":
        "src={post.imageUrl}" in pt,

    "loading=lazy":
        'loading="lazy"' in pt,

    "decoding=async":
        'decoding="async"' in pt,

    "aspect-ratio للصورة":
        "aspectRatio" in pt,

    "Placeholder للصورة":
        "POST_IMAGE_RENDER_V5_1" in pt
        or "POST_IMAGE_RENDER_V5" in pt,

    "Image CDN/Optimizer واضح في PostsView":
        any(x in pt.lower() for x in [
            "cdn",
            "image optimizer",
            "imageoptimization",
            "cloudinary",
            "imgix",
            "images.weserv"
        ]),
}

for label, result in image_checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("5) Image Preloading")
print("=" * 70)

preload_checks = {
    "rel=preload":
        'rel="preload"' in pt,

    "fetchPriority":
        "fetchPriority" in pt,

    "priority image":
        "priority" in pt.lower(),

    "loading=eager":
        'loading="eager"' in pt,
}

for label, result in preload_checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("6) Caching")
print("=" * 70)

cache_checks = {
    "Cache-Control في Posts API":
        "Cache-Control" in appt[appt.find("/api/posts/feed"):
                              appt.find("/api/posts/feed") + 3000]
        if "/api/posts/feed" in appt else False,

    "ETag":
        "ETag" in appt,

    "Service Worker":
        "serviceWorker" in pt
        or "service-worker" in pt.lower(),

    "localStorage مرتبط بالـPosts":
        "localStorage" in pt and (
            "post" in pt.lower() or "feed" in pt.lower()
        ),
}

for label, result in cache_checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("7) Virtualization")
print("=" * 70)

virtualization_checks = {
    "react-window":
        "react-window" in pt or "react-window" in at,

    "react-virtual":
        "react-virtual" in pt or "react-virtual" in at,

    "Virtualizer":
        "Virtualizer" in pt,
}

for label, result in virtualization_checks.items():
    print(("✅ " if result else "❌ ") + label)

print("\n" + "=" * 70)
print("8) Unified Feed SQL Summary")
print("=" * 70)

if db_section:
    has_union = "UNION ALL" in db_section
    has_limit = bool(re.search(r"\bLIMIT\b", db_section, re.I))
    has_cursor = bool(re.search(r"\bcursor\b", db_section, re.I))

    print("UNION ALL:", "✅" if has_union else "❌")
    print("ORDER BY created_at DESC:",
          "✅" if "ORDER BY created_at DESC" in db_section else "❌")
    print("LIMIT:", "✅" if has_limit else "❌")
    print("Cursor:", "✅" if has_cursor else "❌")

print("\n" + "=" * 70)
print("9) Final Diagnosis")
print("=" * 70)

problems = []

if "api.getUnifiedPostsFeed()" in pt:
    problems.append("Feed بدون Pagination من جهة PostsView")

if (
    "ORDER BY created_at DESC" in db_section
    and not re.search(r"\bLIMIT\b", db_section, re.I)
):
    problems.append("Unified Feed يرجع كل المنشورات بدون LIMIT")

if "nextCursor" not in pt:
    problems.append("لا يوجد Cursor Pagination في PostsView")

if "IntersectionObserver" not in pt:
    problems.append("لا يوجد Infinite Scroll / IntersectionObserver")

if "fetchPriority" not in pt and 'loading="eager"' not in pt:
    problems.append("لا يوجد Preloading واضح لأول الصور")

if not any(x in pt.lower() for x in [
    "cdn",
    "cloudinary",
    "imgix",
    "image optimizer"
]):
    problems.append("لا يوجد Image CDN/Optimizer واضح في PostsView")

if "Cache-Control" not in appt:
    problems.append("لا يوجد Cache-Control واضح للـFeed API")

if problems:
    print("\nالمشاكل/النواقص المكتشفة:")
    for i, problem in enumerate(problems, 1):
        print(f"{i}. ⚠️ {problem}")
else:
    print("✅ لم يتم اكتشاف نقص واضح.")

print("\n" + "=" * 70)
print("التوصية")
print("=" * 70)

print("""
المرحلة الأولى:
  1. Cursor Pagination
  2. 12-20 منشور لكل دفعة
  3. Infinite Scroll
  4. عدم إعادة تحميل المنشورات السابقة

المرحلة الثانية:
  5. Image Optimization / CDN
  6. Preload ذكي
  7. Cache

المرحلة الثالثة عند كبر الـFeed:
  8. Virtualization
""")

print("=" * 70)
print("READ ONLY - لم يتم تعديل أي ملف")
print("=" * 70)
