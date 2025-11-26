import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Camera, FileText, Image as ImageIcon, Send, Check, Loader, X, Mic } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { trpc } from '@/lib/trpc';
import { Audio } from 'expo-av';

type UploadedFile = {
  id: string;
  type: 'photo' | 'plan' | 'video';
  uri: string;
  name: string;
  mimeType?: string;
};

export default function InspectionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [clientName, setClientName] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentStep, setCurrentStep] = useState<'intro' | 'interview' | 'uploads' | 'complete'>('intro');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scopeOfWork, setScopeOfWork] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const submitInspectionMutation = trpc.crm.submitInspectionData.useMutation();

  useEffect(() => {
    if (token) {
      const params = new URLSearchParams(token);
      const client = params.get('client') || '';
      const project = params.get('project') || 'new';
      setClientName(client);
      setProjectId(project);
      setIsLoading(false);
    }
  }, [token]);

  const { messages, sendMessage } = useRorkAgent({
    tools: {
      saveScopeOfWork: createRorkTool({
        description: 'Save the scope of work based on the client responses',
        zodSchema: z.object({
          projectType: z.string().describe('Type of project (e.g., kitchen remodel, bathroom renovation)'),
          projectDetails: z.string().describe('Detailed description of the work to be done'),
          rooms: z.array(z.string()).describe('List of rooms or areas involved').optional(),
          measurements: z.string().describe('Any measurements provided by the client').optional(),
          specialRequirements: z.string().describe('Special requirements or preferences').optional(),
          timeline: z.string().describe('Desired timeline or start date').optional(),
          budget: z.string().describe('Budget range if mentioned').optional(),
        }),
        execute(input) {
          const scope = `Project Type: ${input.projectType}\n\nDetails: ${input.projectDetails}${input.rooms ? `\n\nRooms: ${input.rooms.join(', ')}` : ''}${input.measurements ? `\n\nMeasurements: ${input.measurements}` : ''}${input.specialRequirements ? `\n\nSpecial Requirements: ${input.specialRequirements}` : ''}${input.timeline ? `\n\nTimeline: ${input.timeline}` : ''}${input.budget ? `\n\nBudget: ${input.budget}` : ''}`;
          setScopeOfWork(scope);
          return JSON.stringify({ success: true, scope });
        },
      }),
    },
  });

  const sendInitialMessage = useCallback(() => {
    if (currentStep === 'interview' && messages.length === 0) {
      sendMessage(`Hello! I'm here to help gather information about your construction project. Let's start with a few questions to create an accurate estimate for you.\n\nWhat type of construction or renovation project are you interested in?`);
    }
  }, [currentStep, messages.length, sendMessage]);

  useEffect(() => {
    sendInitialMessage();
  }, [sendInitialMessage]);

  const startRecording = async () => {
    try {
      console.log('[Inspection] Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant audio recording permission to continue.');
        return;
      }

      console.log('[Inspection] Setting audio mode...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('[Inspection] Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      console.log('[Inspection] Recording started');
    } catch (err) {
      console.error('[Inspection] Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('[Inspection] Stopping recording...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      }
      
      const uri = recording.getURI();
      console.log('[Inspection] Recording stopped, URI:', uri);
      
      if (uri) {
        const fileName = `voice-note-${Date.now()}.m4a`;
        setUploadedFiles(prev => [...prev, {
          id: `voice-${Date.now()}`,
          type: 'video',
          uri,
          name: fileName,
          mimeType: 'audio/m4a',
        }]);
        Alert.alert('Success', 'Voice recording saved!');
      }
      
      setRecording(null);
    } catch (err) {
      console.error('[Inspection] Failed to stop recording:', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to continue.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets) {
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          id: `photo-${Date.now()}-${index}`,
          type: 'photo' as const,
          uri: asset.uri,
          name: `photo-${Date.now()}-${index}.jpg`,
          mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        }));
        setUploadedFiles(prev => [...prev, ...newFiles]);
        Alert.alert('Success', `${newFiles.length} file(s) added!`);
      }
    } catch (error) {
      console.error('[Inspection] Error picking image:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const takePicture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access to continue.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const newFile: UploadedFile = {
          id: `camera-${Date.now()}`,
          type: 'photo',
          uri: result.assets[0].uri,
          name: `camera-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        };
        setUploadedFiles(prev => [...prev, newFile]);
        Alert.alert('Success', 'Photo added!');
      }
    } catch (error) {
      console.error('[Inspection] Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        const newFiles: UploadedFile[] = result.assets.map((asset, index) => ({
          id: `doc-${Date.now()}-${index}`,
          type: 'plan',
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/pdf',
        }));
        setUploadedFiles(prev => [...prev, ...newFiles]);
        Alert.alert('Success', `${newFiles.length} file(s) added!`);
      }
    } catch (error) {
      console.error('[Inspection] Error picking document:', error);
      Alert.alert('Error', 'Failed to pick documents. Please try again.');
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const submitInspection = async () => {
    if (!scopeOfWork && uploadedFiles.length === 0) {
      Alert.alert('Incomplete', 'Please complete the interview or upload files before submitting.');
      return;
    }

    try {
      setIsLoading(true);
      
      const conversationTranscript = messages.map(m => {
        const textParts = m.parts.filter(p => p.type === 'text');
        return `${m.role}: ${textParts.map(p => (p as any).text).join(' ')}`;
      }).join('\n\n');

      await submitInspectionMutation.mutateAsync({
        clientName,
        projectId,
        scopeOfWork,
        conversationTranscript,
        files: uploadedFiles.map(f => ({
          type: f.type,
          uri: f.uri,
          name: f.name,
          mimeType: f.mimeType || 'application/octet-stream',
        })),
      });

      setCurrentStep('complete');
    } catch (error: any) {
      console.error('[Inspection] Error submitting inspection:', error);
      Alert.alert('Error', error.message || 'Failed to submit inspection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Loading...', headerShown: true }} />
        <Loader size={48} color="#2563EB" />
        <Text style={styles.loadingText}>Loading inspection...</Text>
      </View>
    );
  }

  if (currentStep === 'intro') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Project Inspection', headerShown: true }} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.introCard}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Legacy Prime Construction</Text>
            </View>
            <Text style={styles.welcomeTitle}>Welcome, {clientName}!</Text>
            <Text style={styles.welcomeText}>
              Thank you for your interest in working with us. We&apos;d like to gather some details about your project to provide you with an accurate estimate.
            </Text>
            <Text style={styles.processTitle}>Here&apos;s how it works:</Text>
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={styles.stepText}>Answer a few quick questions about your project</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={styles.stepText}>Upload photos, videos, or plans (optional)</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={styles.stepText}>We&apos;ll create a preliminary estimate for you</Text>
              </View>
            </View>
            <Text style={styles.timeEstimate}>This should take about 5-10 minutes.</Text>
          </View>
        </ScrollView>
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.startButton} onPress={() => setCurrentStep('interview')}>
            <Text style={styles.startButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (currentStep === 'interview') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Project Details', headerShown: true }} />
        <ScrollView style={styles.chatScrollView} contentContainerStyle={styles.chatContent}>
          {messages.map((m) => (
            <View key={m.id} style={styles.messageGroup}>
              {m.parts.map((part, i) => {
                switch (part.type) {
                  case 'text':
                    return (
                      <View
                        key={`${m.id}-${i}`}
                        style={[
                          styles.messageBubble,
                          m.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant,
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            m.role === 'user' ? styles.messageTextUser : styles.messageTextAssistant,
                          ]}
                        >
                          {(part as any).text}
                        </Text>
                      </View>
                    );
                  case 'tool':
                    if ((part as any).state === 'input-streaming' || (part as any).state === 'input-available') {
                      return (
                        <View key={`${m.id}-${i}`} style={styles.toolMessage}>
                          <Loader size={16} color="#F59E0B" />
                          <Text style={styles.toolText}>Processing your response...</Text>
                        </View>
                      );
                    }
                    return null;
                }
              })}
            </View>
          ))}
        </ScrollView>
        <View style={styles.chatInputContainer}>
          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Mic size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.chatInput}
            placeholder="Type your answer..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            onSubmitEditing={(e) => {
              if (e.nativeEvent.text.trim()) {
                sendMessage(e.nativeEvent.text.trim());
              }
            }}
          />
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => {
              if (scopeOfWork) {
                setCurrentStep('uploads');
              } else {
                Alert.alert('Continue Interview', 'Please answer all questions before proceeding.');
              }
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (currentStep === 'uploads') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Upload Files', headerShown: true }} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.uploadCard}>
            <Text style={styles.uploadTitle}>Upload Additional Files (Optional)</Text>
            <Text style={styles.uploadDescription}>
              Add photos of the space, videos, or construction plans to help us provide a more accurate estimate.
            </Text>

            <View style={styles.uploadButtons}>
              <TouchableOpacity style={styles.uploadButton} onPress={takePicture}>
                <Camera size={32} color="#2563EB" />
                <Text style={styles.uploadButtonText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                <ImageIcon size={32} color="#10B981" />
                <Text style={styles.uploadButtonText}>Choose Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
                <FileText size={32} color="#F59E0B" />
                <Text style={styles.uploadButtonText}>Upload Plans</Text>
              </TouchableOpacity>
            </View>

            {uploadedFiles.length > 0 && (
              <View style={styles.filesSection}>
                <Text style={styles.filesSectionTitle}>Uploaded Files ({uploadedFiles.length})</Text>
                {uploadedFiles.map(file => (
                  <View key={file.id} style={styles.fileItem}>
                    {file.type === 'photo' && <ImageIcon size={20} color="#10B981" />}
                    {file.type === 'plan' && <FileText size={20} color="#F59E0B" />}
                    {file.type === 'video' && <Mic size={20} color="#8B5CF6" />}
                    <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                    <TouchableOpacity onPress={() => removeFile(file.id)}>
                      <X size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.skipButton} onPress={() => setCurrentStep('interview')}>
            <Text style={styles.skipButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={submitInspection}
            disabled={submitInspectionMutation.isPending}
          >
            {submitInspectionMutation.isPending ? (
              <Loader size={20} color="#FFFFFF" />
            ) : (
              <>
                <Send size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (currentStep === 'complete') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Complete', headerShown: true }} />
        <View style={styles.completeContainer}>
          <View style={styles.completeCard}>
            <View style={styles.checkmarkContainer}>
              <Check size={64} color="#10B981" />
            </View>
            <Text style={styles.completeTitle}>Thank You!</Text>
            <Text style={styles.completeText}>
              Your project information has been submitted successfully. Our team will review the details and create a preliminary estimate for you.
            </Text>
            <Text style={styles.completeSubtext}>
              We&apos;ll contact you within 24-48 hours with your estimate and next steps.
            </Text>
            <Text style={styles.completeFooter}>
              - Legacy Prime Construction Team
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2563EB',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  processTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  stepsList: {
    gap: 16,
    marginBottom: 24,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    paddingTop: 6,
  },
  timeEstimate: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic' as const,
  },
  bottomActions: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    gap: 12,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  chatScrollView: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 12,
  },
  messageGroup: {
    gap: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: '#2563EB',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFFFFF',
  },
  messageTextAssistant: {
    color: '#1F2937',
  },
  toolMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  toolText: {
    fontSize: 13,
    color: '#92400E',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    alignItems: 'flex-end',
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#EF4444',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
  },
  nextButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  uploadDescription: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 24,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  uploadButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1F2937',
    textAlign: 'center',
  },
  filesSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  filesSectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#4B5563',
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 500,
    width: '100%',
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
  completeTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 16,
  },
  completeText: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 16,
  },
  completeSubtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  completeFooter: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
});
