# Fix for "No script URL provided" Error

## Problem
The app shows: "No script URL provided. Make sure the packager is running or you have embedded a JS bundle in your application bundle."

## Root Cause
This error occurs when:
1. The Metro bundler is not running (in DEBUG mode)
2. The app cannot connect to the Metro bundler
3. The bundler is running on the wrong port or address

## Solutions

### Solution 1: Start the Metro Bundler (RECOMMENDED)

**Option A - Using the provided script:**
```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
chmod +x start-metro.sh
./start-metro.sh
```

**Option B - Manual command:**
```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
npx expo start --ios
```

**Option C - Alternative Metro command:**
```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
npx react-native start
```

### Solution 2: Build for Release (No Bundler Required)

If you want to test without running Metro, build in Release mode:

1. In Xcode, go to **Product → Scheme → Edit Scheme**
2. Select **Run** in the left sidebar
3. Change **Build Configuration** to **Release**
4. Build and run the app

**Note:** Release builds include the JavaScript bundle in the app, so Metro isn't needed.

### Solution 3: Reset Metro Bundler Cache

If Metro is running but the error persists:

```bash
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite
npx expo start --clear
# or
npx react-native start --reset-cache
```

### Solution 4: Check Network Settings

If on a physical device, ensure:
1. Device and Mac are on the same WiFi network
2. Firewall allows connections on port 8081
3. In the app, shake device → Dev Menu → Settings → Debug server host
4. Enter your Mac's IP address: `192.168.x.x:8081`

## Workflow for Development

### Every time you develop:

1. **Start Metro Bundler First:**
   ```bash
   ./start-metro.sh
   # or
   npx expo start
   ```

2. **Then build/run in Xcode:**
   - Press ⌘R in Xcode
   - Or use the Run button

### The bundler MUST be running before launching the app in DEBUG mode!

## What I Fixed

1. **Updated AppDelegate.swift** - Added fallback logic to try multiple bundle entry points
2. **Created start-metro.sh** - Convenient script to start the Metro bundler
3. **Created this README** - Instructions for fixing the error

## Quick Start Commands

```bash
# Navigate to project root
cd /Users/codercrewllc/Downloads/legacy-prime-workflow-suite

# Install dependencies (if needed)
npm install

# Start the bundler
npx expo start

# In another terminal or Xcode, run the app
```

## Troubleshooting

### Port 8081 already in use?
```bash
lsof -ti:8081 | xargs kill -9
npx expo start
```

### Metro won't start?
```bash
# Clean cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### Still getting the error?
1. Clean Xcode build folder (⇧⌘K)
2. Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData/*`
3. Restart Xcode
4. Start Metro bundler
5. Build again
