import { Bell } from 'lucide-react-native';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

export default function NotificationBell() {
  const router = useRouter();
  const { getNotifications } = useApp();
  const unreadCount = getNotifications(true).length;

  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={styles.container}
      accessibilityLabel="Notifications"
      accessibilityHint={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
    >
      <Bell size={24} color="#1F2937" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingRight: 16,
    paddingVertical: 8,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 10,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
});
