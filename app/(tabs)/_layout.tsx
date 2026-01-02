import { Tabs, useRouter, useSegments } from "expo-router";
import { LayoutDashboard, Users, Clock, DollarSign, Camera, Calendar, MessageSquare, Settings, HardHat } from "lucide-react-native";
import React, { useEffect } from "react";
import { useTranslation } from 'react-i18next';
import UserAvatar from '@/components/UserAvatar';
import { useApp } from '@/contexts/AppContext';


export default function TabLayout() {
  const { t } = useTranslation();
  const { user } = useApp();
  const router = useRouter();
  const segments = useSegments();

  // Protect all tab routes - redirect to login if not authenticated
  useEffect(() => {
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // User is not signed in and trying to access protected route
      console.log('[Auth] No user found, redirecting to login');
      router.replace('/login');
    }
  }, [user, segments]);

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
        name="expenses"
        options={{
          title: t('common.expenses'),
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
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
        name="schedule"
        options={{
          title: t('common.schedule'),
          headerShown: false,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('common.chat'),
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subcontractors"
        options={{
          title: 'Subs',
          tabBarIcon: ({ color }) => <HardHat size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('common.settings'),
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

