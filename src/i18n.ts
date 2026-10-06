import { useSyncExternalStore } from 'react';
import { HI } from './i18n.hi';
import { purityHindi, toHindi } from '../shared/hindi';

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

// ---- The store's own words ----

/** Hindi the store supplied for its own wording (merchant.json "hindi"), keyed by the English text. */
const STORE: Record<string, string> = {};
export const addHindi = (map: Record<string, string> | undefined) => Object.assign(STORE, map ?? {});

/** A short piece of the store's own text (a name, a label, a tag): its supplied Hindi, the app's Hindi, or automatic Hindi. */
export const ts = (text: string | undefined | null): string => {
  if (!text) return '';
  if (lang !== 'hi') return text;
  return STORE[text] ?? HI[text] ?? toHindi(text);
};

/** A sentence of the store's own text: its supplied Hindi, else nothing in Hindi (a sentence cannot be guessed word by word). */
export const tl = (text: string | undefined | null): string => {
  if (!text) return '';
  if (lang !== 'hi') return text;
  return STORE[text] ?? HI[text] ?? '';
};

/** A name the owner may have written in Hindi too (designs, collections): their Hindi, else automatic Hindi. */
export const hn = (en: string | undefined | null, hi?: string | null): string => (lang === 'hi' ? hi?.trim() || ts(en) : en ?? '');

/** A long text the owner may have written in Hindi too (a description, the About story): their Hindi, else nothing in Hindi. */
export const hl = (en: string | undefined | null, hi?: string | null): string => (lang === 'hi' ? hi?.trim() || tl(en) : en ?? '');

/** Purity as said in Hindi ("22K 916" → "22 कैरेट 916"). */
export const pur = (p: string) => (lang === 'hi' ? purityHindi(p) : p);

/** Messages the server sends (sign-in, orders), in the buyer's language. */
export const tErr = (msg: string): string => {
  if (lang !== 'hi') return msg;
  if (HI[msg]) return HI[msg];
  const wait = msg.match(/^Please wait (\d+) seconds before asking for another code\.$/);
  if (wait) return t('Please wait {n} seconds before asking for another code.', { n: wait[1] });
  const already = msg.match(/^This order is already (\w+)\./);
  if (already) return t('This order is already {status}. Please call the store to change it.', { status: t(already[1]) });
  return msg;
};

/** A weight written with "g" (e.g. "42.5g – 110g") in the buyer's language. */
export const grams = (s: string) => (lang === 'hi' ? s.replace(/(\d)\s?g\b/g, '$1 ग्राम') : s);
