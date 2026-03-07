import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { useApp } from '@/contexts/AppContext';

export default function FloatingChatButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadChatCount, user } = useApp();

  // unreadChatCount is maintained by chat.tsx via setUnreadChatCount — it is
  // the authoritative value driven by AsyncStorage-persisted seen-timestamps,
  // so it correctly goes to 0 when all conversations are read.

  const isOnChatScreen = pathname === '/chat';
  const isOnAuthScreen = pathname?.includes('/login') || pathname?.includes('/subscription') || pathname?.includes('/signup') || pathname?.includes('/(auth)');

  if (isOnChatScreen || isOnAuthScreen || !user) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.floatingButton}
      onPress={() => router.push('/chat')}
      activeOpacity={0.8}
    >
      <MessageCircle size={26} color="#FFFFFF" strokeWidth={2.5} />
      {unreadChatCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadChatCount > 99 ? '99+' : unreadChatCount}
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
