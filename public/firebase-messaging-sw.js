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

  const notificationTitle = payload.notification?.title || 'Confession';
  const notificationOptions = {
    body: payload.notification?.body || 'New update',
    icon: '/logoemesis.png',
    badge: '/logoemesis.png',
    tag: payload.data?.type || 'notification',
    data: payload.data,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open',
      },
      {
        action: 'close',
        title: 'Close',
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
        const isChat = data?.type === 'chat_message' && data?.chatId;
        const targetUrl = isChat ? `/chat/${data.chatId}` : '/feed';

        // Check if already open
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // Focus a client with same origin; navigate if needed
          if ('focus' in client) {
            try {
              // If the same path, just focus
              const samePath = new URL(client.url).pathname === targetUrl;
              if (samePath) return client.focus();
              // Else try navigate
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
