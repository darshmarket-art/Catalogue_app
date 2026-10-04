// Seeds a Basic store that already has 50 buyers, so the "catalogue full" flow can be tried in the preview.
// Run: npx tsx --env-file=.env scripts/seed-full-store.ts   → open /?store=full-demo and ask for a code with a new number.
import bcrypt from 'bcryptjs';
import { loadConfig } from '../server/config';
import { createStore } from '../server/store';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { parseMerchant } from '../server/merchant';
import { LIMITS } from '../shared/limits';

const ID = 'full-demo';
const OWNER = { email: 'owner@full-demo.test', password: 'FullOwner@2026', phone: '919900022222' };

async function main() {
  const config = loadConfig();
  const root = createStore(config);
  if (await root.get('stores', ID)) {
    console.log(`Store "${ID}" already exists; nothing changed.`);
    return;
  }
  const merchant = parseMerchant(
    {
      id: ID, sector: 'jewellery', catalogueAccess: 'login',
      brand: { name: 'Full House Jewels', tagline: 'Trade Catalogue', description: 'Demo store at its Basic buyer limit', logoUrl: 'https://placehold.co/128x128/4a1835/ffffff/png?text=FH', seoTitle: 'Full House Jewels - Catalogue', seoDescription: 'Demo store at its buyer limit.' },
      theme: { colors: {} }, contact: { whatsapp: OWNER.phone, deskPhone: `+${OWNER.phone}` }, legal: {}, orders: { poPrefix: 'PO-FULL' },
      welcome: { features: [{ icon: 'verified', title: 'Genuine jewellery', description: 'Every piece checked before dispatch' }] },
      onboarding: { defaultMarketHub: 'Zaveri Bazaar, Mumbai', marketHubPlaceholder: 'e.g. your market or city' }
    },
    'seed-full-store', ID
  );
  const rec = newStoreRecord(merchant, { plan: 'basic', owner: { email: OWNER.email, phone: OWNER.phone } });
  await root.create('stores', ID, rec as any);
  const store = scopeStore(root, ID);
  await store.create('admins', OWNER.email, { id: 'adm-full-owner', name: 'Full Owner', email: OWNER.email, password: await bcrypt.hash(OWNER.password, 12), role: 'owner', createdAt: rec.createdAt });
  const limit = LIMITS.basic.users!;
  for (let i = 0; i < limit; i++) {
    const phone = `9183000${String(i).padStart(5, '0')}`;
    await store.set('buyers', phone, { id: `merch-full-${i}`, firmName: `Buyer ${i + 1}`, ownerName: `Owner ${i + 1}`, gstin: 'PENDING-VERIFY', phone, marketHub: 'Zaveri Bazaar, Mumbai', verified: true, createdAt: rec.createdAt });
  }
  console.log(`Seeded "${ID}" on Basic with ${limit} buyers. Owner: ${OWNER.email} / ${OWNER.password}. Any new number now sees "catalogue full".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
