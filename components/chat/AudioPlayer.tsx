import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PanResponder,
  LayoutChangeEvent,
  ActivityIndicator,
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

// ─── Module-level persistent sound cache ─────────────────────────────────────
const MAX_CACHE = 30;
const soundCache = new Map<string, ExpoAudioPlayer>();

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
// 'loading' → spinner, user just tapped play
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
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);
  const waveWidthRef = useRef(0);
  const mountedRef = useRef(true);

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
  // Only check the cache — never eagerly load from network on mount.
  // This prevents simultaneous AVURLAsset loads across all visible messages
  // which causes the "isPlayable accessed synchronously" warning.
  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS !== 'web') {
      const cached = soundCache.get(uri);
      if (cached) {
        if (mountedRef.current) {
          cached.addListener('playbackStatusUpdate',makeStatusHandler(cached));
          soundRef.current = cached;
          if (cached.duration) setTotalSec(cached.duration);
          setLoadState('ready');
        }
      }
      // else: stay 'idle', load lazily on first tap
    } else {
      // Web: always ready (HTML Audio is lazy by nature)
      setLoadState('ready');
    }

    return () => {
      mountedRef.current = false;
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

      player.addListener('playbackStatusUpdate',makeStatusHandler(player));
      player.play();

      soundCache.set(uri, player);
      soundRef.current = player;

      onPlay?.(messageId);
      setLoadState('ready');
      setIsPlaying(true);
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
        const audio = new window.Audio(uri);
        webAudioRef.current = audio;
        audio.ontimeupdate = () => {
          if (!isSeeking.current) setPositionSec(audio.currentTime);
          setTotalSec(audio.duration || duration || 0);
        };
        audio.onended = () => { setIsPlaying(false); setPositionSec(0); };
        audio.onerror = () => setIsPlaying(false);
      }
      await webAudioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
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
      // First tap: load from network and auto-play
      loadAndPlay();
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
      <TouchableOpacity
        style={styles.playBtn}
        onPress={togglePlayback}
        activeOpacity={loadState === 'loading' ? 1 : 0.7}
        disabled={loadState === 'loading'}
      >
        {loadState === 'loading' ? (
          <ActivityIndicator size="small" color={isOwn ? '#1F2937' : '#FFFFFF'} />
        ) : isPlaying ? (
          <Pause size={18} color={iconColor} fill={iconColor} />
        ) : (
          <Play size={18} color={iconColor} fill={iconColor} />
        )}
      </TouchableOpacity>

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
                backgroundColor: i / BAR_COUNT < progress ? playedColor : unplayedColor,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.time, { color: timeColor }]}>
        {isPlaying || positionSec > 0
          ? formatTime(positionSec)
          : formatTime(effectiveTotal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
