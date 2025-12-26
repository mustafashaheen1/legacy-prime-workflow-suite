import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Video } from 'lucide-react-native';

export default function VideoInspectionPage() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [status, setStatus] = useState<'loading' | 'ready' | 'recording' | 'uploading' | 'complete' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Validate token on mount
  useEffect(() => {
    if (token) {
      validateToken();
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const result = await trpc.crm.validateInspectionToken.query({ token });

      if (!result.valid) {
        setStatus('error');
        setErrorMessage(result.message || 'Invalid inspection link');
        return;
      }

      setInspectionData(result.inspection);
      setStatus('ready');
    } catch (error: any) {
      console.error('[Inspection] Error validating token:', error);
      setStatus('error');
      setErrorMessage('Failed to validate inspection link');
    }
  };

  const startRecording = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Not Supported', 'Video recording is only supported on web browsers.');
      return;
    }

    try {
      // Request camera and microphone access
      const stream = await (navigator as any).mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;

      // Show video preview
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Create MediaRecorder
      const mediaRecorder = new (window as any).MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: any) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await handleUpload();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setStatus('recording');
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('[Inspection] Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        Alert.alert('Permission Denied', 'Please allow camera and microphone access to record your inspection video.');
      } else {
        Alert.alert('Error', 'Failed to start recording. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: any) => track.stop());
      }
    }
  };

  const handleUpload = async () => {
    setStatus('uploading');
    setUploadProgress(0);

    try {
      // Create video blob
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoSize = videoBlob.size;

      console.log('[Inspection] Video recorded:', videoSize, 'bytes');

      // Get upload URL
      const { uploadUrl, key } = await trpc.crm.getVideoUploadUrl.mutate({
        token,
        fileExtension: 'webm',
      });

      // Upload to S3
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          console.log('[Inspection] Upload successful');

          // Mark as complete
          await trpc.crm.completeVideoUpload.mutate({
            token,
            videoKey: key,
            videoDuration: recordingTime,
            videoSize,
          });

          setStatus('complete');
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Upload failed');
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'video/webm');
      xhr.send(videoBlob);

    } catch (error: any) {
      console.error('[Inspection] Upload error:', error);
      setStatus('error');
      setErrorMessage('Failed to upload video. Please try again.');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Video Inspection', headerShown: true }} />
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Validating inspection link...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Error', headerShown: true }} />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{errorMessage}</Text>
      </View>
    );
  }

  if (status === 'complete') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Complete', headerShown: true }} />
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Video Submitted!</Text>
        <Text style={styles.successMessage}>
          Thank you for recording your inspection video. We've received it successfully and will review it shortly.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Video Inspection', headerShown: true }} />
      <View style={styles.header}>
        <Text style={styles.title}>Video Inspection</Text>
        {inspectionData && (
          <Text style={styles.subtitle}>For: {inspectionData.clientName}</Text>
        )}
        {inspectionData?.notes && (
          <Text style={styles.notes}>{inspectionData.notes}</Text>
        )}
      </View>

      {Platform.OS === 'web' && (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: 640,
            height: 'auto',
            aspectRatio: 16 / 9,
            borderRadius: 12,
            backgroundColor: '#000',
            marginBottom: 20,
            border: '2px solid #e5e7eb',
          }}
          playsInline
          muted={status === 'recording'}
        />
      )}

      {status === 'recording' && (
        <View style={styles.recordingInfo}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>REC {formatTime(recordingTime)}</Text>
          <Text style={styles.recordingHint}>(Max 10 minutes)</Text>
        </View>
      )}

      {status === 'uploading' && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.uploadingText}>Uploading video... {uploadProgress}%</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.uploadingHint}>Please don't close this page</Text>
        </View>
      )}

      {status === 'ready' && (
        <>
          <Text style={styles.instructions}>
            📹 Please record a video walkthrough of the property or project area. Show any relevant details,
            measurements, or concerns you'd like us to review.
          </Text>
          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Tips for a great video:</Text>
            <Text style={styles.tipText}>• Speak clearly and describe what you're showing</Text>
            <Text style={styles.tipText}>• Show all relevant areas and details</Text>
            <Text style={styles.tipText}>• Include any measurements if possible</Text>
            <Text style={styles.tipText}>• Point out any specific concerns or issues</Text>
          </View>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
          >
            <Video size={24} color="#fff" />
            <Text style={styles.recordButtonText}>Start Recording</Text>
          </TouchableOpacity>
        </>
      )}

      {status === 'recording' && (
        <TouchableOpacity
          style={[styles.recordButton, styles.stopButton]}
          onPress={stopRecording}
        >
          <View style={styles.stopIcon} />
          <Text style={styles.recordButtonText}>Stop & Upload</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    maxWidth: 600,
    paddingHorizontal: 20,
  },
  tips: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    maxWidth: 600,
    width: '100%',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#3b82f6',
    marginBottom: 4,
    lineHeight: 20,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#2563eb',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
  },
  recordingTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991b1b',
  },
  recordingHint: {
    fontSize: 12,
    color: '#7f1d1d',
    marginLeft: 4,
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  uploadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  uploadingHint: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  progressBar: {
    width: 300,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 400,
    paddingHorizontal: 20,
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
