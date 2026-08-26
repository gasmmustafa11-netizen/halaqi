#!/usr/bin/env bash
echo "Applying Java 17 fix to gradle files..."
sed -i '' 's/VERSION_21/VERSION_17/g' android/capacitor-cordova-android-plugins/build.gradle
sed -i '' 's/VERSION_21/VERSION_17/g' android/capacitor-android/build.gradle
echo "Fix applied."


