import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { withBase } from '@config/env';

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
   * True when real background Web Push can work. Browsers only expose
   * Service Workers / PushManager in a secure context (HTTPS, localhost, or an
   * origin the browser has been told to trust), so on plain HTTP this is false.
   */
  isPushSupported: () =>
    'serviceWorker' in navigator && 'PushManager' in window,

  /**
   * HTTP fallback: show an OS notification straight from the page (no Service
   * Worker). Only fires while the app is open in a tab, and only if the browser
   * allows the Notification API on this origin and permission was granted.
   */
  showLocalNotification: (title, body, url) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, icon: '/favicon.png' });
      n.onclick = () => {
        window.focus();
        if (url) window.location.assign(url);
        n.close();
      };
    } catch {
      /* some browsers refuse the constructor on insecure origins */
    }
  },

  /**
   * Registers the service worker and subscribes to push notifications.
   * Prompts the user for permission if not already granted.
   */
  registerAndSubscribe: async () => {
    // 1. Check for browser support
    if (!pushNotificationService.isPushSupported()) {
      console.warn(
        'Web Push unavailable (insecure HTTP origin or unsupported browser). ' +
        'Falling back to in-page notifications while the app is open.'
      );
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
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
      // service-worker.js lives in public/, so it is served from the deployment base path
      // (e.g. /tossv2/service-worker.js), not the site root.
      const registration = await navigator.serviceWorker.register(withBase('service-worker.js'));
      
      // Wait for the service worker to become ready
      await navigator.serviceWorker.ready;

      // 4. Fetch the VAPID Public Key from the backend
      const response = await httpClient.get(endpoints.pushNotifications.vapidPublicKey);
      const vapidPublicKey = response.data?.public_key || response.data?.publicKey;

      if (!vapidPublicKey) {
        throw new Error('No VAPID public key provided by the server.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Unsubscribe any existing subscription to clear old/invalid VAPID keys
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
        // console.log('Unsubscribed existing push subscription.');
      }

      // 5. Subscribe using PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // 6. Send the subscription to our backend to store it
      await httpClient.post(endpoints.pushNotifications.subscribe, subscription.toJSON());
      
      // console.log('Successfully subscribed to push notifications.');
      return true;

    } catch (error) {
      console.error('Error during push notification subscription:', error);
      return false;
    }
  },
};
