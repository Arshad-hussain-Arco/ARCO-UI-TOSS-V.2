/* eslint-disable no-restricted-globals */

// Listen for incoming push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Failed to parse push notification payload', e);
    return;
  }

  const title = data.title || 'New Notification';
  const options = {
    body: data.body || 'You have a new message.',
    icon: data.icon || '/favicon.png', // Fallback to app favicon
    badge: data.badge || '/favicon.png',
    data: data.data || {}, // E.g. { url: '/pending-approvals' }
    vibrate: [100, 50, 100],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Listen for notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  const targetUrl = event.notification.data?.url || '/';

  // This looks to see if the current window is already open and
  // focuses if it is. If not, it opens a new window.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
