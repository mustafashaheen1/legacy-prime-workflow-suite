import { Tabs, useRouter, useSegments } from "expo-router";
import { LayoutDashboard, Users, Clock, DollarSign, Camera, Calendar, MessageSquare, Settings, HardHat, Menu, ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Platform, TouchableOpacity } from 'react-native';
import UserAvatar from '@/components/UserAvatar';
import NotificationBell from '@/components/NotificationBell';
import { useApp } from '@/contexts/AppContext';
import { usePermissions } from '@/hooks/usePermissions';


// Back button component for hidden tab screens
function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/more');
        }
      }}
      style={{ paddingLeft: 16, paddingVertical: 8 }}
    >
      <ArrowLeft size={24} color="#1F2937" />
    </TouchableOpacity>
  );
}

// Maps tab screen names to their feature keys so we can gate them uniformly.
const TAB_FEATURE_MAP: Record<string, string> = {
  dashboard:      'dashboard',
  crm:            'crm',
  clock:          'clock',
  photos:         'photos',
  expenses:       'expenses',
  schedule:       'schedule',
  chat:           'chat',
  subcontractors: 'subs',
};

export default function TabLayout() {
  const { t } = useTranslation();
  const { user, isLoading } = useApp();
  const { hasFeatureAccess } = usePermissions();
  const router = useRouter();
  const segments = useSegments();
  const [navigationReady, setNavigationReady] = React.useState(false);

  // Mark navigation as ready after first render
  useEffect(() => {
    const timer = setTimeout(() => setNavigationReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Protect all tab routes - redirect to login if not authenticated
  useEffect(() => {
    // Don't do anything while loading or navigation not ready
    if (!navigationReady || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // User is not signed in and trying to access protected route
      console.log('[Auth] No user found, redirecting to login');
      router.replace('/login');
    }
  }, [user, segments, navigationReady, isLoading]);

  // If the user lands on a tab they no longer have access to (e.g. admin
  // revoked the feature after they logged in), redirect to first allowed tab.
  useEffect(() => {
    if (!user || !navigationReady || isLoading) return;
    const currentTab = segments[1] as string | undefined;
    const featureKey = currentTab ? TAB_FEATURE_MAP[currentTab] : undefined;
    if (featureKey && !hasFeatureAccess(featureKey)) {
      const fallback = ['dashboard', 'crm', 'clock', 'photos'].find(
        (tab) => hasFeatureAccess(TAB_FEATURE_MAP[tab])
      );
      router.replace(`/(tabs)/${fallback ?? 'more'}` as any);
    }
  }, [user?.id, user?.customPermissions, segments[1], navigationReady, isLoading]);

  // Returns null (blocks tab bar entry) or undefined (keeps default behaviour).
  // For "hidden" mobile tabs we also pass the web path so web users keep access.
  const tabHref = (featureKey: string, webPath?: string): string | null | undefined => {
    if (!hasFeatureAccess(featureKey)) return null;
    if (webPath) return Platform.OS === 'web' ? webPath : null;
    return undefined;
  };

  // Don't render tabs if not authenticated
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: true,
        headerLeft: () => <UserAvatar />,
        headerRight: () => <NotificationBell />,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('common.dashboard'),
          tabBarIcon: ({ color }) => <LayoutDashboard size={24} color={color} />,
          href: tabHref('dashboard'),
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: t('common.crm'),
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          href: tabHref('crm'),
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: t('common.clock'),
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
          href: tabHref('clock'),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('common.photos'),
          tabBarIcon: ({ color }) => <Camera size={24} color={color} />,
          href: tabHref('photos'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Menu size={24} color={color} />,
        }}
      />
      {/* Hidden tabs - accessible via More screen on mobile, or directly on web */}
      <Tabs.Screen
        name="expenses"
        options={{
          title: t('common.expenses'),
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
          href: tabHref('expenses', '/expenses'),
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('common.schedule'),
          headerShown: false,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
          href: tabHref('schedule', '/schedule'),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('common.chat'),
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
          href: tabHref('chat', '/chat'),
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="subcontractors"
        options={{
          title: 'Subcontractors',
          tabBarIcon: ({ color }) => <HardHat size={24} color={color} />,
          href: tabHref('subs', '/subcontractors'),
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          href: Platform.OS === 'web' ? '/settings' : null,
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
    </Tabs>
  );
}

