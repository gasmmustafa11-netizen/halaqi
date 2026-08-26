from pathlib import Path
from datetime import datetime
import shutil
import sys

POSTS = Path("src/components/posts/PostsView.tsx")

print("=" * 60)
print(" Halaqi - Posts Image Loading Optimization v4")
print("=" * 60)

if not POSTS.exists():
    print(f"❌ الملف غير موجود: {POSTS}")
    sys.exit(1)

text = POSTS.read_text(encoding="utf-8")

if "POSTS_IMAGE_LOADING_V4" in text:
    print("ℹ️ تحسين الصور v4 موجود مسبقاً.")
    print("لم يتم تعديل أي شيء.")
    sys.exit(0)

old = """            {posts.map((post) => {
              const salon = getSalon(post);
"""

if old not in text:
    print("❌ لم أجد posts.map المتوقع.")
    print("لم يتم تعديل أي ملف.")
    sys.exit(1)

new = """            {posts.map((post, postIndex) => {
              const salon = getSalon(post);

              // POSTS_IMAGE_LOADING_V4
              // أول صورتين تظهران بسرعة، والباقي Lazy لتخفيف الضغط
              // على الشبكة والـGPU عند فتح Posts.
"""

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = POSTS.with_name(
    POSTS.name + f".before-images-v4-{stamp}"
)

shutil.copy2(POSTS, backup)
print(f"📦 Backup: {backup}")

text = text.replace(old, new, 1)

old_img = """                    <img
                      src={post.imageUrl}
                      alt={post.caption || post.salonName}
                      className="block max-h-[680px] min-h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                      loading="lazy"
                    />
"""

if old_img not in text:
    print("❌ لم أجد صورة المنشور الرئيسية بالشكل المتوقع.")
    shutil.copy2(backup, POSTS)
    print("↩️ تم استرجاع Backup.")
    sys.exit(1)

new_img = """                    <img
                      src={post.imageUrl}
                      alt={post.caption || post.salonName}
                      className="block aspect-[4/5] max-h-[680px] min-h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                      loading={postIndex < 2 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={postIndex < 2 ? 'high' : 'auto'}
                    />
"""

text = text.replace(old_img, new_img, 1)

POSTS.write_text(text, encoding="utf-8")

# التحقق
check = POSTS.read_text(encoding="utf-8")

required = [
    "POSTS_IMAGE_LOADING_V4",
    "loading={postIndex < 2 ? 'eager' : 'lazy'}",
    'decoding="async"',
    "fetchPriority={postIndex < 2 ? 'high' : 'auto'}",
    "aspect-[4/5]",
]

for item in required:
    if item not in check:
        print(f"❌ فشل التحقق من التعديل: {item}")
        shutil.copy2(backup, POSTS)
        print("↩️ تم استرجاع Backup.")
        sys.exit(1)

print()
print("=" * 60)
print("✅ تم تطبيق تحسين الصور بنجاح")
print("=" * 60)
print("• أول صورتين: تحميل سريع")
print("• باقي الصور: Lazy Loading")
print("• decoding=async")
print("• تثبيت مساحة الصورة")
print("• Unified Feed لم يتغير")
print("• db.ts لم يتغير")
print("• api.ts لم يتغير")
print("• types لم تتغير")
print("• التصميم الأساسي لم يتغير")
print(f"• Backup: {backup}")
print()
print("الخطوة التالية:")
print("npm run build")
print("=" * 60)
