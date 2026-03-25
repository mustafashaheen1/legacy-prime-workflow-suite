import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PanResponder,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react-native';
import { AudioModule, createAudioPlayer, CompatAudioPlayer as ExpoAudioPlayer } from '@/lib/expo-audio-compat';

interface Props {
  uri: string;
  duration: number; // seconds
  messageId: string;
  isOwn: boolean;
  onPlay?: (messageId: string) => void;
  shouldStop?: boolean;
}

// ─── Module-level caches ──────────────────────────────────────────────────────
const MAX_CACHE = 30;
const soundCache = new Map<string, ExpoAudioPlayer>();
// URIs that failed to load — skip re-attempting preload for these
const failedUriCache = new Set<string>();
// Web: pre-buffered HTMLAudioElement instances keyed by URI
const webAudioCache = new Map<string, HTMLAudioElement>();

function evictIfNeeded() {
  if (soundCache.size >= MAX_CACHE) {
    const oldest = soundCache.keys().next().value as string;
    soundCache.get(oldest)?.remove();
    soundCache.delete(oldest);
  }
}

// ─── One-time AVAudioSession config ──────────────────────────────────────────
let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured || Platform.OS === 'web') return;
  try {
    await AudioModule.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    audioModeConfigured = true;
  } catch { /* non-fatal */ }
}

// ─── Background preload (called from parent when chat opens) ──────────────────
// Web: creates an HTMLAudioElement with preload="auto" so the browser starts
//      buffering immediately. Stored in webAudioCache for instant playback on tap.
// Native: waits for first status confirmation before committing to soundCache.
//         Broken/expired S3 URLs are added to failedUriCache so they're skipped.
export async function preloadAudio(uri: string): Promise<void> {
  if (!uri) return;

  if (Platform.OS === 'web') {
    if (webAudioCache.has(uri) || failedUriCache.has(uri)) return;
    try {
      const audio = new (window as any).Audio(uri) as HTMLAudioElement;
      audio.preload = 'auto';
      // Start buffering — browser fetches ahead of playback in the background.
      // Store immediately so a second call for the same URI is a no-op.
      webAudioCache.set(uri, audio);
    } catch {
      failedUriCache.add(uri);
    }
    return; // fire-and-forget — don't await browser buffering
  }

  if (soundCache.has(uri) || failedUriCache.has(uri)) return;
  let player: ExpoAudioPlayer | null = null;
  try {
    await ensureAudioMode();
    evictIfNeeded();
    player = createAudioPlayer({ uri });

    // Wait for first successful status (isLoaded !== false) or fast error
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { sub.remove(); resolve(); }, 8000);
      const sub = player!.addListener('playbackStatusUpdate', (s: any) => {
        if (s.error) { clearTimeout(timer); sub.remove(); reject(new Error('load failed')); return; }
        if (s.isLoaded !== false) { clearTimeout(timer); sub.remove(); resolve(); }
      });
    });

    soundCache.set(uri, player);
  } catch {
    failedUriCache.add(uri);
    player?.remove();
  }
}

// ─── Waveform shape ───────────────────────────────────────────────────────────
const BAR_COUNT = 30;
const WAVEFORM = Array.from({ length: BAR_COUNT }, (_, i) => {
  const t = i / BAR_COUNT;
  const v =
    0.4 +
    0.25 * Math.sin(t * Math.PI * 3.7) +
    0.15 * Math.sin(t * Math.PI * 8.3 + 1) +
    0.1 * Math.sin(t * Math.PI * 15 + 2) +
    0.1 * Math.abs(Math.sin(t * Math.PI * 6 + 0.5));
  return Math.max(0.15, Math.min(1, v));
});

// ─────────────────────────────────────────────────────────────────────────────

