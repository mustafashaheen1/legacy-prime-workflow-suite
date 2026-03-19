import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRef } from 'react';
import { Image } from 'expo-image';
import { CheckCheck } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { ChatMessage } from '@/types';
import AudioPlayer from './AudioPlayer';
import VideoMessage from './VideoMessage';
import ReplyPreview from './ReplyPreview';
import { useState } from 'react';

// Swipeable — gesture-handler (no-op on web)
let Swipeable: any = null;
if (Platform.OS !== 'web') {
  try {
    Swipeable = require('react-native-gesture-handler/Swipeable').default;
  } catch { /* not available */ }
}

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  senderName: string;
  senderAvatar?: string;
  playingAudioId: string | null;
  onAudioPlay: (messageId: string) => void;
  onReply: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onImagePress: (uri: string) => void;
  showSenderName?: boolean;
  otherLastReadAt?: string | null;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function formatTime(createdAt?: string, timestamp?: string): string {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
  return timestamp || '';
}

function getFileTypeConfig(ext: string) {
  switch (ext) {
    case 'pdf':  return { label: 'PDF', color: '#EF4444', description: 'PDF Document' };
    case 'doc':
    case 'docx': return { label: 'DOC', color: '#2563EB', description: 'Word Document' };
    case 'xls':
    case 'xlsx': return { label: 'XLS', color: '#16A34A', description: 'Spreadsheet' };
    case 'ppt':
    case 'pptx': return { label: 'PPT', color: '#EA580C', description: 'Presentation' };
    case 'zip':
    case 'rar':  return { label: 'ZIP', color: '#7C3AED', description: 'Archive' };
    case 'txt':  return { label: 'TXT', color: '#6B7280', description: 'Text File' };
    case 'mp3':
    case 'wav':  return { label: 'AUD', color: '#0891B2', description: 'Audio File' };
    default:     return { label: (ext.toUpperCase() || 'FILE').slice(0, 3) || 'FILE', color: '#6B7280', description: 'File' };
  }
}

function ReadReceipt({ isOwn, createdAt, otherLastReadAt }: { isOwn: boolean; createdAt?: string; otherLastReadAt?: string | null }) {
  if (!isOwn) return null;
  const isRead = !!(createdAt && otherLastReadAt && otherLastReadAt >= createdAt);
  return <CheckCheck size={14} color={isRead ? '#2563EB' : 'rgba(0,0,0,0.3)'} strokeWidth={2.5} />;
}

