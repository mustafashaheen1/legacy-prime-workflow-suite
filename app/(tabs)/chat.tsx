import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
  FlatList,
  useWindowDimensions,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SkeletonBox from '@/components/SkeletonBox';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  Paperclip,
  Image as ImageIcon,
  Mic,
  Send,
  X,
  Check,
  Bot,
  Trash2,
  Video as VideoIcon,
  Reply,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '@/contexts/AppContext';
import { ChatMessage } from '@/types';
import GlobalAIChat from '@/components/GlobalAIChatSimple';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getTipOfTheDay } from '@/constants/construction-tips';
import ChatListItem from '@/components/chat/ChatListItem';
import ChatTabs, { ChatTab } from '@/components/chat/ChatTabs';
import MessageBubble from '@/components/chat/MessageBubble';
import ReplyPreview from '@/components/chat/ReplyPreview';
import AudioRecorder from '@/components/chat/AudioRecorder';
import { preloadAudio } from '@/components/chat/AudioPlayer';

type PreviewEntry = { text: string; timestamp: string; senderId: string; type?: string };

// ─── Inline video preview (expo-video, lazy) ─────────────────────────────────
let _VideoView: any = null;
let _useVideoPlayer: any = null;
try {
  const ev = require('expo-video');
  _VideoView = ev.VideoView;
  _useVideoPlayer = ev.useVideoPlayer;
} catch { /* not installed */ }

