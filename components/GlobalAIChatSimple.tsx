import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { Bot, X, Send, Paperclip, File as FileIcon, Mic, Volume2, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useState, useRef, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Audio } from 'expo-av';
import { usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

interface GlobalAIChatProps {
  currentPageContext?: string;
  inline?: boolean;
}

const extensionMimeTypeMap: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

type AttachedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: 'file';
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
};

const getSanitizedMimeType = (initialMimeType: string | undefined, fileName: string): string => {
  if (initialMimeType && initialMimeType !== 'application/octet-stream') {
    return initialMimeType;
  }
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension && extensionMimeTypeMap[extension]) {
    return extensionMimeTypeMap[extension];
  }
  return 'application/octet-stream';
};

export default function GlobalAIChatSimple({ currentPageContext, inline = false }: GlobalAIChatProps) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [soundInstance, setSoundInstance] = useState<Audio.Sound | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pathname = usePathname();
  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname?.includes('/login') || pathname?.includes('/subscription') || pathname?.includes('/signup');
  const { user } = useApp();

  const chatMutation = trpc.openai.chat.useMutation();
  const imageAnalysisMutation = trpc.openai.imageAnalysis.useMutation();

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const startRecording = async () => {
    try {
      console.log('[Voice] Starting recording...');
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        });

        await recording.startAsync();
        setRecordingInstance(recording);
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Error starting recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setIsTranscribing(true);

      if (Platform.OS === 'web') {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        }
      } else {
        if (recordingInstance) {
          try {
            const status = await recordingInstance.getStatusAsync();
            if (status.canRecord || status.isRecording) {
              await recordingInstance.stopAndUnloadAsync();
              const uri = recordingInstance.getURI();
              if (uri) {
                const base64 = await FileSystem.readAsStringAsync(uri, {
                  encoding: 'base64' as any,
                });
                await transcribeAudioBase64(base64);
              }
            }
          } catch (recordError) {
            console.error('Error stopping recording:', recordError);
          } finally {
            try {
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
            } catch (audioModeError) {
              console.error('Error resetting audio mode:', audioModeError);
            }
            setRecordingInstance(null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsTranscribing(false);
      alert('Error processing recording.');
    }
  };

  const transcribeAudioBase64 = async (base64: string) => {
    try {
      console.log('[STT] Transcribing audio via OpenAI Whisper...');
      
      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64,
        }),
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text;
      
      console.log('[STT] Transcription successful:', transcribedText);
      
      if (transcribedText && transcribedText.trim()) {
        setInput(transcribedText);
      }
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      alert('Voice transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const transcribeAudio = async (audio: Blob) => {
    try {
      console.log('[STT] Starting transcription...');
      const formData = new FormData();
      formData.append('audio', audio, 'recording.webm');

      const response = await fetch('https://toolkit.rork.com/stt/transcribe/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text;
      
      console.log('[STT] Transcription successful:', transcribedText);
      
      if (transcribedText && transcribedText.trim()) {
        setInput(transcribedText);
      }
    } catch (error) {
      console.error('[STT] Transcription error:', error);
      alert('Voice transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const stopSpeaking = useCallback(async () => {
    if (soundInstance) {
      try {
        const status = await soundInstance.getStatusAsync();
        if (status.isLoaded) {
          await soundInstance.stopAsync();
          await soundInstance.unloadAsync();
        }
      } catch (error) {
        console.error('Error stopping sound:', error);
      } finally {
        setSoundInstance(null);
      }
    }
    setIsSpeaking(false);
  }, [soundInstance]);

  const speakText = useCallback(async (text: string) => {
    try {
      if (isSpeaking) {
        await stopSpeaking();
        return;
      }

      const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(text)}`;
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      setSoundInstance(sound);
      setIsSpeaking(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          sound.unloadAsync().catch(console.error);
          setSoundInstance(null);
        }
      });
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  }, [isSpeaking, stopSpeaking]);

  useEffect(() => {
    return () => {
      if (soundInstance) {
        soundInstance.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            soundInstance.unloadAsync().catch(console.error);
          }
        }).catch(console.error);
      }
      if (recordingInstance) {
        recordingInstance.getStatusAsync().then((status) => {
          if (status.canRecord || status.isRecording) {
            recordingInstance.stopAndUnloadAsync().catch(console.error);
          }
        }).catch(console.error);
      }
    };
  }, [soundInstance, recordingInstance]);

  const handlePickFile = async () => {
    try {
      console.log('[Attachment] Opening document picker...');
      setShowAttachMenu(false);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const mimeType = getSanitizedMimeType(file.mimeType, file.name);
        
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.name,
          mimeType,
          size: file.size || 0,
          type: 'file',
        };
        console.log('[Attachment] File successfully attached:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      }
    } catch (error) {
      console.error('[Attachment] Error picking file:', error);
      alert('Error selecting file.');
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
  };

  const handlePickImage = async () => {
    try {
      console.log('[Attachment] Opening image picker...');
      setShowAttachMenu(false);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.fileName || `image_${Date.now()}.jpg`,
          mimeType: getSanitizedMimeType(file.mimeType, file.fileName || `image_${Date.now()}.jpg`),
          size: file.fileSize || 0,
          type: 'file',
        };
        console.log('[Attachment] Image successfully attached:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      }
    } catch (error) {
      console.error('[Attachment] Error picking image:', error);
      alert('Error selecting image.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log('[Attachment] Requesting camera permission...');
      setShowAttachMenu(false);
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Camera permission is required to take photos.');
        return;
      }
      
      console.log('[Attachment] Opening camera...');
      
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newFile: AttachedFile = {
          uri: file.uri,
          name: file.fileName || `photo_${Date.now()}.jpg`,
          mimeType: getSanitizedMimeType(file.mimeType, file.fileName || `photo_${Date.now()}.jpg`),
          size: file.fileSize || 0,
          type: 'file',
        };
        console.log('[Attachment] Photo successfully captured:', newFile.name);
        setAttachedFiles([...attachedFiles, newFile]);
      }
    } catch (error) {
      console.error('[Attachment] Error taking photo:', error);
      alert('Error taking photo.');
    }
  };

  const convertFileToBase64 = async (file: AttachedFile): Promise<string> => {
    try {
      console.log('[File Conversion] Starting conversion for:', file.name);
      
      if (Platform.OS === 'web') {
        if (file.uri.startsWith('data:')) {
          const base64 = file.uri.split(',')[1];
          if (!base64) {
            throw new Error('Invalid data URL format');
          }
          return base64;
        }
        
        const response = await fetch(file.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const result = reader.result as string;
              if (!result) {
                reject(new Error('FileReader returned empty result'));
                return;
              }
              const base64Data = result.split(',')[1];
              if (!base64Data) {
                reject(new Error('Failed to extract base64 data'));
                return;
              }
              resolve(base64Data);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => {
            reject(new Error('FileReader failed to read file'));
          };
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64' as any,
        });
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file or file is empty');
        }
        return base64;
      }
    } catch (error) {
      console.error('[File Conversion] Error:', error);
      throw new Error(`Could not process file ${file.name}`);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || chatMutation.isPending) return;
    
    const userMessage = input.trim() || 'Please analyze the attached files';
    
    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    try {
      if (attachedFiles.length > 0 && attachedFiles[0].mimeType.startsWith('image/')) {
        console.log('[Send] Processing image with OpenAI Vision');
        const file = attachedFiles[0];
        const base64 = await convertFileToBase64(file);
        
        setAttachedFiles([]);
        
        const response = await imageAnalysisMutation.mutateAsync({
          imageBase64: base64,
          prompt: userMessage,
          model: 'gpt-4o',
          maxTokens: 1000,
        });

        if (response.success && response.analysis) {
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.analysis,
            imageUri: `data:${file.mimeType};base64,${base64}`,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error(response.error || 'Image analysis failed');
        }
      } else {
        console.log('[Send] Sending text message to OpenAI');
        setAttachedFiles([]);
        
        const conversationMessages = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        
        conversationMessages.push({
          role: 'user',
          content: userMessage,
        });

        const response = await chatMutation.mutateAsync({
          messages: conversationMessages,
          model: 'gpt-4o',
          temperature: 0.7,
        });

        if (response.success && response.message) {
          const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: response.message,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error(response.error || 'Chat request failed');
        }
      }
    } catch (error) {
      console.error('[Send] Error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  if ((isOnChatScreen && !inline) || isOnAuthScreen || !user) {
    return null;
  }

  if (inline) {
    return (
      <View style={styles.inlineContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Bot size={56} color="#D1D5DB" strokeWidth={2} />
              <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
              <Text style={styles.emptyStateText}>
                I&apos;m powered by OpenAI and can help with text, images, and voice. Ask me anything!
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              {message.role === 'user' ? (
                <View style={styles.userMessageContainer}>
                  <View style={styles.userMessage}>
                    <Text style={styles.userMessageText} selectable>
                      {message.content}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    {message.imageUri && (
                      <Image 
                        source={{ uri: message.imageUri }} 
                        style={styles.messageImage}
                        resizeMode="contain"
                      />
                    )}
                    <Text style={styles.assistantMessageText} selectable>
                      {message.content}
                    </Text>
                    <TouchableOpacity
                      style={styles.speakButton}
                      onPress={() => speakText(message.content)}
                    >
                      <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                      <Text style={styles.speakButtonText}>
                        {isSpeaking ? 'Stop' : 'Speak'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}

          {chatMutation.isPending && (
            <View style={styles.assistantMessageContainer}>
              <View style={styles.assistantMessage}>
                <ActivityIndicator size="small" color="#2563EB" />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputWrapper}>
          {(isTranscribing || isRecording) && (
            <View style={styles.recordingBanner}>
              {isTranscribing ? (
                <>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.recordingText}>Transcribing audio...</Text>
                </>
              ) : (
                <>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording...</Text>
                </>
              )}
            </View>
          )}
          {attachedFiles.length > 0 && (
            <ScrollView
              horizontal
              style={styles.attachmentsContainer}
              contentContainerStyle={styles.attachmentsContent}
              showsHorizontalScrollIndicator={false}
            >
              {attachedFiles.map((file, index) => (
                <View key={index} style={styles.attachmentItem}>
                  {file.mimeType.startsWith('image/') ? (
                    <Image source={{ uri: file.uri }} style={styles.attachmentImage} />
                  ) : (
                    <View style={styles.attachmentFileIcon}>
                      <FileIcon size={24} color="#6B7280" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeAttachment}
                    onPress={() => removeFile(index)}
                  >
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {file.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setShowAttachMenu(true)}
              disabled={chatMutation.isPending || isRecording}
            >
              <Paperclip size={22} color="#6B7280" />
            </TouchableOpacity>
            {isRecording ? (
              <TouchableOpacity
                style={styles.recordingButton}
                onPress={stopRecording}
              >
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingButtonText}>Tap to stop</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask me anything..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                  editable={!chatMutation.isPending && !isTranscribing}
                />
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={startRecording}
                  disabled={chatMutation.isPending || isTranscribing}
                >
                  <Mic size={20} color="#6B7280" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.sendButton, (chatMutation.isPending || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={chatMutation.isPending || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)}
            >
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsOpen(true)}
      >
        <Bot size={28} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, isSmallScreen && styles.modalContentMobile]}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.aiIcon}>
                  <Bot size={22} color="#2563EB" strokeWidth={2.5} />
                </View>
                <Text style={styles.headerTitle}>OpenAI Assistant</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Bot size={56} color="#D1D5DB" strokeWidth={2} />
                  <Text style={styles.emptyStateTitle}>Ask me anything!</Text>
                  <Text style={styles.emptyStateText}>
                    I&apos;m powered by OpenAI GPT-4 and can help with text, images, and voice. Ask me anything!
                  </Text>
                </View>
              )}

              {messages.map((message) => (
                <View key={message.id} style={styles.messageWrapper}>
                  {message.role === 'user' ? (
                    <View style={styles.userMessageContainer}>
                      <View style={styles.userMessage}>
                        <Text style={styles.userMessageText} selectable>
                          {message.content}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.assistantMessageContainer}>
                      <View style={styles.assistantMessage}>
                        {message.imageUri && (
                          <Image 
                            source={{ uri: message.imageUri }} 
                            style={styles.messageImage}
                            resizeMode="contain"
                          />
                        )}
                        <Text style={styles.assistantMessageText} selectable>
                          {message.content}
                        </Text>
                        <TouchableOpacity
                          style={styles.speakButton}
                          onPress={() => speakText(message.content)}
                        >
                          <Volume2 size={14} color={isSpeaking ? '#DC2626' : '#6B7280'} />
                          <Text style={styles.speakButtonText}>
                            {isSpeaking ? 'Stop' : 'Speak'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {chatMutation.isPending && (
                <View style={styles.assistantMessageContainer}>
                  <View style={styles.assistantMessage}>
                    <ActivityIndicator size="small" color="#2563EB" />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputWrapper}>
              {(isTranscribing || isRecording) && (
                <View style={styles.recordingBanner}>
                  {isTranscribing ? (
                    <>
                      <ActivityIndicator size="small" color="#2563EB" />
                      <Text style={styles.recordingText}>Transcribing audio...</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingText}>Recording...</Text>
                    </>
                  )}
                </View>
              )}
              {attachedFiles.length > 0 && (
                <ScrollView
                  horizontal
                  style={styles.attachmentsContainer}
                  contentContainerStyle={styles.attachmentsContent}
                  showsHorizontalScrollIndicator={false}
                >
                  {attachedFiles.map((file, index) => (
                    <View key={index} style={styles.attachmentItem}>
                      {file.mimeType.startsWith('image/') ? (
                        <Image source={{ uri: file.uri }} style={styles.attachmentImage} />
                      ) : (
                        <View style={styles.attachmentFileIcon}>
                          <FileIcon size={24} color="#6B7280" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removeAttachment}
                        onPress={() => removeFile(index)}
                      >
                        <X size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {file.name}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setShowAttachMenu(true)}
                  disabled={chatMutation.isPending || isRecording}
                >
                  <Paperclip size={22} color="#6B7280" />
                </TouchableOpacity>
                {isRecording ? (
                  <TouchableOpacity
                    style={styles.recordingButton}
                    onPress={stopRecording}
                  >
                    <View style={styles.recordingIndicator}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingButtonText}>Tap to stop</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      value={input}
                      onChangeText={setInput}
                      placeholder="Ask me anything..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      maxLength={500}
                      editable={!chatMutation.isPending && !isTranscribing}
                    />
                    <TouchableOpacity
                      style={styles.micButton}
                      onPress={startRecording}
                      disabled={chatMutation.isPending || isTranscribing}
                    >
                      <Mic size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.sendButton, (chatMutation.isPending || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)) && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={chatMutation.isPending || isRecording || isTranscribing || (!input.trim() && attachedFiles.length === 0)}
                >
                  <Send size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showAttachMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity 
          style={styles.attachModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <TouchableOpacity 
            style={styles.attachMenu}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.attachMenuHandle} />
            
            <Text style={styles.attachMenuTitle}>Attach File</Text>
            
            <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#EF4444' }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#8B5CF6' }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Photo Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachOption} onPress={handlePickFile}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#3B82F6' }]}>
                <Paperclip size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Document / PDF</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.attachCancelButton}
              onPress={() => setShowAttachMenu(false)}
            >
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inlineContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  floatingButton: {
    position: 'absolute' as const,
    bottom: 90,
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#10A37F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 998,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    maxHeight: 700,
  },
  modalContentMobile: {
    height: '95%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  messageWrapper: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userMessage: {
    backgroundColor: '#10A37F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
  },
  userMessageText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  assistantMessage: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
  },
  assistantMessageText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20,
  },
  inputWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  attachmentsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  attachmentsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  attachmentItem: {
    position: 'relative' as const,
    width: 80,
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  attachmentFileIcon: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachment: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10A37F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  recordingButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  micButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignSelf: 'flex-start',
  },
  speakButtonText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  attachMenuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  attachMenuTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  attachIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  attachCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginTop: 8,
    alignItems: 'center',
  },
  attachCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
});
