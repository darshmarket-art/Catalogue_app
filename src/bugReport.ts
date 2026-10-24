import { Capacitor } from '@capacitor/core';

declare const __APP_VERSION__: string;

/** An error whose message is written for the customer (e.g. "Pick at least one design first."): shown as it is, never reported. */
export class UserError extends Error {}

export type BugKind = 'error' | 'promise' | 'console' | 'resource' | 'csp' | 'api' | 'slow' | 'crash' | 'server' | 'user';

// ---- Breadcrumbs: the last things the visitor did, sent with every report so a bug comes with the steps that led to it. ----
const CRUMB_KEY = 'bug-crumbs';
const MAX_CRUMBS = 30;
let crumbs: string[] = [];
try {
  crumbs = JSON.parse(sessionStorage.getItem(CRUMB_KEY) ?? '[]');
} catch {
  crumbs = [];
}
let saveTimer = 0;
/** Adds a step to the trail (kept per tab, so it survives a page that reloads after crashing). */
export function crumb(text: string): void {
  crumbs.push(`${new Date().toISOString().slice(11, 19)} ${text}`.slice(0, 200));
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
  if (!saveTimer) {
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      try {
        sessionStorage.setItem(CRUMB_KEY, JSON.stringify(crumbs));
      } catch {
        // storage unavailable
      }
    }, 400);
  }
}

/** Where the visitor was and on what: one line for the report. */
function context(): string {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  const role = document.querySelector('[data-role]')?.getAttribute('data-role') ?? '';
  return [
    role && `role ${role}`,
    `${location.pathname}${location.hash}`,
    `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`,
    navigator.onLine ? 'online' : 'offline',
    nav.connection?.effectiveType,
    nav.deviceMemory && `${nav.deviceMemory}GB`,
    document.visibilityState
  ].filter(Boolean).join(' · ');
}

const sentThisSession = new Set<string>();
const MAX_PER_SESSION = 40;

function send(payload: { message: string; stack?: string; where: string; kind: BugKind; crumbs?: string[]; note?: string }): void {
  try {
    // The same problem is sent once per visit (the server counts repeats across visits); a page stuck in a loop cannot flood the list.
    const key = `${payload.kind}|${payload.where}|${payload.message}`;
    if (payload.kind !== 'user' && (sentThisSession.has(key) || sentThisSession.size >= MAX_PER_SESSION)) return;
    sentThisSession.add(key);
    const store = new URLSearchParams(location.search).get('store') ?? localStorage.getItem('store') ?? '';
    void fetch('/api/bug-report', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', ...(store ? { 'X-Store': store } : {}) },
      body: JSON.stringify({ crumbs: crumbs.slice(-MAX_CRUMBS), ctx: context(), ...payload, url: location.href, appVersion: __APP_VERSION__, native: Capacitor.isNativePlatform() })
    }).catch(() => {});
  } catch {
    // reporting must never break the app
  }
}

/** Sends an unexpected error to console.<domain> (Bug reports). Never throws, never shows anything. */
export function reportBug(err: unknown, where: string, kind: BugKind = 'error'): void {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    send({ message: e.message || e.name || 'Unknown error', stack: e.stack, where, kind });
  } catch {
    // reporting must never break the app
  }
}

/** A problem a person describes themselves (something looked wrong but nothing threw). Always kept, with the trail that led to it. */
export function reportProblem(note: string): void {
  send({ message: 'Reported by a person', where: 'report a problem', kind: 'user', note: note.slice(0, 1000) });
}

const describe = (el: Element): string => {
  const t = el.closest('[data-testid],[aria-label],button,a,[role=button],input,label') ?? el;
  const label = t.getAttribute('data-testid') || t.getAttribute('aria-label') || (t.textContent ?? '').trim().slice(0, 30) || t.tagName.toLowerCase();
  return `${t.tagName.toLowerCase()} "${label}"`;
};

