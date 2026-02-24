import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Bell, BellOff, CheckCheck } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const TYPE_COLORS: Record<Notification['type'], string> = {
  'task-reminder':     '#F59E0B',
  'estimate-received': '#3B82F6',
  'proposal-submitted':'#8B5CF6',
  'payment-received':  '#10B981',
  'change-order':      '#EF4444',
  'general':           '#6B7280',
};

// ─── Row ──────────────────────────────────────────────────────────────────────

interface NotificationRowProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const borderColor = TYPE_COLORS[notification.type] ?? '#6B7280';

  return (
    <TouchableOpacity
      onPress={() => onPress(notification)}
      style={[styles.row, { borderLeftColor: borderColor }]}
      activeOpacity={0.7}
    >
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text
            style={[styles.rowTitle, !notification.read && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <View style={styles.rowMeta}>
            {!notification.read && <View style={styles.unreadDot} />}
            <Text style={styles.rowTime}>{formatTimeAgo(notification.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.rowMessage} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, getNotifications, markNotificationRead, refreshNotifications } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  }, [refreshNotifications]);

  // Refresh immediately on focus and then every 15s while screen is open
  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
      const interval = setInterval(() => refreshNotifications(), 15_000);
      return () => clearInterval(interval);
    }, [refreshNotifications])
  );

  const notifications = getNotifications();
  const unread = notifications.filter(n => !n.read);

  const handleMarkAllRead = useCallback(() => {
    if (!user?.id || unread.length === 0) return;
    // Single bulk UPDATE instead of N mutations
    supabase.from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id!)
      .eq('read', false)
      .then(({ error }) => {
        if (error) console.warn('[Notifications] Mark-all-read failed:', error);
      });
    // Optimistic local update so the UI clears immediately
    unread.forEach(n => markNotificationRead(n.id));
  }, [user, unread, markNotificationRead]);

  const handleRowPress = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        markNotificationRead(notification.id);
      }

      const data = notification.data as any;

      switch (notification.type) {
        case 'task-reminder':
          router.push('/(tabs)/dashboard');
          break;
        case 'estimate-received':
        case 'proposal-submitted':
          router.push('/(tabs)/subcontractors');
          break;
        case 'payment-received':
          if (data?.projectId) {
            router.push(`/project/${data.projectId}` as any);
          } else {
            router.push('/(tabs)/expenses');
          }
          break;
        case 'change-order':
          if (data?.projectId) {
            router.push(`/project/${data.projectId}/change-orders` as any);
          } else {
            router.push('/(tabs)/dashboard');
          }
          break;
        case 'general':
          // Task-assignment notifications carry a taskId — go to dashboard where tasks live
          router.push('/(tabs)/dashboard');
          break;
        default:
          break;
      }
    },
    [markNotificationRead, router]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: unread.length > 0
            ? () => (
                <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerBtn}>
                  <CheckCheck size={20} color="#2563EB" />
                  <Text style={styles.headerBtnText}>Mark all read</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={handleRowPress} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BellOff size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              You'll see task reminders, payments, and other updates here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 16,
  },
  headerBtnText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingVertical: 8,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowContent: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '400',
  },
  rowTitleUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  rowTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  rowMessage: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});
