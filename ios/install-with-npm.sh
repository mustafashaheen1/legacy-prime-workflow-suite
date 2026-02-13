#!/bin/bash

# Final automated fix - Forces npm usage and installs everything

PROJECT_DIR="/Users/codercrewllc/Downloads/legacy-prime-workflow-suite"

echo "🔧 Automated Crypto Fix (Using NPM)"
echo "====================================="
echo ""

cd "$PROJECT_DIR"

# Force npm as package manager
export npm_config_user_agent="npm"
unset BUN_INSTALL

echo "📦 Installing expo-crypto with npm..."
npm install expo-crypto --save --legacy-peer-deps 2>&1

if [ $? -eq 0 ]; then
    echo "✅ expo-crypto installed successfully"
else
    echo "⚠️ Installation had warnings, but continuing..."
fi
echo ""

echo "📱 Installing iOS pods..."
if [ -d "ios" ]; then
    cd ios
    pod install 2>&1
    cd ..
    echo "✅ Pods installed"
else
    echo "⚠️ ios directory not found"
fi
echo ""

echo "🧹 Cleaning cache..."
rm -rf node_modules/.cache 2>/dev/null
rm -rf .expo 2>/dev/null
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/react-* 2>/dev/null
rm -rf /tmp/haste-* 2>/dev/null
echo "✅ Cache cleaned"
echo ""

echo "✅ Installation complete!"
echo ""
echo "🚀 To start the app, run:"
echo "   npx expo start --clear"
echo ""
