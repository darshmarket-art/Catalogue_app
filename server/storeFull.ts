import type { Store } from './store';

export const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

interface DayDoc { count: number; phones: string[] }

export interface TurnedAway { today: number; total: number }

/** Counts a buyer a full store turned away (each phone once per day). Returns today's and the all-time count. */
export async function recordTurnedAway(store: Store, phone: string, t: number): Promise<TurnedAway> {
  const day = dayOf(t);
  const doc = (await store.get<DayDoc>('turnedAway', day)) ?? { count: 0, phones: [] };
  if (!doc.phones.includes(phone)) {
    doc.phones.push(phone);
    doc.count = doc.phones.length;
    await store.set('turnedAway', day, doc);
    await store.increment('turnedAway', 'total', { count: 1 });
  }
  return turnedAwayStats(store, t);
}

export async function turnedAwayStats(store: Store, t: number = Date.now()): Promise<TurnedAway> {
  return {
    today: (await store.get<DayDoc>('turnedAway', dayOf(t)))?.count ?? 0,
    total: (await store.get<{ count: number }>('turnedAway', 'total'))?.count ?? 0
  };
}
