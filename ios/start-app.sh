#!/bin/bash

# Final step - Start Metro Bundler

cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

echo "🧹 Clearing caches..."
rm -rf node_modules/.cache 2>/dev/null
rm -rf .expo 2>/dev/null
rm -rf /tmp/metro-* 2>/dev/null
rm -rf /tmp/react-* 2>/dev/null

echo ""
echo "🚀 Starting Metro Bundler with clean cache..."
echo ""

npx expo start --clear
