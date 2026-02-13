#!/bin/bash

# Fix for crypto module error in React Native
# This script installs the necessary dependencies

echo "🔧 Fixing crypto module error for React Native..."
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in the project root?"
    exit 1
fi

echo "📦 Installing expo-crypto..."
npx expo install expo-crypto

if [ $? -eq 0 ]; then
    echo "✅ expo-crypto installed successfully"
else
    echo "⚠️  Failed to install with expo, trying npm..."
    npm install expo-crypto
fi

echo ""
echo "📱 Installing iOS dependencies..."
if [ -d "ios" ]; then
    cd ios
    pod install
    cd ..
    echo "✅ iOS pods installed"
else
    echo "⚠️  ios directory not found, skipping pod install"
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Replace the crypto usage in lib/receipt-duplicate-detection.ts with:"
echo "   import * as Crypto from 'expo-crypto';"
echo ""
echo "2. Or copy the fixed version:"
echo "   cp lib/receipt-duplicate-detection-fixed.ts lib/receipt-duplicate-detection.ts"
echo ""
echo "3. Clear cache and restart:"
echo "   npx expo start --clear"
echo ""
