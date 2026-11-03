import { Router } from 'express';
import { z } from 'zod';
import { HttpError, handler, parse } from '../http';
import type { Store } from '../store';
import { getConfig, usageSince } from '../aiCredits';
import { SETUP_STEPS, billingProject, billingTable, isConnected, loadRows, type BillingRow } from '../billing';
import { daysInMonth, forecast, type Forecast } from '../billingForecast';
import { logger } from '../logger';

const AI_SERVICE = /vertex ai|generative language|gemini/i;
const r2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (ms: number) => new Date(ms).toISOString().slice(0, 7);

interface Amt { gross: number; credits: number; net: number }
const add = (a: Amt, row: BillingRow) => { a.gross += row.cost; a.credits += row.credits; a.net += row.cost + row.credits; };
const zero = (): Amt => ({ gross: 0, credits: 0, net: 0 });
const round = (a: Amt): Amt => ({ gross: r2(a.gross), credits: r2(a.credits), net: r2(a.net) });
const rn = (n: number | null) => (n === null ? null : r2(n));
const rf = (f: Forecast) => ({ ...f, mtd: r2(f.mtd), total: rn(f.total), low: rn(f.low), high: rn(f.high), perDay: rn(f.perDay) });

/** Month keys oldest first, `n` of them ending at `current`. */
const lastMonths = (current: string, n: number) => {
  const [y, m] = current.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)).toISOString().slice(0, 7));
};

/**
 * Console "Billing" section. Mounted inside consoleApi, so every route already needs IAP plus the CONSOLE_ADMINS allowlist.
 * Read only. Cost comes from the BigQuery billing export (server/billing.ts); nothing is called unless BILLING_EXPORT_TABLE is set.
 */
export function consoleBillingRoutes(root: Store) {
  const r = Router();

  r.get('/overview', handler(async (req, res) => {
    const now = Date.now();
    const q = parse(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }), req.query);
    const current = monthOf(now);
    const months = lastMonths(current, 12);
    const month = q.month ?? current;
    const base = { generatedAt: new Date(now).toISOString(), project: billingProject() };
    if (!isConnected()) {
      res.json({ status: 'success', data: { ...base, connected: false, setup: SETUP_STEPS, table: null } });
      return;
    }
    let loaded;
    try {
      loaded = await loadRows(`${months[0]}-01`, now);
    } catch (e) {
      logger.error('billing export read failed', { error: (e as Error).message });
      throw new HttpError(502, `Could not read the billing export: ${(e as Error).message.slice(0, 200)}`);
    }
    if (!loaded) throw new HttpError(500, 'Billing source vanished.');
    const rows = loaded.rows;
    const currency = rows.find((x) => x.currency)?.currency ?? '';

    const trend = new Map(months.map((m) => [m, zero()]));
    for (const x of rows) { const t = trend.get(x.day.slice(0, 7)); if (t) add(t, x); }

    // Selected month, per service and per SKU.
    const svc = new Map<string, { a: Amt; skus: Map<string, Amt> }>();
    const total = zero();
    for (const x of rows.filter((y) => y.day.startsWith(month))) {
      const s = svc.get(x.service) ?? { a: zero(), skus: new Map() };
      add(s.a, x);
      const k = s.skus.get(x.sku) ?? zero();
      add(k, x);
      s.skus.set(x.sku, k);
      svc.set(x.service, s);
      add(total, x);
    }
    const services = [...svc.entries()].map(([service, s]) => ({
      service, ...round(s.a), share: total.net > 0 ? s.a.net / total.net : 0,
      skus: [...s.skus.entries()].map(([sku, a]) => ({ sku, ...round(a) })).sort((a, b) => b.net - a.net).slice(0, 30)
    })).sort((a, b) => b.net - a.net);

    // Current month: daily series (zero-filled up to today) and forecasts.
    const today = new Date(now).getUTCDate(), dim = daysInMonth(current);
    const series = (pick: (x: BillingRow) => boolean) => {
      const net = Array.from({ length: today }, () => 0), gross = Array.from({ length: today }, () => 0);
      for (const x of rows) {
        if (!x.day.startsWith(current) || !pick(x)) continue;
        const i = Number(x.day.slice(8)) - 1;
        if (i < today) { net[i] += x.cost + x.credits; gross[i] += x.cost; }
      }
      return { net, gross };
    };
    const all = series(() => true);
    const cur = trend.get(current)!;
    const perService = [...new Set(rows.filter((x) => x.day.startsWith(current)).map((x) => x.service))]
      .map((service) => ({ service, forecast: rf(forecast(series((x) => x.service === service).net, dim)) }))
      .sort((a, b) => (b.forecast.total ?? b.forecast.mtd) - (a.forecast.total ?? a.forecast.mtd));

    // AI: actual Vertex / Gemini lines vs the ledger estimate for the same month.
    const aiRows = rows.filter((x) => AI_SERVICE.test(x.service));
    const aiActual = zero();
    for (const x of aiRows.filter((y) => y.day.startsWith(month))) add(aiActual, x);
    const cfg = await getConfig(root);
    const from = Date.parse(`${month}-01T00:00:00Z`), to = Date.parse(`${monthOf(from + 32 * 86400000)}-01T00:00:00Z`);
    let estUsd = 0, revenue = 0, calls = 0;
    for (const u of (await usageSince(root, from - 1)).filter((y) => y.ts >= from && y.ts < to)) {
      if (u.outcome === 'ok' || u.outcome === 'provider_failed' || u.outcome === 'pending') { estUsd += u.costUsd; calls++; }
      if (u.outcome === 'ok') revenue += u.price;
    }
    const estInr = estUsd * cfg.usdInr;
    const actualInr = currency === 'INR' ? aiActual.net : currency === 'USD' ? aiActual.net * cfg.usdInr : null;

    res.json({
      status: 'success',
      data: {
        ...base, connected: true, table: billingTable() || null, currency, cachedAt: new Date(loaded.cachedAt).toISOString(), timezone: 'UTC', hasData: rows.length > 0,
        months, month,
        current: { month: current, ...round(cur), daily: all.net.map((n, i) => ({ day: `${current}-${String(i + 1).padStart(2, '0')}`, net: r2(n), gross: r2(all.gross[i]) })), forecast: rf(forecast(all.net, dim)), perService },
        trend: months.map((m) => ({ month: m, ...round(trend.get(m)!) })),
        selected: { month, ...round(total), services },
        ai: {
          month, actual: round(aiActual), actualInr: rn(actualInr),
          skus: services.filter((s) => AI_SERVICE.test(s.service)).flatMap((s) => s.skus.map((k) => ({ service: s.service, ...k }))).sort((a, b) => b.net - a.net),
          estimate: { costUsd: r2(estUsd), costInr: r2(estInr), revenueInr: r2(revenue), marginInr: r2(revenue - estInr), calls, usdInr: cfg.usdInr },
          // Positive = Google charged more than the price table predicted.
          diffInr: actualInr === null ? null : r2(actualInr - estInr),
          actualMarginInr: actualInr === null ? null : r2(revenue - actualInr),
          forecast: rf(forecast(series((x) => AI_SERVICE.test(x.service)).net, dim))
        }
      }
    });
  }));

  return r;
}
