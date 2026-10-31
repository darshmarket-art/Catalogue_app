import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/*
 * Order alerts in the Android apps (Antarixs and the store apps) use Firebase Cloud Messaging; browsers use Web Push (OrderNotificationsToggle).
 * An older install of the app has no PushNotifications plugin, so every call checks first. The token is kept on the phone so the switch shows its state.
 */
const KEY = 'ax-push-token';
export const nativePushAvailable = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
export const nativePushToken = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
const remember = (t: string | null) => {
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* the switch just starts off next time */ }
};

/** Asks for permission, registers with Firebase and resolves with this phone's token. */
export async function enableNativePush(): Promise<string> {
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') throw new Error('Notifications are blocked for this app. Allow them in the phone settings.');
  await PushNotifications.removeAllListeners();
  const token = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Could not reach the notification service. Check the connection and try again.')), 15000);
    void PushNotifications.addListener('registration', (t) => { clearTimeout(timer); resolve(t.value); });
    void PushNotifications.addListener('registrationError', (e) => { clearTimeout(timer); reject(new Error(e.error || 'Could not register this phone for notifications.')); });
    void PushNotifications.register();
  });
  remember(token);
  return token;
}

/** Forgets this phone's token locally and with Firebase. Returns the token that was stored, for the server to delete. */
export async function disableNativePush(): Promise<string | null> {
  const token = nativePushToken();
  remember(null);
  try { await PushNotifications.unregister(); } catch { /* already gone */ }
  return token;
}