const strip = (u: string) => u.split('?')[0].slice(0, 150);

/** Called by the API layer: every call becomes a breadcrumb; a failure that is not "no signal" and a very slow call are reported. */
export function noteApiCall(method: string, path: string, status: number | 'failed', ms: number, err?: unknown): void {
  const p = strip(path).replace(/[0-9a-f]{8,}/gi, ':id');
  crumb(`api ${method} ${p} ${status} ${ms}ms`);
  if (status === 'failed' && navigator.onLine) reportBug(err ?? new Error('Request failed'), `api ${method} ${p}`, 'api');
  else if (typeof status === 'number' && ms > 15_000) send({ message: `Took ${Math.round(ms / 1000)}s`, where: `api ${method} ${p}`, kind: 'slow' });
}

let installed = false;

/** Listens for every kind of failure the page can see. Called once from main.tsx. */
export function installBugCapture(): void {
  if (installed) return;
  installed = true;

  // A page that ended while the visitor was looking at it (out of memory, browser crash): the next load reports it with the old trail.
  try {
    const set = (v: string) => sessionStorage.setItem('bug-alive', v);
    if (sessionStorage.getItem('bug-alive') === 'fg') {
      send({ message: 'The page ended without closing (browser ran out of memory or crashed)', where: 'previous page', kind: 'crash', crumbs: [...crumbs] });
    }
    set(document.visibilityState === 'hidden' ? 'bg' : 'fg');
    document.addEventListener('visibilitychange', () => set(document.visibilityState === 'hidden' ? 'bg' : 'fg'));
    window.addEventListener('pagehide', () => set('bg'));
    window.addEventListener('pageshow', () => set('fg'));
  } catch {
    // storage unavailable: no crash detection
  }

  window.addEventListener('error', (e) => {
    const t = e.target as Element | null;
    if (t && t !== (window as unknown) && 'tagName' in t) {
      // A photo, script or stylesheet that did not load.
      const src = (t as HTMLImageElement).src || (t as HTMLLinkElement).href || '';
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) send({ message: `Failed to load <${t.tagName.toLowerCase()}> ${strip(src)}`, where: 'resource', kind: 'resource' });
      return;
    }
    if (/ResizeObserver loop/i.test(e.message)) return; // harmless browser notice
    reportBug(e.error ?? e.message, 'uncaught', 'error');
  }, true);
  window.addEventListener('unhandledrejection', (e) => reportBug(e.reason, 'unhandled promise', 'promise'));
  document.addEventListener('securitypolicyviolation', (e) => send({ message: `${e.violatedDirective} blocked ${strip(e.blockedURI || 'inline')}`, where: 'security policy', kind: 'csp' }));

  // console.error is where handled-but-wrong things end up.
  const original = console.error.bind(console);
  let inside = false;
  console.error = (...args: unknown[]) => {
    original(...args);
    if (inside) return;
    inside = true;
    try {
      const err = args.find((a): a is Error => a instanceof Error);
      const text = (a: unknown) => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      };
      const message = args.map(text).join(' ').slice(0, 500);
      crumb(`console.error ${message.slice(0, 80)}`);
      if (message) send({ message, stack: err?.stack, where: 'console.error', kind: 'console' });
    } finally {
      inside = false;
    }
  };

  // The trail: taps, screens, connection.
  document.addEventListener('click', (e) => e.target instanceof Element && crumb(`tap ${describe(e.target)}`), { capture: true, passive: true });
  const screen = () => crumb(`screen ${location.pathname}${location.hash}`);
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m].bind(history);
    history[m] = (...a: Parameters<History['pushState']>) => {
      orig(...a);
      screen();
    };
  }
  window.addEventListener('popstate', screen);
  window.addEventListener('hashchange', screen);
  window.addEventListener('online', () => crumb('online'));
  window.addEventListener('offline', () => crumb('offline'));
  crumb(`open ${location.pathname}${location.hash}`);
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
