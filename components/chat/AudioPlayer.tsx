import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react-native';
import { Audio } from 'expo-av';

interface Props {
  uri: string;
  duration: number; // seconds
  messageId: string;
  isOwn: boolean;
  /** Called when this player starts playing, so parent can stop others */
  onPlay?: (messageId: string) => void;
  /** Parent signals this player to stop */
  shouldStop?: boolean;
}

/** iOS cannot play WebM/Opus — these are web-only formats */
const isUnsupportedOnIOS = (url: string) =>
  Platform.OS !== 'web' && /\.webm($|\?)/i.test(url);

// Static waveform bar heights — deterministic per component instance
const BAR_COUNT = 30;
const WAVEFORM = Array.from({ length: BAR_COUNT }, (_, i) => {
  // Generate a natural-looking waveform using a mix of sine harmonics
  const t = i / BAR_COUNT;
  const v =
    0.4 +
    0.25 * Math.sin(t * Math.PI * 3.7) +
    0.15 * Math.sin(t * Math.PI * 8.3 + 1) +
    0.1 * Math.sin(t * Math.PI * 15 + 2) +
    0.1 * Math.abs(Math.sin(t * Math.PI * 6 + 0.5));
  return Math.max(0.15, Math.min(1, v));
});

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
  const [formatError, setFormatError] = useState(false);
  const [waveWidth, setWaveWidth] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const isSeeking = useRef(false);
  const waveWidthRef = useRef(0); // stable ref so PanResponder closure always has current width

  // Progress: 0–1
  const progress = totalSec > 0 ? Math.min(positionSec / totalSec, 1) : 0;

  // Stop when parent signals
  useEffect(() => {
    if (shouldStop && isPlaying) {
      handlePauseStop(false);
    }
  }, [shouldStop]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current = null;
      }
    };
  }, []);

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
        const status = await sound.getStatusAsync().catch(() => null);
        if (status?.isLoaded) {
          await sound.pauseAsync().catch(() => {});
          if (andReset) await sound.setPositionAsync(0).catch(() => {});
        }
      }
    }
    if (andReset) setPositionSec(0);
  };

  const handlePlay = async () => {
    if (isUnsupportedOnIOS(uri)) {
      setFormatError(true);
      return;
    }

    onPlay?.(messageId);

    if (Platform.OS === 'web') {
      if (!webAudioRef.current) {
        const audio = new window.Audio(uri);
        webAudioRef.current = audio;
        audio.ontimeupdate = () => {
          if (!isSeeking.current) setPositionSec(audio.currentTime);
          setTotalSec(audio.duration || duration || 0);
        };
        audio.onended = () => {
          setIsPlaying(false);
          setPositionSec(0);
        };
        audio.onerror = () => setIsPlaying(false);
      }
      await webAudioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
      return;
    }

    // Native (iOS/Android)
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      let sound = soundRef.current;

      if (sound) {
        const status = await sound.getStatusAsync().catch(() => ({ isLoaded: false }));
        if (!status.isLoaded) {
          await sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          sound = null;
        }
      }

      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          (status) => {
            if (!status.isLoaded) return;
            if (!isSeeking.current) {
              setPositionSec((status.positionMillis || 0) / 1000);
            }
            if (status.durationMillis) {
              setTotalSec(status.durationMillis / 1000);
            }
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionSec(0);
              newSound.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
          }
        );
        soundRef.current = newSound;
      } else {
        await sound.playAsync();
      }

      setIsPlaying(true);
    } catch (e: any) {
      console.warn('[AudioPlayer] play error:', e?.message || e);
      if (
        e?.code === 'EXAV' ||
        String(e?.message).includes('format') ||
        String(e?.message).includes('supported')
      ) {
        setFormatError(true);
      }
      setIsPlaying(false);
    }
  };

  const togglePlayback = async () => {
    if (isPlaying) {
      await handlePauseStop(false);
    } else {
      await handlePlay();
    }
  };

  const seekToFraction = async (fraction: number) => {
    const target = Math.max(0, Math.min(1, fraction)) * (totalSec > 0 ? totalSec : duration || 0);
    setPositionSec(target);
    if (Platform.OS === 'web' && webAudioRef.current) {
      webAudioRef.current.currentTime = target;
    } else {
      const sound = soundRef.current;
      if (sound) {
        const status = await sound.getStatusAsync().catch(() => null);
        if (status?.isLoaded) {
          await sound.setPositionAsync(target * 1000).catch(() => {});
        }
      }
    }
  };

  // PanResponder for tap/drag to seek on the waveform.
  // Uses waveWidthRef (not waveWidth state) so the closure always sees the current width.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => waveWidthRef.current > 0,
      onMoveShouldSetPanResponder: () => waveWidthRef.current > 0,
      onPanResponderGrant: (evt) => {
        isSeeking.current = true;
        const fraction = evt.nativeEvent.locationX / waveWidthRef.current;
        seekToFraction(fraction);
      },
      onPanResponderMove: (evt) => {
        const fraction = evt.nativeEvent.locationX / waveWidthRef.current;
        seekToFraction(fraction);
      },
      onPanResponderRelease: () => {
        isSeeking.current = false;
      },
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

  const effectiveTotal = totalSec > 0 ? totalSec : duration || 1;

  if (formatError) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={14} color={isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)'} />
        <Text style={[styles.errorText, { color: isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)' }]}>
          Audio not supported on this device
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Play/Pause button */}
      <TouchableOpacity style={styles.playBtn} onPress={togglePlayback} activeOpacity={0.7}>
        {isPlaying
          ? <Pause size={18} color={iconColor} fill={iconColor} />
          : <Play size={18} color={iconColor} fill={iconColor} />
        }
      </TouchableOpacity>

      {/* Waveform bars */}
      <View
        style={styles.waveformContainer}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width;
          waveWidthRef.current = w;
          setWaveWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        {WAVEFORM.map((amp, i) => {
          const barProgress = i / BAR_COUNT;
          const played = barProgress < progress;
          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: Math.max(3, amp * 28),
                  backgroundColor: played ? playedColor : unplayedColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Time */}
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
  },
});
