#!/bin/bash

# Find the receipt-duplicate-detection.ts file

PROJECT_DIR="/Users/codercrewllc/Downloads/legacy-prime-workflow-suite"

echo "🔍 Searching for receipt-duplicate-detection.ts..."
echo ""

cd "$PROJECT_DIR"

# Search for the file
FILE_PATH=$(find . -name "receipt-duplicate-detection.ts" -type f 2>/dev/null | head -n 1)

if [ -n "$FILE_PATH" ]; then
    echo "✅ Found file at: $FILE_PATH"
    echo ""
    echo "📝 Full path:"
    echo "$PROJECT_DIR/$FILE_PATH"
    echo ""
    echo "🔍 Checking line 35:"
    sed -n '35p' "$FILE_PATH"
    echo ""
    echo "📋 Context (lines 30-40):"
    sed -n '30,40p' "$FILE_PATH"
    echo ""
    echo "════════════════════════════════════════════════════════"
    echo ""
    echo "To edit this file, run:"
    echo "  open -a Xcode \"$PROJECT_DIR/$FILE_PATH\""
    echo ""
    echo "Or:"
    echo "  code \"$PROJECT_DIR/$FILE_PATH\""
    echo ""
else
    echo "❌ File not found in project"
    echo ""
    echo "Searching for any files with 'crypto' require..."
    echo ""
    grep -r "require('crypto')" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v node_modules | head -n 10
fi

echo ""
echo "════════════════════════════════════════════════════════"
