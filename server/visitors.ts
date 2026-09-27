import type { Store } from './store';
import type { AuthedUser } from './auth';
import { newId } from './http';

export const ACTIVITY_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface Actor {
  id: string;
  kind: 'verified' | 'guest';
  name: string;
}

/**
 * Who an analytics event belongs to: a signed-in buyer, or (only when the catalogue is public) an anonymous
 * visitor identified by their browser session. Admins and, in a login-only catalogue, signed-out visitors
 * are not tracked per person.
 */
export function actorFor(user: AuthedUser | null, sessionId: string | undefined, publicCatalogue: boolean): Actor | null {
  if (user?.type === 'retailer') return { id: user.id, kind: 'verified', name: user.name };
  if (user || !publicCatalogue || !sessionId) return null;
  return { id: sessionId, kind: 'guest', name: 'Guest visitor' };
}

/** Adds to a visitor's running totals and marks them as seen now. */
export function bumpVisitor(store: Store, actor: Actor, fields: Record<string, number>) {
  return store.increment('visitors', actor.id, fields, { actorId: actor.id, kind: actor.kind, name: actor.name, lastSeen: Date.now() });
}

export type ActivityEvent =
  | { type: 'dwell'; sku: string; ms: number }
  | { type: 'search'; term: string }
  | { type: 'select'; sku: string }
  | { type: 'cart'; sku: string };

export function logActivity(store: Store, actor: Actor, event: ActivityEvent) {
  const now = Date.now();
  const id = newId('act');
  return store.set('activityEvents', id, { id, actorId: actor.id, ...event, ts: new Date(now).toISOString(), expireAt: new Date(now + ACTIVITY_TTL_MS) });
}
