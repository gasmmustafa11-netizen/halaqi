import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { api } from './api';
import { notify } from '../utils/notifications';

// Local cache of the active FCM token so it can be unregistered on logout.
let activePushToken: string | null = null;
let pushNavigator: ((view: string) => void) | null = null;

function persistToken(token: string) {
  activePushToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('halaqi_push_token', token);
    }
  } catch {
    /* storage unavailable */
  }
}

function clearPersistedToken() {
  activePushToken = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('halaqi_push_token');
    }
  } catch {
    /* storage unavailable */
  }
}

export function setPushNavigator(navigate: (view: string) => void): void {
  pushNavigator = navigate;
}

// Map a push payload to an existing in-app navigation target.
function navigateFromPush(data: Record<string, any> | undefined): void {
  if (!data || !pushNavigator) return;

  const screen = String(data.screen || '');
  const id = String(data.id || '');

  switch (screen) {
    case 'post':
      pushNavigator(id ? `posts:${id}` : 'posts');
      break;
    case 'message':
      pushNavigator('messages');
      break;
    case 'booking':
      pushNavigator('bookings');
      break;
    case 'profile':
      pushNavigator(id ? `user:${id}` : 'profile');
      break;
    case 'salon':
      pushNavigator('explore');
      break;
    case 'admin':
      pushNavigator('admin');
      break;
    default:
      pushNavigator('explore');
      break;
  }
}

/**
 * Register device + listeners for mobile Push Notifications.
 * Safe to call on every platform: on web it is a no-op.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web / PWA: real mobile push is handled by the native shell only.
    return;
  }

  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      await PushNotifications.requestPermissions();
    }

    // Token registration (fires immediately if already granted, or after grant).
    PushNotifications.addListener('registration', async (token: { value: string }) => {
      persistToken(token.value);
      await api.registerPushToken(token.value, 'android');
    });

    PushNotifications.addListener('registrationError', (err: any) => {
      console.error('[PUSH] registration error', err);
    });

    // App in foreground: show the in-app toast (no duplicate system notification
    // is posted by the OS while the app is foregrounded on Android).
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: any) => {
        const title = notification?.title || notification?.data?.titleAr || 'حلاقي';
        const body = notification?.body || notification?.data?.bodyAr || '';
        notify(body ? `${title}\n${body}` : title, 'info');
      }
    );

    // Tap from background / killed state.
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: any) => {
        navigateFromPush(action?.notification?.data);
      }
    );

    await PushNotifications.register();
  } catch (error) {
    console.error('[PUSH] init failed', error);
  }
}

/** Call on logout to stop further pushes to this device. */
export async function deactivatePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const token = activePushToken;
  clearPersistedToken();
  if (token) {
    await api.unregisterPushToken(token);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('halaqi_push_token');
      if (stored) {
        await api.unregisterPushToken(stored);
        localStorage.removeItem('halaqi_push_token');
      }
    }
  } catch {
    /* ignore */
  }
  // Also drop all of the user's tokens (covers multiple devices).
  await api.unregisterAllPushTokens();
}

export function getActivePushToken(): string | null {
  return activePushToken;
}
