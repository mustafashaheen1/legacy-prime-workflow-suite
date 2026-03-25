import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Mic, Image as ImageIcon, Video, Paperclip, Users } from 'lucide-react-native';
import { ChatConversation } from '@/types';
import SkeletonBox from '@/components/SkeletonBox';

type PreviewEntry = { text: string; timestamp: string; senderId: string; type?: string };

interface Props {
  conversation: ChatConversation;
  isSelected: boolean;
  hasUnread: boolean;
  unreadCount?: number;
  preview?: PreviewEntry;
  isLoadingPreview?: boolean;
  currentUserId?: string;
  onPress: () => void;
}

function formatChatTime(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`;
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Deterministic color from name string */
function avatarColor(name: string) {
  const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#9333EA'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function LastMessagePreview({ preview, isGroup, isLoading }: { preview?: PreviewEntry; isGroup: boolean; isLoading?: boolean }) {
  if (!preview) {
    if (isLoading) {
      return <SkeletonBox width="65%" height={12} borderRadius={4} />;
    }
    return <Text style={styles.previewText} numberOfLines={1}>No messages yet</Text>;
  }

  const type = preview.type;

  const iconSize = 13;
  const iconColor = '#6B7280';

  let icon: React.ReactNode = null;
  let label = preview.text || '';

  if (type === 'voice') {
    icon = <Mic size={iconSize} color={iconColor} />;
    label = 'Voice message';
  } else if (type === 'image') {
    icon = <ImageIcon size={iconSize} color={iconColor} />;
    label = 'Photo';
  } else if (type === 'video') {
    icon = <Video size={iconSize} color={iconColor} />;
    label = 'Video';
  } else if (type === 'file') {
    icon = <Paperclip size={iconSize} color={iconColor} />;
    label = preview.text || 'File';
  }

  return (
    <View style={styles.previewRow}>
      {icon}
      <Text style={styles.previewText} numberOfLines={1}>{label || 'Attachment'}</Text>
    </View>
  );
}

export default function ChatListItem({
  conversation,
  isSelected,
  hasUnread,
  unreadCount = 0,
  preview,
  isLoadingPreview,
  currentUserId,
  onPress,
}: Props) {
  const isGroup = conversation.type === 'group';

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.containerActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {conversation.avatar ? (
        <Image
          source={{ uri: conversation.avatar }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : isGroup ? (
        <View style={[styles.avatarPlaceholder, { backgroundColor: '#EFF6FF' }]}>
          <Users size={20} color="#2563EB" />
        </View>
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor(conversation.name) }]}>
          <Text style={styles.avatarInitials}>{getInitials(conversation.name)}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {conversation.name}
          </Text>
          {preview?.timestamp && (
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {formatChatTime(preview.timestamp)}
            </Text>
          )}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.previewContainer}>
            <LastMessagePreview preview={preview} isGroup={isGroup} isLoading={isLoadingPreview} />
          </View>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 0 ? Math.min(unreadCount, 99) : ''}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 2,
    gap: 12,
  },
  containerActive: {
    backgroundColor: '#EFF6FF',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
  },
  nameUnread: {
    fontWeight: '700' as const,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
    flexShrink: 0,
  },
  timeUnread: {
    color: '#2563EB',
    fontWeight: '600' as const,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewContainer: {
    flex: 1,
    minWidth: 0,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  badge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
