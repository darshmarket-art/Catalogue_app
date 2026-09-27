import type { Doc, Store } from './store';

// Business days roll over at midnight India time, wherever the server happens to run.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" in IST. */
export const dayKey = (date: Date = new Date()) => dayFormat.format(date);

export const daysAgo = (n: number, from: Date = new Date()) => dayKey(new Date(from.getTime() - n * DAY_MS));

/** Adds to today's totals (views, inquiries, booked, visitors, ...). */
export function recordDaily(store: Store, fields: Record<string, number>, when: Date = new Date()) {
  const day = dayKey(when);
  return store.increment('dailyStats', day, fields, { day });
}

/** Totals for the last `days` days including today, keyed by day. */
export async function loadDaily(store: Store, days: number): Promise<Record<string, Doc>> {
  const docs = await store.list('dailyStats', { where: [{ field: 'day', op: '>', value: daysAgo(days) }] });
  return Object.fromEntries(docs.map((d) => [d.day, d]));
}

/** Sum of one field across the days `from`..`to - 1` ago (0 = today). */
export function sumDays(stats: Record<string, Doc>, field: string, from: number, to: number): number {
  let total = 0;
  for (let i = from; i < to; i++) total += Number(stats[daysAgo(i)]?.[field]) || 0;
  return total;
}

export function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'New' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}
