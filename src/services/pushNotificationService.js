import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

/**
 * Utility to convert the base64 VAPID public key string into a Uint8Array.
 * Required by the PushManager API.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  /**
   * Registers the service worker and subscribes to push notifications.
   * Prompts the user for permission if not already granted.
   */
  registerAndSubscribe: async () => {
    // 1. Check for browser support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications are not supported by this browser.');
      return false;
    }

    try {
      // 2. Request Permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Push notification permission denied by user.');
        return false;
      }

      // 3. Register Service Worker
      // Assumes service-worker.js is in the public directory (root level)
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      
      // Wait for the service worker to become ready
      await navigator.serviceWorker.ready;

      // 4. Fetch the VAPID Public Key from the backend
      const response = await httpClient.get(endpoints.pushNotifications.vapidPublicKey);
      const vapidPublicKey = response.data?.public_key || response.data?.publicKey;

      if (!vapidPublicKey) {
        throw new Error('No VAPID public key provided by the server.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // 5. Subscribe using PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // 6. Send the subscription to our backend to store it
      await httpClient.post(endpoints.pushNotifications.subscribe, subscription.toJSON());
      
      console.log('Successfully subscribed to push notifications.');
      return true;

    } catch (error) {
      console.error('Error during push notification subscription:', error);
      return false;
    }
  },
};
