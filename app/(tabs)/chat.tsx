import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, Modal, FlatList, useWindowDimensions, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Search, Paperclip, Image as ImageIcon, Mic, Send, Play, X, Check, Bot, Sparkles } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import GlobalAIChat from '@/components/GlobalAIChatSimple';
import ImageAnnotation from '@/components/ImageAnnotation';
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

  const [pendingAnnotation, setPendingAnnotation] = useState<string | null>(null);
  const [dailyTipSent, setDailyTipSent] = useState<boolean>(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);


  const selectedConversation = conversations.find(c => c.id === selectedChat);
  const messages = selectedConversation?.messages || [];

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

  const handleCreateChat = () => {
    if (selectedParticipants.length === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }

    const participantNames = allPeople
      .filter(p => selectedParticipants.includes(p.id))
      .map(p => p.name);

    const chatName = selectedParticipants.length === 1 
      ? participantNames[0]
      : participantNames.join(', ');

    const newConversation = {
      id: Date.now().toString(),
      name: chatName,
      type: selectedParticipants.length === 1 ? 'individual' as const : 'group' as const,
      participants: [user?.id || '1', ...selectedParticipants],
      messages: [],
      createdAt: new Date().toISOString(),
      avatar: selectedParticipants.length === 1 
        ? allPeople.find(p => p.id === selectedParticipants[0])?.avatar 
        : undefined,
    };

    addConversation(newConversation);
    setSelectedChat(newConversation.id);
    setShowNewChatModal(false);
    setSelectedParticipants([]);
    setNewChatSearch('');
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        setPendingAnnotation(result.assets[0].uri);
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
        quality: 0.8,
      });

      if (!result.canceled) {
        setPendingAnnotation(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
    setShowAttachMenu(false);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && selectedChat) {
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
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
    setShowAttachMenu(false);
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Voice recording is not available on web');
      return;
    }

    try {
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
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording || !selectedChat) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }
      const uri = recording.getURI();
      
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: user?.id || '1',
        type: 'voice',
        content: uri || '',
        duration: 15,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addMessageToConversation(selectedChat, newMessage);
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      }
      setRecording(null);
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() && selectedChat) {
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
  };

  const handleSaveAnnotation = (uri: string) => {
    if (selectedChat) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: user?.id || '1',
        type: 'image',
        content: uri,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      addMessageToConversation(selectedChat, newMessage);
    }
    setPendingAnnotation(null);
  };

  const handleCancelAnnotation = () => {
    setPendingAnnotation(null);
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
        return (
          <View style={styles.voiceMessage}>
            <TouchableOpacity style={styles.playButton}>
              <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.voiceWaveform}>
              <View style={styles.waveformBar} />
              <View style={[styles.waveformBar, { height: 20 }]} />
              <View style={[styles.waveformBar, { height: 14 }]} />
              <View style={[styles.waveformBar, { height: 18 }]} />
              <View style={styles.waveformBar} />
              <View style={[styles.waveformBar, { height: 16 }]} />
            </View>
            <Text style={[styles.voiceDuration, message.senderId === user?.id && styles.voiceDurationOwn]}>0:{message.duration}s</Text>
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
          <Image 
            source={{ uri: user?.avatar || 'https://i.pravatar.cc/150?img=12' }} 
            style={styles.userAvatar}
            contentFit="cover"
          />
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
              <Text style={styles.sectionTitle}>{t('chat.title')}</Text>
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
                <View style={styles.aiSparkle}>
                  <Sparkles size={16} color="#8B5CF6" />
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
                      <Image 
                        source={{ uri: conv.avatar || 'https://i.pravatar.cc/150?img=1' }} 
                        style={styles.contactAvatar} 
                        contentFit="cover" 
                      />
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

              <ScrollView style={styles.messagesContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      message.senderId === user?.id ? styles.messageRowRight : styles.messageRowLeft,
                    ]}
                  >
                    {message.senderId !== user?.id && (
                      <Image
                        source={{ uri: selectedConversation?.avatar || 'https://i.pravatar.cc/150?img=45' }}
                        style={styles.messageAvatar}
                        contentFit="cover"
                      />
                    )}
                    <View
                      style={[
                        styles.messageBubble,
                        message.senderId === user?.id ? styles.messageBubbleRight : styles.messageBubbleLeft,
                        message.id?.includes('daily-tip') && styles.dailyTipBubble,
                      ]}
                    >
                      {renderMessageContent(message)}
                    </View>
                    {message.senderId === user?.id && (
                      <Image
                        source={{ uri: user?.avatar || 'https://i.pravatar.cc/150?img=12' }}
                        style={styles.messageAvatar}
                        contentFit="cover"
                      />
                    )}
                  </View>
                ))}
              </ScrollView>

              {isRecording ? (
                <View style={styles.recordingContainer}>
                  <TouchableOpacity style={styles.cancelRecordButton} onPress={cancelRecording}>
                    <X size={24} color="#EF4444" />
                  </TouchableOpacity>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>
                  <TouchableOpacity style={styles.stopRecordButton} onPress={stopRecording}>
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
                    <TouchableOpacity style={styles.voiceButton} onPress={startRecording}>
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
                      <Image
                        source={{ uri: item.avatar || 'https://i.pravatar.cc/150?img=1' }}
                        style={styles.personAvatar}
                        contentFit="cover"
                      />
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

      {pendingAnnotation && (
        <ImageAnnotation
          visible={true}
          imageUri={pendingAnnotation}
          onSave={handleSaveAnnotation}
          onCancel={handleCancelAnnotation}
        />
      )}
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 12,
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
  voiceWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveformBar: {
    width: 3,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
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
});
