/**
 * expo-audio-compat.ts
 *
 * Safe lazy-loading wrapper for expo-audio.
 *
 * WHY THIS EXISTS:
 * expo-audio is a native module that must be compiled into the iOS/Android binary.
 * If the app JS bundle is updated before a native rebuild happens, the module
 * will be missing from the binary, causing an immediate startup crash:
 *   "Cannot find native module 'ExpoAudio'"
 *
 * This shim defers the require() to runtime (lazy) inside a try-catch so a stale
 * binary doesn't crash. Audio features simply become no-ops until the next rebuild.
 *
 * Once the app is rebuilt with expo-audio in the plugins, the real module is used.
 */

// ── Attempt lazy load at module init (once, never changes) ────────────────────
let _ea: typeof import('expo-audio') | null = null;
let _available = false;

try {
  // Dynamic require so Metro doesn't hoist it to module scope as a static import
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _ea = require('expo-audio') as typeof import('expo-audio');
  _available = true;
} catch {
  if (__DEV__) {
    console.warn(
      '[expo-audio-compat] ExpoAudio native module not found in current binary.\n' +
        'Audio features are disabled. Run `npx expo run:ios` or `eas build` to rebuild.'
    );
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type CompatAudioPlayer = {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  remove: () => void;
  addListener: (
    event: string,
    cb: (status: any) => void
  ) => { remove: () => void };
  duration: number | null;
};

export type CompatRecorder = {
  record: () => void;
  stop: () => Promise<void>;
  uri: string | null;
  isRecording: boolean;
  duration: number;
};

// ── AudioModule ───────────────────────────────────────────────────────────────
export const AudioModule = _available
  ? _ea!.AudioModule
  : {
      setAudioModeAsync: async (_opts: any) => {},
      requestRecordingPermissionsAsync: async () => ({ granted: false }),
    };

// ── RecordingPresets ──────────────────────────────────────────────────────────
export const RecordingPresets = _available
  ? _ea!.RecordingPresets
  : { HIGH_QUALITY: {} as any };

// ── createAudioPlayer ─────────────────────────────────────────────────────────
export function createAudioPlayer(source: any): CompatAudioPlayer {
  if (_available) {
    return _ea!.createAudioPlayer(source) as any;
  }
  return {
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    remove: () => {},
    addListener: () => ({ remove: () => {} }),
    duration: null,
  };
}

// ── useAudioRecorder ──────────────────────────────────────────────────────────
// `_available` is a module-level constant — same branch is always taken for the
// lifetime of this JS bundle, so React's rules-of-hooks are satisfied.
function _noOpRecorder(_options?: any): CompatRecorder {
  return { record: () => {}, stop: async () => {}, uri: null, isRecording: false, duration: 0 };
}

// eslint-disable-next-line react-hooks/rules-of-hooks
export const useAudioRecorder: (options: any) => CompatRecorder = _available
  ? (_ea!.useAudioRecorder as any)
  : _noOpRecorder;
