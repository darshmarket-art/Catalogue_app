/**
 * AI credits: a prepaid wallet per store (1 credit = Rs 1, whole numbers only), a ledger of every balance change and an immutable usage
 * record per render attempt. Everything that moves money runs in one Store.transact, so two renders racing on one balance cannot overspend,
 * and every step is idempotent on its id (a retry never charges or refunds twice). Prices and balances are decided only here, never by the client.
 *
 * Root-level collections (the console reads across stores):
 *   aiConfig/global         prices, per-model cost table, USD to INR, low-balance threshold, kill switch
 *   aiWallets/<storeId>     balance, totals, last top-up, per-store flags and overrides
 *   aiLedger/<id>           topup | spend | refund | adjustment, signed amount, balance after, actor, note
 *   aiUsage/<storeId>:<renderId>  one per attempt: style, model, outcome, estimated cost, price, balance after
 */
import crypto from 'crypto';
import { STYLE_IDS, type StyleId } from '../shared/aiStyles';
import { HttpError } from './http';
import type { Doc, Store } from './store';

export const MAX_CREDITS = 100_000;
export const DEFAULT_MODEL = 'gemini-nano-banana-2.1';
export const activeModel = () => process.env.AI_RENDER_MODEL || DEFAULT_MODEL;

export interface AiConfig {
  /** Credits charged per style. */
  prices: Record<StyleId, number>;
  /** Estimated provider cost in USD per image, by model id. */
  modelCostUsd: Record<string, number>;
  usdInr: number;
  /** A store at or below this balance (and above zero) shows in the console's low-balance alerts. */
  lowBalance: number;
  /** Console switch: no store can start a render while on. AI_RENDER_ENABLED=false stays the master. */
  killSwitch: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_CONFIG: AiConfig = {
  prices: Object.fromEntries(STYLE_IDS.map((s) => [s, ['on-model', 'black-necklace', 'ring-hand-women', 'ring-hand-men', 'model-base'].includes(s) ? 12 : 8])) as Record<StyleId, number>,
  modelCostUsd: { 'gemini-nano-banana-2.1': 0.034, 'gemini-3.1-flash-image': 0.067, 'gemini-3-pro-image': 0.134 },
  usdInr: 95,
  lowBalance: 24,
  killSwitch: false
};

export interface Wallet {
  storeId: string;
  balance: number;
  /** Credits ever bought (paid top-ups) and granted free. */
  paidTotal: number;
  freeTotal: number;
  /** Credits spent net of refunds. */
  spent: number;
  lastTopupAt: number | null;
  lastTopupAmount: number | null;
  lastUsedAt: number | null;
  /** Founder or friendly stores: renders are logged with their cost but never charged. */
  aiFree: boolean;
  /** Console can switch AI off for one store. */
  aiEnabled: boolean;
  /** Price per style (or 'all') that replaces the global table for this store. */
  priceOverride: Record<string, number>;
  /** Replaces AI_RENDER_MONTHLY_CAP for this store; null = use the platform default. */
  monthlyCap: number | null;
}

export type Outcome = 'pending' | 'ok' | 'provider_failed' | 'blocked_cap' | 'blocked_credits' | 'blocked_disabled';

export interface Usage {
  id: string;
  storeId: string;
  renderId: string;
  ts: number;
  style: StyleId;
  model: string;
  outcome: Outcome;
  /** Estimated provider cost (USD) from the model table; 0 when the provider was never called. */
  costUsd: number;
  /** Credits charged for this attempt (0 when free, blocked or refunded). */
  price: number;
  /** What the style would have cost at list/override price, even for aiFree stores. */
  listPrice: number;
  balanceAfter: number;
  refunded?: number;
  /** Owner's later decision, if known. Does not change the charge. */
  kept?: boolean;
  resultRef?: string;
}

export interface LedgerRow {
  id: string;
  storeId: string;
  ts: number;
  kind: 'topup' | 'spend' | 'refund' | 'adjustment';
  /** Signed credits: positive adds to the balance. */
  amount: number;
  balanceAfter: number;
  actor: string;
  note: string;
  renderId?: string;
  /** Top-up given for free (a grant) rather than sold. */
  free?: boolean;
}

export const newWallet = (storeId: string, aiFree = false): Wallet => ({
  storeId, balance: 0, paidTotal: 0, freeTotal: 0, spent: 0, lastTopupAt: null, lastTopupAmount: null, lastUsedAt: null,
  aiFree, aiEnabled: true, priceOverride: {}, monthlyCap: null
});

export const usageId = (storeId: string, renderId: string) => `${storeId}:${renderId}`;
export const RENDER_ID = /^[A-Za-z0-9_-]{8,64}$/;
export const newRenderId = () => crypto.randomUUID();

const withDefaults = (c?: Partial<AiConfig> | null): AiConfig => ({
  ...DEFAULT_CONFIG, ...c, prices: { ...DEFAULT_CONFIG.prices, ...c?.prices }, modelCostUsd: { ...DEFAULT_CONFIG.modelCostUsd, ...c?.modelCostUsd }
});
export const getConfig = async (root: Store): Promise<AiConfig> => withDefaults(await root.get<Partial<AiConfig>>('aiConfig', 'global'));

/** The stored wallet over defaults. `founder` makes aiFree default on so Bhakti is logged but never charged. */
export const getWallet = async (root: Store, storeId: string, founder = false): Promise<Wallet> => ({ ...newWallet(storeId, founder), ...(await root.get<Wallet>('aiWallets', storeId)) });

export const priceFor = (cfg: AiConfig, w: Pick<Wallet, 'priceOverride'>, style: StyleId) => w.priceOverride[style] ?? w.priceOverride.all ?? cfg.prices[style];
export const costUsdFor = (cfg: AiConfig, model: string) => cfg.modelCostUsd[model] ?? 0;

export type Reserve =
  | { ok: true; usage: Usage; wallet: Wallet; replay: boolean }
  | { ok: false; reason: 'credits' | 'disabled' | 'paused' | 'cap'; usage: Usage; wallet: Wallet; price: number };

/**
 * Checks and charges in ONE transaction before the provider is called. Idempotent on renderId: a repeat returns the stored record, with
 * `replay` true, and charges nothing. Blocked attempts are logged too.
 */
export async function reserve(root: Store, p: { storeId: string; renderId: string; style: StyleId; model: string; founder: boolean; capReached: boolean }): Promise<Reserve> {
  const id = usageId(p.storeId, p.renderId);
  return root.transact<Reserve>(async (tx) => {
    const [cfgDoc, walletDoc, existing] = await Promise.all([tx.get<Partial<AiConfig>>('aiConfig', 'global'), tx.get<Wallet>('aiWallets', p.storeId), tx.get<Usage>('aiUsage', id)]);
    const wallet: Wallet = { ...newWallet(p.storeId, p.founder), ...walletDoc };
    if (existing) return { ok: true, usage: existing, wallet, replay: true };
    const cfg = withDefaults(cfgDoc);
    const ts = Date.now();
    const listPrice = priceFor(cfg, wallet, p.style);
    const price = wallet.aiFree ? 0 : listPrice;
    const base = { id, storeId: p.storeId, renderId: p.renderId, ts, style: p.style, model: p.model, listPrice };
    const block = (outcome: Outcome, reason: 'credits' | 'disabled' | 'paused' | 'cap'): Reserve => {
      const usage: Usage = { ...base, outcome, costUsd: 0, price: 0, balanceAfter: wallet.balance };
      tx.set('aiUsage', id, usage);
      return { ok: false, reason, usage, wallet, price };
    };
    if (cfg.killSwitch) return block('blocked_disabled', 'paused');
    if (!wallet.aiEnabled) return block('blocked_disabled', 'disabled');
    if (p.capReached) return block('blocked_cap', 'cap');
    if (wallet.balance < price) return block('blocked_credits', 'credits');
    const next: Wallet = { ...wallet, balance: wallet.balance - price, spent: wallet.spent + price, lastUsedAt: ts };
    const usage: Usage = { ...base, outcome: 'pending', costUsd: costUsdFor(cfg, p.model), price, balanceAfter: next.balance };
    tx.set('aiWallets', p.storeId, next);
    tx.set('aiUsage', id, usage);
    if (price > 0) {
      const row: LedgerRow = { id: `${id}:spend`, storeId: p.storeId, ts, kind: 'spend', amount: -price, balanceAfter: next.balance, actor: 'render', note: `${p.style} render`, renderId: p.renderId };
      tx.set('aiLedger', row.id, row);
    }
    return { ok: true, usage, wallet: next, replay: false };
  });
}

/** Closes a reserved render. Provider failure refunds the whole charge automatically (we absorb the cost). Safe to call twice. */
export async function finish(root: Store, storeId: string, renderId: string, result: { outcome: 'ok'; resultRef: string } | { outcome: 'provider_failed' }): Promise<Usage | null> {
  const id = usageId(storeId, renderId);
  return root.transact(async (tx) => {
    const [usage, walletDoc] = await Promise.all([tx.get<Usage>('aiUsage', id), tx.get<Wallet>('aiWallets', storeId)]);
    if (!usage || usage.outcome !== 'pending') return usage;
    if (result.outcome === 'ok') {
      const done: Usage = { ...usage, outcome: 'ok', resultRef: result.resultRef };
      tx.set('aiUsage', id, done);
      return done;
    }
    const wallet: Wallet = { ...newWallet(storeId), ...walletDoc };
    const back = usage.price;
    const next: Wallet = { ...wallet, balance: wallet.balance + back, spent: Math.max(0, wallet.spent - back) };
    const done: Usage = { ...usage, outcome: 'provider_failed', price: 0, refunded: back, balanceAfter: next.balance };
    if (back > 0) {
      tx.set('aiWallets', storeId, next);
      const row: LedgerRow = { id: `${id}:refund`, storeId, ts: Date.now(), kind: 'refund', amount: back, balanceAfter: next.balance, actor: 'system', note: 'Render failed: automatic refund', renderId };
      tx.set('aiLedger', row.id, row);
    }
    tx.set('aiUsage', id, done);
    return done;
  });
}

/** The owner's later choice (kept / discarded). Recorded for reporting only; the charge stands either way. */
export async function markKept(root: Store, storeId: string, renderId: string, kept: boolean) {
  const id = usageId(storeId, renderId);
  return root.transact(async (tx) => {
    const u = await tx.get<Usage>('aiUsage', id);
    if (!u) return null;
    tx.set('aiUsage', id, { ...u, kept });
    return { ...u, kept };
  });
}

export interface Change { storeId: string; kind: 'topup' | 'refund' | 'adjustment'; amount: number; actor: string; note: string; free?: boolean; renderId?: string }

/** Console balance change (top-up, manual refund, +/- adjustment). Never leaves a negative balance. A refund tied to a render is capped at what it charged. */
export async function change(root: Store, c: Change, founder = false): Promise<Wallet> {
  if (!Number.isInteger(c.amount) || c.amount === 0 || Math.abs(c.amount) > MAX_CREDITS) throw new HttpError(400, `Amount must be a whole number of credits, at most ${MAX_CREDITS.toLocaleString('en-IN')}.`);
  if (c.kind !== 'adjustment' && c.amount < 0) throw new HttpError(400, 'Amount must be positive.');
  return root.transact(async (tx) => {
    const [walletDoc, usage] = await Promise.all([tx.get<Wallet>('aiWallets', c.storeId), c.renderId ? tx.get<Usage>('aiUsage', usageId(c.storeId, c.renderId)) : Promise.resolve(null)]);
    const wallet: Wallet = { ...newWallet(c.storeId, founder), ...walletDoc };
    if (c.renderId) {
      if (!usage) throw new HttpError(404, 'That render was not found for this store.');
      const room = (usage.outcome === 'ok' ? usage.price : 0) - (usage.refunded ?? 0);
      if (c.amount > room) throw new HttpError(400, `Only ${Math.max(0, room)} credits can still be refunded for that render.`);
    }
    const balance = wallet.balance + c.amount;
    if (balance < 0) throw new HttpError(400, `The balance cannot go below zero (it is ${wallet.balance}).`);
    const ts = Date.now();
    const next: Wallet = { ...wallet, balance };
    if (c.kind === 'topup') {
      if (c.free) next.freeTotal += c.amount; else next.paidTotal += c.amount;
      next.lastTopupAt = ts;
      next.lastTopupAmount = c.amount;
    }
    if (c.kind === 'refund') next.spent = Math.max(0, next.spent - c.amount);
    tx.set('aiWallets', c.storeId, next);
    if (c.renderId && usage) tx.set('aiUsage', usageId(c.storeId, c.renderId), { ...usage, refunded: (usage.refunded ?? 0) + c.amount });
    const row: LedgerRow = {
      id: `${c.storeId}:${crypto.randomUUID()}`, storeId: c.storeId, ts, kind: c.kind, amount: c.amount, balanceAfter: balance, actor: c.actor, note: c.note.slice(0, 200),
      ...(c.renderId ? { renderId: c.renderId } : {}), ...(c.free ? { free: true } : {})
    };
    tx.set('aiLedger', row.id, row);
    return next;
  });
}

/** Per-store settings from the console (flags, override, cap). */
export async function configureWallet(root: Store, storeId: string, patch: Partial<Pick<Wallet, 'aiFree' | 'aiEnabled' | 'priceOverride' | 'monthlyCap'>>, founder = false): Promise<Wallet> {
  return root.transact(async (tx) => {
    const w: Wallet = { ...newWallet(storeId, founder), ...(await tx.get<Wallet>('aiWallets', storeId)) };
    const next = { ...w, ...patch };
    tx.set('aiWallets', storeId, next);
    return next;
  });
}

export const setConfig = (root: Store, cfg: AiConfig) => root.set('aiConfig', 'global', cfg as unknown as Doc);

const byTs = <T extends { ts: number }>(rows: T[]) => rows.sort((a, b) => b.ts - a.ts);
// ponytail: one store's whole history is read then sorted (equality filter only, so no Firestore index); page it if a store ever has tens of thousands of renders.
export const storeUsage = async (root: Store, storeId: string, limit = 20) => byTs(await root.list<Usage>('aiUsage', { where: [{ field: 'storeId', op: '==', value: storeId }] })).slice(0, limit);
export const storeLedger = async (root: Store, storeId: string, limit = 20) => byTs(await root.list<LedgerRow>('aiLedger', { where: [{ field: 'storeId', op: '==', value: storeId }] })).slice(0, limit);
/** Everything since `since` (ms), newest first, capped. */
export const usageSince = async (root: Store, since: number, max = 20000) => byTs(await root.list<Usage>('aiUsage', { where: [{ field: 'ts', op: '>', value: since }] })).slice(0, max);
export const ledgerSince = async (root: Store, since: number, max = 20000) => byTs(await root.list<LedgerRow>('aiLedger', { where: [{ field: 'ts', op: '>', value: since }] })).slice(0, max);
