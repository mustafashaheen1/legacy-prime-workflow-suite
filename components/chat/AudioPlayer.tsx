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
import { Audio } from 'expo-av';

interface Props {
  uri: string;
  duration: number; // seconds
  messageId: string;
  isOwn: boolean;
  onPlay?: (messageId: string) => void;
  shouldStop?: boolean;
}

// ─── Module-level persistent cache ───────────────────────────────────────────
// Sounds survive component unmount/remount (navigation away and back).
const MAX_CACHE = 30;
const soundCache = new Map<string, Audio.Sound>();

function evictIfNeeded() {
  if (soundCache.size >= MAX_CACHE) {
    const oldest = soundCache.keys().next().value as string;
    soundCache.get(oldest)?.unloadAsync().catch(() => {});
    soundCache.delete(oldest);
  }
}

// ─── One-time AVAudioSession config ──────────────────────────────────────────
let audioModeConfigured = false;
async function ensureAudioMode() {
  if (audioModeConfigured || Platform.OS === 'web') return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
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
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);
  const waveWidthRef = useRef(0);
  const mountedRef = useRef(true);

  const progress = totalSec > 0 ? Math.min(positionSec / totalSec, 1) : 0;

  // ─── Build status callback ────────────────────────────────────────────────
  const makeStatusHandler = (sound: Audio.Sound) => (status: any) => {
    if (!mountedRef.current || !status.isLoaded) return;
    if (!isSeeking.current) {
      setPositionSec((status.positionMillis || 0) / 1000);
    }
    if (status.durationMillis) {
      setTotalSec(status.durationMillis / 1000);
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionSec(0);
      sound.setPositionAsync(0).catch(() => {});
    }
  };

  // ─── Load / cache sound ───────────────────────────────────────────────────
  const loadSound = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoadState('ready');
      return;
    }

    setLoadState('loading');
    await ensureAudioMode();

    // ── Cache hit ───────────────────────────────────────────────────────────
    const cached = soundCache.get(uri);
    if (cached) {
      try {
        const status = await cached.getStatusAsync();
        if (status.isLoaded) {
          cached.setOnPlaybackStatusUpdate(makeStatusHandler(cached));
          soundRef.current = cached;
          if (status.durationMillis) setTotalSec(status.durationMillis / 1000);
          setPositionSec((status.positionMillis || 0) / 1000);
          if (mountedRef.current) setLoadState('ready');
          return;
        }
      } catch { /* fall through to reload */ }
      soundCache.delete(uri);
      await cached.unloadAsync().catch(() => {});
    }

    // ── Cache miss — load from network ──────────────────────────────────────
    try {
      evictIfNeeded();
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        undefined
      );

      sound.setOnPlaybackStatusUpdate(makeStatusHandler(sound));
      soundCache.set(uri, sound);

      if (!mountedRef.current) return;

      soundRef.current = sound;
      setLoadState('ready');
    } catch (e: any) {
      if (!mountedRef.current) return;
      console.warn('[AudioPlayer] load error:', e?.message || e);
      setLoadState('error');
    }
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    loadSound();
    return () => {
      mountedRef.current = false;
      soundRef.current = null;
    };
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (shouldStop && isPlaying) handlePauseStop(false);
  }, [shouldStop]); // eslint-disable-line react-hooks/exhaustive-deps

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
        await sound.pauseAsync().catch(() => {});
        if (andReset) await sound.setPositionAsync(0).catch(() => {});
      }
    }
    if (andReset) setPositionSec(0);
  };

  const handlePlay = async () => {
    if (loadState !== 'ready') return;
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
      await sound.playAsync();
      setIsPlaying(true);
    } catch (e: any) {
      console.warn('[AudioPlayer] play error:', e?.message || e);
      setIsPlaying(false);
    }
  };

  const togglePlayback = () => {
    if (loadState === 'loading') return;
    if (isPlaying) handlePauseStop(false);
    else handlePlay();
  };

  const seekToFraction = async (fraction: number) => {
    const total = totalSec > 0 ? totalSec : duration || 0;
    const target = Math.max(0, Math.min(1, fraction)) * total;
    setPositionSec(target);
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.currentTime = target;
    } else {
      const sound = soundRef.current;
      if (sound) {
        const status = await sound.getStatusAsync().catch(() => null);
        if (status?.isLoaded) await sound.setPositionAsync(target * 1000).catch(() => {});
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => waveWidthRef.current > 0,
      onMoveShouldSetPanResponder: () => waveWidthRef.current > 0,
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
          onPress={() => { setLoadState('loading'); loadSound(); }}
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
