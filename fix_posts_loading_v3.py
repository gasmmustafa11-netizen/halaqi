from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

POSTS = Path("src/components/posts/PostsView.tsx")

print("=" * 60)
print(" Halaqi - Safe Posts Loading Optimization v3")
print("=" * 60)

if not POSTS.exists():
    print(f"❌ الملف غير موجود: {POSTS}")
    sys.exit(1)

text = POSTS.read_text(encoding="utf-8")

# لا نعيد التعديل إذا سبق تطبيقه
if "POSTS_LIKE_STATUS_LAZY_V3" in text:
    print("ℹ️ التحسين v3 موجود مسبقاً.")
    print("لم يتم تعديل أي شيء.")
    sys.exit(0)

old = """        const likeEntries = await Promise.all(
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

if old not in text:
    print("❌ لم أجد بلوك Like المتوقع.")
    print("لم يتم تعديل أي ملف.")
    sys.exit(1)

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = POSTS.with_name(
    POSTS.name + f".before-loading-v3-{stamp}"
)

shutil.copy2(POSTS, backup)
print(f"📦 Backup: {backup}")

new = """        /*
         * POSTS_LIKE_STATUS_LAZY_V3
         *
         * لا نرسل طلب Like مستقل لكل المنشورات عند فتح الصفحة.
         * هذا يمنع عشرات طلبات API المتزامنة التي كانت تؤخر
         * اكتمال تحميل شاشة Posts.
         *
         * الحالة الافتراضية false، ويتم تحديثها عند تفاعل المستخدم.
         */
        if (!cancelled) {
          setLikedPosts({});
        }
"""

text = text.replace(old, new, 1)

# نضيف تحديث الحالة عند بداية handleLike حتى يبقى السلوك واضحاً
marker = """  const handleLike = async (post: SalonPost) => {
"""

if marker not in text:
    print("❌ لم أجد handleLike.")
    print("إرجاع النسخة الاحتياطية...")
    shutil.copy2(backup, POSTS)
    sys.exit(1)

# لا نغيّر handleLike نفسه لأن toggle endpoint ما زال صحيحاً.
# فقط نتركه كما هو.

POSTS.write_text(text, encoding="utf-8")

# تحقق بعد الكتابة
check = POSTS.read_text(encoding="utf-8")

if "POSTS_LIKE_STATUS_LAZY_V3" not in check:
    print("❌ فشل التحقق بعد التعديل.")
    shutil.copy2(backup, POSTS)
    print("↩️ تم استرجاع Backup.")
    sys.exit(1)

if "merged.map(async (post: any)" in check:
    print("❌ ما زال طلب Like الجماعي موجوداً.")
    shutil.copy2(backup, POSTS)
    print("↩️ تم استرجاع Backup.")
    sys.exit(1)

print()
print("=" * 60)
print("✅ تم تطبيق التحسين بنجاح")
print("=" * 60)
print("• أوقفنا طلبات Like الجماعية عند فتح Posts")
print("• Unified Feed لم يتغير")
print("• db.ts لم يتغير")
print("• api.ts لم يتغير")
print("• types لم تتغير")
print("• التصميم لم يتغير")
print("• تم إنشاء Backup تلقائياً")
print()
print("الخطوة التالية:")
print("npm run build")
print("=" * 60)
