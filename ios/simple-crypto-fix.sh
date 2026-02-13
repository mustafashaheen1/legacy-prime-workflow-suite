#!/bin/bash

# Simple direct fix for crypto error

cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

echo "🔧 Applying crypto fix..."
echo ""

# Find all TypeScript files with require('crypto')
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "require('crypto')" {} \; | grep -v node_modules)

if [ -z "$FILES" ]; then
    echo "❌ No files found with require('crypto')"
    echo ""
    echo "The file might be outside this directory or already fixed."
    exit 1
fi

echo "📝 Found files to fix:"
echo "$FILES"
echo ""

# Process each file
for FILE in $FILES; do
    echo "Processing: $FILE"
    
    # Backup
    cp "$FILE" "${FILE}.backup"
    
    # Add import if not present
    if ! grep -q "expo-crypto" "$FILE"; then
        echo "  Adding expo-crypto import..."
        # Add import after the first import statement
        sed -i '' '/^import/a\
import * as Crypto from '\''expo-crypto'\'';
' "$FILE"
    fi
    
    # Comment out the require
    sed -i '' "s/const crypto = require('crypto');/\/\/ const crypto = require('crypto'); \/\/ DISABLED - using expo-crypto/" "$FILE"
    
    echo "  ✅ Updated: $FILE"
    echo "  💾 Backup: ${FILE}.backup"
    echo ""
done

echo "════════════════════════════════════════════════════════"
echo "✅ Files updated!"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "You still need to replace the crypto.createHash() usage"
echo "with Crypto.digestStringAsync() manually."
echo ""
echo "Open the file(s) and replace:"
echo "  crypto.createHash('sha256').update(data).digest('hex')"
echo ""
echo "With:"
echo "  await Crypto.digestStringAsync("
echo "    Crypto.CryptoDigestAlgorithm.SHA256,"
echo "    data,"
echo "    { encoding: Crypto.CryptoEncoding.HEX }"
echo "  )"
echo ""
echo "🔄 Then in Metro, press 'r' to reload"
echo "════════════════════════════════════════════════════════"
