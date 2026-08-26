#!/bin/bash
echo "Applying Java 17 fix..."
sed -i "s/VERSION_21/VERSION_17/g" android/capacitor-cordova-android-plugins/build.gradle