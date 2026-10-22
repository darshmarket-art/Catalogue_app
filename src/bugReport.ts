import { Capacitor } from '@capacitor/core';

declare const __APP_VERSION__: string;

/** An error whose message is written for the customer (e.g. "Pick at least one design first."): shown as it is, never reported. */
export class UserError extends Error {}

/** Sends an unexpected error to console.<domain> (Bug reports). Never throws, never shows anything. */
export function reportBug(err: unknown, where: string): void {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const store = new URLSearchParams(location.search).get('store') ?? localStorage.getItem('store') ?? '';
    void fetch('/api/bug-report', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(store ? { 'X-Store': store } : {}) },
      body: JSON.stringify({ message: e.message || e.name || 'Unknown error', stack: e.stack, where, url: location.href, appVersion: __APP_VERSION__, native: Capacitor.isNativePlatform() })
    }).catch(() => {});
  } catch {
    // reporting must never break the app
  }
}

/**
 * What the customer sees for a failed action: our own messages (UserError, and server messages, which carry a status) as they
 * are; anything unexpected is reported and replaced by a calm sentence.
 */
export function errorText(err: unknown, where: string, fallback = 'Something went wrong.'): string {
  if (err instanceof UserError || (err instanceof Error && typeof (err as { status?: unknown }).status === 'number')) return err.message;
  // No connection is not a bug: say so, and do not report it.
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) return `${fallback} Check your internet connection and try again.`;
  reportBug(err, where);
  return `${fallback} We have been told and are looking into it.`;
}
