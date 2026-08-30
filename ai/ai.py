import os
import subprocess
from pathlib import Path

PROJECT = Path.home() / "halaqi-work" / "halaqi"
MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF"

IGNORE_DIRS = {
    "node_modules",
    "dist",
    ".git",
    ".cache",
    "__pycache__",
    "backups",
    ".vite",
}

IGNORE_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
}

ALLOWED_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx",
    ".json", ".css", ".scss",
    ".html", ".md", ".txt",
    ".py", ".sh", ".cjs", ".mjs",
}

MAX_FILE_SIZE = 120_000
MAX_FILES_TO_SEND = 6


def is_safe_file(path):
    if not path.is_file():
        return False

    if path.name in IGNORE_FILES:
        return False

    if any(part in IGNORE_DIRS for part in path.parts):
        return False

    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        return False

    try:
        if path.stat().st_size > MAX_FILE_SIZE:
            return False

        data = path.read_bytes()

        # تجاهل الملفات الثنائية
        if b"\x00" in data:
            return False

    except OSError:
        return False

    return True


def get_project_files():
    files = []

    try:
        for path in PROJECT.rglob("*"):
            if is_safe_file(path):
                files.append(path)
    except OSError:
        pass

    return files


def search_project(words):
    results = []
    seen = set()

    files = get_project_files()

    for path in files:
        try:
            text = path.read_text(
                encoding="utf-8",
                errors="ignore"
            )

            lower_text = text.lower()

            score = 0

            for word in words:
                if len(word) >= 2 and word.lower() in lower_text:
                    score += 1

            if score > 0:
                results.append((score, path))

        except (OSError, UnicodeError):
            continue

    results.sort(
        key=lambda item: item[0],
        reverse=True
    )

    for _, path in results[:MAX_FILES_TO_SEND]:
        if path not in seen:
            seen.add(path)

    return [path for _, path in results[:MAX_FILES_TO_SEND]]


def read_file(path):
    try:
        return path.read_text(
            encoding="utf-8",
            errors="ignore"
        )
    except Exception as e:
        return f"[تعذر قراءة الملف: {e}]"


def run_ai(prompt):
    try:
        command = [
            "llama-cli",
            "-hf",
            MODEL,
            "-sys",
            """
أنت مساعد برمجة محلي لمشروع Halaqi.

مهمتك هي فحص الكود وتشخيص المشاكل الحقيقية فقط.

القواعد:
- لا تخترع أخطاء.
- لا تعتبر تحسينات التصميم أخطاء.
- لا تقترح حذف شيء مهم بدون دليل.
- اعتمد فقط على الملفات والكود المرسل إليك.
- إذا لم تجد سببًا واضحًا قل بوضوح: لم أجد سببًا واضحًا.
- اذكر اسم الملف والدالة والمشكلة والدليل.
- لا تعدل الملفات بنفسك.
- لا تعرض أسرارًا أو مفاتيح API.
""",
            "-p",
            prompt,
            "-n",
            "900",
            "--temp",
            "0.15",
        ]

        result = subprocess.run(
            command,
            cwd=str(PROJECT),
            text=True,
            capture_output=True,
        )

        if result.returncode != 0:
            error = result.stderr.strip()

            if not error:
                error = "فشل تشغيل الموديل."

            return "❌ " + error

        return result.stdout.strip()

    except FileNotFoundError:
        return "❌ llama-cli غير موجود."
    except Exception as e:
        return f"❌ خطأ في تشغيل AI: {e}"


def inspect_problem(problem):
    print("\n🔎 أبحث عن الملفات المرتبطة...\n")

    # كلمات مهمة من طلب المستخدم
    words = [
        word.strip(
            ".,!?؟:؛()[]{}\"'،"
        )
        for word in problem.split()
    ]

    words = [
        word for word in words
        if len(word) >= 2
    ]

    files = search_project(words)

    if not files:
        return """
لم أجد ملفات كافية مرتبطة بالمشكلة.

لم أقم باختراع تشخيص.

جرّب ذكر اسم الزر أو الدالة أو الـAPI إذا تعرفه.
"""

    context = []

    for path in files:
        relative = path.relative_to(PROJECT)

        content = read_file(path)

        context.append(
            f"""
===== FILE: {relative} =====

{content}
"""
        )

    prompt = f"""
المشكلة التي يريد المستخدم فحصها:

{problem}

هذه الملفات تم العثور عليها بالبحث داخل المشروع:

{"".join(context)}

قم الآن بفحص المشكلة فقط.

أجب بهذا الشكل:

1. النتيجة:
   - هل يوجد خطأ واضح أم لا؟

2. مكان المشكلة:
   - الملف
   - الدالة أو الـAPI
   - السطر التقريبي إذا أمكن

3. السبب:
   - اشرح السبب التقني

4. الدليل:
   - اذكر الجزء المهم من الكود باختصار

5. العلاقة بالمشكلة:
   - اشرح كيف يؤدي الخطأ إلى السلوك الذي وصفه المستخدم

مهم جدًا:
إذا كانت الملفات المتوفرة غير كافية لإثبات السبب، قل ذلك بوضوح ولا تخمّن.

لا تعدل أي ملف.
"""

    return run_ai(prompt)


def main():
    print("=" * 50)
    print("🤖 Halaqi Local Coding AI")
    print("=" * 50)
    print(f"📁 المشروع: {PROJECT}")
    print(f"🧠 الموديل: {MODEL}")
    print("🔎 الوضع الحالي: فحص فقط")
    print("🔒 لا يتم تعديل أي ملف")
    print("اكتب «خروج» لإنهاء المحادثة.")
    print("=" * 50)
    print()

    while True:
        try:
            problem = input("أنت: ").strip()

            if not problem:
                continue

            if problem.lower() in {
                "خروج",
                "exit",
                "quit",
            }:
                print("\n👋 تم إنهاء المحادثة.")
                break

            print("\n🔎 أفحص المشروع...\n")

            answer = inspect_problem(problem)

            print("AI:")
            print(answer)
            print()

        except KeyboardInterrupt:
            print("\n\n👋 تم الإنهاء.")
            break

        except EOFError:
            print("\n👋 تم الإنهاء.")
            break

        except Exception as e:
            print(f"\n❌ خطأ: {e}\n")


if __name__ == "__main__":
    main()
