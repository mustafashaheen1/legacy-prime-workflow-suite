import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { Notification } from '@/types';

// Configure how notifications appear when the app is foregrounded.
// Set once at module level so it applies globally before any listener is added.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

interface NotificationSetupUser {
  id: string;
}

interface NotificationSetupCompany {
  id: string;
}

/**
 * Handles the full push notification setup lifecycle:
 * 1. Android notification channel creation
 * 2. Permission request (graceful — never throws if denied)
 * 3. Expo push token retrieval
 * 4. Token registration in Supabase via tRPC
 * 5. Foreground + response listener registration
 *
 * Safe to call on web (no-ops). Re-runs only when user/company IDs change
 * (covers login/logout/company switch scenarios).
 *
 * @param onNotificationReceived  Optional callback invoked when a push arrives
 *   while the app is foregrounded. Use this to add the notification to local state.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

async function registerPushToken(token: string, platform: 'ios' | 'android', userId: string, companyId: string) {
  const res = await fetch(`${API_BASE}/api/register-push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform, userId, companyId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to register push token');
  }
}

export function useNotificationSetup(
  user: NotificationSetupUser | null,
  company: NotificationSetupCompany | null,
  onNotificationReceived?: (notification: Notification) => void
) {
  const router = useRouter();
  const notificationListener  = useRef<Notifications.EventSubscription | null>(null);
  const responseListener      = useRef<Notifications.EventSubscription | null>(null);
  const tokenRefreshListener  = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Web does not support native push notifications the same way.
    if (Platform.OS === 'web') return;

    // Only run after the user is authenticated — we need userId + companyId for token registration.
    if (!user || !company) return;

    let mounted = true;

    async function setup() {
      try {
        // Android 8+ requires a notification channel before any notification can appear.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            showBadge: true,
          });
        }

        // Check existing permission status to avoid prompting unnecessarily.
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[Notifications] Permission not granted — skipping token registration');
          return;
        }

        // getExpoPushTokenAsync requires a projectId on SDK 50+.
        // Try the EAS runtime config first, then the app.json extra field as fallback.
        const projectId: string | undefined =
          (Constants.easConfig as any)?.projectId ??
          Constants.expoConfig?.extra?.eas?.projectId;

        if (!projectId) {
          console.warn(
            '[Notifications] No EAS projectId found. Push token registration will fail on physical devices. ' +
            'Add "extra": { "eas": { "projectId": "<your-id>" } } to app.json, ' +
            'or run `eas init` to link this project.'
          );
        }

        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );

        if (!mounted) return;

        await registerPushToken(tokenData.data, Platform.OS as 'ios' | 'android', user.id, company.id);

        console.log('[Notifications] Setup complete — push token registered');
      } catch (err) {
        // Non-fatal: push notifications degrading gracefully is acceptable.
        // The app must still function without them.
        console.warn('[Notifications] Setup error (non-fatal):', err);
      }
    }

    setup();

    // Re-register the push token whenever Expo rotates it (e.g. after token invalidation
    // or OS-level token refresh). Without this the old invalid token stays in the DB.
    tokenRefreshListener.current = Notifications.addPushTokenListener(async (newToken) => {
      console.log('[Notifications] Push token rotated, re-registering:', newToken.data);
      try {
        await registerPushToken(newToken.data, Platform.OS as 'ios' | 'android', user.id, company.id);
        console.log('[Notifications] Rotated token re-registered successfully');
      } catch (err) {
        console.warn('[Notifications] Failed to re-register rotated token:', err);
      }
    });

    // Listen for notifications received while the app is in the foreground.
    // Calls onNotificationReceived so AppContext can add it to local state + badge.
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (incoming) => {
        console.log(
          '[Notifications] Foreground notification received:',
          incoming.request.identifier
        );

        onNotificationReceived?.({
          id:        incoming.request.identifier,
          userId:    user?.id ?? '',
          companyId: company?.id ?? '',
          type:      (incoming.request.content.data?.type as Notification['type']) ?? 'general',
          title:     incoming.request.content.title ?? 'Notification',
          message:   incoming.request.content.body  ?? '',
          data:      incoming.request.content.data as any,
          read:      false,
          createdAt: new Date().toISOString(),
        });
      }
    );

    // Listen for the user tapping a notification (background or killed state).
    // Routes to the screen most relevant to the notification type.
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        console.log(
          '[Notifications] Notification tapped:',
          response.notification.request.identifier,
          data
        );

        switch (data?.type) {
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
            router.push('/(tabs)/dashboard');
            break;
          default:
            router.push('/notifications');
        }
      }
    );

    return () => {
      mounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
      tokenRefreshListener.current?.remove();
    };
  }, [user?.id, company?.id]);
}
