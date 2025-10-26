import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useMemo } from 'react';

export default function FloatingChatButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { conversations, user } = useApp();

  const unreadCount = useMemo(() => {
    return conversations.reduce((count, conv) => {
      const lastMessage = conv.lastMessage;
      if (lastMessage && lastMessage.senderId !== user?.id) {
        return count + 1;
      }
      return count;
    }, 0);
  }, [conversations, user]);

  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname === '/login' || pathname === '/subscription';

  if (isOnChatScreen || isOnAuthScreen) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => router.push('/chat')}
      activeOpacity={0.8}
    >
      <MessageCircle size={26} color="#FFFFFF" strokeWidth={2.5} />
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
  floatingButton: {
    position: 'absolute' as const,
    bottom: 90,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 997,
  },
  badge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
