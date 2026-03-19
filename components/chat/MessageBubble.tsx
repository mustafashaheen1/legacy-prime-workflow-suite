import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Paperclip, CheckCheck } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { ChatMessage } from '@/types';
import AudioPlayer from './AudioPlayer';
import VideoMessage from './VideoMessage';
import ReplyPreview from './ReplyPreview';

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
  /** ISO timestamp of when the other participant last read this conversation.
   *  Used to determine read receipt status on own messages. */
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

/** Formats a display time from either createdAt (ISO) or pre-formatted timestamp string. */
function formatTime(createdAt?: string, timestamp?: string): string {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
  return timestamp || '';
}

function ReadReceipt({
  isOwn,
  createdAt,
  otherLastReadAt,
}: {
  isOwn: boolean;
  createdAt?: string;
  otherLastReadAt?: string | null;
}) {
  if (!isOwn) return null;

  // Determine read state
  let isRead = false;
  if (createdAt && otherLastReadAt) {
    isRead = otherLastReadAt >= createdAt;
  }

  if (isRead) {
    return <CheckCheck size={14} color="#2563EB" strokeWidth={2.5} />;
  }
  return <CheckCheck size={14} color="rgba(0,0,0,0.3)" strokeWidth={2.5} />;
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

  const handleLongPress = () => setMenuVisible(true);

  const handleReply = () => {
    setMenuVisible(false);
    onReply(message);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this message for everyone?')) {
        onDelete(message.id);
      }
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

  // Deleted message placeholder
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

  const bubbleStyle = isOwn ? styles.bubbleOwn : styles.bubbleOther;
  const displayTime = formatTime(message.createdAt, message.timestamp);

  return (
    <>
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
            <View style={[styles.bubble, bubbleStyle]}>
              {/* Reply quote block */}
              {message.replyTo && (
                <ReplyPreview
                  replyTo={message.replyTo}
                  insideBubble
                  isOwn={isOwn}
                />
              )}

              {/* Message content */}
              <BubbleContent
                message={message}
                isOwn={isOwn}
                playingAudioId={playingAudioId}
                onAudioPlay={onAudioPlay}
                onImagePress={onImagePress}
              />

              {/* Timestamp + read receipt row */}
              <View style={styles.metaRow}>
                <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
                  {displayTime}
                </Text>
                <ReadReceipt
                  isOwn={isOwn}
                  createdAt={message.createdAt}
                  otherLastReadAt={otherLastReadAt}
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {isOwn && <AvatarPlaceholder name={senderName} avatar={senderAvatar} />}
      </View>

      {/* Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menu}>
            <MenuOption label="Reply" onPress={handleReply} />
            {message.type === 'text' && (
              <MenuOption label="Copy" onPress={handleCopy} />
            )}
            {isOwn && (
              <MenuOption label="Delete for everyone" onPress={handleDelete} destructive />
            )}
            <MenuOption label="Cancel" onPress={() => setMenuVisible(false)} />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function AvatarPlaceholder({ name, avatar }: { name: string; avatar?: string }) {
  if (avatar) {
    return <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor(name) }]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

function MenuOption({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuOptionText, destructive && styles.menuOptionDestructive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function BubbleContent({
  message,
  isOwn,
  playingAudioId,
  onAudioPlay,
  onImagePress,
}: {
  message: ChatMessage;
  isOwn: boolean;
  playingAudioId: string | null;
  onAudioPlay: (id: string) => void;
  onImagePress: (uri: string) => void;
}) {
  const textColor = isOwn ? '#1F2937' : '#FFFFFF';
  const fileNameColor = isOwn ? '#1F2937' : '#FFFFFF';
  const paperclipColor = isOwn ? '#1F2937' : '#FFFFFF';

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
          <Image
            source={{ uri: message.content }}
            style={styles.messageImage}
            contentFit="cover"
          />
        </TouchableOpacity>
      );

    case 'video':
      return <VideoMessage uri={message.content || ''} duration={message.duration} />;

    case 'file': {
      const url = message.content;
      return (
        <TouchableOpacity
          style={styles.fileRow}
          onPress={() => {
            if (!url) return;
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url).catch(() => Alert.alert('Error', 'Unable to open file'));
            }
          }}
          activeOpacity={url ? 0.7 : 1}
        >
          <Paperclip size={16} color={paperclipColor} />
          <Text style={[styles.fileName, { color: fileNameColor }]} numberOfLines={2}>
            {message.fileName || 'Download file'}
          </Text>
        </TouchableOpacity>
      );
    }

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  bubbleWrapper: {
    maxWidth: '75%',
    gap: 2,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginLeft: 4,
    marginBottom: 2,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleOwn: {
    backgroundColor: '#D1FAE5',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#2563EB',
    borderBottomLeftRadius: 4,
  },
  bubbleDeleted: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  deletedText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 220,
  },
  fileName: {
    fontSize: 14,
    flex: 1,
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
  },
  timestampOwn: {
    color: '#6B7280',
  },
  timestampOther: {
    color: 'rgba(255,255,255,0.7)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  menuOptionText: {
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
  },
  menuOptionDestructive: {
    color: '#EF4444',
  },
});
