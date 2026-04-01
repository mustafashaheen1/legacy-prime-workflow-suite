/**
 * expo-audio-compat.ts
 *
 * Safe lazy-loading wrapper for expo-audio with expo-av as fallback.
 *
 * WHY THIS EXISTS:
 * expo-audio is a native module that must be compiled into the iOS/Android binary.
 * If the app JS bundle is updated before a native rebuild, the module will be
 * missing, causing an immediate startup crash: "Cannot find native module 'ExpoAudio'"
 *
 * Priority order:
 *   1. expo-audio  — preferred (new API, no deprecation warnings)
 *   2. expo-av     — fallback when expo-audio binary hasn't been rebuilt yet
 *   3. no-ops      — last resort (neither module available, e.g. web with bad config)
 *
 * Once the app is rebuilt with expo-audio in the plugins, the real module is used
 * and expo-av is not touched.
 */

import { useRef, useMemo } from 'react';
import { Platform } from 'react-native';

// ── Lazy-load expo-audio (requires native binary) ─────────────────────────────
let _ea: typeof import('expo-audio') | null = null;
let _audioAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _ea = require('expo-audio') as typeof import('expo-audio');
  _audioAvailable = true;
} catch {
  if (__DEV__) {
    console.warn(
      '[expo-audio-compat] ExpoAudio not in binary — falling back to expo-av.\n' +
        'Run `npx expo run:ios` or `eas build` to use expo-audio natively.'
    );
  }
}

