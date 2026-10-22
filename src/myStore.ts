import { isValidStoreName } from '../shared/storeName';

const KEY = 'antarixs_store';
// Shared by app.antarixs.com and every [store].antarixs.com; on localhost/run.app there is no parent domain, so host-only.
const parent = (h = window.location.hostname) => (/^(?:[^.]+\.)?antarixs\.com$/.test(h) ? '; domain=.antarixs.com' : '');

/** The store whose admin is signed in on this browser (the Antarixs app opens it straight away). */
export const getMyStore = (): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${KEY}=([^;]*)`));
  return m && isValidStoreName(m[1]) ? m[1] : null;
};
export const setMyStore = (id: string) => {
  document.cookie = `${KEY}=${id}; path=/; max-age=31536000; samesite=lax${parent()}`;
};
/** Called on admin logout. */
export const clearMyStore = () => {
  document.cookie = `${KEY}=; path=/; max-age=0${parent()}`;
};
