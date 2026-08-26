import os
import subprocess

yaml_content = """workflows:
  halaqi-android:
    environment:
      java: 21
    scripts:
      - name: Install dependencies
        script: npm install
      - name: Build Web Assets
        script: npm run build
      - name: Sync Capacitor
        script: npx cap sync android
      - name: Build Android
        script: |
          cd android
          chmod +x gradlew
          ./gradlew clean assembleDebug
"""

with open("codemagic.yaml", "w") as f:
    f.write(yaml_content)

print("✅ تم تحديث ملف codemagic.yaml (تم ضبط Java على 21).")

try:
    subprocess.run(["git", "add", "codemagic.yaml"], check=True)
    subprocess.run(["git", "commit", "-m", "fix: set java to 21"], check=True)
    subprocess.run(["git", "push", "origin", "main"], check=True)
    print("🚀 تم الرفع! الآن Codemagic سيستخدم Java 21 وسيتوافق مع مشروعك.")
except Exception as e:
    print(f"❌ حدث خطأ: {e}")