// ── Lazy-load expo-av (fallback — already in the binary, native only) ────────
let _av: typeof import('expo-av') | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _av = require('expo-av') as typeof import('expo-av');
  } catch {
    /* expo-av not available either */
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type CompatAudioPlayer = {
  play: () => void;
  pause: () => void;
  seekTo: (sec: number) => void;
  remove: () => void;
  addListener: (event: string, cb: (status: any) => void) => { remove: () => void };
  duration: number | null;
};

export type CompatRecorder = {
  prepareToRecordAsync: () => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  uri: string | null;
  isRecording: boolean;
  duration: number;
};

// ── AudioModule ───────────────────────────────────────────────────────────────
export const AudioModule: {
  setAudioModeAsync: (opts: any) => Promise<void>;
  requestRecordingPermissionsAsync: () => Promise<{ granted: boolean }>;
} = _audioAvailable
  ? (_ea!.AudioModule as any)
  : _av
  ? {
      // Map expo-audio API shape → expo-av equivalents
      setAudioModeAsync: async (opts: any) => {
        await (_av!.Audio as any).setAudioModeAsync({
          allowsRecordingIOS: opts.allowsRecording ?? false,
          playsInSilentModeIOS: opts.playsInSilentMode ?? true,
          staysActiveInBackground: false,
        });
      },
      requestRecordingPermissionsAsync: async () => {
        const result = await (_av!.Audio as any).requestPermissionsAsync();
        return { granted: result.granted };
      },
    }
  : {
      setAudioModeAsync: async () => {},
      requestRecordingPermissionsAsync: async () => ({ granted: false }),
    };

// ── RecordingPresets ──────────────────────────────────────────────────────────
export const RecordingPresets: { HIGH_QUALITY: any } = _audioAvailable
  ? (_ea!.RecordingPresets as any)
  : _av
  ? { HIGH_QUALITY: (_av.Audio as any).RecordingOptionsPresets?.HIGH_QUALITY ?? {} }
  : { HIGH_QUALITY: {} };

// ── createAudioPlayer ─────────────────────────────────────────────────────────
export function createAudioPlayer(source: any): CompatAudioPlayer {
  if (_audioAvailable) {
    return _ea!.createAudioPlayer(source) as any;
  }

  if (_av) {
    // expo-av Sound fallback
    // Key design:
    //   - play() before sound loads queues via _pendingPlay flag
    //   - isLoaded surfaces in every status event so AudioPlayer can gate the
    //     loading→ready transition on actual load completion
    //   - createAsync failures emit { error: true } so AudioPlayer shows error state
    const statusListeners: Array<(s: any) => void> = [];
    let _sound: any = null;
    let _isLoaded = false;
    let _pendingPlay = false;
    let _hasError = false;

    const emitError = () =>
      statusListeners.forEach((cb) => cb({ error: true, isLoaded: false }));

    (_av.Audio as any).Sound.createAsync(
      source,
      { shouldPlay: false },
      (avStatus: any) => {
        const nowLoaded = avStatus.isLoaded ?? false;
        if (nowLoaded && !_isLoaded) {
          _isLoaded = true;
          // ── Race-condition fix ────────────────────────────────────────────
          // expo-av fires this status callback BEFORE the createAsync promise
          // resolves, so _sound is still null here. Only fire playAsync() if
          // _sound is already assigned; otherwise leave _pendingPlay=true and
          // let the .then() handler below do it once _sound is available.
          if (_pendingPlay && _sound) {
            _pendingPlay = false;
            _sound.playAsync().catch(() => {});
          }
        }
        const mapped = {
          currentTime: (avStatus.positionMillis ?? 0) / 1000,
          duration: (avStatus.durationMillis ?? 0) / 1000,
          isLoaded: nowLoaded,
          didJustFinish: avStatus.didJustFinish ?? false,
        };
        statusListeners.forEach((cb) => cb(mapped));
      }
    )
      .then(({ sound }: any) => {
        _sound = sound;
        // The status callback fired isLoaded=true before _sound was assigned
        // (the common case). Fire the queued play() now that _sound exists.
        if (_pendingPlay && _isLoaded) {
          _pendingPlay = false;
          sound.playAsync().catch(() => {});
        }
      })
      .catch((e: any) => {
        _hasError = true;
        console.warn('[expo-audio-compat] expo-av Sound create failed:', e?.message || e);
        emitError();
      });

    return {
      play: () => {
        if (_hasError) { emitError(); return; }
        if (_sound && _isLoaded) {
          _sound.playAsync().catch(() => {});
        } else {
          _pendingPlay = true;
        }
      },
      pause: () => { _pendingPlay = false; _sound?.pauseAsync().catch(() => {}); },
      seekTo: (sec: number) => _sound?.setPositionAsync(sec * 1000).catch(() => {}),
      remove: () => { _pendingPlay = false; _sound?.unloadAsync().catch(() => {}); },
      addListener: (event: string, cb: (s: any) => void) => {
        if (event === 'playbackStatusUpdate') {
          statusListeners.push(cb);
          return {
            remove: () => {
              const i = statusListeners.indexOf(cb);
              if (i >= 0) statusListeners.splice(i, 1);
            },
          };
        }
        return { remove: () => {} };
      },
      duration: null,
    };
  }

  // Last-resort no-op
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
// `_audioAvailable` is a module-level constant — the same branch is always taken
// for the lifetime of this JS bundle, satisfying React's rules-of-hooks.

function useAvRecorderFallback(_options: any): CompatRecorder {
  const recRef = useRef<any>(null);
  const uriRef = useRef<string | null>(null);
  // Tracks the in-flight createAsync promise so stop() can await it
  const pendingStartRef = useRef<Promise<void> | null>(null);

  return useMemo<CompatRecorder>(() => ({
    async prepareToRecordAsync() {
      // expo-av handles preparation inside Recording.createAsync — no-op here
    },
    record() {
      pendingStartRef.current = (async () => {
        try {
          if (!_av) return;
          const { recording } = await (_av.Audio as any).Recording.createAsync(
            (_av.Audio as any).RecordingOptionsPresets?.HIGH_QUALITY ?? {}
          );
          recRef.current = recording;
        } catch (e) {
          console.warn('[expo-audio-compat] expo-av Recording.createAsync failed:', e);
        }
      })();
    },
    async stop() {
      // Wait for the async start to finish before attempting to stop
      if (pendingStartRef.current) {
        await pendingStartRef.current;
        pendingStartRef.current = null;
      }
      if (recRef.current) {
        try {
          await recRef.current.stopAndUnloadAsync();
          uriRef.current = recRef.current.getURI() ?? null;
        } catch (e) {
          console.warn('[expo-audio-compat] expo-av Recording stop failed:', e);
        }
        recRef.current = null;
      }
    },
    get uri() { return uriRef.current; },
    get isRecording() { return recRef.current !== null || pendingStartRef.current !== null; },
    duration: 0,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
}

function useNoOpRecorder(_options?: any): CompatRecorder {
  return useMemo<CompatRecorder>(
    () => ({ prepareToRecordAsync: async () => {}, record: () => {}, stop: async () => {}, uri: null, isRecording: false, duration: 0 }),
    []
  );
}

// Assigned once at module load — never changes between renders, so hook rules hold
export const useAudioRecorder: (options: any) => CompatRecorder = _audioAvailable
  ? (_ea!.useAudioRecorder as any)
  : _av
  ? useAvRecorderFallback
  : useNoOpRecorder;
