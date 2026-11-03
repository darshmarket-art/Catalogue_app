// Fills the e2e store with AI usage so the console AI section has something real to draw. Only when AI_E2E_SEED=1 (tests/e2e/ai-credits.e2e.ts).
// The rows go through the same collections and shapes server/aiCredits.ts writes; nothing here calls a provider.
import type { Store } from '../../server/store';
import { loadMerchant } from '../../server/merchant';
import { newStoreRecord } from '../../server/tenancy';
import { DEFAULT_CONFIG, newWallet, type LedgerRow, type Usage } from '../../server/aiCredits';
import { STYLE_IDS } from '../../shared/aiStyles';

const DAY = 86400000;

export async function seedAi(root: Store) {
  const ex = loadMerchant({ MERCHANT: 'example' });
  const stores = [
    { id: 'priya-jewels', name: 'Priya Jewels', balance: 96, free: false },
    { id: 'rupa-gold', name: 'Rupa Gold House', balance: 16, free: false },
    { id: 'shree-ornaments', name: 'Shree Ornaments', balance: 0, free: false },
    { id: 'bhakti', name: 'Bhakti Jewels', balance: 0, free: true }
  ];
  for (const s of stores) if (s.id !== 'bhakti') await root.set('stores', s.id, newStoreRecord({ ...ex, id: s.id, brand: { ...ex.brand, name: s.name } }, { plan: 'pro' }));
  const now = Date.now();
  let n = 0;
  for (const [si, s] of stores.entries()) {
    let bal = s.balance;
    for (let d = 24; d >= 0; d -= 1) {
      const per = (d * 7 + si * 3) % 4; // 0..3 renders a day, uneven
      for (let k = 0; k < per; k += 1) {
        n += 1;
        const style = STYLE_IDS[(d + k + si) % STYLE_IDS.length];
        const outcome = n % 9 === 0 ? 'provider_failed' : n % 13 === 0 && !s.free ? 'blocked_credits' : 'ok';
        const price = s.free || outcome !== 'ok' ? 0 : DEFAULT_CONFIG.prices[style];
        const ts = now - d * DAY - k * 3600_000 - 600_000;
        const u: Usage = {
          id: `${s.id}:seed${n}`, storeId: s.id, renderId: `seed${n}`.padEnd(8, '0'), ts, style, model: 'gemini-nano-banana-2.1', outcome,
          costUsd: outcome.startsWith('blocked') ? 0 : 0.034, price, listPrice: DEFAULT_CONFIG.prices[style], balanceAfter: bal, ...(outcome === 'provider_failed' ? { refunded: DEFAULT_CONFIG.prices[style] } : {})
        };
        await root.set('aiUsage', u.id, u);
      }
    }
    if (!s.free) {
      const t: LedgerRow = { id: `${s.id}:seedtop`, storeId: s.id, ts: now - 20 * DAY, kind: 'topup', amount: 500, balanceAfter: 500, actor: 'dev', note: 'UPI seed' };
      await root.set('aiLedger', t.id, t);
    }
    await root.set('aiWallets', s.id, { ...newWallet(s.id, s.free), balance: s.balance, paidTotal: s.free ? 0 : 500, spent: s.free ? 0 : 400, lastTopupAt: s.free ? null : now - 20 * DAY, lastTopupAmount: s.free ? null : 500, lastUsedAt: now - 3600_000 * (si + 1) });
  }
}
