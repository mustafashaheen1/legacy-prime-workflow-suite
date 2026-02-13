#!/bin/bash

# Start Metro Bundler for React Native/Expo
# This script should be run before building the iOS app in Xcode

echo "🚀 Starting Metro Bundler..."
echo ""

# Navigate to the project root (parent of ios directory)
cd "$(dirname "$0")/.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Running npm install..."
    npm install
fi

# Start the Metro bundler
echo "Starting Expo/Metro bundler..."
npx expo start --ios

# Alternative if expo start doesn't work:
# npx react-native start
