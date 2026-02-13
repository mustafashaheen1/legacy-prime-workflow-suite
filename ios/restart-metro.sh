#!/bin/bash

# Restart Metro Bundler with clean cache and proper config

PROJECT_DIR="/Users/codercrewllc/Downloads/legacy-prime-workflow-suite"

echo "🧹 Cleaning Metro cache..."
cd "$PROJECT_DIR"

# Kill any running Metro instances
lsof -ti:8081 | xargs kill -9 2>/dev/null || true

# Clean all caches
rm -rf node_modules/.cache 2>/dev/null
rm -rf .expo 2>/dev/null
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/react-* 2>/dev/null
rm -rf /tmp/haste-* 2>/dev/null

echo "✅ Cache cleaned"
echo ""

# Verify critical files exist
echo "🔍 Verifying files..."

if [ -f "metro.config.js" ]; then
    echo "✅ metro.config.js found"
else
    echo "❌ metro.config.js NOT FOUND"
fi

if [ -f "crypto-shim.js" ]; then
    echo "✅ crypto-shim.js found"
else
    echo "❌ crypto-shim.js NOT FOUND"
fi

if [ -d "node_modules/expo-crypto" ]; then
    echo "✅ expo-crypto installed"
else
    echo "❌ expo-crypto NOT INSTALLED"
fi

echo ""
echo "🚀 Starting Metro Bundler with clean cache..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start Metro with explicit config and clear cache
npx expo start --clear --config metro.config.js
