// Firebase Cloud Messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
const firebaseConfig = {
  apiKey: "AIzaSyAnv7glqAMxl_r1K23CZcp2V-hZHV1Gvb4",
  authDomain: "emesispro.firebaseapp.com",
  databaseURL: "https://emesispro-default-rtdb.firebaseio.com",
  projectId: "emesispro",
  storageBucket: "emesispro.firebasestorage.app",
  messagingSenderId: "352946034946",
  appId: "1:352946034946:web:c5e882c40813844db14a1b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle messages when app is in background
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Background message received:', payload);

  const imageUrl = payload.notification?.image || null;
  const notificationTitle = payload.notification?.title || 'Confession';
  const notificationOptions = {
    body: payload.notification?.body || 'New update',
    icon: '/icon-512.png',
    badge: '/notification-icon.png',
    tag: payload.data?.tag || payload.data?.type || ('confession-' + Math.random().toString(36).slice(2, 8)),
    renotify: true,
    data: { ...(payload.data || {}) },
    requireInteraction: !!payload.data?.url || !!payload.data?.click_action,
    silent: false,
    ...(imageUrl ? { image: imageUrl } : {}),
    actions: [
      {
        action: 'open',
        title: 'Open Confession',
        icon: '/icon-192.png',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.tag);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open/focus window
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const data = event.notification?.data || {};
        const clickAction = data.click_action || data.url || data.clickAction || '';
        const isChat = data.type === 'chat_message' && data.chatId;
        let targetUrl = isChat ? `/chat/${data.chatId}` : (data.postId ? `/feed#post-${data.postId}` : '/feed');
        if (typeof clickAction === 'string' && clickAction.startsWith('/')) targetUrl = clickAction;
        if (typeof clickAction === 'string' && /^https?:\/\//.test(clickAction)) targetUrl = clickAction;

        // Check if already open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ('focus' in client) {
            try {
              const samePath = new URL(client.url).pathname === new URL(targetUrl, self.location.href).pathname;
              if (samePath) return client.focus();
              if ('navigate' in client) return client.navigate(targetUrl);
            } catch {}
          }
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
