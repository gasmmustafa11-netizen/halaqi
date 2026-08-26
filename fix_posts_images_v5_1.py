from pathlib import Path
from datetime import datetime
import shutil
import sys
import re

POSTS = Path("src/components/posts/PostsView.tsx")

print("=" * 60)
print(" Halaqi - Posts Image Rendering Fix v5.1")
print("=" * 60)

if not POSTS.exists():
    print(f"❌ الملف غير موجود: {POSTS}")
    sys.exit(1)

text = POSTS.read_text(encoding="utf-8")

if "POST_IMAGE_RENDER_V5_1" in text:
    print("ℹ️ v5.1 مطبق مسبقاً.")
    sys.exit(0)

# نبحث عن img الرئيسي الخاص بصورة المنشور
pattern = re.compile(
    r'''(?P<indent>\s*)<img
(?P<body>[\s\S]*?)
(?P<indent2>\s*)/>
''',
    re.MULTILINE
)

matches = list(pattern.finditer(text))

target = None

for m in matches:
    block = m.group(0)

    if (
        "src={post.imageUrl}" in block
        and "loading=" in block
    ):
        target = m
        break

if target is None:
    print("❌ لم أجد صورة المنشور الحالية.")
    print("لم يتم تعديل أي ملف.")
    sys.exit(1)

old_img = target.group(0)
indent = target.group("indent")

stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
backup = POSTS.with_name(
    POSTS.name + f".before-images-v5-1-{stamp}"
)

shutil.copy2(POSTS, backup)
print(f"📦 Backup: {backup}")

new_img = f'''{indent}<div
{indent}  className="POST_IMAGE_RENDER_V5_1 relative overflow-hidden bg-[#0b0b0b]"
{indent}  style={{ aspectRatio: '4 / 5' }}
{indent}>
{indent}  <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0b]">
{indent}    <div className="h-8 w-8 animate-pulse rounded-full border border-[#D4AF37]/10 bg-[#D4AF37]/[0.03]" />
{indent}  </div>

{indent}  <img
{indent}    src={{post.imageUrl}}
{indent}    alt={{post.caption || post.salonName || 'Halaqi post'}}
{indent}    className="relative z-[1] block h-full w-full object-cover transition-opacity duration-300"
{indent}    loading="lazy"
{indent}    decoding="async"
{indent}    onError={{(event) => {{
{indent}      event.currentTarget.style.opacity = '0';
{indent}    }}}}
{indent}  />
{indent}</div>
'''

text = text[:target.start()] + new_img + text[target.end():]

POSTS.write_text(text, encoding="utf-8")

check = POSTS.read_text(encoding="utf-8")

if "POST_IMAGE_RENDER_V5_1" not in check:
    print("❌ فشل التحقق بعد التعديل.")
    shutil.copy2(backup, POSTS)
    print("↩️ تم استرجاع Backup.")
    sys.exit(1)

print()
print("=" * 60)
print("✅ تم تطبيق v5.1 بنجاح")
print("=" * 60)
print("• تم العثور على صورة المنشور الحالية")
print("• تم تثبيت مساحة الصورة")
print("• تم إضافة Placeholder")
print("• decoding=async")
print("• Lazy Loading مستمر")
print("• Unified Feed لم يتغير")
print("• DB لم يتغير")
print("• API لم يتغير")
print("• Backup تم إنشاؤه")
print()
print("الخطوة التالية:")
print("npm run build")
print("=" * 60)
