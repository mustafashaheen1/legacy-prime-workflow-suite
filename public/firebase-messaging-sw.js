// Firebase Messaging Service Worker
// Handles background push notifications on web (Chrome, Firefox, Edge, Safari 16.4+ PWA).
// Config values are injected at runtime via /api/firebase-config — no secrets in source.

importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

// Config is passed from the main thread via postMessage after SW registration.
// Falls back to self.firebaseConfig if already set (e.g. subsequent SW activations).
let messaging;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !messaging) {
    firebase.initializeApp(event.data.config);
    messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Background message:', payload);
      const title = payload.notification?.title || 'Legacy Prime';
      const data  = payload.data || {};

      self.registration.showNotification(title, {
        body:  payload.notification?.body || '',
        icon:  '/assets/images/app-icon-1024.png',
        badge: '/assets/images/app-icon-1024.png',
        data,
        tag:   data.type || 'general',
      });
    });
  }
});

// Route notification taps to the correct screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let path = '/notifications';

  switch (data.type) {
    case 'chat':               path = '/(tabs)/chat';           break;
    case 'task-reminder':      path = '/(tabs)/dashboard';      break;
    case 'task-assigned':      path = '/(tabs)/schedule';       break;
    case 'estimate-received':
    case 'proposal-submitted': path = '/(tabs)/subcontractors'; break;
    case 'payment-received':   path = data.projectId ? `/project/${data.projectId}` : '/(tabs)/expenses';  break;
    case 'change-order':       path = data.projectId ? `/project/${data.projectId}` : '/(tabs)/dashboard'; break;
    case 'general':
      if (data.title === 'Removed from Job Assignment') {
        path = data.projectId ? `/project/${data.projectId}` : '/(tabs)/schedule';
      } else if (data.title === 'Employee Application Rejected') {
        path = '/(tabs)/settings';
      } else {
        path = '/notifications';
      }
      break;
    default:                   path = '/notifications';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(path);
          return;
        }
      }
      clients.openWindow(path);
    })
  );
});
