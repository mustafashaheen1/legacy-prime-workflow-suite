import {
  View,
  Text,
  StyleSheet,
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
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useLocalSearchParams } from 'expo-router';
import SkeletonBox from '@/components/SkeletonBox';
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
  ChevronLeft,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
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
import TypingIndicator from '@/components/chat/TypingIndicator';
import DateSeparator, { formatDateLabel } from '@/components/chat/DateSeparator';
import { setActiveConversationId } from '@/hooks/useNotificationSetup';

type PreviewEntry = { text: string; timestamp: string; senderId: string; type?: string };

type ConversationMeta = {
  unreadCount: number;
  otherLastReadAt: string | null;
};

type MessageItem =
  | { kind: 'message'; data: ChatMessage & { isDeleted: boolean }; key: string }
  | { kind: 'date'; label: string; key: string };

type TypingUser = { name: string; avatar?: string };

type PendingUpload = {
  tempId: string;
  conversationId: string;
  type: 'image' | 'video' | 'file' | 'voice';
  localUri: string;
  fileName?: string;
  duration?: number;
  timestamp: string;
  createdAt: string;
};

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

  // ── Notification deep-link param ───────────────────────────────────────────
  const { conversationId: notifConversationId } = useLocalSearchParams<{ conversationId?: string }>();

  // ── Core chat state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [pendingUploads, setPendingUploads] = useState<Map<string, PendingUpload>>(new Map());
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<{ uri: string; mimeType: string; duration?: number } | null>(null);
  const [dailyTipSent, setDailyTipSent] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isAudioMode, setIsAudioMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('all');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());

  // ── Pagination state (older-message loading) ───────────────────────────────
  // olderMessages stores pages fetched via "load more" per conversation.
  // They live in local state (not AppContext) so we can prepend without
  // touching the global store.
  const [olderMessages, setOlderMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [convHasMore, setConvHasMore] = useState<Map<string, boolean>>(new Map());
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const oldestCursors = useRef<Map<string, string>>(new Map());

  // ── Unread / meta per conversation ────────────────────────────────────────
  const [conversationMeta, setConversationMeta] = useState<Map<string, ConversationMeta>>(new Map());
  const [conversationPreviews, setConversationPreviews] = useState<Map<string, PreviewEntry>>(new Map());

  // ── Typing indicators ─────────────────────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingBroadcastRef = useRef(0);

  // ── Derived unread set (for tab filter + badge) ───────────────────────────
  const unreadConversations = useMemo(() => {
    const set = new Set<string>();
    conversationMeta.forEach((meta, id) => {
      if (meta.unreadCount > 0) set.add(id);
    });
    return set;
  }, [conversationMeta]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const flatListRef = useRef<FlatList>(null);
  const fetchConversationsFnRef = useRef<(() => void) | null>(null);
  const conversationsRef = useRef(conversations);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  const selectedChatRef = useRef<string | null>(null);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
    // Tell notification handler which conversation is open so it can suppress
    // redundant banners while the user is actively reading that chat
    setActiveConversationId(selectedChat);
    return () => { setActiveConversationId(null); };
  }, [selectedChat]);

  // ── Auto-open conversation from notification tap ───────────────────────────
  // Uses a ref so we only act once per unique conversationId param even if
  // conversations list re-renders multiple times while loading.
  const notifOpenHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notifConversationId || notifOpenHandledRef.current === notifConversationId) return;
    const found = conversations.find((c) => c.id === notifConversationId);
    if (found) {
      notifOpenHandledRef.current = notifConversationId;
      handleSelectChat(notifConversationId);
    }
  }, [notifConversationId, conversations]);

  // ── iOS keyboard padding ──────────────────────────────────────────────────
  const [iosKbPadding, setIosKbPadding] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        if (Platform.OS === 'ios') setIosKbPadding(e.endCoordinates.height);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { if (Platform.OS === 'ios') setIosKbPadding(0); }
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedConversation = conversations.find((c) => c.id === selectedChat);
  const messages = selectedConversation?.messages || [];

  // Merge older (paginated) messages with the current AppContext messages.
  // olderMessages are prepended; IDs are deduped so Realtime inserts never double-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allMessages = useMemo<ChatMessage[]>(() => {
    if (!selectedChat) return messages;
    const older = olderMessages.get(selectedChat) ?? [];
    if (older.length === 0) return messages;
    const seen = new Set<string>();
    const merged: ChatMessage[] = [];
    for (const m of [...older, ...messages]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    return merged;
  }, [messages, olderMessages, selectedChat]);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string }>();
    if (user) map.set(user.id, { name: user.name, avatar: user.avatar });
    teamMembers.forEach((m) => map.set(m.id, { name: m.name, avatar: m.avatar }));
    return map;
  }, [user, teamMembers]);

  // ── Build message items list with date separators + pending uploads ───────
  const messageItems = useMemo<MessageItem[]>(() => {
    const items: MessageItem[] = [];
    let lastDateStr = '';

    allMessages.forEach((message) => {
      const isDeleted = locallyDeletedIds.has(message.id) || !!message.isDeleted;
      const raw = message.createdAt || message.timestamp;
      const date = raw ? new Date(raw) : null;
      const dateStr = date && !isNaN(date.getTime()) ? date.toDateString() : '';

      if (dateStr && dateStr !== lastDateStr) {
        items.push({ kind: 'date', label: formatDateLabel(date!), key: `date-${dateStr}` });
        lastDateStr = dateStr;
      }

      items.push({ kind: 'message', data: { ...message, isDeleted }, key: message.id });
    });

    // Append pending (optimistic) uploads for this conversation
    pendingUploads.forEach((pu) => {
      if (pu.conversationId !== selectedChat) return;
      items.push({
        kind: 'message',
        key: pu.tempId,
        data: {
          id: pu.tempId,
          senderId: user?.id || '',
          type: pu.type === 'voice' ? 'voice' : pu.type,
          content: pu.localUri,
          fileName: pu.fileName,
          duration: pu.duration,
          timestamp: pu.timestamp,
          createdAt: pu.createdAt,
          isDeleted: false,
          uploadProgress: 0,
        },
      });
    });

    return items;
  }, [allMessages, locallyDeletedIds, pendingUploads, selectedChat, user?.id]);

  // ── Scroll to end on new messages ─────────────────────────────────────────
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      prevMessageCountRef.current = messages.length;
    }
  }, [messages.length]);

  // Reset count when conversation changes
  useEffect(() => {
    prevMessageCountRef.current = 0;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
  }, [selectedChat]);

  // ── Preload voice messages ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedChat || Platform.OS === 'web') return;
    const voiceUris = messages
      .filter((m) => m.type === 'voice' && !m.isDeleted && m.content)
      .map((m) => m.content as string)
      .slice(-3)
      .reverse();
    if (voiceUris.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const uri of voiceUris) {
        if (cancelled) break;
        await preloadAudio(uri);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedChat]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typing: broadcast to others in this conversation ─────────────────────
  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current < 1500) return; // throttle to 1 event / 1.5s
    lastTypingBroadcastRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, userName: user.name, avatar: user.avatar },
    });
  }, [user]);

  // ── Typing: subscribe per conversation ────────────────────────────────────
  useEffect(() => {
    if (!selectedChat || !user?.id || selectedChat === 'ai-assistant') return;

    setTypingUsers(new Map()); // clear on conversation switch

    const channel = supabase
      .channel(`typing:${selectedChat}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload?.userId || payload.userId === user.id) return;
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(payload.userId, { name: payload.userName || 'Someone', avatar: payload.avatar });
          return next;
        });
        // Auto-clear after 3 s of silence
        const existing = typingTimeoutsRef.current.get(payload.userId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(payload.userId);
            return next;
          });
          typingTimeoutsRef.current.delete(payload.userId);
        }, 3000);
        typingTimeoutsRef.current.set(payload.userId, t);
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
      setTypingUsers(new Map());
    };
  }, [selectedChat, user?.id]);

  // ── Clear AI chat ─────────────────────────────────────────────────────────
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

  // ── Fetch team members ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!user?.id || !user?.role) return;
      setIsLoadingMembers(true);
      try {
        const resp = await fetch(`${rorkApi}/api/team/get-members?userId=${user.id}&userRole=${user.role}`);
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

  // ── Fetch conversations (poll 30 s + Realtime-triggered) ─────────────────
  useEffect(() => {
    const fetchConversations = async () => {
      if (!user?.id) return;
      setIsLoadingConversations(true);

      try {
        const resp = await fetch(`${rorkApi}/api/team/get-conversations?userId=${user.id}`);
        const result = await resp.json();
        if (!result.success) return;

        const freshMeta = new Map<string, ConversationMeta>();

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

          // If this conversation is currently open, force unreadCount = 0 locally
          const isSelected = conv.id === selectedChatRef.current;
          freshMeta.set(conv.id, {
            unreadCount: isSelected ? 0 : (conv.unreadCount || 0),
            otherLastReadAt: conv.otherLastReadAt || null,
          });
        });

        setConversationMeta((prev) => {
          const next = new Map(prev);
          freshMeta.forEach((meta, id) => next.set(id, meta));
          return next;
        });

        // Sync global badge count
        let badge = 0;
        freshMeta.forEach((meta, id) => {
          if (id !== selectedChatRef.current) badge += meta.unreadCount;
        });
        setUnreadChatCount?.(badge);
      } catch (e) {
        console.error('[Chat] fetchConversations error:', e);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversationsFnRef.current = fetchConversations;
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);

    const convChannel = supabase
      .channel(`conversations-list:${user?.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        () => { fetchConversationsFnRef.current?.(); }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(convChannel);
    };
  }, [user?.id]);

  // ── Fetch + Realtime messages for active conversation ─────────────────────
  useEffect(() => {
    if (!selectedChat || !user?.id || selectedChat === 'ai-assistant') return;

    // Clear pagination state for this conversation on initial load so stale
    // "older" pages from a previous visit don't bleed through.
    setOlderMessages((prev) => { const n = new Map(prev); n.delete(selectedChat); return n; });
    setConvHasMore((prev) => { const n = new Map(prev); n.delete(selectedChat); return n; });
    oldestCursors.current.delete(selectedChat);

    const fetchMessages = async () => {
      const conversation = conversationsRef.current.find((c) => c.id === selectedChat);
      if (!conversation) return;
      try {
        const resp = await fetch(
          `${rorkApi}/api/team/get-messages?conversationId=${selectedChat}&userId=${user.id}&limit=50`
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
              createdAt: msg.timestamp,
              replyTo: msg.replyTo,
              isDeleted: msg.isDeleted,
            });
          }
          if (msg.isDeleted) {
            setLocallyDeletedIds((prev) => new Set(prev).add(msg.id));
          }
        });

        // Store the oldest message's timestamp as the cursor for "load more"
        if (result.messages.length > 0) {
          oldestCursors.current.set(selectedChat, result.messages[0].timestamp);
        }
        setConvHasMore((prev) => new Map(prev).set(selectedChat, result.hasMore ?? false));
      } catch (e) {
        console.error('[Chat] fetchMessages error:', e);
      }
    };

    fetchMessages();

    const activeConvId = selectedChat;
    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          const msg = payload.new as any;
          if (msg.is_deleted) return;
          const latestConv = conversationsRef.current.find((c) => c.id === activeConvId);
          if (latestConv?.messages.some((m) => m.id === msg.id)) return;
          addMessageToConversation(activeConvId, {
            id: msg.id,
            senderId: msg.sender_id,
            type: msg.type,
            content: msg.content,
            text: msg.content,
            fileName: msg.file_name,
            duration: msg.duration,
            timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: msg.created_at,
            isDeleted: false,
          });
          fetchConversationsFnRef.current?.();
          // Clear typing indicator for the sender
          if (msg.sender_id !== user.id) {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              next.delete(msg.sender_id);
              return next;
            });
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` },
        (payload) => {
          const msg = payload.new as any;
          if (msg.is_deleted) {
            setLocallyDeletedIds((prev) => new Set(prev).add(msg.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Chat] Realtime unavailable, relying on poll fallback');
        }
      });

    const interval = setInterval(fetchMessages, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedChat, user?.id]);

  // ── Daily tip ─────────────────────────────────────────────────────────────
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

  // ── Team member helpers ───────────────────────────────────────────────────
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

  // ── Conversation filtering ────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const all = conversations.filter((c) => c.type === 'individual' || c.type === 'group');
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectChat = (convId: string) => {
    setSelectedChat(convId);
    setReplyingTo(null);
    setTypingUsers(new Map());

    // Clear unread locally
    setConversationMeta((prev) => {
      const next = new Map(prev);
      const meta = next.get(convId);
      if (meta && meta.unreadCount > 0) {
        next.set(convId, { ...meta, unreadCount: 0 });
        // Recalculate badge
        let badge = 0;
        next.forEach((m, id) => { if (id !== convId) badge += m.unreadCount; });
        setUnreadChatCount?.(Math.max(0, badge));
      }
      return next;
    });

    if (user?.id && convId !== 'ai-assistant') {
      fetch(`${rorkApi}/api/team/update-last-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, userId: user.id }),
      }).catch(() => {});
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

          const now = new Date().toISOString();
          addMessageToConversation(selectedChat, {
            id: result.message.id,
            senderId: user?.id || '',
            text: messageText,
            content: messageText,
            type: 'text',
            timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: now,
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
      const now = new Date().toISOString();
      addMessageToConversation(selectedChat, {
        id: Date.now().toString(),
        senderId: user?.id || '',
        text: messageText,
        type: 'text',
        timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: now,
      });
      setMessageText('');
      setReplyingTo(null);
    }
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);
    if (text.trim()) broadcastTyping();
  };

  const handleReply = (message: ChatMessage) => setReplyingTo(message);

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id) return;
    setLocallyDeletedIds((prev) => new Set(prev).add(messageId));
    try {
      const resp = await fetch(`${rorkApi}/api/team/delete-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, userId: user.id }),
      });
      const result = await resp.json();
      if (!result.success) {
        setLocallyDeletedIds((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
        console.error('[Chat] Delete failed:', result.error);
      }
    } catch (e) {
      console.error('[Chat] Delete message error:', e);
    }
  };

  // ── Load older messages (pagination) ─────────────────────────────────────
  const fetchOlderMessages = async () => {
    if (!selectedChat || !user?.id || isLoadingOlder) return;
    const cursor = oldestCursors.current.get(selectedChat);
    if (!cursor) return;

    setIsLoadingOlder(true);
    try {
      const resp = await fetch(
        `${rorkApi}/api/team/get-messages?conversationId=${selectedChat}&userId=${user.id}&limit=50&before=${encodeURIComponent(cursor)}`
      );
      const result = await resp.json();
      if (!result.success) return;

      if (result.messages.length > 0) {
        const mapped: ChatMessage[] = result.messages.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          type: msg.type,
          content: msg.content,
          text: msg.text,
          fileName: msg.fileName,
          duration: msg.duration,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: msg.timestamp,
          replyTo: msg.replyTo,
          isDeleted: msg.isDeleted,
        }));

        // Prepend to existing older messages (already ASC from API)
        setOlderMessages((prev) => {
          const n = new Map(prev);
          const existing = n.get(selectedChat) ?? [];
          n.set(selectedChat, [...mapped, ...existing]);
          return n;
        });

        // Advance cursor to the oldest message in this new batch
        oldestCursors.current.set(selectedChat, result.messages[0].timestamp);
      }

      setConvHasMore((prev) => new Map(prev).set(selectedChat, result.hasMore ?? false));
    } catch (e) {
      console.error('[Chat] fetchOlderMessages error:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // ── Image / video helpers ─────────────────────────────────────────────────
  const handlePickImage = async () => {
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
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
      if (status !== 'granted') { Alert.alert('Permission Required', 'Camera permission is needed'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.6 });
      if (!result.canceled && result.assets[0]) setPreviewImage(result.assets[0].uri);
    } catch {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Retries an async operation up to maxAttempts times with exponential backoff.
  // Trailing comma on <T,> prevents TSX from treating it as a JSX tag.
  const withRetry = async <T,>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> => {
    let lastError: Error = new Error('Operation failed');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (e: any) {
        lastError = e;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }
    throw lastError;
  };

  const uploadToS3 = async (localUri: string, mimeType: string): Promise<{ publicUrl: string }> => {
    const mimeToExt: Record<string, string> = {
      'video/quicktime': 'mov', 'video/mp4': 'mp4', 'video/mpeg': 'mp4',
      'audio/mp4': 'mp4', 'audio/wav': 'wav', 'audio/webm': 'webm',
      'image/jpeg': 'jpg', 'image/png': 'png',
    };
    const ext = mimeToExt[mimeType] ?? mimeType.split('/')[1] ?? 'bin';
    const urlResp = await fetch(`${rorkApi}/api/get-upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, fileName: `file.${ext}`, fileType: mimeType }),
    });
    const urlResult = await urlResp.json();
    if (!urlResult.success) throw new Error(urlResult.error || 'Failed to get upload URL');

    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const uploadResp = await fetch(urlResult.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': mimeType } });
      if (!uploadResp.ok) throw new Error(`S3 upload failed: ${uploadResp.status}`);
    } else {
      const uploadResult = await FileSystem.uploadAsync(urlResult.uploadUrl, localUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': mimeType },
      });
      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`S3 upload failed: ${uploadResult.status}`);
      }
    }
    return { publicUrl: urlResult.publicUrl };
  };

  const sendMediaMessage = async (
    type: 'image' | 'video' | 'file',
    publicUrl: string,
    extras?: { fileName?: string; duration?: number },
    convId?: string,
  ) => {
    const targetConvId = convId ?? selectedChat;
    if (!targetConvId) return;
    const resp = await fetch(`${rorkApi}/api/team/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: targetConvId, senderId: user?.id, type, content: publicUrl, fileName: extras?.fileName, duration: extras?.duration }),
    });
    const result = await resp.json();
    if (result.success) {
      const now = new Date().toISOString();
      addMessageToConversation(targetConvId, {
        id: result.message.id,
        senderId: user?.id || '',
        type,
        content: publicUrl,
        fileName: extras?.fileName,
        duration: extras?.duration,
        timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: now,
      });
    } else {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleSendImage = async () => {
    if (!previewImage || !selectedChat) return;
    const localUri = previewImage;
    const convId = selectedChat;

    // Close modal immediately — don't block the user
    setPreviewImage(null);

    const conversation = conversations.find((c) => c.id === convId);
    const isTeam = convId !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

    if (!isTeam) {
      const now = new Date().toISOString();
      addMessageToConversation(convId, { id: Date.now().toString(), senderId: user?.id || '', type: 'image', content: localUri, timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: now });
      return;
    }

    // Optimistic pending message (shows upload spinner in chat)
    const tempId = `pending-img-${Date.now()}`;
    const now = new Date();
    const pendingEntry: PendingUpload = {
      tempId, conversationId: convId, type: 'image', localUri,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
    };
    setPendingUploads((prev) => { const next = new Map(prev); next.set(tempId, pendingEntry); return next; });

    try {
      const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
      const { publicUrl } = await withRetry(() => uploadToS3(localUri, `image/${ext}`));
      await sendMediaMessage('image', publicUrl, undefined, convId);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send image: ' + e.message);
    } finally {
      setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
    }
  };

  const handlePickVideo = async () => {
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        // iOS OS-level compression at pick time — significantly reduces upload size/time
        ...(Platform.OS === 'ios' ? { videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality } : {}),
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const rawMime = asset.mimeType || `video/${asset.uri.split('.').pop()?.toLowerCase() || 'mp4'}`;
        const mime = rawMime === 'video/mov' ? 'video/quicktime' : rawMime;
        setPreviewVideo({ uri: asset.uri, mimeType: mime, duration: asset.duration ? Math.round(asset.duration / 1000) : undefined });
      }
    } catch {
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const handleSendVideo = async () => {
    if (!previewVideo || !selectedChat) return;
    const { uri: localUri, mimeType, duration } = previewVideo;
    const convId = selectedChat;

    // Close modal immediately
    setPreviewVideo(null);

    const conversation = conversations.find((c) => c.id === convId);
    const isTeam = convId !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

    if (!isTeam) {
      const now = new Date().toISOString();
      addMessageToConversation(convId, { id: Date.now().toString(), senderId: user?.id || '', type: 'video', content: localUri, duration, timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: now });
      return;
    }

    const tempId = `pending-vid-${Date.now()}`;
    const now = new Date();
    const pendingEntry: PendingUpload = {
      tempId, conversationId: convId, type: 'video', localUri, duration,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
    };
    setPendingUploads((prev) => { const next = new Map(prev); next.set(tempId, pendingEntry); return next; });

    try {
      const { publicUrl } = await withRetry(() => uploadToS3(localUri, mimeType));
      await sendMediaMessage('video', publicUrl, { duration }, convId);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send video: ' + e.message);
    } finally {
      setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
    }
  };

  const handlePickDocument = async () => {
    if (!selectedChat) return;
    setShowAttachMenu(false);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        const convId = selectedChat;
        const conversation = conversations.find((c) => c.id === convId);
        const isTeam = convId !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

        if (!isTeam) {
          const now = new Date().toISOString();
          addMessageToConversation(convId, { id: Date.now().toString(), senderId: user?.id || '', type: 'file', fileName: file.name, content: file.uri, timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: now });
          return;
        }

        // Optimistic pending entry — upload in background
        const tempId = `pending-doc-${Date.now()}`;
        const now = new Date();
        const pendingEntry: PendingUpload = {
          tempId, conversationId: convId, type: 'file', localUri: file.uri, fileName: file.name,
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          createdAt: now.toISOString(),
        };
        setPendingUploads((prev) => { const next = new Map(prev); next.set(tempId, pendingEntry); return next; });

        try {
          const mime = file.mimeType || 'application/octet-stream';
          const { publicUrl } = await withRetry(() => uploadToS3(file.uri, mime));
          await sendMediaMessage('file', publicUrl, { fileName: file.name }, convId);
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to send document');
        } finally {
          setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pick document');
    }
  };

  const handleAudioSend = async (result: {
    uri: string | null;
    blob?: Blob;
    durationSec: number;
    mimeType: string;
  }) => {
    setIsAudioMode(false);
    if (!selectedChat) return;

    const convId = selectedChat;
    const conversation = conversations.find((c) => c.id === convId);
    const isTeam = convId !== 'ai-assistant' && conversation && (conversation.type === 'individual' || conversation.type === 'group');

    let audioLocalUri: string | null = null;
    let blobUrl: string | null = null;

    if (result.blob) {
      blobUrl = URL.createObjectURL(result.blob);
      audioLocalUri = blobUrl;
    } else if (result.uri) {
      audioLocalUri = result.uri;
    }

    if (!isTeam) {
      const now = new Date().toISOString();
      addMessageToConversation(convId, {
        id: Date.now().toString(), senderId: user?.id || '', type: 'voice',
        content: audioLocalUri || '', duration: result.durationSec,
        timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: now,
      });
      return;
    }

    if (!audioLocalUri) { Alert.alert('Error', 'No audio data'); return; }

    // Optimistic pending entry
    const tempId = `pending-voice-${Date.now()}`;
    const now = new Date();
    const pendingEntry: PendingUpload = {
      tempId, conversationId: convId, type: 'voice', localUri: audioLocalUri,
      duration: result.durationSec,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
    };
    setPendingUploads((prev) => { const next = new Map(prev); next.set(tempId, pendingEntry); return next; });

    try {
      const { publicUrl: audioUrl } = await withRetry(() => uploadToS3(audioLocalUri!, result.mimeType));
      if (blobUrl) URL.revokeObjectURL(blobUrl);

      const msgResp = await fetch(`${rorkApi}/api/team/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, senderId: user?.id, type: 'voice', content: audioUrl, duration: result.durationSec }),
      });
      const msgResult = await msgResp.json();
      if (msgResult.success) {
        const sentAt = new Date().toISOString();
        addMessageToConversation(convId, {
          id: msgResult.message.id, senderId: user?.id || '', type: 'voice',
          content: audioUrl, duration: result.durationSec,
          timestamp: new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: sentAt,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send voice message: ' + e.message);
    } finally {
      setPendingUploads((prev) => { const next = new Map(prev); next.delete(tempId); return next; });
    }
  };

  // ── FlatList renderItem ───────────────────────────────────────────────────
  const otherLastReadAt = selectedChat ? (conversationMeta.get(selectedChat)?.otherLastReadAt ?? null) : null;

  const renderMessageItem = useCallback(({ item }: { item: MessageItem }) => {
    if (item.kind === 'date') {
      return <DateSeparator label={item.label} />;
    }

    const { data: message } = item;
    const senderData = userMap.get(message.senderId);
    const senderName =
      message.senderId === user?.id
        ? user.name
        : senderData?.name || selectedConversation?.name || 'User';
    const senderAvatar =
      message.senderId === user?.id
        ? user?.avatar
        : senderData?.avatar || selectedConversation?.avatar;

    return (
      <MessageBubble
        message={message}
        isOwn={message.senderId === user?.id}
        senderName={senderName}
        senderAvatar={senderAvatar}
        playingAudioId={playingAudioId}
        onAudioPlay={(id) => setPlayingAudioId(id)}
        onReply={handleReply}
        onDelete={handleDeleteMessage}
        onImagePress={(uri) => setSelectedImage(uri)}
        showSenderName={selectedConversation?.type === 'group'}
        otherLastReadAt={message.senderId === user?.id ? otherLastReadAt : undefined}
      />
    );
  }, [userMap, user, selectedConversation, playingAudioId, otherLastReadAt, locallyDeletedIds]);

  // ── Render ────────────────────────────────────────────────────────────────
  const hideTabBar = !!(selectedChat && isSmallScreen && Platform.OS !== 'web');

  return (
    <View style={styles.container}>
      {/* Hide the tab bar when a conversation is open on mobile (Expo Router declarative) */}
      <Tabs.Screen
        options={{
          tabBarStyle: hideTabBar
            ? { display: 'none' }
            : { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
        }}
      />

      <View style={styles.content}>
        {/* ─── Sidebar ──────────────────────────────────────────────────── */}
        {(!isSmallScreen || !selectedChat) && (
          <View style={[styles.sidebar, isSmallScreen && styles.sidebarMobile, isSmallScreen && { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.newChatButton} onPress={() => setShowNewChatModal(true)}>
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

            <ChatTabs activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unreadConversations.size} />

            <FlatList
              data={[
                { _type: 'ai' as const },
                ...filteredConversations.map((c) => ({ _type: 'conv' as const, conv: c })),
              ]}
              keyExtractor={(item) => item._type === 'ai' ? 'ai-assistant' : item.conv.id}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                isLoadingConversations &&
                conversations.filter((c) => c.type === 'individual' || c.type === 'group').length === 0 ? (
                  <View style={styles.contactsSection}>
                    <SkeletonBox width={140} height={14} borderRadius={4} style={{ marginBottom: 12 }} />
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }}>
                        <SkeletonBox width={48} height={48} borderRadius={24} />
                        <View style={{ flex: 1 }}>
                          <SkeletonBox width="70%" height={14} borderRadius={4} />
                          <SkeletonBox width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null
              }
              ListEmptyComponent={
                conversations.filter((c) => c.type === 'individual' || c.type === 'group').length === 0 &&
                !isLoadingConversations ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No conversations yet</Text>
                    <Text style={styles.emptyStateSubtext}>Start a new chat to get started</Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                if (item._type === 'ai') {
                  return (
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
                      {filteredConversations.length > 0 && (
                        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
                          {activeTab === 'groups' ? 'Groups' : activeTab === 'unread' ? 'Unread' : 'Messages'}
                        </Text>
                      )}
                    </View>
                  );
                }

                const conv = item.conv;
                return (
                  <ChatListItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedChat === conv.id}
                    hasUnread={unreadConversations.has(conv.id)}
                    unreadCount={conversationMeta.get(conv.id)?.unreadCount || 0}
                    preview={conversationPreviews.get(conv.id)}
                    isLoadingPreview={isLoadingConversations && !conversationPreviews.has(conv.id)}
                    currentUserId={user?.id}
                    onPress={() => handleSelectChat(conv.id)}
                  />
                );
              }}
            />
          </View>
        )}

        {/* ─── Chat area ────────────────────────────────────────────────── */}
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
                {isSmallScreen && (
                  <View style={[styles.mobileHeader, { paddingTop: insets.top + 6 }]}>
                    <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <ChevronLeft size={28} color="#2563EB" />
                    </TouchableOpacity>
                    {/* Avatar */}
                    {selectedConversation?.avatar ? (
                      <Image source={{ uri: selectedConversation.avatar }} style={styles.mobileHeaderAvatar} contentFit="cover" />
                    ) : (
                      <View style={styles.mobileHeaderAvatarPlaceholder}>
                        <Text style={styles.mobileHeaderAvatarInitials}>
                          {getInitials(selectedConversation?.name || 'CH')}
                        </Text>
                      </View>
                    )}
                    <View style={styles.mobileHeaderInfo}>
                      <Text style={styles.mobileHeaderName} numberOfLines={1}>
                        {selectedConversation?.name || 'Chat'}
                      </Text>
                      {typingUsers.size > 0 ? (
                        <Text style={styles.mobileTypingLabel}>
                          {typingUsers.size === 1
                            ? `${Array.from(typingUsers.values())[0].name.split(' ')[0]} is typing...`
                            : 'Several people are typing...'}
                        </Text>
                      ) : selectedConversation?.type === 'group' ? (
                        <Text style={styles.mobileHeaderSubtitle}>
                          {(selectedConversation.participants?.length || 0) + 1} members
                        </Text>
                      ) : (
                        <Text style={styles.mobileHeaderSubtitle}>tap here for more info</Text>
                      )}
                    </View>
                  </View>
                )}

                <KeyboardAvoidingView
                  style={[{ flex: 1 }, Platform.OS === 'ios' && { paddingBottom: iosKbPadding }]}
                  behavior={Platform.OS === 'ios' ? undefined : 'height'}
                  keyboardVerticalOffset={0}
                >
                  {!isSmallScreen && (
                    <View style={styles.chatHeader}>
                      {/* Avatar */}
                      {selectedConversation?.avatar ? (
                        <Image source={{ uri: selectedConversation.avatar }} style={styles.webHeaderAvatar} contentFit="cover" />
                      ) : (
                        <View style={styles.webHeaderAvatarPlaceholder}>
                          <Text style={styles.webHeaderAvatarInitials}>
                            {getInitials(selectedConversation?.name || 'CH')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.chatHeaderContent}>
                        <Text style={styles.chatTitle}>{selectedConversation?.name}</Text>
                        {typingUsers.size > 0 ? (
                          <Text style={styles.typingHeaderLabel}>
                            {typingUsers.size === 1
                              ? `${Array.from(typingUsers.values())[0].name.split(' ')[0]} is typing...`
                              : 'Several people are typing...'}
                          </Text>
                        ) : selectedConversation?.type === 'group' ? (
                          <Text style={styles.webHeaderSubtitle}>
                            {(selectedConversation.participants?.length || 0) + 1} members
                          </Text>
                        ) : (
                          <Text style={styles.webHeaderSubtitle}>online</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Messages */}
                  <FlatList
                    ref={flatListRef}
                    data={messageItems}
                    keyExtractor={(item) => item.key}
                    renderItem={renderMessageItem}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={20}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={Platform.OS !== 'web'}
                    ListHeaderComponent={
                      selectedChat && selectedChat !== 'ai-assistant' && convHasMore.get(selectedChat) ? (
                        <TouchableOpacity
                          style={styles.loadMoreButton}
                          onPress={fetchOlderMessages}
                          disabled={isLoadingOlder}
                        >
                          {isLoadingOlder ? (
                            <ActivityIndicator size="small" color="#2563EB" />
                          ) : (
                            <Text style={styles.loadMoreText}>Load older messages</Text>
                          )}
                        </TouchableOpacity>
                      ) : null
                    }
                    ListFooterComponent={
                      typingUsers.size > 0 ? <TypingIndicator typingUsers={typingUsers} /> : null
                    }
                  />

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
                    <View style={[styles.recorderContainer, { paddingBottom: iosKbPadding > 0 ? 10 : (hideTabBar ? Math.max(insets.bottom, 10) : 10) }]}>
                      <AudioRecorder autoStart onSend={handleAudioSend} onCancel={() => setIsAudioMode(false)} />
                    </View>
                  ) : (
                    <View style={[styles.inputContainer, { paddingBottom: iosKbPadding > 0 ? 12 : (hideTabBar ? Math.max(insets.bottom, 12) : 12) }]}>
                      <TouchableOpacity style={styles.attachButton} onPress={() => setShowAttachMenu(true)}>
                        <Paperclip size={20} color="#6B7280" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.messageInput}
                        placeholder={t('chat.typeMessage')}
                        placeholderTextColor="#9CA3AF"
                        value={messageText}
                        onChangeText={handleTextChange}
                        multiline
                        onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150)}
                      />
                      {messageText.trim() ? (
                        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                          <Send size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.voiceButton} onPress={() => setIsAudioMode(true)}>
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

      {/* ─── New Chat Modal ────────────────────────────────────────────────── */}
      <Modal visible={showNewChatModal} transparent animationType="slide" onRequestClose={() => setShowNewChatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.newChatModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chat.title')}</Text>
              <TouchableOpacity onPress={() => { setShowNewChatModal(false); setSelectedParticipants([]); setNewChatSearch(''); }}>
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Search size={16} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder={t('common.search')} placeholderTextColor="#9CA3AF" value={newChatSearch} onChangeText={setNewChatSearch} />
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
                  <TouchableOpacity style={[styles.personItem, isSelected && styles.personItemSelected]} onPress={() => handleToggleParticipant(item.id)}>
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
                        <Text style={styles.personType}>{item.role === 'admin' ? 'Admin' : 'Employee'}</Text>
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
                    <><ActivityIndicator size="large" color="#2563EB" /><Text style={styles.emptyStateText}>Loading team members...</Text></>
                  ) : (
                    <Text style={styles.emptyStateText}>{teamMembers.length === 0 ? 'No team members found.' : 'No results found'}</Text>
                  )}
                </View>
              )}
            />
            <TouchableOpacity style={[styles.createChatButton, selectedParticipants.length === 0 && styles.createChatButtonDisabled]} onPress={handleCreateChat} disabled={selectedParticipants.length === 0}>
              <Text style={styles.createChatButtonText}>{selectedParticipants.length === 1 ? 'Start Direct Chat' : `Create Group (${selectedParticipants.length})`}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Attach Menu ──────────────────────────────────────────────────── */}
      <Modal visible={showAttachMenu} transparent animationType="fade" onRequestClose={() => setShowAttachMenu(false)}>
        <TouchableOpacity style={styles.attachModalOverlay} activeOpacity={1} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.attachMenu}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto}>
                <View style={[styles.attachIconContainer, { backgroundColor: '#EF4444' }]}><ImageIcon size={24} color="#FFFFFF" /></View>
                <Text style={styles.attachOptionText}>Take Photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.attachOption} onPress={handlePickImage}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#8B5CF6' }]}><ImageIcon size={24} color="#FFFFFF" /></View>
              <Text style={styles.attachOptionText}>Photo Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handlePickVideo}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#10B981' }]}><VideoIcon size={24} color="#FFFFFF" /></View>
              <Text style={styles.attachOptionText}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handlePickDocument}>
              <View style={[styles.attachIconContainer, { backgroundColor: '#3B82F6' }]}><Paperclip size={24} color="#FFFFFF" /></View>
              <Text style={styles.attachOptionText}>Document</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Fullscreen Image Modal ───────────────────────────────────────── */}
      <Modal visible={selectedImage !== null} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <TouchableOpacity style={styles.imageModalOverlay} activeOpacity={1} onPress={() => setSelectedImage(null)}>
          <TouchableOpacity style={styles.closeImageButton} onPress={() => setSelectedImage(null)}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} contentFit="contain" />}
        </TouchableOpacity>
      </Modal>

      {/* ─── Send Image Preview Modal ──────────────────────────────────────── */}
      <Modal visible={previewImage !== null} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Send Image</Text>
              <TouchableOpacity onPress={() => setPreviewImage(null)}><X size={24} color="#1F2937" /></TouchableOpacity>
            </View>
            {previewImage && <Image source={{ uri: previewImage }} style={styles.previewImage} contentFit="contain" />}
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewCancelButton} onPress={() => setPreviewImage(null)}>
                <Text style={styles.previewCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewSendButton} onPress={handleSendImage}>
                <Send size={20} color="#FFFFFF" /><Text style={styles.previewSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Send Video Preview Modal ─────────────────────────────────────── */}
      <Modal visible={previewVideo != null} transparent={false} animationType="slide" onRequestClose={() => setPreviewVideo(null)}>
        <View style={styles.videoPreviewScreen}>
          <View style={styles.videoPreviewTopBar}>
            <TouchableOpacity onPress={() => setPreviewVideo(null)} style={styles.videoPreviewBackBtn}>
              <X size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.videoPreviewTopTitle}>Send to {conversations.find((c) => c.id === selectedChat)?.name || 'Chat'}</Text>
            {previewVideo?.duration != null && (
              <View style={styles.videoPreviewDurationBadge}>
                <Text style={styles.videoPreviewDurationText}>
                  {Math.floor(previewVideo.duration / 60)}:{String(previewVideo.duration % 60).padStart(2, '0')}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.videoPreviewContent}>
            {previewVideo && Platform.OS !== 'web' ? (
              <VideoPreviewPlayer uri={previewVideo.uri} />
            ) : previewVideo && Platform.OS === 'web' ? (
              /* @ts-ignore web-only */
              <video src={previewVideo.uri} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : null}
          </View>
          <View style={styles.videoPreviewBottomBar}>
            <TouchableOpacity style={styles.videoSendBtn} onPress={handleSendVideo} activeOpacity={0.85}>
              <Send size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  userAvatarInitials: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' as const },
  userName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  teamInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { fontSize: 14, color: '#1F2937' },
  mobileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 10 },
  mobileHeaderAvatar: { width: 38, height: 38, borderRadius: 19 },
  mobileHeaderAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  mobileHeaderAvatarInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  mobileHeaderInfo: { flex: 1, justifyContent: 'center' },
  mobileHeaderName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  mobileHeaderSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  mobileTypingLabel: { fontSize: 12, color: '#25D366', fontStyle: 'italic', marginTop: 1 },
  backButton: { paddingHorizontal: 4, paddingVertical: 4 },
  backButtonText: { fontSize: 16, color: '#2563EB', fontWeight: '600' as const },
  chatTitle: { fontSize: 17, fontWeight: '600' as const, color: '#1F2937' },
  content: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 360, backgroundColor: '#FFFFFF', borderRightWidth: 1, borderRightColor: '#E5E7EB', padding: 16 },
  sidebarMobile: { width: '100%', borderRightWidth: 0, flex: 1 },
  newChatButton: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  newChatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' as const },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  contactsSection: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  clearChatIconButton: { padding: 4 },
  contactItemActive: { backgroundColor: '#EFF6FF' },
  aiChatItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, gap: 12, backgroundColor: '#F0F9FF', borderWidth: 2, borderColor: '#DBEAFE' },
  aiAvatarContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2563EB' },
  aiChatInfo: { flex: 1 },
  aiChatName: { fontSize: 15, fontWeight: '700' as const, color: '#1F2937', marginBottom: 2 },
  aiChatDescription: { fontSize: 12, color: '#6B7280' },
  chatArea: { flex: 1, backgroundColor: '#FFFFFF' },
  chatAreaMobile: { flex: 1 },
  chatHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' },
  webHeaderAvatar: { width: 40, height: 40, borderRadius: 20 },
  webHeaderAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', alignItems: 'center' as const, justifyContent: 'center' as const },
  webHeaderAvatarInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  webHeaderSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  chatHeaderContent: { flex: 1 },
  typingHeaderLabel: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 2 },
  aiHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiChatContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  messagesContainer: { flex: 1 },
  messagesContent: { paddingVertical: 12 },
  loadMoreButton: { alignSelf: 'center', marginVertical: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 16, minWidth: 48, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontSize: 13, color: '#2563EB', fontWeight: '500' },
  replyBar: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8 },
  replyBarContent: { flex: 1 },
  recorderContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center' },
  inputContainer: { flexDirection: 'row', paddingTop: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 8, alignItems: 'flex-end', backgroundColor: '#FFFFFF' },
  attachButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  messageInput: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1F2937', maxHeight: 100, borderWidth: 1, borderColor: '#E5E7EB' },
  sendButton: { backgroundColor: '#2563EB', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  voiceButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  noChatSelected: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noChatText: { fontSize: 20, fontWeight: '600' as const, color: '#1F2937', marginTop: 16 },
  noChatSubtext: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyStateText: { fontSize: 16, fontWeight: '600' as const, color: '#6B7280' },
  emptyStateSubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  newChatModal: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#1F2937' },
  selectedCount: { backgroundColor: '#EFF6FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12 },
  selectedCountText: { fontSize: 14, color: '#2563EB', fontWeight: '600' as const },
  personItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  personItemSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  personInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  personAvatar: { width: 40, height: 40, borderRadius: 20 },
  personAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  personAvatarInitials: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' as const },
  personDetails: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '600' as const, color: '#1F2937' },
  personType: { fontSize: 14, color: '#6B7280' },
  checkIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  createChatButton: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  createChatButtonDisabled: { backgroundColor: '#D1D5DB' },
  createChatButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const },
  attachModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  attachMenu: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 8 },
  attachOption: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12 },
  attachIconContainer: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  attachOptionText: { fontSize: 16, fontWeight: '500' as const, color: '#1F2937' },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeImageButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  fullscreenImage: { width: '90%', height: '80%' },
  previewModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  previewContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '80%' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  previewTitle: { fontSize: 18, fontWeight: '700' as const, color: '#1F2937' },
  previewImage: { width: '100%', height: 400, backgroundColor: '#F3F4F6' },
  previewActions: { flexDirection: 'row', padding: 16, gap: 12 },
  previewCancelButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  previewCancelText: { fontSize: 16, fontWeight: '600' as const, color: '#6B7280' },
  previewSendButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563EB', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  previewSendText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  videoPreviewScreen: { flex: 1, backgroundColor: '#000' },
  videoPreviewTopBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, gap: 12 },
  videoPreviewBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  videoPreviewTopTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const },
  videoPreviewDurationBadge: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  videoPreviewDurationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' as const },
  videoPreviewContent: { flex: 1 },
  videoPreviewBottomBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16 },
  videoSendBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  videoSendBtnDisabled: { opacity: 0.6 },
});
