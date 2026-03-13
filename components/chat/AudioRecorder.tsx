import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Mic, X, Send, Square } from 'lucide-react-native';
import { AudioModule, useAudioRecorder, RecordingPresets } from '@/lib/expo-audio-compat';

type RecorderState = 'idle' | 'recording' | 'preview';

interface RecordingResult {
  uri: string | null;
  blob?: Blob;
  durationSec: number;
  mimeType: string;
}

interface Props {
  onSend: (result: RecordingResult) => void;
  onCancel: () => void;
  /** If true, skip the idle mic button and start recording immediately on mount */
  autoStart?: boolean;
}

// ─── WAV encoder (pure JS, no dependencies) ──────────────────────────────────
// Encodes mono Float32 PCM samples → 16-bit PCM WAV ArrayBuffer.
// WAV is universally supported: iOS AVFoundation, Android, and all browsers.
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const write4 = (o: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));

  write4(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  write4(8, 'WAVE');
  write4(12, 'fmt ');
  view.setUint32(16, 16, true);       // PCM chunk size
  view.setUint16(20, 1, true);        // PCM format
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);        // block align
  view.setUint16(34, 16, true);       // bits per sample
  write4(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AudioRecorder({ onSend, onCancel, autoStart }: Props) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(20).fill(6));
  const [previewResult, setPreviewResult] = useState<RecordingResult | null>(null);

  // Native (expo-audio)
  const nativeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const animIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web (Web Audio API)
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmSamplesRef = useRef<Float32Array[]>([]);
  const isRecordingRef = useRef(false);

  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // Auto-start recording on mount if requested
  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Blinking dot animation while recording
  useEffect(() => {
    if (state === 'recording') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [state]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
        streamRef.current = stream;
        pcmSamplesRef.current = [];
        isRecordingRef.current = true;

        // AudioContext for both amplitude visualisation and PCM capture
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);

        // Analyser — drives the live waveform bars
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!isRecordingRef.current) return;
          analyser.getByteFrequencyData(freqData);
          const avg = Array.from(freqData.slice(0, 20)).map((v) => Math.max(4, (v / 255) * 28));
          setAmplitudes(avg);
          requestAnimationFrame(tick);
        };
        tick();

        // ScriptProcessorNode — accumulates raw PCM samples for WAV encoding
        // (deprecated but universally supported; AudioWorklet needs a separate file)
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          if (!isRecordingRef.current) return;
          pcmSamplesRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        source.connect(processor);
        processor.connect(ctx.destination);
        scriptProcessorRef.current = processor;
      } else {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) return;

        await AudioModule.setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        // HIGH_QUALITY → MPEG4AAC → .m4a — natively supported on iOS & Android
        nativeRecorder.record();

        // Pseudo-random waveform (avoids isMeteringEnabled iOS audio-session errors)
        animIntervalRef.current = setInterval(() => {
          setAmplitudes(() => Array.from({ length: 20 }, () => Math.random() * 22 + 4));
        }, 150);
      }

      setState('recording');
      startTimer();
    } catch (e) {
      console.error('[AudioRecorder] startRecording error:', e);
    }
  };

  const stopRecording = async (): Promise<RecordingResult | null> => {
    stopTimer();
    const durationSec = Math.floor((Date.now() - startTimeRef.current) / 1000);

    if (Platform.OS === 'web') {
      isRecordingRef.current = false;

      // Disconnect Web Audio nodes
      scriptProcessorRef.current?.disconnect();
      scriptProcessorRef.current = null;

      // Combine all PCM chunks
      const chunks = pcmSamplesRef.current;
      pcmSamplesRef.current = [];
      const totalSamples = chunks.reduce((sum, a) => sum + a.length, 0);
      const combined = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      await audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;

      // Stop mic
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      // Encode to WAV — plays natively on iOS, Android, and all browsers
      const wavBuffer = encodeWAV(combined, sampleRate);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      return { uri: null, blob, durationSec, mimeType: 'audio/wav' };
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
      await nativeRecorder.stop();
      await AudioModule.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = nativeRecorder.uri;
      // audio/mp4 is the correct IANA MIME type for .m4a (AAC in MPEG-4 container)
      return { uri: uri ?? null, durationSec, mimeType: 'audio/mp4' };
    }
  };

  const handleStop = async () => {
    const result = await stopRecording();
    if (result) {
      setPreviewResult(result);
      setState('preview');
      setElapsedSec(result.durationSec);
    }
  };

  const handleCancel = async () => {
    if (state === 'recording') {
      await stopRecording();
    }
    setState('idle');
    setPreviewResult(null);
    setElapsedSec(0);
    onCancel();
  };

  const handleSend = () => {
    if (previewResult) {
      onSend(previewResult);
      setState('idle');
      setPreviewResult(null);
      setElapsedSec(0);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (state === 'idle') {
    return (
      <TouchableOpacity style={styles.micButton} onPress={startRecording} activeOpacity={0.7}>
        <Mic size={20} color="#2563EB" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.recorderBar}>
      {/* Cancel */}
      <TouchableOpacity style={styles.actionBtn} onPress={handleCancel} activeOpacity={0.7}>
        <X size={22} color="#EF4444" />
      </TouchableOpacity>

      {/* Waveform / Status */}
      <View style={styles.centerArea}>
        {state === 'recording' && (
          <>
            <Animated.View style={[styles.recordingDot, { opacity: dotOpacity }]} />
            <View style={styles.waveformRow}>
              {amplitudes.map((h, i) => (
                <View key={i} style={[styles.bar, { height: h }]} />
              ))}
            </View>
          </>
        )}
        {state === 'preview' && (
          <View style={styles.waveformRow}>
            {amplitudes.map((h, i) => (
              <View key={i} style={[styles.bar, styles.barPreview, { height: h }]} />
            ))}
          </View>
        )}
        <Text style={styles.timer}>{formatTime(elapsedSec)}</Text>
      </View>

      {/* Stop (recording) or Send (preview) */}
      {state === 'recording' ? (
        <TouchableOpacity style={[styles.actionBtn, styles.stopBtn]} onPress={handleStop} activeOpacity={0.7}>
          <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.actionBtn, styles.sendBtn]} onPress={handleSend} activeOpacity={0.7}>
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recorderBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 8,
    gap: 8,
    minHeight: 48,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    backgroundColor: '#EF4444',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
  },
  centerArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  waveformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
  },
  bar: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 2,
    minHeight: 4,
  },
  barPreview: {
    backgroundColor: '#9CA3AF',
  },
  timer: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    minWidth: 36,
  },
});
