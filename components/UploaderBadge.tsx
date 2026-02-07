import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import type { Uploader } from '@/types';

interface UploaderBadgeProps {
  uploader: Uploader | null | undefined;
  size?: 'small' | 'medium';
  showName?: boolean;
  onPress?: () => void;
}

/**
 * UploaderBadge Component
 *
 * Displays user avatar and name for expenses/photos uploader.
 *
 * Usage:
 *   <UploaderBadge uploader={expense.uploader} size="small" />
 *   <UploaderBadge uploader={photo.uploader} size="medium" showName={true} />
 *
 * Features:
 * - Shows avatar image if available
 * - Shows initials if no avatar
 * - Gracefully handles null/undefined uploader
 * - Optional click handler for user profile navigation
 */
export default function UploaderBadge({
  uploader,
  size = 'small',
  showName = true,
  onPress,
}: UploaderBadgeProps) {
  // Don't render anything if no uploader (historical records)
  if (!uploader) {
    return null;
  }

  const avatarSize = size === 'small' ? 24 : 32;
  const fontSize = size === 'small' ? 10 : 12;
  const nameSize = size === 'small' ? 12 : 14;

  // Generate initials from name
  const initials = uploader.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const content = (
    <>
      {/* Avatar or Initials */}
      {uploader.avatar ? (
        <Image
          source={{ uri: uploader.avatar }}
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </View>
      )}

      {/* Name */}
      {showName && (
        <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>
          {uploader.name}
        </Text>
      )}
    </>
  );

  // If onPress provided, wrap in TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  // Otherwise, just a View
  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  name: {
    color: '#6B7280',
    fontWeight: '500',
    maxWidth: 120,
  },
});
