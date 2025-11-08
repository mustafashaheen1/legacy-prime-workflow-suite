import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "@/contexts/AppContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import GlobalAIChat from "@/components/GlobalAIChat";
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

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]/estimate" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <LanguageProvider>
            <AppProvider>
              <RootLayoutNav />
              <GlobalAIChat />
              <FloatingChatButton />
            </AppProvider>
          </LanguageProvider>
        </GestureHandlerRootView>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
