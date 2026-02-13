#!/bin/bash
# ONE-LINE FIX - Copy and paste this entire command into terminal

cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite && \
echo "🔧 Installing expo-crypto..." && \
npx expo install expo-crypto && \
echo "📱 Installing iOS pods..." && \
cd ios && pod install && cd .. && \
echo "🧹 Cleaning cache..." && \
rm -rf node_modules/.cache .expo /tmp/metro-* /tmp/react-* 2>/dev/null; \
echo "" && \
echo "✅ Fix complete! Starting Metro..." && \
npx expo start --clear
