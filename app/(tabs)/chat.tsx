import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, Modal, FlatList, useWindowDimensions, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Paperclip, Image as ImageIcon, Mic, Send, Play, X, Check, Bot, Sparkles, Trash2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import GlobalAIChat from '@/components/GlobalAIChatSimple';
import { getTipOfTheDay } from '@/constants/construction-tips';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { user, conversations, clients, addConversation, addMessageToConversation } = useApp();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [newChatSearch, setNewChatSearch] = useState<string>('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [dailyTipSent, setDailyTipSent] = useState<boolean>(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});

  // Function to clear AI chat history
  const handleClearAIChat = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to clear all AI chat history? This cannot be undone.')) {
        await clearAIChatHistory();
      }
    } else {
      Alert.alert('Clear AI Chat', 'Are you sure you want to clear all AI chat history? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => clearAIChatHistory() },
      ]);
    }
  };

  const clearAIChatHistory = async () => {
    if (!user?.id) return;

    try {
      console.log('[Chat] Clearing AI chat history...');

      const response = await fetch('/api/clear-chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (response.ok) {
        console.log('[Chat] ✅ AI chat history cleared');
        // Reload the page or refresh AI chat to show cleared state
        if (selectedChat === 'ai-assistant') {
          setSelectedChat(null);
          setTimeout(() => setSelectedChat('ai-assistant'), 100);
        }
      } else {
        console.error('[Chat] ❌ Failed to clear AI chat history');
        Alert.alert('Error', 'Failed to clear chat history');
      }
    } catch (error) {
      console.error('[Chat] Error clearing AI chat:', error);
      Alert.alert('Error', 'Failed to clear chat history');
    }
  };

  // Refs for web audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const selectedConversation = conversations.find(c => c.id === selectedChat);
  const messages = selectedConversation?.messages || [];

  // Helper function to get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Create a map of user IDs to user data for quick lookup
  const userMap = useMemo(() => {
    const map = new Map();

    // Add current user
    if (user) {
      map.set(user.id, { name: user.name, avatar: user.avatar });
    }

    // Add team members
    teamMembers.forEach(member => {
      map.set(member.id, { name: member.name, avatar: member.avatar });
    });

    return map;
  }, [user, teamMembers]);

  // Auto-scroll to bottom when messages change or chat is opened
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      // Small delay to ensure messages are rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, selectedChat]);

  // Fetch team members from database
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id || !user?.role) {
        console.log('[Chat] User not loaded yet, skipping team member fetch');
        return;
      }

      setIsLoadingMembers(true);
      try {
        console.log('[Chat] Fetching team members for user:', user.id, 'role:', user.role);

        const response = await fetch(
          `/api/team/get-members?userId=${user.id}&userRole=${user.role}`
        );

        const result = await response.json();

        if (result.success) {
          console.log('[Chat] Fetched', result.members.length, 'team members');
          setTeamMembers(result.members);
        } else {
          console.error('[Chat] Failed to fetch team members:', result.error);
          Alert.alert('Error', 'Failed to load team members');
        }
      } catch (error: any) {
        console.error('[Chat] Error fetching team members:', error);
        Alert.alert('Error', 'Failed to load team members: ' + error.message);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchTeamMembers();
  }, [user?.id, user?.role]);

  // Fetch conversations from database
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) {
        console.log('[Chat] User not loaded yet, skipping conversation fetch');
        return;
      }

      setIsLoadingConversations(true);
      try {
        console.log('[Chat] Fetching conversations for user:', user.id);

        const response = await fetch(
          `/api/team/get-conversations?userId=${user.id}`
        );

        const result = await response.json();

        if (result.success) {
          console.log('[Chat] Fetched', result.conversations.length, 'conversations');

          // Transform and add each conversation to context
          result.conversations.forEach((conv: any) => {
            // Check if conversation already exists in local context
            const existingConv = conversations.find(c => c.id === conv.id);

            if (!existingConv) {
              const localConversation = {
                id: conv.id,
                name: conv.name,
                type: conv.type as 'individual' | 'group',
                participants: conv.participants.map((p: any) => p.id),
                messages: [], // Messages will be fetched when conversation is opened
                createdAt: conv.createdAt,
                avatar: conv.avatar,
              };

              addConversation(localConversation);
            }
          });
        } else {
          console.error('[Chat] Failed to fetch conversations:', result.error);
        }
      } catch (error: any) {
        console.error('[Chat] Error fetching conversations:', error);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [user?.id]);

  // Fetch messages when a team conversation is selected and poll for new messages
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat || !user?.id || selectedChat === 'ai-assistant') {
        return;
      }

      const conversation = conversations.find(c => c.id === selectedChat);
      if (!conversation || (conversation.type !== 'individual' && conversation.type !== 'group')) {
        return; // Not a team chat
      }

      try {
        console.log('[Chat] Fetching messages for conversation:', selectedChat);

        const response = await fetch(
          `/api/team/get-messages?conversationId=${selectedChat}&userId=${user.id}`
        );

        const result = await response.json();

        if (result.success) {
          console.log('[Chat] Fetched', result.messages.length, 'messages');

          // Get existing message IDs to avoid duplicates
          const existingMessageIds = new Set((conversation.messages || []).map(m => m.id));

          // Only add new messages that don't exist yet
          result.messages.forEach((msg: any) => {
            if (!existingMessageIds.has(msg.id)) {
              const chatMessage: ChatMessage = {
                id: msg.id,
                senderId: msg.senderId,
                type: msg.type,
                content: msg.content,
                text: msg.text,
                fileName: msg.fileName,
                fileUrl: msg.fileUrl,
                duration: msg.duration,
                timestamp: msg.timestamp,
              };

              addMessageToConversation(selectedChat, chatMessage);
            }
          });
        } else {
          console.error('[Chat] Failed to fetch messages:', result.error);
        }
      } catch (error: any) {
        console.error('[Chat] Error fetching messages:', error);
      }
    };

    // Initial fetch
    fetchMessages();

    // Poll for new messages every 5 seconds
    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 5000);

    // Cleanup interval on unmount or when selectedChat changes
    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedChat, user?.id]);

  const allPeople = useMemo(() => {
    return teamMembers.map(member => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      type: 'employee' as const,
      email: member.email,
      role: member.role,
    }));
  }, [teamMembers]);

  const filteredPeople = useMemo(() => {
    if (!newChatSearch) return allPeople;
    const query = newChatSearch.toLowerCase();
    return allPeople.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.email.toLowerCase().includes(query)
    );
  }, [allPeople, newChatSearch]);

  const handleToggleParticipant = (personId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId);
      }
      return [...prev, personId];
    });
  };

  const handleCreateChat = async () => {
    if (selectedParticipants.length === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    try {
      const participantNames = allPeople
        .filter(p => selectedParticipants.includes(p.id))
        .map(p => p.name);

      const chatName = selectedParticipants.length === 1
        ? participantNames[0]
        : participantNames.join(', ');

      console.log('[Chat] Creating conversation with participants:', selectedParticipants);

      // Call API to create or find existing conversation
      const response = await fetch('/api/team/create-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createdBy: user.id,
          participantIds: selectedParticipants,
          name: selectedParticipants.length > 1 ? chatName : null, // Only set name for group chats
          type: selectedParticipants.length === 1 ? 'individual' : 'group',
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('[Chat] Failed to create conversation:', result.error);
        Alert.alert('Error', 'Failed to create conversation');
        return;
      }

      const dbConversation = result.conversation;

      if (result.existed) {
        console.log('[Chat] Found existing conversation:', dbConversation.id);
      } else {
        console.log('[Chat] Created new conversation:', dbConversation.id);
      }

      // Check if conversation already exists in local context
      const existingLocalConv = conversations.find(c => c.id === dbConversation.id);

      if (!existingLocalConv) {
        // Add to local context if not already there
        const localConversation = {
          id: dbConversation.id,
          name: chatName,
          type: dbConversation.type as 'individual' | 'group',
          participants: [user.id, ...selectedParticipants],
          messages: [],
          createdAt: dbConversation.created_at,
          avatar: selectedParticipants.length === 1
            ? allPeople.find(p => p.id === selectedParticipants[0])?.avatar
            : undefined,
        };

        addConversation(localConversation);
      }

      // Select the conversation (existing or new)
      setSelectedChat(dbConversation.id);
      setShowNewChatModal(false);
      setSelectedParticipants([]);
      setNewChatSearch('');

    } catch (error: any) {
      console.error('[Chat] Error creating conversation:', error);
      Alert.alert('Error', 'Failed to create conversation: ' + error.message);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
        // Resize to max 1920x1080 to reduce file size
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
    setShowAttachMenu(false);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        // Resize to max 1920x1080 to reduce file size
        maxWidth: 1920,
        maxHeight: 1920,
      });

      if (!result.canceled && result.assets[0]) {
        setPreviewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
    setShowAttachMenu(false);
  };

  const handleSendImage = async () => {
    if (!previewImage || !selectedChat) return;

    setIsUploadingImage(true);
    try {
      const conversation = conversations.find(c => c.id === selectedChat);
      const isTeamChat = selectedChat !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

      if (isTeamChat) {
        // Team chat: Upload to S3 using presigned URL
        console.log('[Chat] Uploading image to S3...');

        // Get file blob
        let blob: Blob;
        let fileExtension = 'jpg';
        let contentType = 'image/jpeg';

        if (Platform.OS === 'web') {
          const response = await fetch(previewImage);
          blob = await response.blob();
          contentType = blob.type || 'image/jpeg';
          fileExtension = contentType.split('/')[1] || 'jpg';
        } else {
          // Mobile: Read file and create blob
          const base64 = await FileSystem.readAsStringAsync(previewImage, {
            encoding: FileSystem.EncodingType.Base64,
          });
          fileExtension = previewImage.split('.').pop() || 'jpg';
          contentType = `image/${fileExtension}`;

          // Convert base64 to blob
          const byteCharacters = atob(base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: contentType });
        }

        // Get presigned URL
        const urlResponse = await fetch('/api/get-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            fileName: `image.${fileExtension}`,
            fileType: contentType,
          }),
        });

        const urlResult = await urlResponse.json();

        if (!urlResult.success) {
          throw new Error(urlResult.error || 'Failed to get upload URL');
        }

        // Upload directly to S3
        const uploadResponse = await fetch(urlResult.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: {
            'Content-Type': contentType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload to S3');
        }

        console.log('[Chat] Image uploaded to S3:', urlResult.publicUrl);

        // Send message via API
        const messageResponse = await fetch('/api/team/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedChat,
            senderId: user?.id,
            type: 'image',
            content: urlResult.publicUrl,
          }),
        });

        const result = await messageResponse.json();

        if (result.success) {
          const newMessage: ChatMessage = {
            id: result.message.id,
            senderId: user?.id || '1',
            type: 'image',
            content: urlResult.publicUrl,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          addMessageToConversation(selectedChat, newMessage);
        } else {
          Alert.alert('Error', 'Failed to send image');
        }
      } else {
        // AI assistant or local chat - use local URI
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderId: user?.id || '1',
          type: 'image',
          content: previewImage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        addMessageToConversation(selectedChat, newMessage);
      }

      setPreviewImage(null);
    } catch (error: any) {
      console.error('[Chat] Error sending image:', error);
      Alert.alert('Error', 'Failed to send image: ' + error.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePickDocument = async () => {
    if (!selectedChat) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const conversation = conversations.find(c => c.id === selectedChat);
        const isTeamChat = selectedChat !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

        if (isTeamChat) {
          // Team chat: Upload to S3 using presigned URL
          console.log('[Chat] Uploading document to S3...');

          // Get file blob
          let blob: Blob;
          const fileName = result.assets[0].name;
          const mimeType = result.assets[0].mimeType || 'application/octet-stream';

          if (Platform.OS === 'web') {
            const response = await fetch(result.assets[0].uri);
            blob = await response.blob();
          } else {
            // Mobile: Read file and create blob
            const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Convert base64 to blob
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: mimeType });
          }

          // Get presigned URL
          const urlResponse = await fetch('/api/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user?.id,
              fileName: fileName,
              fileType: mimeType,
            }),
          });

          const urlResult = await urlResponse.json();

          if (!urlResult.success) {
            throw new Error(urlResult.error || 'Failed to get upload URL');
          }

          // Upload directly to S3
          const uploadResponse = await fetch(urlResult.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
              'Content-Type': mimeType,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload to S3');
          }

          console.log('[Chat] Document uploaded to S3:', urlResult.publicUrl);

          // Send message via API
          const messageResponse = await fetch('/api/team/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: selectedChat,
              senderId: user?.id,
              type: 'file',
              content: urlResult.publicUrl,
              fileName: fileName,
            }),
          });

          const messageResult = await messageResponse.json();

          if (messageResult.success) {
            const newMessage: ChatMessage = {
              id: messageResult.message.id,
              senderId: user?.id || '1',
              type: 'file',
              fileName: fileName,
              content: urlResult.publicUrl,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            addMessageToConversation(selectedChat, newMessage);
            Alert.alert('Success', `${fileName} sent`);
          } else {
            Alert.alert('Error', 'Failed to send document');
          }
        } else {
          // AI assistant or local chat
          const newMessage: ChatMessage = {
            id: Date.now().toString(),
            senderId: user?.id || '1',
            type: 'file',
            fileName: result.assets[0].name,
            content: result.assets[0].uri,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          addMessageToConversation(selectedChat, newMessage);
          Alert.alert('Document Sent', `${result.assets[0].name} sent to chat`);
        }
      }
    } catch (error: any) {
      console.error('Error with document:', error);
      Alert.alert('Error', error.message || 'Failed to send document');
    }
    setShowAttachMenu(false);
  };

  const startRecording = async () => {
    try {
      console.log('[Voice] Starting recording...');
      recordingStartTimeRef.current = Date.now(); // Record start time

      if (Platform.OS === 'web') {
        // Web recording using MediaRecorder API
        let stream = streamRef.current;
        if (!stream || stream.getTracks().length === 0 || stream.getTracks()[0].readyState !== 'live') {
          console.log('[Voice] Getting new media stream');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
        } else {
          console.log('[Voice] Reusing existing media stream');
        }

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
        // Mobile recording using expo-av
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Microphone permission is needed');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (!selectedChat) return;

    // Check if recording on web or mobile
    const isWebRecording = Platform.OS === 'web' && mediaRecorderRef.current;
    const isMobileRecording = recording;

    if (!isWebRecording && !isMobileRecording) return;

    // Calculate recording duration
    const durationInSeconds = recordingStartTimeRef.current
      ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
      : 0;
    console.log('[Voice] Recording duration:', durationInSeconds, 'seconds');

    try {
      setIsRecording(false);
      let audioBlob: Blob | null = null;
      let uri: string | null = null;

      // Handle web recording
      if (Platform.OS === 'web' && mediaRecorderRef.current) {
        const mediaRecorder = mediaRecorderRef.current;

        // Stop the recorder and wait for final data
        await new Promise<void>((resolve) => {
          mediaRecorder.onstop = () => resolve();
          mediaRecorder.stop();
        });

        // Create blob from recorded chunks
        audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('[Voice] Web recording stopped, blob size:', audioBlob.size);

        // Stop media stream to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            console.log('[Voice] Stopping track:', track.kind);
            track.stop();
          });
          streamRef.current = null;
        }

        mediaRecorderRef.current = null;
      }
      // Handle mobile recording
      else if (recording) {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        uri = recording.getURI();

        if (!uri) {
          Alert.alert('Error', 'Failed to get recording');
          setRecording(null);
          return;
        }

        setRecording(null);
      }

      // Check if this is a team chat (not AI assistant)
      const conversation = conversations.find(c => c.id === selectedChat);
      const isTeamChat = selectedChat !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

      if (isTeamChat) {
        // Team chat: Upload to S3 and send via API
        console.log('[Voice] Uploading voice message to S3...');

        try {
          let base64Audio: string;

          // Convert to base64
          if (audioBlob) {
            // Web: Convert blob to base64
            base64Audio = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
            });
          } else if (uri) {
            // Mobile: Read file as base64
            base64Audio = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } else {
            throw new Error('No audio data available');
          }

          // Upload to S3
          const uploadResponse = await fetch('/api/upload-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: `data:audio/${audioBlob ? 'webm' : 'm4a'};base64,${base64Audio}`,
              userId: user?.id,
              fileName: `voice-message.${audioBlob ? 'webm' : 'm4a'}`,
            }),
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Failed to upload audio');
          }

          console.log('[Voice] Audio uploaded to S3:', uploadResult.url);

          // Send message via API
          const messageResponse = await fetch('/api/team/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: selectedChat,
              senderId: user?.id,
              type: 'voice',
              content: uploadResult.url,
              duration: durationInSeconds,
            }),
          });

          const messageResult = await messageResponse.json();

          if (!messageResult.success) {
            throw new Error(messageResult.error || 'Failed to send voice message');
          }

          console.log('[Voice] Voice message sent successfully');

          // Add message to local state
          const newMessage: ChatMessage = {
            id: messageResult.message.id,
            senderId: user?.id || '1',
            type: 'voice',
            content: uploadResult.url,
            duration: durationInSeconds,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          addMessageToConversation(selectedChat, newMessage);
        } catch (error: any) {
          console.error('[Voice] Error sending voice message:', error);
          Alert.alert('Error', 'Failed to send voice message: ' + error.message);
        }
      } else {
        // Local conversation (AI assistant or existing local chat)
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderId: user?.id || '1',
          type: 'voice',
          content: uri || URL.createObjectURL(audioBlob!),
          duration: durationInSeconds,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        addMessageToConversation(selectedChat, newMessage);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
      setRecording(null);
      mediaRecorderRef.current = null;
    }
  };

  const cancelRecording = async () => {
    console.log('[Voice] Canceling recording...');

    try {
      setIsRecording(false);

      // Handle web recording cancellation
      if (Platform.OS === 'web' && mediaRecorderRef.current) {
        console.log('[Voice] Stopping web recording');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        // Stop media stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      }
      // Handle mobile recording cancellation
      else if (recording) {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        setRecording(null);
      }

      console.log('[Voice] Recording canceled');
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  const handleSendMessage = async () => {
    if (messageText.trim() && selectedChat) {
      const conversation = conversations.find(c => c.id === selectedChat);
      const isTeamChat = selectedChat !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

      if (isTeamChat) {
        // Team chat: Send via API
        try {
          const response = await fetch('/api/team/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: selectedChat,
              senderId: user?.id,
              type: 'text',
              content: messageText,
            }),
          });

          const result = await response.json();

          if (result.success) {
            const newMessage: ChatMessage = {
              id: result.message.id,
              senderId: user?.id || '1',
              text: messageText,
              content: messageText,
              type: 'text',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            addMessageToConversation(selectedChat, newMessage);
            setMessageText('');
          } else {
            Alert.alert('Error', 'Failed to send message');
          }
        } catch (error: any) {
          console.error('[Chat] Error sending message:', error);
          Alert.alert('Error', 'Failed to send message: ' + error.message);
        }
      } else {
        // AI assistant or local chat
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderId: user?.id || '1',
          text: messageText,
          type: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        addMessageToConversation(selectedChat, newMessage);
        setMessageText('');
      }
    }
  };


  useEffect(() => {
    const checkAndSendDailyTip = async () => {
      if (selectedChat !== 'ai-assistant') return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const lastTipDate = await AsyncStorage.getItem('lastDailyTipDate_chat');
        
        console.log('[Daily Tip Chat] Checking daily tip - today:', today, 'lastTipDate:', lastTipDate, 'dailyTipSent:', dailyTipSent);
        
        if (lastTipDate !== today && !dailyTipSent) {
          console.log('[Daily Tip Chat] Sending daily construction tip');
          const tip = getTipOfTheDay();
          const tipMessage: ChatMessage = {
            id: `daily-tip-${Date.now()}`,
            senderId: 'ai-assistant',
            type: 'text',
            text: `🏗️ **Daily Construction Tip** (${tip.category})\n\n${tip.tip}\n\n💡 Have questions about this or need help with your project? I'm here to help!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          
          setTimeout(() => {
            console.log('[Daily Tip Chat] Adding tip message to conversation');
            addMessageToConversation('ai-assistant', tipMessage);
          }, 800);
          
          await AsyncStorage.setItem('lastDailyTipDate_chat', today);
          setDailyTipSent(true);
          console.log('[Daily Tip Chat] Daily tip sent successfully');
        } else {
          console.log('[Daily Tip Chat] Daily tip already sent or conditions not met');
        }
      } catch (error) {
        console.error('[Daily Tip] Error sending daily tip:', error);
      }
    };

    checkAndSendDailyTip();
  }, [selectedChat, dailyTipSent, addMessageToConversation]);



  const handlePasteText = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setMessageText(prev => prev + text);
      }
    } catch (error) {
      console.error('Failed to paste text:', error);
      Alert.alert('Error', 'Failed to paste text');
    }
  };

  const handleCopyImage = async (imageUri: string | undefined) => {
    if (!imageUri) return;
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Info', 'Image copied to clipboard. On web, you can right-click the image to copy.');
      } else {
        await Clipboard.setImageAsync(imageUri);
        Alert.alert('Success', 'Image copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy image:', error);
      Alert.alert('Error', 'Failed to copy image');
    }
  };



  const playAudio = async (messageId: string, audioUrl: string, duration: number) => {
    try {
      // If already playing this audio, pause it
      if (playingAudioId === messageId) {
        console.log('[Audio] Pausing audio:', messageId);

        // Pause web audio (don't reset position)
        if (webAudioRef.current) {
          webAudioRef.current.pause();
        }

        // Pause mobile audio
        if (audioPlayerRef.current) {
          await audioPlayerRef.current.pauseAsync();
        }

        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      if (playingAudioId && playingAudioId !== messageId) {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          webAudioRef.current.currentTime = 0;
          webAudioRef.current = null;
        }

        if (audioPlayerRef.current) {
          await audioPlayerRef.current.stopAsync();
          await audioPlayerRef.current.unloadAsync();
          audioPlayerRef.current = null;
        }
        setAudioProgress(prev => ({ ...prev, [playingAudioId]: 0 }));
      }

      console.log('[Audio] Playing audio:', audioUrl);

      // For web, use HTML5 Audio
      if (Platform.OS === 'web') {
        let audio = webAudioRef.current;

        // Create new audio if doesn't exist or different audio
        if (!audio || audio.src !== audioUrl) {
          audio = new window.Audio(audioUrl);
          webAudioRef.current = audio;

          audio.onended = () => {
            setPlayingAudioId(null);
            setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
          };

          audio.onerror = (error) => {
            console.error('[Audio] Error playing audio:', error);
            Alert.alert('Error', 'Failed to play audio');
            setPlayingAudioId(null);
            webAudioRef.current = null;
          };

          // Update progress as audio plays
          audio.ontimeupdate = () => {
            if (audio && duration > 0) {
              const progress = (audio.currentTime / duration) * 100;
              setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
            }
          };
        }

        await audio.play();
        setPlayingAudioId(messageId);
      } else {
        // For mobile, use expo-av
        let sound = audioPlayerRef.current;

        if (!sound) {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true }
          );
          sound = newSound;
          audioPlayerRef.current = sound;

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              if (status.didJustFinish) {
                setPlayingAudioId(null);
                setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
                sound?.unloadAsync();
              } else if (status.durationMillis) {
                const progress = (status.positionMillis / status.durationMillis) * 100;
                setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
              }
            }
          });
        } else {
          await sound.playAsync();
        }

        setPlayingAudioId(messageId);
      }
    } catch (error) {
      console.error('[Audio] Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio message');
      setPlayingAudioId(null);
    }
  };

  const renderMessageContent = (message: ChatMessage) => {
    switch (message.type) {
      case 'text':
        const isTipMessage = message.id?.includes('daily-tip');
        return (
          <Text 
            style={[
              styles.messageText, 
              message.senderId === user?.id && styles.messageTextOwn,
              isTipMessage && styles.dailyTipText
            ]}
            selectable
          >
            {message.text}
          </Text>
        );
      
      case 'voice':
        const isPlaying = playingAudioId === message.id;
        const duration = message.duration || 0;
        const progress = audioProgress[message.id] || 0;
        const currentTime = Math.floor((duration * progress) / 100);

        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = currentTime % 60;
        const totalMinutes = Math.floor(duration / 60);
        const totalSeconds = duration % 60;

        const formattedCurrent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
        const formattedTotal = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
        const displayTime = isPlaying || progress > 0 ? formattedCurrent : formattedTotal;

        return (
          <View style={styles.voiceMessage}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => playAudio(message.id, message.content || '', duration)}
            >
              {isPlaying ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </TouchableOpacity>
            <View style={styles.voiceWaveformContainer}>
              <View style={styles.voiceWaveform}>
                {[12, 20, 14, 18, 12, 16, 10, 18, 14, 20].map((height, index) => (
                  <View
                    key={index}
                    style={[
                      styles.waveformBar,
                      { height },
                      (index / 10) * 100 <= progress && styles.waveformBarActive,
                    ]}
                  />
                ))}
              </View>
              {progress > 0 && (
                <View style={[styles.progressOverlay, { width: `${progress}%` }]} />
              )}
            </View>
            <Text style={[styles.voiceDuration, message.senderId === user?.id && styles.voiceDurationOwn]}>
              {displayTime}
            </Text>
          </View>
        );
      
      case 'image':
        return (
          <TouchableOpacity 
            onPress={() => setSelectedImage(message.content || null)}
            onLongPress={() => handleCopyImage(message.content)}
          >
            <Image
              source={{ uri: message.content }}
              style={styles.messageImage}
              contentFit="cover"
            />
          </TouchableOpacity>
        );

      case 'file':
        return (
          <View style={styles.fileMessage}>
            <Paperclip size={16} color={message.senderId === user?.id ? '#1F2937' : '#FFFFFF'} />
            <Text style={[styles.fileName, message.senderId === user?.id && styles.fileNameOwn]}>{message.fileName}</Text>
          </View>
        );
      
      default:
        return null;
    }
  };

  const individualChats = conversations.filter(c => c.type === 'individual');
  const groupChats = conversations.filter(c => c.type === 'group');

  return (
    <View style={styles.container}>
      {!isSmallScreen && <View style={styles.header}>
        <View style={styles.userInfo}>
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.userAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.userAvatarInitials}>{user ? getInitials(user.name) : 'JD'}</Text>
            </View>
          )}
          <Text style={styles.userName}>{user?.name || 'John Doe'}</Text>
        </View>
        <View style={styles.teamInfo}>
          <Users size={20} color="#1F2937" />
          <Text style={styles.teamName}>Team Alpha</Text>
        </View>
      </View>}

      {isSmallScreen && selectedChat && (
        <View style={styles.mobileHeader}>
          <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.chatTitle}>{selectedConversation?.name}</Text>
        </View>
      )}

      <View style={styles.content}>
        {(!isSmallScreen || !selectedChat) && <View style={[styles.sidebar, isSmallScreen && styles.sidebarMobile]}>
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={() => setShowNewChatModal(true)}
          >
            <Text style={styles.newChatButtonText}>Start New Chat</Text>
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <Search size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.contactsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('chat.title')}</Text>
                <TouchableOpacity onPress={handleClearAIChat} style={styles.clearChatIconButton}>
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.aiChatItem, selectedChat === 'ai-assistant' && styles.contactItemActive]}
                onPress={() => {
                  setSelectedChat('ai-assistant');
                }}
              >
                <View style={styles.aiAvatarContainer}>
                  <Bot size={20} color="#2563EB" strokeWidth={2.5} />
                </View>
                <View style={styles.aiChatInfo}>
                  <Text style={styles.aiChatName}>AI Assistant</Text>
                  <Text style={styles.aiChatDescription}>{t('chat.typeMessage')}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {individualChats.length > 0 && (
              <View style={styles.contactsSection}>
                <Text style={styles.sectionTitle}>Direct Messages</Text>
                {individualChats
                  .filter(conv => !searchQuery || conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((conv) => (
                    <TouchableOpacity
                      key={conv.id}
                      style={[styles.contactItem, selectedChat === conv.id && styles.contactItemActive]}
                      onPress={() => setSelectedChat(conv.id)}
                    >
                      {conv.avatar ? (
                        <Image
                          source={{ uri: conv.avatar }}
                          style={styles.contactAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.contactAvatarPlaceholder}>
                          <Text style={styles.contactAvatarInitials}>{getInitials(conv.name)}</Text>
                        </View>
                      )}
                      <Text style={styles.contactName}>{conv.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {groupChats.length > 0 && (
              <View style={styles.groupsSection}>
                <Text style={styles.sectionTitle}>Groups</Text>
                {groupChats
                  .filter(conv => !searchQuery || conv.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((group) => (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupItem, selectedChat === group.id && styles.groupItemActive]}
                      onPress={() => setSelectedChat(group.id)}
                    >
                      <Users size={20} color="#2563EB" />
                      <Text style={styles.groupName}>{group.name}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {conversations.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No conversations yet</Text>
                <Text style={styles.emptyStateSubtext}>Start a new chat to get started</Text>
              </View>
            )}
          </ScrollView>
        </View>}

        {(!isSmallScreen || selectedChat) && <View style={[styles.chatArea, isSmallScreen && styles.chatAreaMobile]}>
          {selectedChat === 'ai-assistant' ? (
            <View style={styles.aiChatContainer}>
              {!isSmallScreen && <View style={styles.chatHeader}>
                <View style={styles.aiHeaderInfo}>
                  <View style={styles.aiAvatarContainer}>
                    <Bot size={20} color="#2563EB" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.chatTitle}>AI Assistant</Text>
                </View>
              </View>}
              <GlobalAIChat inline />
            </View>
          ) : selectedChat ? (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? (isSmallScreen ? 150 : 90) : 0}
            >
              {!isSmallScreen && <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>{selectedConversation?.name}</Text>
              </View>}

              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((message) => {
                  const senderData = userMap.get(message.senderId);
                  const senderName = message.senderId === user?.id ? user.name : (senderData?.name || selectedConversation?.name || 'User');
                  const senderAvatar = message.senderId === user?.id ? user?.avatar : (senderData?.avatar || selectedConversation?.avatar);

                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.messageRow,
                        message.senderId === user?.id ? styles.messageRowRight : styles.messageRowLeft,
                      ]}
                    >
                      {message.senderId !== user?.id && (
                        senderAvatar ? (
                          <Image
                            source={{ uri: senderAvatar }}
                            style={styles.messageAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.messageAvatarPlaceholder}>
                            <Text style={styles.messageAvatarInitials}>{getInitials(senderName)}</Text>
                          </View>
                        )
                      )}
                      <View
                        style={[
                          styles.messageBubble,
                          message.senderId === user?.id ? styles.messageBubbleRight : styles.messageBubbleLeft,
                          message.id?.includes('daily-tip') && styles.dailyTipBubble,
                        ]}
                      >
                        {renderMessageContent(message)}
                        <Text
                          style={[
                            styles.messageTimestamp,
                            message.senderId === user?.id && styles.messageTimestampOwn,
                          ]}
                        >
                          {message.timestamp}
                        </Text>
                      </View>
                      {message.senderId === user?.id && (
                        user?.avatar ? (
                          <Image
                            source={{ uri: user.avatar }}
                            style={styles.messageAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.messageAvatarPlaceholder}>
                            <Text style={styles.messageAvatarInitials}>{getInitials(user.name)}</Text>
                          </View>
                        )
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {isRecording ? (
                <View style={styles.recordingContainer}>
                  <TouchableOpacity
                    style={styles.cancelRecordButton}
                    onPress={() => {
                      console.log('[Chat] Cancel button clicked');
                      cancelRecording();
                    }}
                  >
                    <X size={24} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stopRecordButton}
                    onPress={() => {
                      console.log('[Chat] Send/Stop recording button clicked');
                      stopRecording();
                    }}
                  >
                    <Send size={24} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    style={styles.attachButton}
                    onPress={() => setShowAttachMenu(true)}
                  >
                    <Paperclip size={20} color="#6B7280" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.messageInput}
    placeholder={t('chat.typeMessage')}
                    placeholderTextColor="#9CA3AF"
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                  />
                  {messageText.trim() ? (
                    <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                      <Send size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.voiceButton}
                      onPress={() => {
                        console.log('[Chat] Mic button clicked');
                        startRecording();
                      }}
                    >
                      <Mic size={20} color="#2563EB" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </KeyboardAvoidingView>
          ) : (
            <View style={styles.noChatSelected}>
              <Users size={64} color="#D1D5DB" />
              <Text style={styles.noChatText}>{t('chat.title')}</Text>
              <Text style={styles.noChatSubtext}>{t('chat.noMessages')}</Text>
            </View>
          )}
        </View>}
      </View>

      <Modal
        visible={showNewChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.newChatModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chat.title')}</Text>
              <TouchableOpacity onPress={() => {
                setShowNewChatModal(false);
                setSelectedParticipants([]);
                setNewChatSearch('');
              }}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
placeholder={t('common.search')}
                placeholderTextColor="#9CA3AF"
                value={newChatSearch}
                onChangeText={setNewChatSearch}
              />
            </View>

            {selectedParticipants.length > 0 && (
              <View style={styles.selectedCount}>
                <Text style={styles.selectedCountText}>
                  {selectedParticipants.length} selected
                </Text>
              </View>
            )}

            <FlatList
              data={filteredPeople}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={({ item }) => {
                const isSelected = selectedParticipants.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.personItem, isSelected && styles.personItemSelected]}
                    onPress={() => handleToggleParticipant(item.id)}
                  >
                    <View style={styles.personInfo}>
                      {item.avatar ? (
                        <Image
                          source={{ uri: item.avatar }}
                          style={styles.personAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.personAvatarPlaceholder}>
                          <Text style={styles.personAvatarInitials}>{getInitials(item.name)}</Text>
                        </View>
                      )}
                      <View style={styles.personDetails}>
                        <Text style={styles.personName}>{item.name}</Text>
                        <Text style={styles.personType}>
                          {item.role === 'admin' ? 'Admin' : 'Employee'}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Check size={20} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyState}>
                  {isLoadingMembers ? (
                    <>
                      <ActivityIndicator size="large" color="#2563EB" />
                      <Text style={styles.emptyStateText}>Loading team members...</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyStateText}>
                      {teamMembers.length === 0
                        ? 'No team members found. Please add team members to the database.'
                        : 'No results found'}
                    </Text>
                  )}
                </View>
              )}
            />

            <TouchableOpacity
              style={[styles.createChatButton, selectedParticipants.length === 0 && styles.createChatButtonDisabled]}
              onPress={handleCreateChat}
              disabled={selectedParticipants.length === 0}
            >
              <Text style={styles.createChatButtonText}>
                {selectedParticipants.length === 1 ? 'Start Direct Chat' : `Create Group (${selectedParticipants.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity 
          style={styles.attachModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View style={styles.attachMenu}>
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
            
            <TouchableOpacity style={styles.attachOption} onPress={handlePickDocument}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#3B82F6' }]}>
                <Paperclip size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Document</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <TouchableOpacity 
          style={styles.imageModalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          <TouchableOpacity style={styles.closeImageButton} onPress={() => setSelectedImage(null)}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Send Image</Text>
              <TouchableOpacity onPress={() => setPreviewImage(null)}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {previewImage && (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewImage}
                contentFit="contain"
              />
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewCancelButton}
                onPress={() => setPreviewImage(null)}
                disabled={isUploadingImage}
              >
                <Text style={styles.previewCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewSendButton}
                onPress={handleSendImage}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={20} color="#FFFFFF" />
                    <Text style={styles.previewSendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    fontSize: 14,
    color: '#1F2937',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    padding: 16,
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    flex: 1,
  },
  newChatButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  contactsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  clearChatIconButton: {
    padding: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  contactItemActive: {
    backgroundColor: '#EFF6FF',
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  contactAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  contactName: {
    fontSize: 14,
    color: '#1F2937',
  },
  groupsSection: {
    marginBottom: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  groupItemActive: {
    backgroundColor: '#EFF6FF',
  },
  groupName: {
    fontSize: 14,
    color: '#1F2937',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  chatAreaMobile: {
    width: '100%',
    position: 'absolute' as const,
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  messageBubbleLeft: {
    backgroundColor: '#2563EB',
  },
  messageBubbleRight: {
    backgroundColor: '#E5E7EB',
  },
  messageTimestamp: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimestampOwn: {
    color: '#9CA3AF',
  },
  messageText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  messageTextOwn: {
    color: '#1F2937',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 180,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  pauseBar: {
    width: 3,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  voiceWaveformContainer: {
    flex: 1,
    position: 'relative',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveformBar: {
    width: 3,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  waveformBarActive: {
    backgroundColor: '#FFFFFF',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'transparent',
  },
  voiceDuration: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  voiceDurationOwn: {
    color: '#6B7280',
  },
  fileMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  fileNameOwn: {
    color: '#1F2937',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
    alignItems: 'center',
  },
  attachButton: {
    padding: 8,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2563EB',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FEF2F2',
  },
  cancelRecordButton: {
    padding: 8,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600' as const,
  },
  stopRecordButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  newChatModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  selectedCount: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedCountText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  personItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  personItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  personAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  personDetails: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1F2937',
  },
  personType: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createChatButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  createChatButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  createChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  attachModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 99999,
  },
  attachMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
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
    fontWeight: '500' as const,
    color: '#1F2937',
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: '90%',
    height: '80%',
  },
  noChatSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noChatText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#1F2937',
    marginTop: 16,
  },
  noChatSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  dailyTipBubble: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  dailyTipText: {
    color: '#78350F',
    fontWeight: '600' as const,
  },

  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  aiChatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#DBEAFE',
  },
  aiAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  aiChatInfo: {
    flex: 1,
  },
  aiChatName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1F2937',
    marginBottom: 2,
  },
  aiChatDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  aiSparkle: {
    padding: 4,
  },
  aiChatContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  aiHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1F2937',
  },
  previewImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#F3F4F6',
  },
  previewActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  previewCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  previewCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  previewSendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  previewSendText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
