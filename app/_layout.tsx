import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import GlobalAIChat from "@/components/GlobalAIChatSimple";
import FloatingChatButton from "@/components/FloatingChatButton";
import ErrorBoundary from "@/components/ErrorBoundary";
import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";
import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'web') {
  const originalError = console.error;
  console.error = (...args) => {
    const message = JSON.stringify(args);
    if (message.includes('transform-origin') || message.includes('transformOrigin')) {
      return;
    }
    originalError(...args);
  };
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/subscription',
  '/inspection',
  '/subcontractor-register',
  '/reset-password',
  '/forgot-password',
  '/phone-login',
  '/auth/callback',
  '/terms',
  '/privacy',
];


function RootLayoutNav() {
  const { user, isLoading, company, addNotification, getNotifications, refreshNotifications, setUnreadChatCount } = useApp();
  useNotificationSetup(user, company, addNotification);

  // Global background poll — keeps the bell badge live on every screen.
  // Depends on both user AND company since refreshNotifications guards on both.
  // Runs every 30s; clears on logout or company switch.
  useEffect(() => {
    if (!user?.id || !company?.id) return;
    refreshNotifications();
    const interval = setInterval(() => refreshNotifications(), 60_000);
    return () => clearInterval(interval);
    // refreshNotifications is a useCallback derived from these same two IDs —
    // including it would double-fire on startup when both the IDs and the
    // function reference change in the same render cycle, causing N concurrent
    // Supabase requests and ERR_CONNECTION_CLOSED. The IDs already capture the
    // dependency correctly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, company?.id]);

  // Global unread chat count — runs even before the chat tab is first visited.
  // Uses Supabase directly + Realtime instead of polling the serverless API.
  useEffect(() => {
    if (!user?.id) return;

    const myConvIds: string[] = [];
    const myLastReadByConv: Record<string, string> = {};

    const fetchUnreadCount = async () => {
      try {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', user.id);

        if (!parts?.length) { setUnreadChatCount(0); return; }

        myConvIds.length = 0;
        for (const p of parts) {
          myConvIds.push(p.conversation_id);
          myLastReadByConv[p.conversation_id] = p.last_read_at || '1970-01-01T00:00:00.000Z';
        }

        const minLastRead = Object.values(myLastReadByConv).reduce(
          (min, t) => (t < min ? t : min),
          new Date().toISOString()
        );

        const { data: unreadMsgs } = await supabase
          .from('messages')
          .select('conversation_id, created_at')
          .in('conversation_id', myConvIds)
          .neq('sender_id', user.id)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .gt('created_at', minLastRead)
          .limit(500);

        let total = 0;
        for (const msg of (unreadMsgs || []) as any[]) {
          const lastRead = myLastReadByConv[msg.conversation_id] || '1970-01-01T00:00:00.000Z';
          if (msg.created_at > lastRead) total++;
        }
        setUnreadChatCount(total);
      } catch (err: any) {
        console.warn('[ChatBadge] fetch failed:', err?.message ?? err);
      }
    };

    fetchUnreadCount();

    const badgeChannel = supabase
      .channel(`badge:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id || msg.is_deleted) return;
          // Re-fetch always — unknown conv_id means a new conversation was created
          // and the participant INSERT may have been missed; fetchUnreadCount will
          // re-query conversation_participants and pick it up automatically.
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_participants' },
        (payload) => {
          const p = payload.new as any;
          // Current user was added to a new conversation — register it so
          // the next messages INSERT from that conv passes the ID filter.
          if (p.user_id !== user.id) return;
          if (!myConvIds.includes(p.conversation_id)) {
            myConvIds.push(p.conversation_id);
            myLastReadByConv[p.conversation_id] = p.last_read_at || '1970-01-01T00:00:00.000Z';
          }
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants' },
        (payload) => {
          const p = payload.new as any;
          // User read a conversation — re-fetch to get the authoritative count
          if (p.user_id === user.id) fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(badgeChannel);
    };
  }, [user?.id]);

  // Keep native app icon badge in sync with the in-app unread count
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unreadCount = getNotifications(true).length;
    Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [getNotifications]);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const [navigationReady, setNavigationReady] = React.useState(false);

  // Mark navigation as ready after first render
  useEffect(() => {
    const timer = setTimeout(() => setNavigationReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Protect routes - redirect to login if not authenticated
  useEffect(() => {
    // Don't do anything while loading or navigation not ready
    if (!navigationReady || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isPublicRoute = PUBLIC_ROUTES.some(route => {
      if (route === '/') return pathname === '/';
      return pathname?.startsWith(route);
    });

    // Check if it's an inspection or subcontractor-register token route
    const isTokenRoute = pathname?.startsWith('/inspection/') ||
                     pathname?.startsWith('/subcontractor-register/') ||
                     pathname?.startsWith('/schedule-view/');

    console.log('[Auth Check]', {
      pathname,
      user: user ? 'logged in' : 'not logged in',
      inAuthGroup,
      isPublicRoute,
      isTokenRoute,
    });

    if (user && inAuthGroup && !pathname?.includes('reset-password') && !pathname?.includes('subscription')) {
      // User is already authenticated but on an auth screen — send to dashboard
      console.log('[Auth] Already logged in, redirecting to dashboard');
      router.replace('/(tabs)/dashboard');
    } else if (!user && !inAuthGroup && !isPublicRoute && !isTokenRoute) {
      // User is not signed in and trying to access protected route
      console.log('[Auth] Redirecting to login');
      router.replace('/login');
    }
  }, [user, segments, pathname]);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: '',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#1F2937',
        headerShadowVisible: true,
        ...(Platform.OS === 'ios' && {
          headerLargeTitle: false,
        }),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Project screens with custom headers */}
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/estimate" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/takeoff" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/expenses" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/files-navigation" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/change-orders" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/costs" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/labor" options={{ headerShown: false }} />
      {/* Public pages - no header */}
      <Stack.Screen name="inspection/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="subcontractor-register/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="register-subcontractor/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="schedule-view/[token]" options={{ headerShown: false }} />
      {/* These now get automatic back buttons */}
      <Stack.Screen
        name="subcontractor/[id]"
        options={{
          headerShown: false, // Using custom ScreenHeader
          title: 'Subcontractor'
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="reports"
        options={{
          title: 'Reports Library',
          headerLargeTitle: false
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerLargeTitle: false
        }}
      />
      <Stack.Screen name="admin/employee-management" options={{ title: 'Employee Management' }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="stripe-test" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function ChatWidgets() {
  const pathname = usePathname();

  // Hide chat widgets on pages where they don't make sense
  const shouldHideChat =
    // Public/registration pages
    pathname?.startsWith('/register-subcontractor/') ||
    pathname?.startsWith('/subcontractor-register/') ||
    pathname?.startsWith('/inspection/') ||
    pathname?.startsWith('/schedule-view/') ||
    // Auth pages
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/signup') ||
    pathname === '/' ||
    // Settings/Profile pages
    pathname?.startsWith('/profile') ||
    pathname?.includes('/settings') ||
    // Admin/Reports pages (can be re-enabled if needed)
    pathname?.startsWith('/admin/') ||
    pathname?.startsWith('/reports') ||
    // More menu
    pathname?.endsWith('/more') ||
    // Schedule tab
    pathname === '/schedule' ||
    // Notifications screen
    pathname?.startsWith('/notifications') ||
    // Legal pages
    pathname?.startsWith('/privacy') ||
    pathname?.startsWith('/terms');

  if (shouldHideChat) {
    return null;
  }

  return (
    <>
      <ErrorBoundary fallback={null}>
        <GlobalAIChat />
      </ErrorBoundary>
      <FloatingChatButton />
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Hide native splash immediately so we can show our custom animated one
    SplashScreen.hideAsync();
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AppProvider>
          {showSplash ? (
            <AnimatedSplashScreen onAnimationComplete={handleSplashComplete} />
          ) : (
            <>
              <RootLayoutNav />
              <ChatWidgets />
            </>
          )}
        </AppProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );

  return (
    <>
      {content}
    </>
  );
}
