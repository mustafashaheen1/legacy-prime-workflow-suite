import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import GlobalAIChat from "@/components/GlobalAIChatSimple";
import FloatingChatButton from "@/components/FloatingChatButton";
import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";
import { useNotificationSetup } from "@/hooks/useNotificationSetup";
import * as Notifications from 'expo-notifications';
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
];

function RootLayoutNav() {
  const { user, isLoading, company, addNotification, getNotifications } = useApp();
  useNotificationSetup(user, company, addNotification);

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

    if (!user && !inAuthGroup && !isPublicRoute && !isTokenRoute) {
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
    pathname?.startsWith('/notifications');

  if (shouldHideChat) {
    return null;
  }

  return (
    <>
      <GlobalAIChat />
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
