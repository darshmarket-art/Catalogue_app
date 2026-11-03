import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError, handler, parse } from '../http';
import type { Store } from '../store';
import type { StoreRecord } from '../tenancy';
import { STYLE_IDS } from '../../shared/aiStyles';
import {
  DEFAULT_CONFIG, MAX_CREDITS, activeModel, change, configureWallet, getConfig, ledgerSince, newWallet, priceFor, setConfig, storeLedger, usageSince, type AiConfig, type Usage, type Wallet
} from '../aiCredits';
import { renderEnabled, renderMonthlyCap } from '../aiRender';

const DAY = 86400000;
const credits = z.number().int().min(0).max(MAX_CREDITS);
const note = z.string().trim().max(200);
const OUTCOMES = ['ok', 'provider_failed', 'blocked_cap', 'blocked_credits', 'blocked_disabled', 'pending'] as const;

/** UTC calendar day key of a timestamp. */
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const startOfDay = (ms: number) => Date.parse(dayKey(ms));

/** A call that reached the provider (billable, possibly failed). Blocked attempts never did. */
const reached = (u: Usage) => u.outcome === 'ok' || u.outcome === 'provider_failed' || u.outcome === 'pending';

/**
 * Console "AI" section: usage, wallets, price controls. Mounted inside consoleApi, so every route already requires IAP plus the CONSOLE_ADMINS allowlist.
 * Writes are JSON only and each one adds a line to the console audit log. Provider cost is ESTIMATED from the editable per-model table; Cloud Billing is not called.
 */
