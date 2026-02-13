# Fix for "Unable to resolve module crypto" Error

## Problem
```
Unable to resolve module crypto from .../lib/receipt-duplicate-detection.ts: 
crypto could not be found within the project
```

## Root Cause
React Native does not include Node.js built-in modules like `crypto`. When you try to `require('crypto')`, it fails because this module doesn't exist in the React Native environment.

## Solutions

### Solution 1: Use expo-crypto (RECOMMENDED for Expo projects)

**Step 1: Install expo-crypto**
```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
npx expo install expo-crypto
```

**Step 2: Update your receipt-duplicate-detection.ts file**

Replace the crypto usage section (around line 33-40) with:

```typescript
import * as Crypto from 'expo-crypto';

// Inside your function, replace the crypto code with:
const hashContent = async (base64Content: string): Promise<string> => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
};
```

### Solution 2: Use react-native-quick-crypto (For better Node.js compatibility)

**Step 1: Install react-native-quick-crypto**
```bash
npm install react-native-quick-crypto
cd ios && pod install && cd ..
```

**Step 2: Add polyfill to your entry file (index.js or App.tsx)**
```javascript
import 'react-native-quick-crypto';
```

**Step 3: Your crypto code should now work as-is**

### Solution 3: Remove Platform Detection (Simplest for React Native)

Since this code is running in React Native, remove the Node.js environment check entirely.

**Original problematic code:**
```typescript
if (typeof window !== 'undefined') {
  // Browser environment
  const encoder = new TextEncoder();
  // ... browser crypto code
} else {
  // Node.js environment - use crypto module
  const crypto = require('crypto');  // ❌ This fails in React Native
  return crypto
    .createHash('sha256')
    .update(base64Content)
    .digest('hex');
}
```

**Fixed code for React Native:**
```typescript
import * as Crypto from 'expo-crypto';

// Remove the platform detection, just use expo-crypto
export async function hashReceiptContent(base64Content: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
}
```

### Solution 4: Use the Crypto Polyfill I Created

Use the `crypto-polyfill.ts` file I created:

```typescript
// In receipt-duplicate-detection.ts
import { hashBase64Content } from './crypto-polyfill';

// Then use it like this:
const hash = await hashBase64Content(base64Content);
```

## Complete Fixed Example

Here's a complete example of what your receipt-duplicate-detection.ts should look like:

```typescript
import * as Crypto from 'expo-crypto';

interface Receipt {
  content: string;
  timestamp: number;
  // ... other fields
}

/**
 * Generate a hash for receipt content to detect duplicates
 */
export async function generateReceiptHash(receipt: Receipt): Promise<string> {
  const base64Content = receipt.content;
  
  // Use expo-crypto for SHA-256 hashing
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64Content,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  
  return hash;
}

/**
 * Check if a receipt is a duplicate based on its hash
 */
export async function isDuplicateReceipt(
  receipt: Receipt,
  existingHashes: Set<string>
): Promise<boolean> {
  const hash = await generateReceiptHash(receipt);
  return existingHashes.has(hash);
}

/**
 * Store for tracking seen receipt hashes
 */
export class ReceiptDuplicateDetector {
  private seenHashes: Set<string> = new Set();
  
  async isDuplicate(receipt: Receipt): Promise<boolean> {
    const hash = await generateReceiptHash(receipt);
    
    if (this.seenHashes.has(hash)) {
      return true;
    }
    
    this.seenHashes.add(hash);
    return false;
  }
  
  clear(): void {
    this.seenHashes.clear();
  }
  
  getHashCount(): number {
    return this.seenHashes.size;
  }
}

export default ReceiptDuplicateDetector;
```

## Quick Fix Commands

```bash
# Navigate to project directory
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

# Install expo-crypto
npx expo install expo-crypto

# Reinstall pods (iOS)
cd ios
pod install
cd ..

# Clear cache and restart
npx expo start --clear
```

## Manual Edit Instructions

1. **Open** `lib/receipt-duplicate-detection.ts`
2. **Add import** at the top:
   ```typescript
   import * as Crypto from 'expo-crypto';
   ```
3. **Replace** the section with `require('crypto')` (lines 33-39) with:
   ```typescript
   const hash = await Crypto.digestStringAsync(
     Crypto.CryptoDigestAlgorithm.SHA256,
     base64Content,
     { encoding: Crypto.CryptoEncoding.HEX }
   );
   return hash;
   ```
4. **Make the function async** if it isn't already:
   ```typescript
   async function hashContent(base64Content: string): Promise<string> {
   ```

## Alternative: If You Can't Modify the Code

If this is a third-party library, create a metro.config.js to alias the crypto module:

```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-quick-crypto'),
};

module.exports = config;
```

Then install react-native-quick-crypto:
```bash
npm install react-native-quick-crypto
cd ios && pod install && cd ..
```

## What I Created For You

1. **crypto-polyfill.ts** - A ready-to-use crypto polyfill using expo-crypto
2. **This documentation** - Multiple solutions to fix the crypto error

Choose the solution that works best for your project!
