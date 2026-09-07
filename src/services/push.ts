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
 *
 * CRASH FIX (Android 13+): The previous crash when tapping "السماح بالإشعارات"
 * was caused by unhandled exceptions from native PushNotifications.checkPermissions(),
 * requestPermissions(), and register() — especially when the result object was undefined
 * or when the native Firebase messaging layer wasn't fully initialized. All native
 * calls are now wrapped with defensive null checks and try-catch blocks.
 */
export async function initPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web / PWA: real mobile push is handled by the native shell only.
    return;
  }

  try {
    const permResult = await PushNotifications.checkPermissions();
    const perm = permResult && typeof permResult === 'object' ? permResult : {};
    const receiveStatus = (perm as any)?.receive;
    if (receiveStatus !== 'granted') {
      try {
        const reqResult = await PushNotifications.requestPermissions();
        const req = reqResult && typeof reqResult === 'object' ? reqResult : {};
        if ((req as any)?.receive !== 'granted') {
          // Permission denied; don't crash — continue safely.
          console.warn('[PUSH] Notification permission denied');
          return;
        }
      } catch (reqErr: any) {
        console.error('[PUSH] Request permissions failed:', reqErr);
        // Don't crash the app; abort push init safely.
        return;
      }
    }

    // Token registration (fires immediately if already granted, or after grant).
    PushNotifications.addListener('registration', async (token: { value?: string }) => {
      try {
        const value = token?.value || token?.toString();
        if (value && typeof value === 'string') {
          persistToken(value);
          await api.registerPushToken(value, 'android');
        }
      } catch (tokenErr: any) {
        console.error('[PUSH] Token registration error:', tokenErr);
      }
    });

    PushNotifications.addListener('registrationError', (err: any) => {
      try {
        console.error('[PUSH] registration error', err);
      } catch {
        // ignore logging errors
      }
    });

    // App in foreground: show the in-app toast (no duplicate system notification
    // is posted by the OS while the app is foregrounded on Android).
    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: any) => {
        try {
          const title = notification?.title || notification?.data?.titleAr || 'حلاقي';
          const body = notification?.body || notification?.data?.bodyAr || '';
          notify(body ? `${title}\n${body}` : title, 'info');
        } catch (notifyErr: any) {
          console.error('[PUSH] Foreground notification error:', notifyErr);
        }
      }
    );

    // Tap from background / killed state.
    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: any) => {
        try {
          navigateFromPush(action?.notification?.data);
        } catch (navErr: any) {
          console.error('[PUSH] Navigation from push error:', navErr);
        }
      }
    );

    try {
      await PushNotifications.register();
    } catch (regErr: any) {
      console.error('[PUSH] register() call failed:', regErr);
      // Don't crash; notifications will retry or work via server-side tokens.
    }
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