function VideoPreviewPlayer({ uri }: { uri: string }) {
  if (!_VideoView || !_useVideoPlayer) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = _useVideoPlayer(uri, (p: any) => { p.loop = true; p.play(); });
  return (
    <_VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      allowsFullscreen={false}
    />
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { t } = useTranslation();
  const { user, conversations, addConversation, addMessageToConversation, setUnreadChatCount } =
    useApp();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const insets = useSafeAreaInsets();
  const rorkApi =
    process.env.EXPO_PUBLIC_RORK_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    'https://legacy-prime-workflow-suite.vercel.app';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [showAttachMenu, setShowAttachMenu] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [newChatSearch, setNewChatSearch] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ uri: string; mimeType: string; duration?: number } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState<boolean>(false);
  const [dailyTipSent, setDailyTipSent] = useState<boolean>(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isAudioMode, setIsAudioMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  const conversationLastMsgAtRef = useRef<Map<string, string>>(new Map());
  // Tracks whether we've already loaded persisted timestamps from AsyncStorage.
  // Reset to false when user changes so a fresh load happens on re-login.
  const seenLoadedRef = useRef(false);
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  // Keep AppContext (and FloatingChatButton) in sync with the authoritative count.
  useEffect(() => {
    setUnreadChatCount?.(unreadConversations.size);
  }, [unreadConversations]);
  const [conversationPreviews, setConversationPreviews] = useState<Map<string, PreviewEntry>>(new Map());

  const scrollViewRef = useRef<ScrollView>(null);
  // Measured height of the mobile header so KAV gets an accurate offset
  const [headerHeight, setHeaderHeight] = useState(56);
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  // Mirror selectedChat in a ref so the fetchConversations closure (keyed on
  // user?.id, not selectedChat) always reads the current value.
  const selectedChatRef = useRef<string | null>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Track keyboard height on iOS to apply exact paddingBottom to the chat column.
  // KeyboardAvoidingView is unreliable on iPad because it needs to know its own
  // y-position relative to the screen, which changes with navigation headers,
  // desktop headers, etc. Using the raw keyboard coordinates is always correct.
  const [iosKbPadding, setIosKbPadding] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        if (Platform.OS === 'ios') setIosKbPadding(e.endCoordinates.height);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (Platform.OS === 'ios') setIosKbPadding(0);
      }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const selectedConversation = conversations.find((c) => c.id === selectedChat);
  const messages = selectedConversation?.messages || [];

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const userMap = useMemo(() => {
    const map = new Map();
    if (user) map.set(user.id, { name: user.name, avatar: user.avatar });
    teamMembers.forEach((m) => map.set(m.id, { name: m.name, avatar: m.avatar }));
    return map;
  }, [user, teamMembers]);

  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, selectedChat]);

  // ─── Clear AI chat ───────────────────────────────────────────────────────────
  const handleClearAIChat = async () => {
    const doIt = async () => {
      try {
        const resp = await fetch(`${rorkApi}/api/clear-chat-history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id }),
        });
        if (resp.ok && selectedChat === 'ai-assistant') {
          setSelectedChat(null);
          setTimeout(() => setSelectedChat('ai-assistant'), 100);
        } else if (!resp.ok) {
          Alert.alert('Error', 'Failed to clear chat history');
        }
      } catch {
        Alert.alert('Error', 'Failed to clear chat history');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all AI chat history? This cannot be undone.')) doIt();
    } else {
      Alert.alert('Clear AI Chat', 'Clear all AI chat history? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  // ─── Fetch team members ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id || !user?.role) return;
      setIsLoadingMembers(true);
      try {
        const resp = await fetch(
          `${rorkApi}/api/team/get-members?userId=${user.id}&userRole=${user.role}`
        );
        const result = await resp.json();
        if (result.success) setTeamMembers(result.members);
      } catch (e) {
        console.error('[Chat] fetchTeamMembers error:', e);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchTeamMembers();
  }, [user?.id, user?.role]);

  // Reset seen-timestamps state whenever the logged-in user changes so a fresh
  // load from AsyncStorage happens on the next fetchConversations call.
  useEffect(() => {
    seenLoadedRef.current = false;
    conversationLastMsgAtRef.current = new Map();
  }, [user?.id]);

  // ─── Fetch conversations (poll 30s) ──────────────────────────────────────────
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;
      setIsLoadingConversations(true);

      // ── One-time: restore "last-seen" timestamps persisted from previous session ──
      // This lets the first poll correctly detect messages that arrived while the
      // user was logged out (knownAt will be populated, so the > comparison works).
      if (!seenLoadedRef.current) {
        seenLoadedRef.current = true;
        try {
          const raw = await AsyncStorage.getItem(`chat_seen_${user.id}`);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, string>;
            Object.entries(parsed).forEach(([id, ts]) => {
              conversationLastMsgAtRef.current.set(id, ts);
            });
          }
        } catch { /* non-fatal */ }
      }

      try {
        const resp = await fetch(`${rorkApi}/api/team/get-conversations?userId=${user.id}`);
        const result = await resp.json();
        if (!result.success) return;

        result.conversations.forEach((conv: any) => {
          addConversation({
            id: conv.id,
            name: conv.name,
            type: conv.type as 'individual' | 'group',
            participants: conv.participants.map((p: any) => p.id),
            messages: conversationsRef.current.find((c) => c.id === conv.id)?.messages || [],
            createdAt: conv.createdAt,
            avatar: conv.avatar,
          });

          if (conv.lastMessage) {
            const lmType = conv.lastMessage.type;
            const previewText =
              lmType === 'image' ? '📷 Photo'
              : lmType === 'voice' ? '🎤 Voice message'
              : lmType === 'video' ? '🎬 Video'
              : lmType === 'file' ? `📎 ${conv.lastMessage.file_name || 'File'}`
              : conv.lastMessage.content || '';
            setConversationPreviews((prev) => {
              const next = new Map(prev);
              next.set(conv.id, {
                text: previewText,
                timestamp: conv.lastMessage.created_at,
                senderId: conv.lastMessage.sender_id,
                type: lmType,
              });
              return next;
            });
          }

          if (conv.lastMessageAt) {
            const knownAt = conversationLastMsgAtRef.current.get(conv.id);
            // Use ref — selectedChat inside this closure is stale (effect only
            // re-runs on user?.id change, not on every conversation switch).
            const isSelected = conv.id === selectedChatRef.current;
            // Only count as unread / notify if the message was sent by someone else
            const isOwnMessage = conv.lastMessage?.sender_id === user?.id;
            if (!isSelected && !isOwnMessage && knownAt && conv.lastMessageAt > knownAt) {
              setUnreadConversations((prev) => new Set(prev).add(conv.id));
              if (Platform.OS !== 'web') {
                const lm = conv.lastMessage;
                const msgText =
                  lm?.type === 'image' ? '📷 Photo'
                  : lm?.type === 'voice' ? '🎤 Voice message'
                  : lm?.type === 'video' ? '🎬 Video'
                  : lm?.type === 'file' ? `📎 ${lm?.file_name || 'File'}`
                  : (lm?.content || 'New message');
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: conv.name,
                    body: msgText,
                    data: { type: 'chat', conversationId: conv.id },
                    sound: 'default',
                  },
                  trigger: null,
                }).catch(() => {});
              }
            }
            conversationLastMsgAtRef.current.set(conv.id, conv.lastMessageAt);
          }
        });
      } catch (e) {
        console.error('[Chat] fetchConversations error:', e);
      } finally {
        setIsLoadingConversations(false);
        // Persist the current "last-seen" timestamps so the next app launch can
        // compare against them and correctly mark messages as unread.
        if (user?.id && conversationLastMsgAtRef.current.size > 0) {
          const obj = Object.fromEntries(conversationLastMsgAtRef.current);
          AsyncStorage.setItem(`chat_seen_${user.id}`, JSON.stringify(obj)).catch(() => {});
        }
      }
    };

    fetchConversations();
    // Poll every 5s (same as fetchMessages) so unread badges and previews
    // appear quickly — previously 30s which felt very laggy.
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // ─── Fetch messages (poll 5s) ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat || !user?.id || selectedChat === 'ai-assistant') return;
      const conversation = conversationsRef.current.find((c) => c.id === selectedChat);
      if (!conversation) return;

      try {
        const resp = await fetch(
          `${rorkApi}/api/team/get-messages?conversationId=${selectedChat}&userId=${user.id}`
        );
        const result = await resp.json();
        if (!result.success) return;

        const latestConv = conversationsRef.current.find((c) => c.id === selectedChat);
        const existingIds = new Set((latestConv?.messages || []).map((m) => m.id));

        result.messages.forEach((msg: any) => {
          if (!existingIds.has(msg.id)) {
            addMessageToConversation(selectedChat, {
              id: msg.id,
              senderId: msg.senderId,
              type: msg.type,
              content: msg.content,
              text: msg.text,
              fileName: msg.fileName,
              duration: msg.duration,
              timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              replyTo: msg.replyTo,
              isDeleted: msg.isDeleted,
            });
          }
        });
      } catch (e) {
        console.error('[Chat] fetchMessages error:', e);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedChat, user?.id]);

  // ─── Preload voice messages when a conversation is opened ────────────────────
  // Stagger by 300 ms per track so we don't slam AVAudioSession with simultaneous
  // createAsync calls, which causes "isPlayable accessed synchronously" warnings.
  useEffect(() => {
    if (!selectedConversation || Platform.OS === 'web') return;

    // Only preload the 5 most recent voice messages.
    // Preloading too many simultaneously triggers AVAudioSession "isPlayable
    // accessed synchronously" warnings and saturates the audio session on iOS.
    const voiceUris = selectedConversation.messages
      .filter((m) => m.type === 'voice' && !m.isDeleted && m.content)
      .slice(-5)
      .map((m) => m.content as string);

    if (voiceUris.length === 0) return;

    // 500 ms stagger — gives AVAudioSession time to settle between loads
    const timers = voiceUris.map((uri, i) =>
      setTimeout(() => { preloadAudio(uri); }, i * 500)
    );

    return () => timers.forEach(clearTimeout);
  }, [selectedConversation?.id, selectedConversation?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Daily tip ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkDailyTip = async () => {
      if (selectedChat !== 'ai-assistant') return;
      const today = new Date().toISOString().split('T')[0];
      const last = await AsyncStorage.getItem('lastDailyTipDate_chat');
      if (last !== today && !dailyTipSent) {
        const tip = getTipOfTheDay();
        const tipMsg: ChatMessage = {
          id: `daily-tip-${Date.now()}`,
          senderId: 'ai-assistant',
          type: 'text',
          text: `🏗️ **Daily Construction Tip** (${tip.category})\n\n${tip.tip}\n\n💡 Have questions? I\'m here to help!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setTimeout(() => addMessageToConversation('ai-assistant', tipMsg), 800);
        await AsyncStorage.setItem('lastDailyTipDate_chat', today);
        setDailyTipSent(true);
      }
    };
    checkDailyTip();
  }, [selectedChat, dailyTipSent]);

  // ─── Team member helpers ───────────────────────────────────────────────────────
  const allPeople = useMemo(
    () =>
      teamMembers.map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        type: 'employee' as const,
        email: m.email,
        role: m.role,
      })),
    [teamMembers]
  );

  const filteredPeople = useMemo(() => {
    if (!newChatSearch) return allPeople;
    const q = newChatSearch.toLowerCase();
    return allPeople.filter((p) => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q));
  }, [allPeople, newChatSearch]);

  // ─── Conversation filtering by tab ───────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const all = conversations.filter(
      (c) => c.type === 'individual' || c.type === 'group'
    );
    const searched = searchQuery
      ? all.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : all;

    switch (activeTab) {
      case 'unread':
        return searched.filter((c) => unreadConversations.has(c.id));
      case 'groups':
        return searched.filter((c) => c.type === 'group');
      default:
        return searched;
    }
  }, [conversations, searchQuery, activeTab, unreadConversations]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────
  const handleSelectChat = (convId: string) => {
    setSelectedChat(convId);
    setReplyingTo(null);
    setUnreadConversations((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      return next;
    });
    // Immediately advance the persisted timestamp for this conversation so
    // the next fetchConversations poll won't re-add the unread badge and so
    // next login correctly knows this conversation was read.
    if (user?.id) {
      const ts = conversationLastMsgAtRef.current.get(convId);
      if (ts) {
        AsyncStorage.getItem(`chat_seen_${user.id}`)
          .then((raw) => {
            const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
            obj[convId] = ts;
            return AsyncStorage.setItem(`chat_seen_${user.id}`, JSON.stringify(obj));
          })
          .catch(() => {});
      }
    }
  };

  const handleToggleParticipant = (personId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  const handleCreateChat = async () => {
    if (selectedParticipants.length === 0) {
      Alert.alert('Error', 'Please select at least one person');
      return;
    }
    if (!user?.id) return;

    try {
      const names = allPeople.filter((p) => selectedParticipants.includes(p.id)).map((p) => p.name);
      const chatName = names.join(', ');

      const resp = await fetch(`${rorkApi}/api/team/create-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdBy: user.id,
          participantIds: selectedParticipants,
          name: selectedParticipants.length > 1 ? chatName : null,
          type: selectedParticipants.length === 1 ? 'individual' : 'group',
        }),
      });

      const result = await resp.json();
      if (!result.success) {
        Alert.alert('Error', 'Failed to create conversation');
        return;
      }

      const dbConv = result.conversation;
      if (!conversations.find((c) => c.id === dbConv.id)) {
        addConversation({
          id: dbConv.id,
          name: chatName,
          type: dbConv.type,
          participants: [user.id, ...selectedParticipants],
          messages: [],
          createdAt: dbConv.created_at,
          avatar:
            selectedParticipants.length === 1
              ? allPeople.find((p) => p.id === selectedParticipants[0])?.avatar
              : undefined,
        });
      }

      setSelectedChat(dbConv.id);
      setShowNewChatModal(false);
      setSelectedParticipants([]);
      setNewChatSearch('');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to create conversation: ' + e.message);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;

    const conversation = conversations.find((c) => c.id === selectedChat);
    const isTeamChat =
      selectedChat !== 'ai-assistant' &&
      conversation &&
      (conversation.type === 'individual' || conversation.type === 'group');

    if (isTeamChat) {
      try {
        const resp = await fetch(`${rorkApi}/api/team/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedChat,
            senderId: user?.id,
            type: 'text',
            content: messageText,
            replyTo: replyingTo
              ? {
                  id: replyingTo.id,
                  senderId: replyingTo.senderId,
                  senderName: userMap.get(replyingTo.senderId)?.name || 'Unknown',
                  type: replyingTo.type,
                  text: replyingTo.text || replyingTo.content,
                  content: replyingTo.content,
                }
              : undefined,
          }),
        });

        const result = await resp.json();
        if (result.success) {
          const replyToPayload = replyingTo
            ? {
                id: replyingTo.id,
                senderId: replyingTo.senderId,
                senderName: userMap.get(replyingTo.senderId)?.name || 'Unknown',
                type: replyingTo.type,
                text: replyingTo.text || replyingTo.content,
                content: replyingTo.content,
              }
            : undefined;

          addMessageToConversation(selectedChat, {
            id: result.message.id,
            senderId: user?.id || '',
            text: messageText,
            content: messageText,
            type: 'text',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            replyTo: replyToPayload,
          });
          setMessageText('');
          setReplyingTo(null);
        } else {
          Alert.alert('Error', 'Failed to send message');
        }
      } catch (e: any) {
        Alert.alert('Error', 'Failed to send message: ' + e.message);
      }
    } else {
      addMessageToConversation(selectedChat, {
        id: Date.now().toString(),
        senderId: user?.id || '',
        text: messageText,
        type: 'text',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setMessageText('');
      setReplyingTo(null);
    }
  };

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;

    // Optimistic UI: mark deleted locally
    setLocallyDeletedIds((prev) => new Set(prev).add(messageId));

    try {
      const resp = await fetch(`${rorkApi}/api/team/delete-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId: user.id }),
      });
      const result = await resp.json();
      if (!result.success) {
        // Undo optimistic update
        setLocallyDeletedIds((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
        console.error('[Chat] Delete failed:', result.error);
      }
    } catch (e) {
      console.error('[Chat] Delete message error:', e);
    }
  };

  // ─── Image pick/send ─────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      if (!result.canceled && result.assets[0]) setPreviewImage(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      if (!result.canceled && result.assets[0]) setPreviewImage(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadToS3 = async (
    localUri: string,
    mimeType: string
  ): Promise<{ publicUrl: string }> => {
    // Map MIME types to proper file extensions
    const mimeToExt: Record<string, string> = {
      'video/quicktime': 'mov',
      'video/mp4': 'mp4',
      'video/mpeg': 'mp4',
      'audio/mp4': 'mp4',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'image/jpeg': 'jpg',
      'image/png': 'png',
    };
    const ext = mimeToExt[mimeType] ?? mimeType.split('/')[1] ?? 'bin';

    // Get presigned S3 URL
    const urlResp = await fetch(`${rorkApi}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, fileName: `file.${ext}`, fileType: mimeType }),
    });
    const urlResult = await urlResp.json();
    if (!urlResult.success) throw new Error(urlResult.error || 'Failed to get upload URL');

    if (Platform.OS === 'web') {
      // Web: fetch the blob URL / object URL and PUT it
      const response = await fetch(localUri);
      const blob = await response.blob();
      const uploadResp = await fetch(urlResult.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mimeType },
      });
      if (!uploadResp.ok) throw new Error(`S3 upload failed: ${uploadResp.status}`);
    } else {
      // Native: FileSystem.uploadAsync streams the file at the OS level —
      // no base64, no JS heap pressure. Correct for all file sizes.
      console.log('[uploadToS3] uploading', localUri, mimeType);
      const uploadResult = await FileSystem.uploadAsync(urlResult.uploadUrl, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': mimeType },
      });
      console.log('[uploadToS3] result status:', uploadResult.status);
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`S3 upload failed: ${uploadResult.status} — ${uploadResult.body}`);
      }
    }

    return { publicUrl: urlResult.publicUrl };
  };

  const sendMediaMessage = async (
    type: 'image' | 'video' | 'file',
    publicUrl: string,
    extras?: { fileName?: string; duration?: number }
  ) => {
    if (!selectedChat) return;
    const resp = await fetch(`${rorkApi}/api/team/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedChat,
        senderId: user?.id,
        type,
        content: publicUrl,
        fileName: extras?.fileName,
        duration: extras?.duration,
      }),
    });
    const result = await resp.json();
    if (result.success) {
      addMessageToConversation(selectedChat, {
        id: result.message.id,
        senderId: user?.id || '',
        type,
        content: publicUrl,
        fileName: extras?.fileName,
        duration: extras?.duration,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } else {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSendImage = async () => {
    if (!previewImage || !selectedChat) return;
    setIsUploadingImage(true);
    try {
      const conversation = conversations.find((c) => c.id === selectedChat);
      const isTeam =
        selectedChat !== 'ai-assistant' &&
        conversation &&
        (conversation.type === 'individual' || conversation.type === 'group');

      if (isTeam) {
        const ext = previewImage.split('.').pop()?.toLowerCase() || 'jpg';
        const mime = `image/${ext}`;
        const { publicUrl } = await uploadToS3(previewImage, mime);
        await sendMediaMessage('image', publicUrl);
      } else {
        addMessageToConversation(selectedChat, {
          id: Date.now().toString(),
          senderId: user?.id || '',
          type: 'image',
          content: previewImage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
      setPreviewImage(null);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send image: ' + e.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ─── Video pick/send ──────────────────────────────────────────────────────────
  const handlePickVideo = async () => {
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Use mimeType from picker; fall back to extension-based detection
        const rawMime = asset.mimeType || `video/${asset.uri.split('.').pop()?.toLowerCase() || 'mp4'}`;
        // iOS returns .mov files — ensure correct MIME type
        const mime = rawMime === 'video/mov' ? 'video/quicktime' : rawMime;
        const durationSec = asset.duration ? Math.round(asset.duration / 1000) : undefined;
        setPreviewVideo({ uri: asset.uri, mimeType: mime, duration: durationSec });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const handleSendVideo = async () => {
    if (!previewVideo || !selectedChat) return;
    setIsUploadingVideo(true);
    try {
      const conversation = conversations.find((c) => c.id === selectedChat);
      const isTeam =
        selectedChat !== 'ai-assistant' &&
        conversation &&
        (conversation.type === 'individual' || conversation.type === 'group');

      if (isTeam) {
        console.log('[Video] uploading', previewVideo.uri, previewVideo.mimeType);
        const { publicUrl } = await uploadToS3(previewVideo.uri, previewVideo.mimeType);
        console.log('[Video] uploaded, publicUrl:', publicUrl);
        await sendMediaMessage('video', publicUrl, { duration: previewVideo.duration });
      } else {
        addMessageToConversation(selectedChat, {
          id: Date.now().toString(),
          senderId: user?.id || '',
          type: 'video',
          content: previewVideo.uri,
          duration: previewVideo.duration,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
      setPreviewVideo(null);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send video: ' + e.message);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // ─── Document pick/send ───────────────────────────────────────────────────────
  const handlePickDocument = async () => {
    if (!selectedChat) return;
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const conversation = conversations.find((c) => c.id === selectedChat);
        const isTeam =
          selectedChat !== 'ai-assistant' &&
          conversation &&
          (conversation.type === 'individual' || conversation.type === 'group');

        if (isTeam) {
          const file = result.assets[0];
          const mime = file.mimeType || 'application/octet-stream';
          const { publicUrl } = await uploadToS3(file.uri, mime);
          await sendMediaMessage('file', publicUrl, { fileName: file.name });
        } else {
          addMessageToConversation(selectedChat, {
            id: Date.now().toString(),
            senderId: user?.id || '',
            type: 'file',
            fileName: result.assets[0].name,
            content: result.assets[0].uri,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send document');
    }
  };

  // ─── Audio recording send ─────────────────────────────────────────────────────
  const handleAudioSend = async (result: {
    uri: string | null;
    blob?: Blob;
    durationSec: number;
    mimeType: string;
  }) => {
    setIsAudioMode(false);
    if (!selectedChat) return;

    const conversation = conversations.find((c) => c.id === selectedChat);
    const isTeam =
      selectedChat !== 'ai-assistant' &&
      conversation &&
      (conversation.type === 'individual' || conversation.type === 'group');

    try {
      if (isTeam) {
        // Build a local URI for the audio so uploadToS3 can handle it uniformly.
        // Web: blob → object URL; Native: file URI from expo-av recording.
        let audioLocalUri: string;
        if (result.blob) {
          audioLocalUri = URL.createObjectURL(result.blob);
        } else if (result.uri) {
          audioLocalUri = result.uri;
        } else {
          throw new Error('No audio data');
        }

        // Reuse the same presigned-URL + direct-S3-PUT path as images.
        // The previous /api/upload-audio approach uploaded server-side without
        // a public ACL, so the resulting S3 URL returned 403 for other users —
        // iOS AVFoundation parsed the 403 XML body as audio and threw
        // "format not supported", showing "Audio not supported on this device".
        const { publicUrl: audioUrl } = await uploadToS3(audioLocalUri, result.mimeType);

        // Revoke the object URL immediately after upload (web only)
        if (result.blob) URL.revokeObjectURL(audioLocalUri);

        const msgResp = await fetch(`${rorkApi}/api/team/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedChat,
            senderId: user?.id,
            type: 'voice',
            content: audioUrl,
            duration: result.durationSec,
          }),
        });

        const msgResult = await msgResp.json();
        if (msgResult.success) {
          addMessageToConversation(selectedChat, {
            id: msgResult.message.id,
            senderId: user?.id || '',
            type: 'voice',
            content: audioUrl,
            duration: result.durationSec,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      } else {
        const localUri =
          result.uri ||
          (result.blob ? URL.createObjectURL(result.blob) : null);
        addMessageToConversation(selectedChat, {
          id: Date.now().toString(),
          senderId: user?.id || '',
          type: 'voice',
          content: localUri || '',
          duration: result.durationSec,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send voice message: ' + e.message);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  const isTeamChat = selectedChat !== 'ai-assistant';

  return (
    <View style={styles.container}>
      {/* Desktop header */}
      {!isSmallScreen && (
        <View style={styles.header}>
          <View style={styles.userInfo}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.userAvatar} contentFit="cover" />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Text style={styles.userAvatarInitials}>{user ? getInitials(user.name) : 'JD'}</Text>
              </View>
            )}
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.teamInfo}>
            <Users size={20} color="#1F2937" />
            <Text style={styles.teamName}>Team Chat</Text>
          </View>
        </View>
      )}

      <View style={styles.content}>
        {/* ─── Sidebar ─────────────────────────────────────────────────────── */}
        {(!isSmallScreen || !selectedChat) && (
          <View style={[styles.sidebar, isSmallScreen && styles.sidebarMobile]}>
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

            {/* Tabs */}
            <ChatTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              unreadCount={unreadConversations.size}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* AI Assistant */}
              <View style={styles.contactsSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{t('chat.title')}</Text>
                  <TouchableOpacity onPress={handleClearAIChat} style={styles.clearChatIconButton}>
                    <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.aiChatItem, selectedChat === 'ai-assistant' && styles.contactItemActive]}
                  onPress={() => handleSelectChat('ai-assistant')}
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

              {/* Skeleton loader */}
              {isLoadingConversations &&
                conversations.filter((c) => c.type === 'individual' || c.type === 'group').length === 0 && (
                  <View style={styles.contactsSection}>
                    <SkeletonBox width={140} height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
                        <SkeletonBox width={48} height={48} borderRadius={24} />
                        <View style={{ flex: 1 }}>
                          <SkeletonBox width="70%" height={14} borderRadius={4} />
                          <SkeletonBox width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
                        </View>
                        <SkeletonBox width={36} height={12} borderRadius={4} />
                      </View>
                    ))}
                  </View>
                )}

              {/* Conversations */}
              {filteredConversations.length > 0 && (
                <View style={styles.contactsSection}>
                  <Text style={styles.sectionTitle}>
                    {activeTab === 'groups' ? 'Groups' : activeTab === 'unread' ? 'Unread' : 'Messages'}
                  </Text>
                  {filteredConversations.map((conv) => (
                    <ChatListItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={selectedChat === conv.id}
                      hasUnread={unreadConversations.has(conv.id)}
                      unreadCount={unreadConversations.has(conv.id) ? 1 : 0}
                      preview={conversationPreviews.get(conv.id)}
                      currentUserId={user?.id}
                      onPress={() => handleSelectChat(conv.id)}
                    />
                  ))}
                </View>
              )}

              {conversations.filter((c) => c.type === 'individual' || c.type === 'group').length === 0 &&
                !isLoadingConversations && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No conversations yet</Text>
                    <Text style={styles.emptyStateSubtext}>Start a new chat to get started</Text>
                  </View>
                )}
            </ScrollView>
          </View>
        )}

        {/* ─── Chat area ──────────────────────────────────────────────────── */}
        {(!isSmallScreen || selectedChat) && (
          <View style={[styles.chatArea, isSmallScreen && styles.chatAreaMobile]}>
            {selectedChat === 'ai-assistant' ? (
              <View style={styles.aiChatContainer}>
                {!isSmallScreen && (
                  <View style={styles.chatHeader}>
                    <View style={styles.aiHeaderInfo}>
                      <View style={styles.aiAvatarContainer}>
                        <Bot size={20} color="#2563EB" strokeWidth={2.5} />
                      </View>
                      <Text style={styles.chatTitle}>AI Assistant</Text>
                    </View>
                  </View>
                )}
                <ErrorBoundary fallback={null}>
                  <GlobalAIChat inline />
                </ErrorBoundary>
              </View>
            ) : selectedChat ? (
              <>
                {/* Mobile header — lives inside the chat area so KAV sits directly below it */}
                {isSmallScreen && (
                  <View
                    style={styles.mobileHeader}
                    onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                  >
                    <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backButton}>
                      <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.chatTitle} numberOfLines={1}>
                      {selectedConversation?.name || 'Chat'}
                    </Text>
                  </View>
                )}
              {/* iOS: plain View + iosKbPadding from keyboard events (reliable on all devices).
                  Android: KeyboardAvoidingView with behavior='height' (window resizes natively). */}
              <KeyboardAvoidingView
                style={[
                  { flex: 1 },
                  Platform.OS === 'ios' && { paddingBottom: iosKbPadding },
                ]}
                behavior={Platform.OS === 'ios' ? undefined : 'height'}
                keyboardVerticalOffset={0}
              >
                {!isSmallScreen && (
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatTitle}>{selectedConversation?.name}</Text>
                  </View>
                )}

                {/* Messages */}
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.messagesContainer}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() =>
                    scrollViewRef.current?.scrollToEnd({ animated: false })
                  }
                >
                  {messages.map((message) => {
                    const senderData = userMap.get(message.senderId);
                    const senderName =
                      message.senderId === user?.id
                        ? user.name
                        : senderData?.name || selectedConversation?.name || 'User';
                    const senderAvatar =
                      message.senderId === user?.id
                        ? user?.avatar
                        : senderData?.avatar || selectedConversation?.avatar;

                    const isDeleted = locallyDeletedIds.has(message.id) || !!message.isDeleted;
                    return (
                      <MessageBubble
                        key={message.id}
                        message={{ ...message, isDeleted }}
                        isOwn={message.senderId === user?.id}
                        senderName={senderName}
                        senderAvatar={senderAvatar}
                        playingAudioId={playingAudioId}
                        onAudioPlay={(id) => setPlayingAudioId(id)}
                        onReply={handleReply}
                        onDelete={handleDeleteMessage}
                        onImagePress={(uri) => setSelectedImage(uri)}
                        showSenderName={selectedConversation?.type === 'group'}
                      />
                    );
                  })}
                </ScrollView>

                {/* Reply bar */}
                {replyingTo && (
                  <View style={styles.replyBar}>
                    <Reply size={16} color="#2563EB" />
                    <View style={styles.replyBarContent}>
                      <ReplyPreview
                        replyTo={{
                          id: replyingTo.id,
                          senderId: replyingTo.senderId,
                          senderName: userMap.get(replyingTo.senderId)?.name || 'Unknown',
                          type: replyingTo.type,
                          text: replyingTo.text || replyingTo.content,
                          content: replyingTo.content,
                        }}
                        onDismiss={() => setReplyingTo(null)}
                      />
                    </View>
                  </View>
                )}

                {/* Input area */}
                {isAudioMode ? (
                  <View style={[
                    styles.recorderContainer,
                    { paddingBottom: iosKbPadding > 0 ? 10 : Math.max(insets.bottom, 10) },
                  ]}>
                    <AudioRecorder
                      autoStart
                      onSend={handleAudioSend}
                      onCancel={() => setIsAudioMode(false)}
                    />
                  </View>
                ) : (
                  <View style={[
                    styles.inputContainer,
                    // When keyboard is up: iosKbPadding already includes the safe-area
                    // bottom (home indicator) so don't double-apply it.
                    { paddingBottom: iosKbPadding > 0 ? 12 : Math.max(insets.bottom, 12) },
                  ]}>
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
                      onFocus={() =>
                        setTimeout(
                          () => scrollViewRef.current?.scrollToEnd({ animated: true }),
                          150
                        )
                      }
                    />
                    {messageText.trim() ? (
                      <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                        <Send size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.voiceButton}
                        onPress={() => setIsAudioMode(true)}
                      >
                        <Mic size={20} color="#2563EB" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </KeyboardAvoidingView>
              </>
            ) : (
              <View style={styles.noChatSelected}>
                <Users size={64} color="#D1D5DB" />
                <Text style={styles.noChatText}>{t('chat.title')}</Text>
                <Text style={styles.noChatSubtext}>{t('chat.noMessages')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ─── New Chat Modal ──────────────────────────────────────────────────── */}
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
              <TouchableOpacity
                onPress={() => {
                  setShowNewChatModal(false);
                  setSelectedParticipants([]);
                  setNewChatSearch('');
                }}
              >
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
                <Text style={styles.selectedCountText}>{selectedParticipants.length} selected</Text>
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
                        <Image source={{ uri: item.avatar }} style={styles.personAvatar} contentFit="cover" />
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
                        ? 'No team members found.'
                        : 'No results found'}
                    </Text>
                  )}
                </View>
              )}
            />

            <TouchableOpacity
              style={[
                styles.createChatButton,
                selectedParticipants.length === 0 && styles.createChatButtonDisabled,
              ]}
              onPress={handleCreateChat}
              disabled={selectedParticipants.length === 0}
            >
              <Text style={styles.createChatButtonText}>
                {selectedParticipants.length === 1
                  ? 'Start Direct Chat'
                  : `Create Group (${selectedParticipants.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Attach Menu ─────────────────────────────────────────────────────── */}
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
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
                <View style={[styles.attachIconContainer, { backgroundColor: '#EF4444' }]}>
                  <ImageIcon size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.attachOptionText}>Take Photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#8B5CF6' }]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Photo Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handlePickVideo}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#10B981' }]}>
                <VideoIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.attachOptionText}>Video</Text>
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

      {/* ─── Image Preview Modal ──────────────────────────────────────────────── */}
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
            <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} contentFit="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* ─── Send Image Preview Modal ─────────────────────────────────────────── */}
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
              <Image source={{ uri: previewImage }} style={styles.previewImage} contentFit="contain" />
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

      {/* ─── Send Video Preview Modal (WhatsApp-style full-screen) ──────────────── */}
      <Modal
        visible={previewVideo != null}
        transparent={false}
        animationType="slide"
        onRequestClose={() => !isUploadingVideo && setPreviewVideo(null)}
      >
        <View style={styles.videoPreviewScreen}>
          {/* Top bar */}
          <View style={styles.videoPreviewTopBar}>
            <TouchableOpacity
              onPress={() => !isUploadingVideo && setPreviewVideo(null)}
              style={styles.videoPreviewBackBtn}
              disabled={isUploadingVideo}
            >
              <X size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.videoPreviewTopTitle}>Send to {
              conversations.find(c => c.id === selectedChat)?.name || 'Chat'
            }</Text>
            {previewVideo?.duration != null && (
              <View style={styles.videoPreviewDurationBadge}>
                <Text style={styles.videoPreviewDurationText}>
                  {Math.floor(previewVideo.duration / 60)}:{String(previewVideo.duration % 60).padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>

          {/* Video preview area — plays the local file with expo-video */}
          <View style={styles.videoPreviewContent}>
            {previewVideo && Platform.OS !== 'web' ? (
              <VideoPreviewPlayer uri={previewVideo.uri} />
            ) : previewVideo && Platform.OS === 'web' ? (
              /* @ts-ignore web-only */
              <video
                src={previewVideo.uri}
                autoPlay
                loop
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : null}
          </View>

          {/* Bottom bar */}
          <View style={styles.videoPreviewBottomBar}>
            <TouchableOpacity
              style={[styles.videoSendBtn, isUploadingVideo && styles.videoSendBtnDisabled]}
              onPress={handleSendVideo}
              disabled={isUploadingVideo}
              activeOpacity={0.85}
            >
              {isUploadingVideo ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Send size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitials: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  userName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { fontSize: 14, color: '#1F2937' },
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
  backButton: { paddingVertical: 4 },
  backButtonText: { fontSize: 16, color: '#2563EB', fontWeight: '600' as const },
  chatTitle: { fontSize: 17, fontWeight: '600' as const, color: '#1F2937', flex: 1 },
  content: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    padding: 16,
  },
  sidebarMobile: { width: '100%', borderRightWidth: 0, flex: 1 },
  newChatButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  newChatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  contactsSection: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearChatIconButton: { padding: 4 },
  contactItemActive: { backgroundColor: '#EFF6FF' },
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
  aiChatInfo: { flex: 1 },
  aiChatName: { fontSize: 15, fontWeight: '700' as const, color: '#1F2937', marginBottom: 2 },
  aiChatDescription: { fontSize: 12, color: '#6B7280' },
  chatArea: { flex: 1, backgroundColor: '#FFFFFF' },
  chatAreaMobile: {
    flex: 1,
  },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiChatContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  messagesContainer: { flex: 1, paddingVertical: 12 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  replyBarContent: { flex: 1 },
  recorderContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingHorizontal: 12,
    // paddingBottom is set dynamically in render using insets.bottom
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  attachButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  messageInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sendButton: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noChatSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noChatText: { fontSize: 20, fontWeight: '600' as const, color: '#1F2937', marginTop: 16 },
  noChatSubtext: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyStateText: { fontSize: 16, fontWeight: '600' as const, color: '#6B7280' },
  emptyStateSubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#1F2937' },
  selectedCount: { backgroundColor: '#EFF6FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12 },
  selectedCountText: { fontSize: 14, color: '#2563EB', fontWeight: '600' as const },
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
  personItemSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  personAvatar: { width: 40, height: 40, borderRadius: 20 },
  personAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
  },
  personAvatarInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  personDetails: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  personType: { fontSize: 14, color: '#6B7280' },
  checkIcon: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  createChatButton: {
    backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 8,
    alignItems: 'center', marginTop: 16,
  },
  createChatButtonDisabled: { backgroundColor: '#D1D5DB' },
  createChatButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const },
  attachModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  attachMenu: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, gap: 8,
  },
  attachOption: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 },
  attachIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  attachOptionText: { fontSize: 16, fontWeight: '500' as const, color: '#1F2937' },
  imageModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeImageButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  fullscreenImage: { width: '90%', height: '80%' },
  previewModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  previewContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '80%',
  },
  previewHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  previewTitle: { fontSize: 18, fontWeight: '700' as const, color: '#1F2937' },
  previewImage: { width: '100%', height: 400, backgroundColor: '#F3F4F6' },
  videoPreviewPlaceholder: {
    height: 200, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6', gap: 12,
  },
  videoPreviewText: { fontSize: 16, color: '#6B7280' },
  previewActions: { flexDirection: 'row', padding: 16, gap: 12 },
  previewCancelButton: {
    flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  previewCancelText: { fontSize: 16, fontWeight: '600' as const, color: '#6B7280' },
  previewSendButton: {
    flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#2563EB', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  previewSendText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  // ─── WhatsApp-style full-screen video preview ───────────────────────────────
  videoPreviewScreen: {
    flex: 1, backgroundColor: '#000',
  },
  videoPreviewTopBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
    gap: 12,
  },
  videoPreviewBackBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  videoPreviewTopTitle: {
    flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const,
  },
  videoPreviewDurationBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  videoPreviewDurationText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '600' as const,
  },
  videoPreviewContent: {
    flex: 1,
  },
  videoPreviewBottomBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16,
  },
  videoSendBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  videoSendBtnDisabled: {
    opacity: 0.6,
  },
});