export function consoleAiRoutes(root: Store) {
  const r = Router();

  const actorOf = (res: Response) => String(res.locals.actor);
  const record = async (res: Response, storeId: string | null, action: string, what: string) => {
    const id = `aud-${crypto.randomUUID()}`;
    await root.set('consoleAudit', id, { id, at: new Date().toISOString(), who: actorOf(res), ...(storeId ? { storeId } : {}), action, what });
  };
  const json = (req: Request) => {
    if (!req.is('application/json')) throw new HttpError(415, 'Send JSON.');
  };
  const getRec = async (id: string) => {
    const rec = await root.get<StoreRecord>('stores', id);
    if (!rec) throw new HttpError(404, 'Store not found.');
    return rec;
  };
  const names = async () => new Map((await root.list<StoreRecord>('stores')).map((s) => [s.id, s.merchant.brand.name]));

  r.get('/overview', handler(async (_req, res) => {
    const now = Date.now();
    const since = startOfDay(now) - 29 * DAY;
    const [usage, ledger, cfg, nm] = await Promise.all([usageSince(root, since - 1), ledgerSince(root, since - 1), getConfig(root), names()]);
    const days = Array.from({ length: 30 }, (_, i) => dayKey(since + i * DAY));
    const daily = new Map(days.map((d) => [d, { day: d, ok: 0, failed: 0, blocked: 0, spend: 0, costInr: 0 }]));
    const win = (n: number) => {
      const from = startOfDay(now) - (n - 1) * DAY;
      const rows = usage.filter((u) => u.ts >= from);
      const ok = rows.filter((u) => u.outcome === 'ok').length, failed = rows.filter((u) => u.outcome === 'provider_failed').length;
      return { calls: ok + failed, ok, failed, blocked: rows.filter((u) => u.outcome.startsWith('blocked')).length, successRate: ok + failed ? ok / (ok + failed) : null };
    };
    const byStyle = new Map<string, { style: string; calls: number; spend: number }>();
    const byStore = new Map<string, { storeId: string; name: string; calls: number; spend: number }>();
    let revenue = 0, costUsd = 0;
    for (const u of usage) {
      const d = daily.get(dayKey(u.ts));
      if (!d) continue;
      if (u.outcome === 'ok') { d.ok++; d.spend += u.price; revenue += u.price; }
      else if (u.outcome === 'provider_failed') d.failed++;
      else if (u.outcome.startsWith('blocked')) d.blocked++;
      if (reached(u)) {
        d.costInr += u.costUsd * cfg.usdInr;
        costUsd += u.costUsd;
        const s = byStyle.get(u.style) ?? { style: u.style, calls: 0, spend: 0 };
        s.calls++; if (u.outcome === 'ok') s.spend += u.price;
        byStyle.set(u.style, s);
        const t = byStore.get(u.storeId) ?? { storeId: u.storeId, name: nm.get(u.storeId) ?? u.storeId, calls: 0, spend: 0 };
        t.calls++; if (u.outcome === 'ok') t.spend += u.price;
        byStore.set(u.storeId, t);
      }
    }
    const sold = ledger.filter((l) => l.kind === 'topup' && !l.free).reduce((t, l) => t + l.amount, 0);
    const granted = ledger.filter((l) => l.kind === 'topup' && l.free).reduce((t, l) => t + l.amount, 0);
    const refunded = ledger.filter((l) => l.kind === 'refund').reduce((t, l) => t + l.amount, 0);
    const costInr = costUsd * cfg.usdInr;
    res.json({
      status: 'success',
      data: {
        generatedAt: new Date(now).toISOString(), timezone: 'UTC', enabled: renderEnabled(), killSwitch: cfg.killSwitch, model: activeModel(),
        windows: { today: win(1), week: win(7), month: win(30) },
        credits: { sold, granted, spent: revenue, refunded },
        money: { revenue, costInr, margin: revenue - costInr, estimated: true },
        daily: [...daily.values()].map((d) => ({ ...d, costInr: Math.round(d.costInr * 100) / 100 })),
        byStyle: [...byStyle.values()].sort((a, b) => b.calls - a.calls),
        topStores: [...byStore.values()].sort((a, b) => b.calls - a.calls).slice(0, 10),
        billing: { connected: false, note: 'Cost is estimated from the model table below. Cloud Billing is not connected.' }
      }
    });
  }));

  const storeRows = async () => {
    const now = Date.now();
    const monthStart = Date.parse(`${new Date(now).toISOString().slice(0, 7)}-01T00:00:00Z`);
    const [recs, cfg, usage, wallets] = await Promise.all([
      root.list<StoreRecord>('stores'), getConfig(root), usageSince(root, monthStart - 1), root.list<Wallet>('aiWallets')
    ]);
    const wmap = new Map(wallets.map((w) => [w.storeId, w]));
    return recs.map((rec) => {
      const wallet: Wallet = { ...newWallet(rec.id, rec.plan === 'founder'), ...wmap.get(rec.id) };
      const mine = usage.filter((u) => u.storeId === rec.id);
      const calls = mine.filter(reached).length;
      const spend = mine.filter((u) => u.outcome === 'ok').reduce((t, u) => t + u.price, 0);
      const status = !wallet.aiEnabled ? 'off' : wallet.aiFree ? 'free' : wallet.balance <= 0 ? 'zero' : wallet.balance <= cfg.lowBalance ? 'low' : 'ok';
      return {
        id: rec.id, name: rec.merchant.brand.name, subdomain: rec.subdomain, balance: wallet.balance, aiFree: wallet.aiFree, aiEnabled: wallet.aiEnabled,
        monthlyCap: wallet.monthlyCap, priceOverride: wallet.priceOverride, rendersMonth: calls, spendMonth: spend, lastUsedAt: wallet.lastUsedAt, lastTopupAt: wallet.lastTopupAt,
        paidTotal: wallet.paidTotal, freeTotal: wallet.freeTotal, status, engaged: Boolean(wallet.lastUsedAt || wallet.lastTopupAt), blockedWeek: mine.filter((u) => u.outcome === 'blocked_credits' && u.ts > now - 7 * DAY).length,
        prices: Object.fromEntries(STYLE_IDS.map((s) => [s, priceFor(cfg, wallet, s)]))
      };
    });
  };

  r.get('/stores', handler(async (_req, res) => {
    res.json({ status: 'success', data: { defaultCap: renderMonthlyCap(), rows: (await storeRows()).sort((a, b) => b.rendersMonth - a.rendersMonth || a.name.localeCompare(b.name)) } });
  }));

  r.get('/alerts', handler(async (_req, res) => {
    const cfg = await getConfig(root);
    const rows = (await storeRows()).filter((s) => !s.aiFree && s.aiEnabled && (s.engaged || s.blockedWeek) && (s.balance <= cfg.lowBalance || s.blockedWeek));
    res.json({ status: 'success', data: { lowBalance: cfg.lowBalance, rows: rows.map((s) => ({ ...s, level: s.balance <= 0 ? 'zero' : 'low' })).sort((a, b) => a.balance - b.balance) } });
  }));

  const filters = z.object({
    store: z.string().max(40).optional(), style: z.enum(STYLE_IDS).optional(), outcome: z.enum(OUTCOMES).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  });
  const usageRows = async (req: Request, max: number) => {
    const f = parse(filters, req.query);
    const from = f.from ? Date.parse(`${f.from}T00:00:00Z`) : Date.now() - 30 * DAY;
    const to = f.to ? Date.parse(`${f.to}T00:00:00Z`) + DAY : Infinity;
    return (await usageSince(root, from - 1)).filter((u) => u.ts < to && (!f.store || u.storeId === f.store) && (!f.style || u.style === f.style) && (!f.outcome || u.outcome === f.outcome)).slice(0, max);
  };
  r.get('/usage', handler(async (req, res) => {
    const [rows, nm] = await Promise.all([usageRows(req, 500), names()]);
    res.json({ status: 'success', data: rows.map((u) => ({ id: u.id, ts: u.ts, storeId: u.storeId, store: nm.get(u.storeId) ?? u.storeId, style: u.style, model: u.model, outcome: u.outcome, costUsd: u.costUsd, price: u.price, balanceAfter: u.balanceAfter, kept: u.kept ?? null })) });
  }));
  // A spreadsheet opens a cell starting with = + - @ as a formula, so those get a leading apostrophe.
  const cell = (v: unknown) => `"${String(v ?? '').replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
  r.get('/usage.csv', handler(async (req, res) => {
    const rows = await usageRows(req, 20000);
    const head = ['time_utc', 'store', 'style', 'model', 'outcome', 'est_cost_usd', 'credits_charged', 'balance_after', 'kept', 'render_id'];
    const body = rows.map((u) => [new Date(u.ts).toISOString(), u.storeId, u.style, u.model, u.outcome, u.costUsd, u.price, u.balanceAfter, u.kept ?? '', u.renderId].map(cell).join(','));
    res.type('text/csv').setHeader('Content-Disposition', 'attachment; filename="ai-usage.csv"');
    res.send([head.join(','), ...body].join('\r\n'));
  }));

  r.get('/stores/:id/ledger', handler(async (req, res) => {
    await getRec(req.params.id);
    res.json({ status: 'success', data: await storeLedger(root, req.params.id, 50) });
  }));

  r.get('/config', handler(async (_req, res) => {
    const cfg = await getConfig(root);
    res.json({ status: 'success', data: { config: cfg, model: activeModel(), serverEnabled: renderEnabled(), defaults: DEFAULT_CONFIG, maxCredits: MAX_CREDITS } });
  }));

  const configBody = z.object({
    prices: z.record(z.enum(STYLE_IDS), credits).optional(),
    modelCostUsd: z.record(z.string().min(1).max(60), z.number().min(0).max(10)).optional(),
    usdInr: z.number().min(1).max(1000).optional(),
    lowBalance: credits.optional(),
    killSwitch: z.boolean().optional()
  }).strict();
  r.post('/config', handler(async (req, res) => {
    json(req);
    const b = parse(configBody, req.body);
    const cur = await getConfig(root);
    const next: AiConfig = {
      ...cur, ...b, prices: { ...cur.prices, ...b.prices }, modelCostUsd: b.modelCostUsd ? { ...b.modelCostUsd } : cur.modelCostUsd,
      updatedAt: new Date().toISOString(), updatedBy: actorOf(res)
    };
    await setConfig(root, next);
    const what = [
      b.prices && `prices ${Object.entries(b.prices).map(([k, v]) => `${k}=${v}`).join(' ')}`, b.modelCostUsd && `model costs ${JSON.stringify(b.modelCostUsd)}`,
      b.usdInr !== undefined && `USD-INR ${cur.usdInr} -> ${b.usdInr}`, b.lowBalance !== undefined && `low balance ${cur.lowBalance} -> ${b.lowBalance}`,
      b.killSwitch !== undefined && `kill switch ${cur.killSwitch} -> ${b.killSwitch}`
    ].filter(Boolean).join('; ');
    await record(res, null, 'ai-config', `AI config: ${what || 'no change'}`);
    res.json({ status: 'success', data: next });
  }));

  // Wallet writes. A note is required so every credit movement can be explained later.
  const money = (kind: 'topup' | 'refund' | 'adjustment', schema: z.ZodType<any>, verb: string) =>
    r.post(`/stores/:id/${kind === 'topup' ? 'topup' : kind === 'refund' ? 'refund' : 'adjust'}`, handler(async (req, res) => {
      json(req);
      const rec = await getRec(req.params.id);
      const b = parse(schema, req.body);
      const w = await change(root, { storeId: rec.id, kind, amount: b.amount, actor: actorOf(res), note: b.note, free: b.free, renderId: b.renderId }, rec.plan === 'founder');
      await record(res, rec.id, `ai-${kind}`, `${verb} ${b.amount > 0 ? '+' : ''}${b.amount} credits${b.free ? ' (free grant)' : ''}${b.renderId ? ` for render ${b.renderId}` : ''}: ${b.note}. Balance ${w.balance}`);
      res.json({ status: 'success', data: { balance: w.balance } });
    }));
  money('topup', z.object({ amount: z.number().int().min(1).max(MAX_CREDITS), note: note.min(1), free: z.boolean().optional() }).strict(), 'Top-up');
  money('adjustment', z.object({ amount: z.number().int().min(-MAX_CREDITS).max(MAX_CREDITS).refine((n) => n !== 0, 'Amount cannot be zero'), note: note.min(3) }).strict(), 'Adjustment');
  money('refund', z.object({ amount: z.number().int().min(1).max(MAX_CREDITS), note: note.min(3), renderId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional() }).strict(), 'Refund');

  r.post('/stores/:id/settings', handler(async (req, res) => {
    json(req);
    const rec = await getRec(req.params.id);
    const b = parse(z.object({
      aiFree: z.boolean().optional(), aiEnabled: z.boolean().optional(), monthlyCap: z.number().int().min(0).max(100000).nullable().optional(),
      priceOverride: z.record(z.enum(['all', ...STYLE_IDS]), credits).optional()
    }).strict(), req.body);
    const w = await configureWallet(root, rec.id, b, rec.plan === 'founder');
    await record(res, rec.id, 'ai-settings', `AI settings: ${JSON.stringify(b)}`);
    res.json({ status: 'success', data: { aiFree: w.aiFree, aiEnabled: w.aiEnabled, monthlyCap: w.monthlyCap, priceOverride: w.priceOverride } });
  }));

  return r;
}
