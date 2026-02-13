# DIRECT FIX FOR CRYPTO ERROR

The metro.config.js approach isn't working. You need to update the actual source file.

═══════════════════════════════════════════════════════════════

## THE PROBLEM:

File: lib/receipt-duplicate-detection.ts
Line 35: const crypto = require('crypto');

This doesn't work in React Native.

═══════════════════════════════════════════════════════════════

## THE FIX:

You need to edit lib/receipt-duplicate-detection.ts and replace the crypto usage.

### Option 1: Find and Edit the File

1. Open: lib/receipt-duplicate-detection.ts
2. Find line 35: `const crypto = require('crypto');`
3. Replace that entire section with:

```typescript
import * as Crypto from 'expo-crypto';

// Instead of:
// const crypto = require('crypto');
// return crypto.createHash('sha256').update(base64Content).digest('hex');

// Use this:
const hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  base64Content,
  { encoding: Crypto.CryptoEncoding.HEX }
);
return hash;
```

4. Make sure to add the import at the top of the file:
```typescript
import * as Crypto from 'expo-crypto';
```

5. Make sure the function is async:
```typescript
async function yourFunctionName(base64Content: string): Promise<string> {
```

═══════════════════════════════════════════════════════════════

## OR USE THIS TERMINAL COMMAND:

Find the file first:

```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
find . -name "receipt-duplicate-detection.ts" -type f
```

This will show you where the file is located.

═══════════════════════════════════════════════════════════════

## ALTERNATIVE: Quick Search in VS Code / Your Editor

1. Open the project in VS Code or your editor
2. Press ⌘⇧F (global search)
3. Search for: `require('crypto')`
4. Replace with expo-crypto code shown above

═══════════════════════════════════════════════════════════════

## WHY METRO.CONFIG.JS ISN'T WORKING:

Metro bundler sometimes doesn't pick up the extraNodeModules config
reliably, especially with TypeScript files. The direct approach of
updating the source file is more reliable.

═══════════════════════════════════════════════════════════════

## AFTER FIXING THE FILE:

1. Save the file
2. In Metro terminal, press `r` to reload
3. Or restart Metro: Ctrl+C, then `npx expo start --clear`
4. Build in Xcode (⌘R)
5. ✅ It will work!

═══════════════════════════════════════════════════════════════
