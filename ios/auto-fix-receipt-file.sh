#!/bin/bash

# Automatic fix for receipt-duplicate-detection.ts crypto error

PROJECT_DIR="/Users/codercrewllc/Downloads/legacy-prime-workflow-suite"
cd "$PROJECT_DIR"

echo "🔍 Finding and fixing receipt-duplicate-detection.ts..."
echo ""

# Find the file
FILE=$(find . -name "receipt-duplicate-detection.ts" -type f | grep -v node_modules | head -n 1)

if [ -z "$FILE" ]; then
    echo "❌ File not found. Searching in common locations..."
    
    # Try common paths
    if [ -f "lib/receipt-duplicate-detection.ts" ]; then
        FILE="lib/receipt-duplicate-detection.ts"
    elif [ -f "src/lib/receipt-duplicate-detection.ts" ]; then
        FILE="src/lib/receipt-duplicate-detection.ts"
    elif [ -f "app/lib/receipt-duplicate-detection.ts" ]; then
        FILE="app/lib/receipt-duplicate-detection.ts"
    else
        echo "❌ Cannot find file. Searching for require('crypto')..."
        grep -r "require('crypto')" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".git"
        exit 1
    fi
fi

echo "✅ Found file: $FILE"
echo ""

# Create backup
cp "$FILE" "${FILE}.backup"
echo "✅ Backup created: ${FILE}.backup"
echo ""

# Check if import already exists
if grep -q "import.*expo-crypto" "$FILE"; then
    echo "ℹ️  expo-crypto import already exists"
else
    echo "📝 Adding expo-crypto import..."
    # Add import at the top after other imports
    sed -i.tmp '1i\
import * as Crypto from '\''expo-crypto'\'';
' "$FILE"
    rm -f "${FILE}.tmp"
fi

echo ""
echo "📝 Replacing require('crypto') with expo-crypto..."

# Use perl for better multiline replacement
perl -i -pe '
    s/const crypto = require\(\x27crypto\x27\);.*?\.digest\(\x27hex\x27\);/const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64Content, { encoding: Crypto.CryptoEncoding.HEX }); return hash;/gs;
' "$FILE" 2>/dev/null || {
    echo "⚠️  Complex replacement failed, trying simpler approach..."
    
    # Create a temporary fixed version
    cat > /tmp/crypto-fix.txt << 'EOF'
  // React Native environment - use expo-crypto
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
EOF
    
    # Try to replace just the require line
    sed -i.tmp "s/const crypto = require('crypto');/\/\/ Using expo-crypto instead/" "$FILE"
    rm -f "${FILE}.tmp"
}

echo "✅ File updated"
echo ""
echo "📋 Checking result..."
grep -n "expo-crypto\|Crypto\|crypto" "$FILE" | head -n 20
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ Fix applied!"
echo ""
echo "🔄 Next steps:"
echo "  1. In Metro terminal, press 'r' to reload"
echo "  2. Or press Ctrl+C and run: npx expo start --clear"
echo "  3. Build in Xcode (⌘R)"
echo ""
echo "📝 If the error persists, manually edit:"
echo "   $FILE"
echo ""
echo "💾 Original backed up to:"
echo "   ${FILE}.backup"
echo "════════════════════════════════════════════════════════"
