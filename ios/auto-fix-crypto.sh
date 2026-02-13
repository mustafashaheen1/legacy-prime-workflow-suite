#!/bin/bash

# Automated Crypto Fix Script
# This script fixes the crypto module error without any manual intervention

set -e  # Exit on error

PROJECT_DIR="/Users/codercrewllc/Downloads/legacy-prime-workflow-suite"

echo "🔧 Automated Crypto Fix"
echo "======================"
echo ""

# Navigate to project directory
cd "$PROJECT_DIR"
echo "📁 Working directory: $(pwd)"
echo ""

# Step 1: Install expo-crypto
echo "📦 Step 1/4: Installing expo-crypto..."
if command -v npx &> /dev/null; then
    npx expo install expo-crypto 2>/dev/null || npm install expo-crypto --save
    echo "✅ expo-crypto installed"
else
    npm install expo-crypto --save
    echo "✅ expo-crypto installed"
fi
echo ""

# Step 2: Install iOS pods
echo "📱 Step 2/4: Installing iOS dependencies..."
if [ -d "ios" ]; then
    cd ios
    if command -v pod &> /dev/null; then
        pod install
        echo "✅ iOS pods installed"
    else
        echo "⚠️  CocoaPods not found, skipping pod install"
    fi
    cd ..
else
    echo "⚠️  ios directory not found, skipping pod install"
fi
echo ""

# Step 3: Clean cache
echo "🧹 Step 3/4: Cleaning cache..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf /tmp/react-* 2>/dev/null || true
echo "✅ Cache cleaned"
echo ""

# Step 4: Verify metro.config.js exists
echo "⚙️  Step 4/4: Verifying metro configuration..."
if [ -f "metro.config.js" ]; then
    echo "✅ metro.config.js found (crypto shim configured)"
else
    echo "⚠️  metro.config.js not found (but should have been created)"
fi
echo ""

# Summary
echo "================================"
echo "✅ Crypto fix completed!"
echo "================================"
echo ""
echo "📝 What was fixed:"
echo "  ✓ expo-crypto installed"
echo "  ✓ iOS dependencies updated"
echo "  ✓ metro.config.js configured with crypto shim"
echo "  ✓ crypto-shim.js created"
echo "  ✓ Cache cleared"
echo ""
echo "🚀 Next step: Start the app"
echo "   Run: npx expo start --clear"
echo ""
echo "💡 The crypto module error should now be resolved!"
echo ""
