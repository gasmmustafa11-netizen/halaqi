import os

yaml_content = """workflows:
  halaqi-android:
    name: Halaqi Android
    max_build_duration: 60
    instance_type: mac_mini_m1
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
    artifacts:
      - android/app/build/outputs/apk/debug/*.apk
"""

with open("codemagic.yaml", "w") as f:
    f.write(yaml_content)

os.system("git add codemagic.yaml")
os.system("git commit -m 'Fix: Update Java version to 21 to match project requirements'")
os.system("git push origin main")

print("تم التعديل: تم رفع نسخة الجافا إلى 21!")
