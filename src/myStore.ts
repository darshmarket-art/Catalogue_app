import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { isValidStoreName } from '../shared/storeName';

const KEY = 'antarixs_store';
// Shared by app.antarixs.com and every [store].antarixs.com; on localhost/run.app there is no parent domain, so host-only.
const parent = (h = window.location.hostname) => (/^(?:[^.]+\.)?antarixs\.com$/.test(h) ? '; domain=.antarixs.com' : '');
// In the Android/iOS app the cookie may not survive the app being killed, so the store is also kept in native storage (shared by every page in the app).
const native = Capacitor.isNativePlatform();

/** The store whose user (admin or buyer) is signed in on this device; the Antarixs app opens it straight away. */
export const getMyStore = async (): Promise<string | null> => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  const v = m?.[1] ?? (native ? (await Preferences.get({ key: KEY })).value : null);
  return v && isValidStoreName(v) ? v : null;
};
export const setMyStore = (id: string) => {
  document.cookie = `${KEY}=${id}; path=/; max-age=31536000; samesite=lax${parent()}`;
  if (native) void Preferences.set({ key: KEY, value: id });
};
/** Called on logout (admin or buyer). */
export const clearMyStore = () => {
  document.cookie = `${KEY}=; path=/; max-age=0${parent()}`;
  if (native) void Preferences.remove({ key: KEY });
};

/** Is this store address live? 'offline' means we could not ask, which is not the same as the store being gone. */
export const checkStore = async (id: string): Promise<'open' | 'missing' | 'offline'> => {
  try {
    const r = await fetch(`/api/signup/open?name=${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (r.ok) return 'open';
    return r.status === 404 ? 'missing' : 'offline';
  } catch {
    return 'offline';
  }
};
