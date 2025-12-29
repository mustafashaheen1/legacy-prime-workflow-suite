import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Camera } from 'expo-camera';
import { Video } from 'expo-av';
import { Loader, Video as VideoIcon, Upload, Check, X, RotateCw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '@/lib/trpc';

type RecordingStatus = 'idle' | 'recording' | 'recorded' | 'uploading' | 'complete';

export default function InspectionVideoScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [isValidating, setIsValidating] = useState(true);
  const [inspectionData, setInspectionData] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<Camera>(null);

  const validateTokenQuery = trpc.crm.validateInspectionToken.useQuery(
    { token: token || '' },
    {
      enabled: !!token,
      retry: false,
    }
  );

  const completeInspectionMutation = trpc.crm.completeVideoUpload.useMutation();

  useEffect(() => {
    if (validateTokenQuery.data) {
      if (validateTokenQuery.data.valid && validateTokenQuery.data.inspection) {
        setInspectionData(validateTokenQuery.data.inspection);
      }
      setIsValidating(false);
    } else if (validateTokenQuery.error) {
      setIsValidating(false);
    }
  }, [validateTokenQuery.data, validateTokenQuery.error]);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
        setHasPermission(cameraStatus === 'granted' && audioStatus === 'granted');
      }
    })();
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      setStatus('recording');

      const video = await cameraRef.current.recordAsync({
        maxDuration: 300, // 5 minutes max
        quality: Camera.Constants.VideoQuality['720p'],
      });

      setVideoUri(video.uri);
      setStatus('recorded');
      setIsRecording(false);
    } catch (error) {
      console.error('[InspectionVideo] Error recording:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
      setIsRecording(false);
      setStatus('idle');
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('[InspectionVideo] Error stopping recording:', error);
    }
  };

  const pickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to upload a video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        setStatus('recorded');
      }
    } catch (error) {
      console.error('[InspectionVideo] Error picking video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  const retakeVideo = () => {
    setVideoUri(null);
    setStatus('idle');
  };

  const uploadVideo = async () => {
    if (!videoUri || !token) return;

    try {
      setStatus('uploading');
      console.log('[InspectionVideo] Starting video upload process...');

      // For web platform, we need to upload to S3
      if (Platform.OS === 'web' && videoUri.startsWith('blob:')) {
        // Get the video file from the blob URL
        const response = await fetch(videoUri);
        const blob = await response.blob();
        const file = new File([blob], `inspection-${token}.mp4`, { type: 'video/mp4' });

        console.log('[InspectionVideo] Video file size:', file.size, 'bytes');

        // Get presigned S3 upload URL
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';
        const urlResponse = await fetch(`${apiUrl}/api/get-s3-upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `inspection-${token}.mp4`,
            fileType: 'video/mp4',
          }),
        });

        if (!urlResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadUrl, key, fileUrl } = await urlResponse.json();
        console.log('[InspectionVideo] Got presigned URL, uploading to S3...');

        // Upload directly to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': 'video/mp4',
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload video to S3');
        }

        console.log('[InspectionVideo] Video uploaded to S3 successfully');

        // Complete the inspection with S3 key
        const result = await completeInspectionMutation.mutateAsync({
          token,
          videoKey: key,
          videoDuration: 0,
          videoSize: file.size,
        });

        if (result.success) {
          setStatus('complete');
        }
      } else {
        // For native platform (future implementation)
        const result = await completeInspectionMutation.mutateAsync({
          token,
          videoKey: videoUri,
          videoDuration: 0,
          videoSize: 0,
        });

        if (result.success) {
          setStatus('complete');
        }
      }
    } catch (error: any) {
      console.error('[InspectionVideo] Error uploading video:', error);
      Alert.alert('Error', error.message || 'Failed to upload video. Please try again.');
      setStatus('recorded');
    }
  };

  if (isValidating) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Validating...', headerShown: true }} />
        <Loader size={48} color="#2563EB" />
        <Text style={styles.loadingText}>Validating inspection link...</Text>
      </View>
    );
  }

  if (validateTokenQuery.error || !inspectionData) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Invalid Link', headerShown: true }} />
        <View style={styles.errorCard}>
          <X size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Invalid or Expired Link</Text>
          <Text style={styles.errorText}>
            This inspection link is invalid or has expired. Please contact Legacy Prime Construction for a new link.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'complete') {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Complete', headerShown: true }} />
        <View style={styles.successCard}>
          <View style={styles.checkmarkContainer}>
            <Check size={64} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successText}>
            Your inspection video has been submitted successfully. Our team will review it and contact you shortly.
          </Text>
          <Text style={styles.successFooter}>
            - Legacy Prime Construction Team
          </Text>
        </View>
      </View>
    );
  }

  // For web platform, use HTML5 video input
  if (Platform.OS === 'web') {
    const handleWebVideoSelect = async (event: any) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith('video/')) {
        const videoUrl = URL.createObjectURL(file);
        setVideoUri(videoUrl);
        setStatus('recorded');
      }
    };

    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Video Inspection', headerShown: true }} />

        <View style={styles.header}>
          <Text style={styles.companyName}>Legacy Prime Construction</Text>
          <Text style={styles.clientName}>Video Inspection for {inspectionData?.clientName || 'Client'}</Text>
          <Text style={styles.instructions}>
            Record a video walkthrough of the project area. Show us the space, details, and any specific concerns.
          </Text>
        </View>

        <View style={styles.cameraContainer}>
          {status === 'recorded' && videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={styles.camera}
              useNativeControls
              resizeMode="contain"
              isLooping
            />
          ) : (
            <View style={[styles.camera, { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }]}>
              <VideoIcon size={64} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
                Tap below to record or upload video
              </Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          {status === 'idle' && (
            <>
              <label htmlFor="video-input" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                width: '100%'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '40px',
                  backgroundColor: '#FFFFFF',
                  border: '4px solid #EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    backgroundColor: '#EF4444'
                  }} />
                </div>
                <Text style={styles.controlText}>Tap to record or upload video</Text>
              </label>
              <input
                id="video-input"
                type="file"
                accept="video/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleWebVideoSelect}
              />
            </>
          )}

          {status === 'recorded' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => {
                  if (videoUri) URL.revokeObjectURL(videoUri);
                  setVideoUri(null);
                  setStatus('idle');
                }}
              >
                <RotateCw size={20} color="#6B7280" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={uploadVideo}>
                <Check size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Video</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'uploading' && (
            <>
              <Loader size={48} color="#2563EB" />
              <Text style={styles.controlText}>Uploading video...</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Video Inspection', headerShown: true }} />
        <Loader size={48} color="#2563EB" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Permission Required', headerShown: true }} />
        <View style={styles.errorCard}>
          <VideoIcon size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Camera Permission Required</Text>
          <Text style={styles.errorText}>
            Please grant camera and microphone permissions to record your inspection video.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Video Inspection', headerShown: true }} />

      <View style={styles.header}>
        <Text style={styles.companyName}>Legacy Prime Construction</Text>
        <Text style={styles.clientName}>Video Inspection for {inspectionData.clientName}</Text>
        <Text style={styles.instructions}>
          Record a video walkthrough of the project area. Show us the space, details, and any specific concerns.
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        {status === 'recorded' && videoUri ? (
          <Video
            source={{ uri: videoUri }}
            style={styles.camera}
            useNativeControls
            resizeMode="contain"
            isLooping
          />
        ) : (
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={Camera.Constants.Type.back}
          />
        )}
      </View>

      <View style={styles.controls}>
        {status === 'idle' && (
          <>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={startRecording}
            >
              <View style={styles.recordButtonInner} />
            </TouchableOpacity>
            <Text style={styles.controlText}>Tap to start recording</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickVideo}>
              <Upload size={20} color="#2563EB" />
              <Text style={styles.uploadButtonText}>Or upload existing video</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'recording' && (
          <>
            <TouchableOpacity
              style={styles.stopButton}
              onPress={stopRecording}
            >
              <View style={styles.stopButtonInner} />
            </TouchableOpacity>
            <Text style={styles.controlText}>Recording... Tap to stop</Text>
          </>
        )}

        {status === 'recorded' && (
          <>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.retakeButton} onPress={retakeVideo}>
                <RotateCw size={20} color="#6B7280" />
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={uploadVideo}>
                <Check size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Video</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {status === 'uploading' && (
          <>
            <Loader size={48} color="#2563EB" />
            <Text style={styles.controlText}>Uploading video...</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2563EB',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  instructions: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  controls: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButtonInner: {
    width: 30,
    height: 30,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  controlText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600' as const,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  retakeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 400,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 400,
  },
  checkmarkContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  successFooter: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
  },
});
