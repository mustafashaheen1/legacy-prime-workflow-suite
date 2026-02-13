#!/bin/bash

# Quick fix script - Run this to fix the crypto error immediately

cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

echo "🚀 Quick Fix for Crypto Module Error"
echo "===================================="
echo ""

# Step 1: Install expo-crypto
echo "Step 1: Installing expo-crypto..."
npx expo install expo-crypto

# Step 2: Install iOS dependencies
echo ""
echo "Step 2: Installing iOS dependencies..."
cd ios && pod install && cd ..

# Step 3: Copy fixed file (if original exists)
echo ""
echo "Step 3: Backing up and updating receipt-duplicate-detection.ts..."
if [ -f "lib/receipt-duplicate-detection.ts" ]; then
    # Create backup
    cp lib/receipt-duplicate-detection.ts lib/receipt-duplicate-detection.ts.backup
    echo "✅ Backup created: lib/receipt-duplicate-detection.ts.backup"
    
    # Copy fixed version
    if [ -f "lib/receipt-duplicate-detection-fixed.ts" ]; then
        cp lib/receipt-duplicate-detection-fixed.ts lib/receipt-duplicate-detection.ts
        echo "✅ Fixed version applied"
    else
        echo "⚠️  Fixed version not found. Please manually update the file."
    fi
else
    echo "⚠️  Original file not found. Please manually create lib/receipt-duplicate-detection.ts"
fi

# Step 4: Clear cache
echo ""
echo "Step 4: Clearing Metro bundler cache..."
rm -rf node_modules/.cache
rm -rf .expo

echo ""
echo "✅ All fixes applied!"
echo ""
echo "🎯 Now run: npx expo start --clear"
echo ""
