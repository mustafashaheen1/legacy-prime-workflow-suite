#!/bin/bash

# Pre-build script to check if Metro bundler is running
# Add this as a "Run Script" build phase in Xcode BEFORE "Compile Sources"

# Only check in DEBUG mode
if [ "${CONFIGURATION}" == "Debug" ]; then
    echo "Checking if Metro bundler is running..."
    
    # Check if port 8081 is in use (Metro's default port)
    if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ Metro bundler is running on port 8081"
    else
        echo "⚠️  WARNING: Metro bundler is not running!"
        echo ""
        echo "To fix this error, start the Metro bundler:"
        echo "  cd ${PROJECT_DIR}/.."
        echo "  npx expo start"
        echo ""
        echo "Or run this script:"
        echo "  ${PROJECT_DIR}/../start-metro.sh"
        echo ""
        echo "The app will crash at launch without the bundler running."
    fi
fi

exit 0
