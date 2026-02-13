import { Tabs, useRouter, useSegments } from "expo-router";
import { LayoutDashboard, Users, Clock, DollarSign, Camera, Calendar, MessageSquare, Settings, HardHat, Menu, ArrowLeft } from "lucide-react-native";
import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Platform, TouchableOpacity } from 'react-native';
import UserAvatar from '@/components/UserAvatar';
import { useApp } from '@/contexts/AppContext';


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

export default function TabLayout() {
  const { t } = useTranslation();
  const { user, isLoading } = useApp();
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
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: t('common.crm'),
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clock"
        options={{
          title: t('common.clock'),
          tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: t('common.photos'),
          tabBarIcon: ({ color }) => <Camera size={24} color={color} />,
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
          href: Platform.OS === 'web' ? '/expenses' : null, // Hide from tab bar on mobile
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: t('common.schedule'),
          headerShown: false,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
          href: Platform.OS === 'web' ? '/schedule' : null, // Hide from tab bar on mobile
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('common.chat'),
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
          href: Platform.OS === 'web' ? '/chat' : null, // Hide from tab bar on mobile
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="subcontractors"
        options={{
          title: 'Subcontractors',
          tabBarIcon: ({ color }) => <HardHat size={24} color={color} />,
          href: Platform.OS === 'web' ? '/subcontractors' : null, // Hide from tab bar on mobile
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
          href: Platform.OS === 'web' ? '/settings' : null, // Hide from tab bar on mobile
          headerLeft: Platform.OS !== 'web' ? () => <BackButton /> : () => <UserAvatar />,
        }}
      />
    </Tabs>
  );
}

