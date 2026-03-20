import { useEffect, useRef } from 'react';
import { Platform, NativeModules, AppState, AppStateStatus, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import type { Notification } from '@/types';

// Configure how notifications appear when the app is foregrounded.
// Set once at module level so it applies globally before any listener is added.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

// Register FCM background message handler (native only).
// Required for React Native Firebase to process FCM messages when the app
// is killed or in the background. Must be called at module level (outside
// any component) so it's registered before the JS engine sleeps.
// For alert pushes (notification + data), the system displays the banner
// automatically; this handler ensures any custom logic still runs.
if (Platform.OS !== 'web') {
  (async () => {
    try {
      const { getApp }        = await import('@react-native-firebase/app');
      const { getMessaging, setBackgroundMessageHandler } = await import('@react-native-firebase/messaging');
      setBackgroundMessageHandler(getMessaging(getApp()), async (_message) => {
        // Background / killed-state handler.
        // The system already shows the notification banner for alert pushes.
        // Custom badge or data processing can be added here if needed.
      });
    } catch {
      // No-op on web or if Firebase is unavailable
    }
  })();
}

interface NotificationSetupUser    { id: string; }
interface NotificationSetupCompany { id: string; }

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app';

// Show the Settings prompt at most once per app session to avoid nagging.
let permissionDeniedAlertShown = false;

async function registerPushToken(
  token: string,
  platform: 'ios' | 'android' | 'web',
  userId: string,
  companyId: string,
  tokenSource: 'fcm' | 'fcm-web' | 'expo' = 'fcm'
) {
  const res = await fetch(`${API_BASE}/api/register-push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform, userId, companyId, tokenSource }),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let errMsg = 'Failed to register push token';
    try { errMsg = JSON.parse(raw)?.error || errMsg; } catch {}
    console.error('[Notifications] register-push-token failed — status:', res.status, 'body:', raw.slice(0, 300));
    throw new Error(errMsg);
  }
}

/**
 * Handles the full push notification setup lifecycle across all platforms:
 *
 * iOS/Android:
 *   1. Android notification channel creation
 *   2. Permission request (graceful — never throws if denied)
 *   3. FCM token retrieval via @react-native-firebase/messaging
 *   4. Token registration in backend
 *   5. Foreground + response listener registration via expo-notifications
 *
 * Web:
 *   1. Browser Notification permission request
 *   2. Service Worker registration (firebase-messaging-sw.js)
 *   3. FCM web token retrieval
 *   4. Token registration in backend
 *
 * Re-runs only when user/company IDs change (covers login/logout/company switch).
 */
export function useNotificationSetup(
  user: NotificationSetupUser | null,
  company: NotificationSetupCompany | null,
  onNotificationReceived?: (notification: Notification) => void
) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener     = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user || !company) return;

    let mounted = true;

    // ─── WEB ──────────────────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
      (async () => {
        try {
          if (typeof window === 'undefined') return;
          if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            console.log('[Notifications] Web push not supported in this browser');
            return;
          }

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.log('[Notifications] Web push permission denied');
            return;
          }

          // Register Firebase service worker
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[Notifications] Service worker registered');

          // Pass Firebase config to the service worker via postMessage.
          // This avoids hardcoding config values in the SW file (which lives in the public repo).
          const swConfig = {
            apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
            authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
          };
          const sw = registration.active || registration.waiting || registration.installing;
          sw?.postMessage({ type: 'FIREBASE_CONFIG', config: swConfig });

          // Dynamically import Firebase web SDK (avoids loading on native)
          const { getFirebaseMessagingWeb } = await import('@/lib/firebase');
          const { getToken }                = await import('firebase/messaging');

          const messaging = await getFirebaseMessagingWeb();
          if (!messaging) {
            console.log('[Notifications] Firebase messaging not supported');
            return;
          }

          const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
          if (!vapidKey) {
            console.warn('[Notifications] EXPO_PUBLIC_FIREBASE_VAPID_KEY not set — web push disabled');
            return;
          }

          const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
          if (!token) {
            console.warn('[Notifications] No FCM web token returned');
            return;
          }

          if (!mounted) return;
          await registerPushToken(token, 'web', user.id, company.id, 'fcm-web');
          console.log('[Notifications] Web FCM token registered');
        } catch (err) {
          console.warn('[Notifications] Web push setup error (non-fatal):', err);
        }
      })();
      return;
    }

    // ─── iOS / Android ────────────────────────────────────────────────────────
    async function setup() {
      try {
        // Android 8+ requires a notification channel before any notification can appear.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name:             'Default',
            importance:       Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            showBadge:        true,
          });
          await Notifications.setNotificationChannelAsync('task-reminders', {
            name:             'Task Reminders',
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            showBadge:        true,
          });
        }

        // Request permissions via expo-notifications (handles both iOS + Android 13+)
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert:       true,
              allowBadge:       true,
              allowSound:       true,
              allowProvisional: true, // silent delivery to Notification Center if user hasn't decided
            },
          });
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[Notifications] Permission not granted — skipping token registration');
          // existingStatus === 'denied' means the user previously tapped "Don't Allow".
          // requestPermissionsAsync cannot re-prompt in that state; only the device
          // Settings page can re-enable it. Show the alert once per session.
          if (existingStatus === 'denied' && !permissionDeniedAlertShown) {
            permissionDeniedAlertShown = true;
            Alert.alert(
              'Enable Notifications',
              'Push notifications are disabled. To receive alerts for rate change requests and other updates, enable notifications in your device settings.',
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => Linking.openSettings(),
                },
              ]
            );
          }
          return;
        }

        // Get FCM token via react-native-firebase (modular API)
        // Dynamic import keeps the native module out of the web bundle
        const { getApp }      = await import('@react-native-firebase/app');
        const { getMessaging, getToken, deleteToken, onTokenRefresh } = await import('@react-native-firebase/messaging');
        const messagingInstance = getMessaging(getApp());

        // One-time forced token refresh to fix BadEnvironmentKeyInToken errors
        // caused by stale FCM tokens that have incorrect APNs environment metadata.
        // Once a fresh token is obtained, this is skipped on subsequent launches.
        const REFRESH_FLAG = '@fcm_apns_env_fix_v1';
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const alreadyRefreshed = await AsyncStorage.getItem(REFRESH_FLAG);
        if (!alreadyRefreshed) {
          try {
            await deleteToken(messagingInstance);
            console.log('[Notifications] Force-refreshed FCM token (APNs environment fix)');
          } catch (e) {
            console.warn('[Notifications] deleteToken failed (non-fatal):', e);
          }
          await AsyncStorage.setItem(REFRESH_FLAG, '1');
        }

        const fcmToken = await getToken(messagingInstance);

        if (!fcmToken) {
          console.warn('[Notifications] No FCM token returned');
          return;
        }

        if (!mounted) return;
        await registerPushToken(fcmToken, Platform.OS as 'ios' | 'android', user.id, company.id, 'fcm');
        console.log('[Notifications] FCM token registered');

        // Listen for FCM token refresh (device rotates token)
        const unsubscribeTokenRefresh = onTokenRefresh(messagingInstance, async (newToken) => {
          console.log('[Notifications] FCM token rotated, re-registering');
          try {
            await registerPushToken(newToken, Platform.OS as 'ios' | 'android', user.id, company.id, 'fcm');
          } catch (err) {
            console.warn('[Notifications] Failed to re-register rotated FCM token:', err);
          }
        });

        // Store cleanup function
        (setup as any)._unsubscribeTokenRefresh = unsubscribeTokenRefresh;

      } catch (err) {
        console.warn('[Notifications] Setup error (non-fatal):', err);
      }
    }

    setup();

    // Re-register FCM token whenever the app returns to the foreground.
    // This catches token rotations that happened while the app was backgrounded
    // or killed — critical for devices (e.g. iPad) that were logged in before
    // the FCM migration or haven't re-launched since token rotation.
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') setup();
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // Foreground notification display (expo-notifications handles the UI layer)
    notificationListener.current = Notifications.addNotificationReceivedListener((incoming) => {
      console.log('[Notifications] Foreground notification:', incoming.request.identifier);
      const notifType = incoming.request.content.data?.type as string | undefined;

      // Chat notifications are transient — they are NOT persisted to the notifications
      // table (which has a strict type CHECK constraint that excludes 'chat').
      // The chat screen handles delivery via Realtime/polling; the push banner is
      // shown automatically by the system (shouldShowBanner: true above).
      // Increment the floating chat button badge so the user sees an unread count
      // even when the chat screen isn't mounted (e.g. on the dashboard).
      if (notifType === 'chat') {
        return;
      }

      onNotificationReceived?.({
        id:        incoming.request.identifier,
        userId:    user.id,
        companyId: company.id,
        type:      (notifType as Notification['type']) ?? 'general',
        title:     incoming.request.content.title ?? 'Notification',
        message:   incoming.request.content.body  ?? '',
        data:      incoming.request.content.data as any,
        read:      false,
        createdAt: new Date().toISOString(),
      });
    });

    // Tap routing — fires when user taps a notification (background or killed state)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('[Notifications] Notification tapped:', data?.type);

      // Small delay prevents navigation conflicts on iPad multitasking / split view
      setTimeout(() => {
        switch (data?.type) {
          case 'chat':
            router.push('/(tabs)/chat');
            break;
          case 'task-reminder':
            router.push('/(tabs)/dashboard');
            break;
          case 'estimate-received':
          case 'proposal-submitted':
            router.push('/(tabs)/subcontractors');
            break;
          case 'payment-received':
            router.push(data?.projectId ? `/project/${data.projectId}` as any : '/(tabs)/expenses');
            break;
          case 'change-order':
            router.push(data?.projectId ? `/project/${data.projectId}` as any : '/(tabs)/dashboard');
            break;
          case 'general':
            router.push('/(tabs)/dashboard');
            break;
          default:
            router.push('/notifications');
        }
      }, 100);
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
      (setup as any)._unsubscribeTokenRefresh?.();
    };
  }, [user?.id, company?.id]);
}
