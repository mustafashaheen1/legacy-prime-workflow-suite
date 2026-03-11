import { View, StyleSheet, TouchableOpacity, Platform, Text, Modal, StatusBar } from 'react-native';
import { useState } from 'react';
import { Play, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  uri: string;
  duration?: number; // seconds
}

// Lazy-load expo-video to avoid module-level side effects
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const ev = require('expo-video');
  VideoView = ev.VideoView;
  useVideoPlayer = ev.useVideoPlayer;
} catch { /* expo-video not installed */ }

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Full-screen video player modal ──────────────────────────────────────────
function FullscreenPlayer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  if (!VideoView || !useVideoPlayer) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.fullscreenContainer}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFillObject}
          contentFit="contain"
          nativeControls
          allowsFullscreen={false}
        />
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Web player ──────────────────────────────────────────────────────────────
function WebVideoPlayer({ uri, duration }: { uri: string; duration?: number }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.thumbnail}
        onPress={() => setFullscreen(true)}
        activeOpacity={0.9}
      >
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
        {duration != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {fullscreen && (
        <Modal visible transparent={false} animationType="fade" onRequestClose={() => setFullscreen(false)}>
          <View style={styles.fullscreenContainer}>
            {/* @ts-ignore web element */}
            <video
              src={uri}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
            />
            <TouchableOpacity
              style={[styles.closeBtn, { top: 40 }]}
              onPress={() => setFullscreen(false)}
              activeOpacity={0.8}
            >
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}

// ─── Native player ────────────────────────────────────────────────────────────
function NativeVideoPlayer({ uri, duration }: { uri: string; duration?: number }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      {/* Chat bubble thumbnail — tap to open fullscreen */}
      <TouchableOpacity
        style={styles.thumbnail}
        onPress={() => setFullscreen(true)}
        activeOpacity={0.9}
      >
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Play size={28} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
        {duration != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Full-screen player */}
      {fullscreen && (
        <FullscreenPlayer uri={uri} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────
export default function VideoMessage({ uri, duration }: Props) {
  if (Platform.OS === 'web') {
    return <WebVideoPlayer uri={uri} duration={duration} />;
  }
  return <NativeVideoPlayer uri={uri} duration={duration} />;
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 240,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
