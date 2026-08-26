from pathlib import Path
from datetime import datetime
import shutil
import sys

POSTS = Path("src/components/posts/PostsView.tsx")

print("=" * 60)
print(" Halaqi - Posts Image Rendering Fix v5")
print("=" * 60)

if not POSTS.exists():
    print(f"❌ الملف غير موجود: {POSTS}")
    sys.exit(1)

text = POSTS.read_text(encoding="utf-8")

if "POST_IMAGE_RENDER_V5" in text:
    print("ℹ️ v5 مطبق مسبقاً.")
    sys.exit(0)

old = '''                  <div className="relative overflow-hidden border-y border-white/[0.06] bg-black/40">
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/20 via-transparent to-white/[0.025]" />
                    <img
                      src={post.imageUrl}
                      alt={post.caption || post.salonName}
                      className="block max-h-[680px] min-h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.01]"
                      loading="lazy"
                    />
                  </div>'''

if old not in text:
    print("❌ لم أجد بلوك صورة المنشور المتوقع.")
    print("لم يتم تعديل أي ملف.")
    sys.exit(1)

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = POSTS.with_name(
    POSTS.name + f".before-images-v5-{stamp}"
)

shutil.copy2(POSTS, backup)
print(f"📦 Backup: {backup}")

new = '''                  <div
                    className="POST_IMAGE_RENDER_V5 relative overflow-hidden border-y border-white/[0.06] bg-[#0b0b0b]"
                    style={{ aspectRatio: '4 / 5' }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0b]">
                      <div className="h-8 w-8 animate-pulse rounded-full border border-[#D4AF37]/10 bg-[#D4AF37]/[0.03]" />
                    </div>

                    <img
                      src={post.imageUrl}
                      alt={post.caption || post.salonName || 'Halaqi post'}
                      className="relative z-[1] block h-full w-full object-cover transition-opacity duration-300 group-hover:scale-[1.01]"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.opacity = '0';
                      }}
                    />

                    <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/20 via-transparent to-white/[0.025]" />
                  </div>'''

text = text.replace(old, new, 1)

POSTS.write_text(text, encoding="utf-8")

check = POSTS.read_text(encoding="utf-8")

if "POST_IMAGE_RENDER_V5" not in check:
    print("❌ فشل التحقق.")
    shutil.copy2(backup, POSTS)
    print("↩️ تم استرجاع Backup.")
    sys.exit(1)

print()
print("=" * 60)
print("✅ تم تطبيق v5 بنجاح")
print("=" * 60)
print("• أضفنا مساحة ثابتة للصورة قبل تحميلها")
print("• أزلنا ظهور المساحة السوداء المفاجئة")
print("• أضفنا Placeholder خفيف")
print("• decoding=async")
print("• Lazy Loading مستمر")
print("• Unified Feed لم يتغير")
print("• API لم يتغير")
print("• DB لم يتغير")
print("• تم إنشاء Backup")
print()
print("الآن نفذ:")
print("npm run build")
print("=" * 60)
