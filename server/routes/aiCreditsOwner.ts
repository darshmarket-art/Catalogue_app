import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError, handler, parse } from '../http';
import { RENDER_ID, getConfig, getWallet, markKept, priceFor, storeLedger, storeUsage } from '../aiCredits';
import type { AiWallet } from './photos';
import { STYLE_IDS } from '../../shared/aiStyles';

/** Owner side of AI credits: read-only for the balance (top-ups are made by Antarixs in the console). Always this store's own wallet. */
export function aiCreditsOwnerRoutes(ai: AiWallet, requireAdmin: RequestHandler) {
  const r = Router();
  r.get('/', requireAdmin, handler(async (_req, res) => {
    const [cfg, wallet] = await Promise.all([getConfig(ai.root), ai.founder().then((f) => getWallet(ai.root, ai.storeId, f))]);
    const [usage, ledger] = await Promise.all([storeUsage(ai.root, ai.storeId, 8), storeLedger(ai.root, ai.storeId, 40)]);
    res.json({
      status: 'success',
      data: {
        balance: wallet.balance, free: wallet.aiFree, enabled: wallet.aiEnabled && !cfg.killSwitch, low: !wallet.aiFree && wallet.balance <= cfg.lowBalance,
        prices: Object.fromEntries(STYLE_IDS.map((s) => [s, wallet.aiFree ? 0 : priceFor(cfg, wallet, s)])),
        lastTopup: wallet.lastTopupAt ? { at: wallet.lastTopupAt, amount: wallet.lastTopupAmount } : null,
        recent: usage.map((u) => ({ id: u.renderId, ts: u.ts, style: u.style, outcome: u.outcome, price: u.price, refunded: u.refunded ?? 0, kept: u.kept ?? null })),
        topups: ledger.filter((l) => l.kind === 'topup' || l.kind === 'adjustment').slice(0, 5).map((l) => ({ ts: l.ts, amount: l.amount, kind: l.kind }))
      }
    });
  }));
  // The owner says whether they kept the render. Reporting only: the charge stands either way.
  r.post('/keep', requireAdmin, handler(async (req, res) => {
    const { renderId, kept } = parse(z.object({ renderId: z.string().regex(RENDER_ID), kept: z.boolean() }), req.body);
    if (!(await markKept(ai.root, ai.storeId, renderId, kept))) throw new HttpError(404, 'Render not found.');
    res.json({ status: 'success', data: { renderId, kept } });
  }));
  return r;
}
