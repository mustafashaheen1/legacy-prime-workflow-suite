import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import GlobalAIChat from "@/components/GlobalAIChatSimple";
import FloatingChatButton from "@/components/FloatingChatButton";
import { trpc, trpcClient } from "@/lib/trpc";
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

const queryClient = new QueryClient();

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
  const { user, isLoading } = useApp();
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
    const isTokenRoute = pathname?.startsWith('/inspection/') || pathname?.startsWith('/subcontractor-register/');

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
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/estimate" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/takeoff" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/expenses" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/files-navigation" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/change-orders" options={{ headerShown: false }} />
      <Stack.Screen name="inspection/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="subcontractor-register/[token]" options={{ headerShown: false }} />
      <Stack.Screen name="subcontractor/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="stripe-test" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AppProvider>
          <RootLayoutNav />
          <GlobalAIChat />
          <FloatingChatButton />
        </AppProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {content}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
