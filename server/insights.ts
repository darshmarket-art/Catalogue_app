import type { Store, Doc } from './store';
import type { MessageLog } from './messages';
import { deliverySummary } from './messages';
import { daysAgo, loadDaily, sumDays } from './stats';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Insights {
  periodLabel: string;
  summary: string;
  kpis: { views7: number; views7Prev: number; orders7: number; orders7Prev: number; activeBuyers7: number; activeBuyers30: number; newBuyers7: number; buyers: number; shortlisters: number; shortlistedDesigns: number };
  weeks: Array<{ label: string; views: number; orders: number; visitors: number }>;
  topDesigns: Array<{ sku: string; name: string; category: string; views: number }>;
  collections: Array<{ name: string; views: number; designs: number }>;
  whatsapp: { total: number; delivered: number; failed: number; deliveredRate: number | null; receiptsConnected: boolean } | null;
}

const pct = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 100));
const n = (v: number, one: string, many = `${one}s`) => `${v.toLocaleString('en-IN')} ${v === 1 ? one : many}`;

/** The owner's weekly story in plain English, built only from the numbers (no AI). */
export function weeklySummary(k: Insights['kpis'], top: Insights['topDesigns'], wa: Insights['whatsapp']): string {
  const parts: string[] = [];
  const v = pct(k.views7, k.views7Prev);
  parts.push(k.views7 === 0 ? 'No design views this week yet.' : `Designs were viewed ${n(k.views7, 'time')} this week${v === null ? '' : v >= 0 ? `, up ${v}% on last week` : `, down ${Math.abs(v)}% on last week`}.`);
  if (top[0]) parts.push(`${top[0].name} drew the most attention (${n(top[0].views, 'view')}).`);
  parts.push(k.orders7 > 0 ? `${n(k.orders7, 'order was', 'orders were')} booked${k.orders7Prev > 0 ? ` against ${k.orders7Prev} last week` : ''}.` : 'No orders were booked this week.');
  parts.push(`${n(k.activeBuyers7, 'buyer')} visited in the last 7 days${k.newBuyers7 > 0 ? `, ${k.newBuyers7} of them new` : ''}; ${n(k.shortlisters, 'buyer has', 'buyers have')} designs shortlisted.`);
  if (wa && wa.total > 0) parts.push(wa.deliveredRate === null ? `${n(wa.total, 'WhatsApp message')} went out; delivery receipts are not connected yet.` : `${wa.deliveredRate}% of ${n(wa.total, 'WhatsApp message')} were delivered.`);
  return parts.join(' ');
}

export async function buildInsights(store: Store, storeId: string, log: MessageLog | null, receiptsConnected: boolean, now = Date.now()): Promise<Insights> {
  const since30 = daysAgo(30, new Date(now));
  const [stats, views, products, categories, buyers, visitors, shortlists] = await Promise.all([
    loadDaily(store, 56),
    store.list<Doc>('productViews', { where: [{ field: 'day', op: '>', value: since30 }] }),
    store.list<Doc>('products'),
    store.list<Doc>('categories'),
    store.list<Doc>('buyers'),
    store.list<Doc>('visitors'),
    store.list<Doc>('shortlists')
  ]);

  const bySku = new Map(products.map((p) => [p.sku, p]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const viewCount = new Map<string, number>();
  for (const v of views) viewCount.set(v.sku, (viewCount.get(v.sku) ?? 0) + 1);
  const topDesigns = [...viewCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([sku, c]) => {
      const p = bySku.get(sku);
      return { sku, name: p?.name ?? sku, category: catName.get(p?.category) ?? p?.category ?? '', views: c };
    });
  const colViews = new Map<string, { views: number; designs: number }>();
  for (const p of products) {
    const name = catName.get(p.category) ?? p.category ?? 'Uncategorised';
    const cur = colViews.get(name) ?? { views: 0, designs: 0 };
    colViews.set(name, { views: cur.views + (viewCount.get(p.sku) ?? 0), designs: cur.designs + 1 });
  }
  const collections = [...colViews.entries()].map(([name, c]) => ({ name, ...c })).sort((a, b) => b.views - a.views);

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const w = 7 - i; // oldest first
    const from = w * 7;
    return { label: w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} wks ago`, views: sumDays(stats, 'views', from, from + 7), orders: sumDays(stats, 'booked', from, from + 7), visitors: sumDays(stats, 'visitors', from, from + 7) };
  });

  const verified = visitors.filter((v) => v.kind === 'verified');
  const kpis = {
    views7: sumDays(stats, 'views', 0, 7), views7Prev: sumDays(stats, 'views', 7, 14),
    orders7: sumDays(stats, 'booked', 0, 7), orders7Prev: sumDays(stats, 'booked', 7, 14),
    activeBuyers7: verified.filter((v) => now - Number(v.lastSeen) <= 7 * DAY_MS).length,
    activeBuyers30: verified.filter((v) => now - Number(v.lastSeen) <= 30 * DAY_MS).length,
    newBuyers7: buyers.filter((b) => now - Date.parse(b.createdAt) <= 7 * DAY_MS).length,
    buyers: buyers.length,
    shortlisters: shortlists.filter((s) => (s.skus?.length ?? 0) > 0).length,
    shortlistedDesigns: new Set(shortlists.flatMap((s) => s.skus ?? [])).size
  };

  const msgs = log ? (await log.listForStore(storeId, now)).filter((m) => now - m.createdMs <= 7 * DAY_MS) : [];
  const whatsapp = log ? { ...deliverySummary(msgs), receiptsConnected } : null;

  return { periodLabel: 'Last 7 days', summary: weeklySummary(kpis, topDesigns, whatsapp), kpis, weeks, topDesigns, collections, whatsapp };
}
