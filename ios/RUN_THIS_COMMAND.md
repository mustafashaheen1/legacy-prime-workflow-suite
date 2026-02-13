# 🚀 COPY AND PASTE THIS COMMAND

Run this single command in your terminal to fix everything:

```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite && npx expo install expo-crypto && cd ios && pod install && cd .. && rm -rf node_modules/.cache .expo && npx expo start --clear
```

---

## Or run it in steps:

```bash
# Step 1: Go to project directory
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

# Step 2: Install expo-crypto
npx expo install expo-crypto

# Step 3: Install iOS dependencies
cd ios
pod install
cd ..

# Step 4: Clean and start
rm -rf node_modules/.cache .expo
npx expo start --clear
```

---

## What this does:

1. ✅ Installs `expo-crypto` (React Native compatible crypto library)
2. ✅ Updates iOS dependencies via CocoaPods
3. ✅ Clears Metro bundler cache
4. ✅ Starts Metro with clean cache

The crypto module error will be fixed because:
- I created `metro.config.js` that routes `crypto` imports to our shim
- I created `crypto-shim.js` that uses `expo-crypto` under the hood
- Now when your code does `require('crypto')`, it gets our shim instead

---

## ✅ All Done!

After running the command above, your app should:
- ✅ No longer show "Unable to resolve module crypto"
- ✅ Build and run successfully
- ✅ Hash receipt content properly using expo-crypto

---

**Just copy the one-line command at the top and paste it in your terminal!**