// 'idle'    → play button visible, duration shown, nothing loaded yet
// 'loading' → spinner ring shown, user just tapped play (or preload in progress)
// 'ready'   → sound loaded & playing/paused
// 'error'   → load failed
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export default function AudioPlayer({
  uri,
  duration,
  messageId,
  isOwn,
  onPlay,
  shouldStop,
}: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [totalSec, setTotalSec] = useState(duration || 0);
  const [loadState, setLoadState] = useState<LoadState>('idle');

  const soundRef = useRef<ExpoAudioPlayer | null>(null);
  const listenerSubRef = useRef<{ remove: () => void } | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);
  const waveWidthRef = useRef(0);
  const mountedRef = useRef(true);

  // ─── Spinner ring animation ───────────────────────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loadState === 'loading') {
      spinAnim.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
  }, [loadState]); // eslint-disable-line react-hooks/exhaustive-deps

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const progress = totalSec > 0 ? Math.min(positionSec / totalSec, 1) : 0;

  // ─── Status callback ──────────────────────────────────────────────────────
  const makeStatusHandler = (player: ExpoAudioPlayer) => (status: any) => {
    if (!mountedRef.current) return;
    if (!isSeeking.current) {
      setPositionSec(status.currentTime || 0);
    }
    if (status.duration) {
      setTotalSec(status.duration);
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionSec(0);
      try { player.seekTo(0); } catch { /* non-fatal */ }
    }
  };

  // ─── Mount / URI change ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS !== 'web') {
      const cached = soundCache.get(uri);
      if (cached) {
        if (mountedRef.current) {
          listenerSubRef.current?.remove();
          listenerSubRef.current = cached.addListener('playbackStatusUpdate', (status: any) => {
            if (!mountedRef.current) return;
            // Cached player may emit error if it was broken (e.g. expired URL)
            if (status.error) {
              setLoadState('error');
              soundCache.delete(uri);
              failedUriCache.add(uri);
              return;
            }
            makeStatusHandler(cached)(status);
          });
          soundRef.current = cached;
          if (cached.duration) setTotalSec(cached.duration);
          setLoadState('ready');
        }
      }
      // else: stay 'idle', load lazily on first tap
    }
    // Web: stay 'idle' — loadState transitions to 'loading' then 'ready'
    // when the user first taps play and the browser buffers the audio.

    return () => {
      mountedRef.current = false;
      listenerSubRef.current?.remove();
      listenerSubRef.current = null;
      soundRef.current = null;
    };
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup web audio on unmount
  useEffect(() => {
    return () => {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
    };
  }, []);

  // Stop when parent signals another player started
  useEffect(() => {
    if (shouldStop && isPlaying) handlePauseStop(false);
  }, [shouldStop]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load + play (lazy — triggered on first tap) ──────────────────────────
  const loadAndPlay = useCallback(async () => {
    setLoadState('loading');
    await ensureAudioMode();

    try {
      evictIfNeeded();

      const player = createAudioPlayer({ uri });

      if (!mountedRef.current) {
        player.remove();
        return;
      }

      // Keep the spinner until the sound actually reports ready.
      //   expo-audio: no `isLoaded` field → `status.isLoaded !== false` fires on
      //               the first status tick, transitioning quickly.
      //   expo-av fallback: `isLoaded=false` until asset is buffered, then
      //               `isLoaded=true` fires the transition.
      //   expo-av error: `status.error=true` shows error state immediately.
      let hasTransitioned = false;
      listenerSubRef.current?.remove();
      listenerSubRef.current = player.addListener('playbackStatusUpdate', (status: any) => {
        if (!mountedRef.current) return;

        if (status.error) {
          setLoadState('error');
          return;
        }

        if (!hasTransitioned && status.isLoaded !== false) {
          hasTransitioned = true;
          setLoadState('ready');
          setIsPlaying(true);
        }

        if (!isSeeking.current) setPositionSec(status.currentTime || 0);
        if (status.duration) setTotalSec(status.duration);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPositionSec(0);
          try { player.seekTo(0); } catch { /* non-fatal */ }
        }
      });

      // play() is safe to call before load — expo-av fallback queues it via
      // _pendingPlay and fires as soon as createAsync resolves.
      player.play();

      soundCache.set(uri, player);
      soundRef.current = player;
      onPlay?.(messageId);
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.warn('[AudioPlayer] load error:', e?.message || e);
      setLoadState('error');
    }
  }, [uri, messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Playback controls ────────────────────────────────────────────────────
  const handlePauseStop = async (andReset: boolean) => {
    setIsPlaying(false);
    if (Platform.OS === 'web') {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        if (andReset) webAudioRef.current.currentTime = 0;
      }
    } else {
      const sound = soundRef.current;
      if (sound) {
        try { sound.pause(); } catch { /* non-fatal */ }
        if (andReset) try { sound.seekTo(0); } catch { /* non-fatal */ }
      }
    }
    if (andReset) setPositionSec(0);
  };

  const handlePlay = async () => {
    onPlay?.(messageId);

    if (Platform.OS === 'web') {
      if (!webAudioRef.current) {
        // Prefer a pre-buffered element from the module-level cache so playback
        // starts instantly without a loading spinner.
        const cached = webAudioCache.get(uri);
        if (cached) {
          webAudioRef.current = cached;
          // Already buffering/buffered — no loading state needed
          setLoadState('ready');
        } else {
          // Cold start: show spinner until browser has enough data
          setLoadState('loading');
          const audio = new (window as any).Audio(uri) as HTMLAudioElement;
          webAudioRef.current = audio;
          audio.addEventListener('canplay', () => {
            if (mountedRef.current) setLoadState('ready');
          }, { once: true });
        }
        const audio = webAudioRef.current;
        audio.ontimeupdate = () => {
          if (!isSeeking.current) setPositionSec(audio.currentTime);
          setTotalSec(audio.duration || duration || 0);
        };
        audio.onended = () => { setIsPlaying(false); setPositionSec(0); };
        audio.onerror = () => {
          if (mountedRef.current) { setIsPlaying(false); setLoadState('error'); }
        };
      }
      await webAudioRef.current.play().catch(() => {
        if (mountedRef.current) setIsPlaying(false);
      });
      if (mountedRef.current) setIsPlaying(true);
      return;
    }

    const sound = soundRef.current;
    if (!sound) return;
    try {
      sound.play();
      setIsPlaying(true);
    } catch (e: any) {
      console.warn('[AudioPlayer] play error:', e?.message || e);
      setIsPlaying(false);
    }
  };

  const togglePlayback = () => {
    if (loadState === 'loading') return;
    if (loadState === 'idle') {
      // Web uses handlePlay (HTML Audio, lazy load on first tap).
      // Native uses loadAndPlay (expo-audio/expo-av, explicit load + play).
      if (Platform.OS === 'web') handlePlay();
      else loadAndPlay();
      return;
    }
    if (isPlaying) handlePauseStop(false);
    else handlePlay();
  };

  const seekToFraction = async (fraction: number) => {
    if (loadState !== 'ready') return;
    const total = totalSec > 0 ? totalSec : duration || 0;
    const target = Math.max(0, Math.min(1, fraction)) * total;
    setPositionSec(target);
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.currentTime = target;
    } else {
      const sound = soundRef.current;
      if (sound) {
        try { sound.seekTo(target); } catch { /* non-fatal */ }
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => waveWidthRef.current > 0 && loadState === 'ready',
      onMoveShouldSetPanResponder: () => waveWidthRef.current > 0 && loadState === 'ready',
      onPanResponderGrant: (evt) => {
        isSeeking.current = true;
        seekToFraction(evt.nativeEvent.locationX / waveWidthRef.current);
      },
      onPanResponderMove: (evt) => {
        seekToFraction(evt.nativeEvent.locationX / waveWidthRef.current);
      },
      onPanResponderRelease: () => { isSeeking.current = false; },
    })
  ).current;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const iconColor = isOwn ? '#1F2937' : '#FFFFFF';
  const playedColor = isOwn ? '#1F2937' : '#FFFFFF';
  const unplayedColor = isOwn ? 'rgba(31,41,55,0.3)' : 'rgba(255,255,255,0.35)';
  const timeColor = isOwn ? 'rgba(31,41,55,0.7)' : 'rgba(255,255,255,0.8)';
  const errColor = isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)';
  const ringColor = isOwn ? 'rgba(31,41,55,0.7)' : 'rgba(255,255,255,0.85)';

  const effectiveTotal = totalSec > 0 ? totalSec : duration || 1;

  if (loadState === 'error') {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={14} color={errColor} />
        <Text style={[styles.errorText, { color: errColor }]}>Audio unavailable</Text>
        <TouchableOpacity
          onPress={() => { setPositionSec(0); loadAndPlay(); }}
          style={styles.retryBtn}
          activeOpacity={0.7}
        >
          <Text style={[styles.retryText, { color: errColor }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Play / Pause button with loading ring ── */}
      <View style={styles.playBtnWrapper}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={togglePlayback}
          activeOpacity={loadState === 'loading' ? 1 : 0.7}
          disabled={loadState === 'loading'}
        >
          {loadState !== 'loading' && (
            isPlaying
              ? <Pause size={18} color={iconColor} fill={iconColor} />
              : <Play size={18} color={iconColor} fill={iconColor} />
          )}
        </TouchableOpacity>

        {/* Spinning ring shown while loading — rendered around the button */}
        {loadState === 'loading' && (
          <>
            {/* Faint full-circle track */}
            <View style={[styles.ringTrack, { borderColor: ringColor + '33' }]} pointerEvents="none" />
            {/* Animated arc */}
            <Animated.View
              style={[
                styles.ringArc,
                { borderTopColor: ringColor, transform: [{ rotate: spin }] },
              ]}
              pointerEvents="none"
            />
          </>
        )}
      </View>

      {/* ── Waveform ── */}
      <View
        style={styles.waveformContainer}
        onLayout={(e: LayoutChangeEvent) => {
          waveWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        {WAVEFORM.map((amp, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(3, amp * 28),
                backgroundColor:
                  loadState === 'loading'
                    ? (isOwn ? 'rgba(31,41,55,0.15)' : 'rgba(255,255,255,0.2)')
                    : i / BAR_COUNT < progress
                    ? playedColor
                    : unplayedColor,
              },
            ]}
          />
        ))}
      </View>

      {/* ── Time ── */}
      <Text style={[styles.time, { color: timeColor }]}>
        {isPlaying || positionSec > 0
          ? formatTime(positionSec)
          : formatTime(effectiveTotal)}
      </Text>
    </View>
  );
}

const RING_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  playBtnWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Faint full-circle track behind the spinning arc
  ringTrack: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2.5,
  },
  // Single-arc spinner — only borderTopColor is set; others stay transparent
  ringArc: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingVertical: 4,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  time: {
    fontSize: 12,
    fontWeight: '500' as const,
    minWidth: 36,
    textAlign: 'right',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 180,
    paddingVertical: 4,
  },
  errorText: {
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textDecorationLine: 'underline',
  },
});
