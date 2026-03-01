import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DollarSign, Calendar, MessageSquare, HardHat, Settings, ChevronRight } from 'lucide-react-native';
import { usePermissions } from '@/hooks/usePermissions';

interface MenuItem {
  key: string;
  featureKey: string | null; // null = always visible (not feature-gated)
  icon: React.ReactNode;
  label: string;
  route: string;
  description: string;
}

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { hasFeatureAccess } = usePermissions();

  const allItems: MenuItem[] = [
    {
      key: 'expenses',
      featureKey: 'expenses',
      icon: <DollarSign size={24} color="#2563EB" />,
      label: t('common.expenses'),
      route: '/(tabs)/expenses',
      description: 'Track and manage expenses',
    },
    {
      key: 'schedule',
      featureKey: 'schedule',
      icon: <Calendar size={24} color="#2563EB" />,
      label: t('common.schedule'),
      route: '/(tabs)/schedule',
      description: 'View and manage schedules',
    },
    {
      key: 'chat',
      featureKey: 'chat',
      icon: <MessageSquare size={24} color="#2563EB" />,
      label: t('common.chat'),
      route: '/(tabs)/chat',
      description: 'Team communications',
    },
    {
      key: 'subcontractors',
      featureKey: 'subs',
      icon: <HardHat size={24} color="#2563EB" />,
      label: 'Subcontractors',
      route: '/(tabs)/subcontractors',
      description: 'Manage subcontractors',
    },
    {
      key: 'settings',
      featureKey: null, // settings always visible
      icon: <Settings size={24} color="#2563EB" />,
      label: t('common.settings'),
      route: '/(tabs)/settings',
      description: 'App settings and preferences',
    },
  ];

  // Filter out items the user doesn't have access to.
  const menuItems = allItems.filter(
    (item) => item.featureKey === null || hasFeatureAccess(item.featureKey)
  );

  const handleItemPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.menuItem}
              onPress={() => handleItemPress(item.route)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>{item.icon}</View>
              <View style={styles.textContainer}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
});
