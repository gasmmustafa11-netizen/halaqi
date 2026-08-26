from pathlib import Path
import shutil
import sys

file = Path("src/server/app.ts")

if not file.exists():
    print("❌ الملف غير موجود:")
    print(file)
    sys.exit(1)

# نسخة احتياطية
backup = Path("src/server/app.ts.before_image_fix")

if not backup.exists():
    shutil.copy2(file, backup)
    print("✅ تم إنشاء نسخة احتياطية:")
    print(backup)
else:
    print("ℹ️ النسخة الاحتياطية موجودة مسبقًا:")
    print(backup)

# قراءة الملف
lines = file.read_text(encoding="utf-8").splitlines()

new_line = """  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https://images.unsplash.com data: blob:; frame-ancestors 'self';");"""

found = False
new_lines = []

for line in lines:
    if "Content-Security-Policy" in line:
        new_lines.append(new_line)
        found = True
        print("✅ تم العثور على CSP القديمة واستبدالها.")
    else:
        new_lines.append(line)

if not found:
    print("❌ لم أجد Content-Security-Policy داخل الملف.")
    sys.exit(1)

# حفظ الملف
file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

print()
print("🎉 تم الإصلاح بنجاح!")
print()
print("CSP الجديدة:")
print(new_line)
print()
print("الآن تحقق بالأوامر التالية:")
print()
print("grep -n \"Content-Security-Policy\" src/server/app.ts")
print("grep -n \"images.unsplash.com\" src/server/app.ts")
