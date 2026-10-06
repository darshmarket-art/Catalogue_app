import { useSyncExternalStore } from 'react';
import { HI } from './i18n.hi';

/**
 * Buyer-side language: English or Hindi. Strings are written in English in the code and looked up in the Hindi table (src/i18n.hi.ts);
 * anything missing from the table stays in English. Names the store enters (designs, collections, banners) are never translated.
 * The choice is remembered on this device. The owner's screens stay in English.
 */
export type Lang = 'en' | 'hi';
const KEY = 'app-lang';

const read = (): Lang => {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
};

let lang: Lang = read();
const listeners = new Set<() => void>();
const apply = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
};
apply();

export const getLang = () => lang;
export const setLang = (next: Lang) => {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // not remembered; the choice still holds for this visit
  }
  apply();
  listeners.forEach((l) => l());
};

/** Re-renders the caller when the language changes. */
export const useLang = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => lang,
    () => lang
  );

/** The string in the current language, with {name} placeholders filled in. */
export function t(en: string, vars?: Record<string, string | number>): string {
  const s = lang === 'hi' ? (HI[en] ?? en) : en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m)) : s;
}

/** "1 design" / "5 designs": picks the singular or plural English key, then translates it. */
export const tn = (n: number, one: string, many: string, vars?: Record<string, string | number>) => t(n === 1 ? one : many, { n, ...vars });