export default function MessageBubble({
  message,
  isOwn,
  senderName,
  senderAvatar,
  playingAudioId,
  onAudioPlay,
  onReply,
  onDelete,
  onImagePress,
  showSenderName = false,
  otherLastReadAt,
}: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const swipeableRef = useRef<any>(null);

  const triggerReply = () => {
    swipeableRef.current?.close();
    onReply(message);
  };

  const handleLongPress = () => setMenuVisible(true);

  const handleDelete = () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this message for everyone?')) onDelete(message.id);
    } else {
      Alert.alert('Delete Message', 'Delete this message for everyone?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(message.id) },
      ]);
    }
  };

  const handleCopy = async () => {
    setMenuVisible(false);
    if (message.text || message.content) {
      await Clipboard.setStringAsync(message.text || message.content || '');
    }
  };

  // Swipe action (reply icon)
  const renderSwipeAction = () => (
    <View style={[styles.swipeAction, isOwn ? styles.swipeActionLeft : styles.swipeActionRight]}>
      <View style={styles.swipeIconCircle}>
        <Text style={styles.swipeIcon}>↩</Text>
      </View>
    </View>
  );

  // Deleted message
  if (message.isDeleted) {
    return (
      <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
        {!isOwn && <AvatarPlaceholder name={senderName} avatar={senderAvatar} />}
        <View style={[styles.bubble, styles.bubbleDeleted]}>
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
        {isOwn && <AvatarPlaceholder name={senderName} avatar={senderAvatar} />}
      </View>
    );
  }

  const displayTime = formatTime(message.createdAt, message.timestamp);
  const isUploading = message.uploadProgress === 0;

  const bubbleContent = (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft]}>
      {!isOwn && <AvatarPlaceholder name={senderName} avatar={senderAvatar} />}

      <View style={styles.bubbleWrapper}>
        {showSenderName && !isOwn && (
          <Text style={styles.senderLabel}>{senderName}</Text>
        )}

        <TouchableOpacity
          onLongPress={handleLongPress}
          activeOpacity={0.9}
          delayLongPress={400}
        >
          <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            {/* Reply quote */}
            {message.replyTo && (
              <ReplyPreview replyTo={message.replyTo} insideBubble isOwn={isOwn} />
            )}

            {/* Content or upload spinner */}
            {isUploading ? (
              <UploadingContent type={message.type} isOwn={isOwn} />
            ) : (
              <BubbleContent
                message={message}
                isOwn={isOwn}
                playingAudioId={playingAudioId}
                onAudioPlay={onAudioPlay}
                onImagePress={onImagePress}
              />
            )}

            {/* Timestamp + read receipt */}
            <View style={styles.metaRow}>
              <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
                {displayTime}
              </Text>
              {isUploading
                ? <ActivityIndicator size={10} color={isOwn ? '#6B7280' : 'rgba(255,255,255,0.6)'} />
                : <ReadReceipt isOwn={isOwn} createdAt={message.createdAt} otherLastReadAt={otherLastReadAt} />
              }
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {isOwn && <AvatarPlaceholder name={senderName} avatar={senderAvatar} />}
    </View>
  );

  // Wrap with Swipeable on native (not for uploading messages)
  const wrapped =
    Swipeable && !isUploading ? (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={isOwn ? renderSwipeAction : undefined}
        renderLeftActions={!isOwn ? renderSwipeAction : undefined}
        onSwipeableOpen={triggerReply}
        friction={2}
        leftThreshold={50}
        rightThreshold={50}
        overshootLeft={false}
        overshootRight={false}
      >
        {bubbleContent}
      </Swipeable>
    ) : bubbleContent;

  return (
    <>
      {wrapped}

      {/* Context Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <MenuOption label="Reply" onPress={() => { setMenuVisible(false); triggerReply(); }} />
            {message.type === 'text' && <MenuOption label="Copy" onPress={handleCopy} />}
            {isOwn && <MenuOption label="Delete for everyone" onPress={handleDelete} destructive />}
            <MenuOption label="Cancel" onPress={() => setMenuVisible(false)} />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function UploadingContent({ type, isOwn }: { type: string; isOwn: boolean }) {
  const color = isOwn ? '#6B7280' : 'rgba(255,255,255,0.7)';
  const label =
    type === 'image' ? '📷 Sending photo...'
    : type === 'video' ? '🎬 Sending video...'
    : type === 'voice' ? '🎤 Sending voice...'
    : '📎 Sending file...';
  return (
    <View style={styles.uploadingRow}>
      <ActivityIndicator size="small" color={isOwn ? '#2563EB' : '#FFFFFF'} />
      <Text style={[styles.uploadingLabel, { color }]}>{label}</Text>
    </View>
  );
}

function AvatarPlaceholder({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) return <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />;
  return (
    <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor(name) }]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

function MenuOption({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuOptionText, destructive && styles.menuOptionDestructive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BubbleContent({
  message, isOwn, playingAudioId, onAudioPlay, onImagePress,
}: {
  message: ChatMessage; isOwn: boolean;
  playingAudioId: string | null;
  onAudioPlay: (id: string) => void;
  onImagePress: (uri: string) => void;
}) {
  const textColor = isOwn ? '#1F2937' : '#FFFFFF';

  switch (message.type) {
    case 'text':
      return (
        <Text style={[styles.messageText, { color: textColor }]} selectable>
          {message.text || message.content || ''}
        </Text>
      );

    case 'voice':
      return (
        <AudioPlayer
          uri={message.content || ''}
          duration={message.duration || 0}
          messageId={message.id}
          isOwn={isOwn}
          onPlay={onAudioPlay}
          shouldStop={playingAudioId !== null && playingAudioId !== message.id}
        />
      );

    case 'image':
      return (
        <TouchableOpacity onPress={() => onImagePress(message.content || '')}>
          <Image source={{ uri: message.content }} style={styles.messageImage} contentFit="cover" />
        </TouchableOpacity>
      );

    case 'video':
      return <VideoMessage uri={message.content || ''} duration={message.duration} />;

    case 'file': {
      const url = message.content;
      const fileName = message.fileName || 'Document';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const config = getFileTypeConfig(ext);

      return (
        <TouchableOpacity
          style={styles.fileCard}
          onPress={() => {
            if (!url) return;
            if (Platform.OS === 'web') window.open(url, '_blank');
            else Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open file'));
          }}
          activeOpacity={url ? 0.7 : 1}
        >
          <View style={[styles.fileTypeBox, { backgroundColor: config.color }]}>
            <Text style={styles.fileTypeLabel}>{config.label}</Text>
          </View>
          <View style={styles.fileCardInfo}>
            <Text
              style={[styles.fileCardName, { color: textColor }]}
              numberOfLines={2}
            >
              {fileName}
            </Text>
            <Text style={[styles.fileCardDesc, { color: isOwn ? '#6B7280' : 'rgba(255,255,255,0.65)' }]}>
              {config.description}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2, paddingHorizontal: 12, gap: 8 },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubbleWrapper: { maxWidth: '75%', gap: 2 },
  senderLabel: { fontSize: 11, fontWeight: '600' as const, color: '#6B7280', marginLeft: 4, marginBottom: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  bubbleOwn: { backgroundColor: '#D1FAE5', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#2563EB', borderBottomLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  deletedText: { fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageImage: { width: 220, height: 160, borderRadius: 8 },

  // File card — WhatsApp style
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180, maxWidth: 240 },
  fileTypeBox: { width: 44, height: 52, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileTypeLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.5 },
  fileCardInfo: { flex: 1, gap: 2 },
  fileCardName: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  fileCardDesc: { fontSize: 11 },

  // Upload state
  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  uploadingLabel: { fontSize: 13 },

  // Meta row (time + receipt)
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 3, marginTop: 2 },
  timestamp: { fontSize: 11 },
  timestampOwn: { color: '#6B7280' },
  timestampOther: { color: 'rgba(255,255,255,0.7)' },

  // Avatar
  avatar: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  avatarPlaceholder: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitials: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' as const },

  // Swipe action
  swipeAction: { justifyContent: 'center', paddingHorizontal: 16 },
  swipeActionRight: { alignItems: 'flex-start' },
  swipeActionLeft: { alignItems: 'flex-end' },
  swipeIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  swipeIcon: { fontSize: 16 },

  // Context menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', minWidth: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  menuOption: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  menuOptionText: { fontSize: 16, color: '#1F2937', textAlign: 'center' },
  menuOptionDestructive: { color: '#EF4444' },
});
