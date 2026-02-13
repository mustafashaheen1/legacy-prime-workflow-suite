# 🎯 QUICK START - Fix Crypto Error

## The Problem
```
Unable to resolve module crypto from .../lib/receipt-duplicate-detection.ts
```

React Native doesn't have Node.js's `crypto` module. You need to use `expo-crypto` instead.

---

## ⚡ FASTEST FIX (2 Commands)

```bash
# 1. Run the quick fix script
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
chmod +x quick-fix-crypto.sh && ./quick-fix-crypto.sh

# 2. Start the app
npx expo start --clear
```

**That's it!** The script does everything for you.

---

## 🔧 Manual Fix (If you prefer step-by-step)

### Step 1: Install expo-crypto
```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
npx expo install expo-crypto
```

### Step 2: Install iOS dependencies
```bash
cd ios
pod install
cd ..
```

### Step 3: Update your code

**Open:** `lib/receipt-duplicate-detection.ts`

**Find this code (around line 33-38):**
```typescript
} else {
  // Node.js environment - use crypto module
  const crypto = require('crypto');  // ❌ THIS FAILS
  return crypto
    .createHash('sha256')
    .update(base64Content)
    .digest('hex');
}
```

**Replace with:**
```typescript
import * as Crypto from 'expo-crypto';  // Add this at the top

// Then replace the crypto code with:
const hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  base64Content,
  { encoding: Crypto.CryptoEncoding.HEX }
);
return hash;
```

### Step 4: Make the function async
Make sure the function containing this code is `async`:
```typescript
async function hashContent(base64Content: string): Promise<string> {
  // ... your code
}
```

### Step 5: Clear cache and restart
```bash
npx expo start --clear
```

---

## 📁 Files I Created For You

1. **`quick-fix-crypto.sh`** ⭐ - Run this for automatic fix
2. **`fix-crypto-error.sh`** - Alternative fix script
3. **`lib/receipt-duplicate-detection-fixed.ts`** - Fully working replacement file
4. **`lib/crypto-polyfill.ts`** - Reusable crypto utilities
5. **`CRYPTO_ERROR_FIX.md`** - Detailed documentation

---

## 🚀 Option: Use Pre-Fixed File

Instead of editing manually, just copy the fixed version:

```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

# Backup original
cp lib/receipt-duplicate-detection.ts lib/receipt-duplicate-detection.ts.backup

# Use fixed version
cp lib/receipt-duplicate-detection-fixed.ts lib/receipt-duplicate-detection.ts

# Start app
npx expo start --clear
```

---

## ✅ Verify the Fix

After applying the fix, you should see:
- ✅ No crypto module errors
- ✅ App builds successfully
- ✅ Metro bundler runs without errors

---

## 🆘 Still Having Issues?

### Error: "expo-crypto not found"
```bash
npm install expo-crypto --save
cd ios && pod install && cd ..
```

### Error: "Cannot find module 'expo-crypto'"
Make sure you restarted the Metro bundler:
```bash
# Kill any running Metro instances
lsof -ti:8081 | xargs kill -9

# Start fresh
npx expo start --clear
```

### The file doesn't exist at that path
Search for where the file actually is:
```bash
find . -name "receipt-duplicate-detection.ts" -type f
```

Then edit that file with the fixes above.

---

## 🎓 What Changed?

| Before (Node.js) | After (React Native) |
|-----------------|---------------------|
| `require('crypto')` ❌ | `import * as Crypto from 'expo-crypto'` ✅ |
| `crypto.createHash('sha256')` ❌ | `Crypto.digestStringAsync(...)` ✅ |
| Synchronous ❌ | Async/await ✅ |
| Node.js only ❌ | Cross-platform ✅ |

---

## 💡 Need Help?

1. Read `CRYPTO_ERROR_FIX.md` for detailed explanations
2. Check `lib/receipt-duplicate-detection-fixed.ts` for a complete working example
3. Use `lib/crypto-polyfill.ts` for other crypto needs in your app

---

**Choose your path:**
- 🚀 **Fast**: Run `./quick-fix-crypto.sh`
- 🔧 **Manual**: Follow the step-by-step guide above
- 📋 **Copy**: Use the pre-fixed file

All methods will solve the crypto module error!
