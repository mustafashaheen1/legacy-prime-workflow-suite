# Session Handoff — Photo Feature Work

## Session Timeline (Most Recent First)

### Session 3 — Zoom Controls (Current)
**Status: IMPLEMENTATION COMPLETE, NOT YET COMMITTED**

Added zoom in/out controls to fullscreen photo preview modals across 3 files:
- `app/(tabs)/photos.tsx` — **COMPLETE** (done in Session 2, finished in Session 3)
- `app/project/[id].tsx` — **COMPLETE** (handlers added in Session 2, modal JSX + styles added in Session 3)
- `app/project/[id]/files-navigation.tsx` — **COMPLETE** (full implementation in Session 3)

**Uncommitted changes**: All 3 files modified (620 insertions, 45 deletions). Need to commit + push.

#### Zoom Features Implemented
| Feature | Platform | Status |
|---------|----------|--------|
| +/- buttons with % display | All | Done |
| Pinch-to-zoom (1x–4x) | Native | Done |
| Pan/drag when zoomed | Native | Done |
| Double-tap toggle 1x/2x | Native | Done |
| Scroll wheel zoom | Web | Done |
| Zoom reset on nav/close | All | Done |
| Background tap disabled when zoomed | All | Done |

#### Technical Details — Zoom Implementation
- **Libraries used**: `react-native-gesture-handler` (Gesture.Pinch, Gesture.Pan, Gesture.Tap, GestureDetector, GestureHandlerRootView) + `react-native-reanimated` (useSharedValue, useAnimatedStyle, withSpring, runOnJS)
- **Constants**: MIN_ZOOM=1, MAX_ZOOM=4, ZOOM_STEP=0.5
- **Variable naming**: `photos.tsx` uses `scale`, `translateX`, etc. / `[id].tsx` and `files-navigation.tsx` use `zScale`, `zTranslateX` etc. (z-prefix to avoid conflicts with existing vars)
- **GestureHandlerRootView** is required inside `<Modal>` because the root one in `_layout.tsx` doesn't cover modal content on iOS/Android
- **expo-image** doesn't support animated styles directly — wrapped in `Animated.View` with transform
- **Gesture composition**: `Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan))`
- **Web scroll wheel**: `useEffect` with `wheel` event listener on image container ref, `{ passive: false }` for `preventDefault()`
- **Styles added**: `fsZoomControls`, `fsZoomBtn`, `fsZoomBtnDisabled`, `fsZoomBadge`, `fsZoomText`

---

### Session 2 — Fullscreen Photo Preview + Fixes
**Status: All committed**

1. **Fullscreen photo preview modal** (`photos.tsx`) — commit `d9b030a`
   - Full-screen overlay with navigation arrows, download, uploader info, metadata panel
   - Fixed variable ordering bug (filteredPhotos/fullScreenIndex memos declared before their dependencies)

2. **CORS download fix** — commit `f436dce`
   - S3 blocks cross-origin fetch requests → changed to direct `<a>` tag download on web
   - Native still uses fetch → blob → FileSystem → Sharing

3. **Fullscreen preview for project screens** — commit `1d6ffbd`
   - `app/project/[id].tsx`: Changed `viewingPhoto` from string to `Photo` type, added nav/download/metadata
   - `app/project/[id]/files-navigation.tsx`: Added `ViewableImageItem` type to normalize Photo/Expense/ProjectFile objects, fullscreen viewer for images, kept PDF "Open in Browser"

### Session 1 — Keyboard Fixes + Edit Client Modal
**Status: All committed** (commits `45016a0` through `c301e7a`)
- Fixed keyboard hiding inputs on iPad/iOS across multiple screens
- Added `InputAccessoryView` Done button for iPhone
- Fixed various UI bugs (salesperson badge, Office Role picker, web camera banners)

---

## Known Bugs (Not Fixed — Reverted by Linter)

These were fixed but the linter auto-reverted the changes:

1. **Duplicate upload modal in `photos.tsx`**
   - Bug: Two upload progress indicators appear simultaneously — an inline overlay inside the preview Modal AND a standalone Modal both trigger on `uploadProgress.isUploading`
   - Fix attempted: Remove the standalone Upload Progress Modal
   - Status: Reverted by linter, bug still present

2. **Both buttons loading state in `photos.tsx`**
   - Bug: "Take Photo" and "Upload Photo" buttons both show loading spinners when either is clicked
   - Cause: `isPickingMedia` is a single `boolean` shared by both
   - Fix attempted: Changed to discriminated union `'camera' | 'gallery' | false`
   - Status: Reverted by linter, bug still present

---

## File-Specific Notes

### `app/(tabs)/photos.tsx` (~2300+ lines)
- Main Photos tab with project filter, category filter, grid/list view
- Fullscreen preview modal with zoom (complete)
- Uses `fullScreenPhoto` / `filteredPhotos` / `fullScreenIndex` state
- Image URL at `.url`

### `app/project/[id].tsx` (~6500+ lines)
- Massive project detail screen with 10+ tabs (overview, schedule, estimate, photos, files, etc.)
- Photos tab section has fullscreen viewer with zoom (complete)
- Uses `viewingPhoto` (Photo type) / `projectPhotos` / `viewingPhotoIndex` state
- Image URL at `.url`
- Zoom vars use `z` prefix: `zScale`, `zTranslateX`, etc.

### `app/project/[id]/files-navigation.tsx` (~2400+ lines)
- Project files organized in predefined + custom folders (Photos, Receipts, Permit Files, etc.)
- `ViewableImageItem` type normalizes Photo, Expense, ProjectFile objects
- Uses `fullScreenImage` / `fullScreenImageList` / `fullScreenImageIndex` state
- Image URL at `.uri` (NOT `.url`)
- Zoom vars use `z` prefix
- Converter helpers: `photoToViewable()`, `expenseToViewable()`, `projectFileToViewable()`

---

## Local Dev Notes
- Frontend: `bunx expo start --web` (runs on localhost:8081)
- Backend: Can't use `vercel dev` — 142 API files exceeds Vercel's 128 builds limit
- Workaround: `.env` EXPO_PUBLIC_API_URL points to production (`https://legacy-prime-workflow-suite.vercel.app`)
- CORS issue: Uploads from localhost to production API fail (API routes lack CORS headers). Options: Chrome `--disable-web-security` or add CORS headers to API routes.

---

## What Needs to Happen Next
1. **Commit + push** the zoom controls changes (3 files, 620 insertions)
2. **Test** on iOS/iPad (pinch, pan, double-tap) and web (scroll wheel, +/- buttons)
3. Optionally fix the two linter-reverted bugs (duplicate modal, dual loading state)
