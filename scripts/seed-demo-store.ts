// Seeds a demo jewellery store (5 collections, 40 designs, 3 buyers) so search and filters can be tried at once.
// Usage: npx tsx scripts/seed-demo-store.ts            (STORE=file by default, same data file as the dev server)
//        STORE=firestore npx tsx scripts/seed-demo-store.ts   (your own cloud project; needs credentials)
// Store: aurum-demo  ·  Owner: owner@aurum-demo.test / DemoOwner@2026  ·  Buyers sign in with the OTP_STATIC_CODE.
import bcrypt from 'bcryptjs';
import { loadConfig } from '../server/config';
import { createStore } from '../server/store';
import { newStoreRecord, scopeStore } from '../server/tenancy';
import { parseMerchant } from '../server/merchant';
import { TRIAL_DAYS } from '../shared/limits';

const ID = 'aurum-demo';
const OWNER = { email: 'owner@aurum-demo.test', password: 'DemoOwner@2026', phone: '919900011111' };
const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&fit=crop`;
const PHOTOS = [
  '1515562141207-7a88fb7ce338', '1599643478518-a784e5dc4c8f', '1535632066927-ab7c9ab60908', '1573408301185-9146fe634ad0', '1611591437281-460bfbe1220a',
  '1601121141461-9d6647bca1ed', '1617038220319-276d3cfab638', '1603561591411-07134e71a2a9', '1605100804763-247f67b3557e', '1588444650733-d0767b753fc8',
  '1602173574767-37ac01994b2a', '1611085583191-a3b181a88401', '1596944924616-7b38e7cfac36', '1610694955371-d4a3e0ce4b52', '1589128777073-263566ae5e4d',
  '1606760227091-3dd870d97f1d', '1600003014755-ba31aa59c4b6', '1584302179602-e4c3d3fd629d'
].map(img);

const COLLECTIONS = [
  { name: 'Rings', subtitle: 'Solitaire, bands and cocktail rings', min: 3, max: 12, karats: ['22K 916', '18K 750'], photo: 3 },
  { name: 'Bridal Sets', subtitle: 'Chokers, haar and matching earrings', min: 40, max: 120, karats: ['22K 916'], photo: 1 },
  { name: 'Chains', subtitle: 'Daily-wear and statement chains', min: 8, max: 45, karats: ['22K 916', '18K 750'], photo: 7 },
  { name: 'Earrings', subtitle: 'Jhumka, studs and drops', min: 4, max: 20, karats: ['22K 916', '18K 750', '14K 585'], photo: 6 },
  { name: 'Bangles', subtitle: 'Kada, bangles and bracelets', min: 15, max: 60, karats: ['22K 916'], photo: 12 }
];

const NAMES: Record<string, string[]> = {
  Rings: ['Classic Solitaire Ring', 'Twisted Band', 'Floral Cocktail Ring', 'Temple Motif Ring', 'Peacock Ring', 'Minimal Dome Ring', 'Lotus Statement Ring', 'Nakshi Ring'],
  'Bridal Sets': ['Royal Kundan Choker Set', 'Antique Temple Haar', 'Polki Bridal Set', 'Lakshmi Kasu Mala', 'Guttapusalu Set', 'Rani Haar', 'Mango Mala Set', 'Nizami Choker'],
  Chains: ['Rope Chain 20 inch', 'Box Chain 22 inch', 'Singapore Twist Chain', 'Figaro Chain', 'Nawabi Chain', 'Ball Chain', 'Flat Curb Chain', 'Mangalsutra Chain'],
  Earrings: ['Classic Jhumka', 'Chandbali Drops', 'Temple Studs', 'Pearl Drop Earrings', 'Peacock Jhumka', 'Floral Studs', 'Kundan Danglers', 'Hoop Earrings'],
  Bangles: ['Antique Kada Pair', 'Nakshi Bangles Set of 4', 'Plain Daily Bangles', 'Kundan Bracelet', 'Temple Kada', 'Twisted Bangle Pair', 'Filigree Bracelet', 'Broad Patterned Kada']
};
const WORDS = ['matte finish', 'antique polish', 'bridal', 'daily wear', 'office wear', 'gift', 'festive', 'lightweight', 'heavy', 'hand-finished'];

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
      brand: { name: 'Aurum Demo Jewels', tagline: 'Trade Catalogue', description: 'Demo wholesale catalogue', logoUrl: 'https://placehold.co/128x128/715509/ffffff/png?text=AD', seoTitle: 'Aurum Demo Jewels - Catalogue', seoDescription: 'Browse the Aurum Demo catalogue.' },
      theme: { colors: {} }, contact: { whatsapp: OWNER.phone, deskPhone: `+${OWNER.phone}` }, legal: {}, orders: { poPrefix: 'PO-AURUM' },
      welcome: { features: [{ icon: 'verified', title: 'Genuine jewellery', description: 'Every piece checked before dispatch' }] },
      onboarding: { defaultMarketHub: 'Zaveri Bazaar, Mumbai', marketHubPlaceholder: 'e.g. your market or city' }
    },
    'seed-demo-store', ID
  );
  const now = Date.now();
  const rec = newStoreRecord(merchant, { plan: 'basic', trialEndsAt: new Date(now + TRIAL_DAYS * 86400000).toISOString(), owner: { email: OWNER.email, phone: OWNER.phone } });
  await root.create('stores', ID, rec as any);
  await root.create('trialClaims', `phone-${OWNER.phone}`, { storeId: ID, at: rec.createdAt });
  await root.create('trialClaims', `email-${OWNER.email}`, { storeId: ID, at: rec.createdAt });

  const store = scopeStore(root, ID);
  await store.create('admins', OWNER.email, { id: 'adm-demo-owner', name: 'Demo Owner', email: OWNER.email, password: await bcrypt.hash(OWNER.password, 12), role: 'owner', createdAt: rec.createdAt });

  let n = 0;
  for (const [ci, c] of COLLECTIONS.entries()) {
    const id = `cat-demo-${ci + 1}`;
    await store.set('categories', id, { id, slug: `CAT-${c.name.toUpperCase().replace(/\s+/g, '-')}`, name: c.name, subtitle: c.subtitle, avgNetWt: `${c.min}g – ${c.max}g`, image: PHOTOS[c.photo], eligibleKarats: c.karats, minTargetWt: c.min, maxTargetWt: c.max, createdAt: new Date(now + ci).toISOString() });
    for (const [pi, title] of NAMES[c.name].entries()) {
      n++;
      const gross = Number((c.min + ((c.max - c.min) * ((pi * 37) % 100)) / 100).toFixed(3));
      const stone = pi % 3 === 0 ? Number((gross * 0.08).toFixed(3)) : 0;
      const purity = c.karats[pi % c.karats.length];
      const priceMode = pi % 5 === 4 ? 'on-request' : pi % 5 === 2 ? 'fixed' : 'by-weight';
      const photos = [PHOTOS[(ci * 8 + pi) % PHOTOS.length], PHOTOS[(ci * 8 + pi + 5) % PHOTOS.length]];
      const id = `item-demo-${n}`;
      await store.set('products', id, {
        id, sku: `AD-${c.name.slice(0, 3).toUpperCase()}-${String(1000 + n)}`, title, category: c.name, purity, grossWt: gross, stoneWt: stone, netWt: Number((gross - stone).toFixed(3)),
        images: photos, image: photos[0], stockStatus: pi % 4 === 3 ? 'Made-to-Order' : 'Ready in Vault', priceMode,
        ...(priceMode === 'fixed' ? { price: Math.round(gross * 7200) } : {}),
        ...(pi % 2 === 0 ? { huid: `HM/D-${100000 + n * 7}` } : {}),
        description: `${title} in ${purity}: ${WORDS[pi % WORDS.length]}, ${WORDS[(pi + 3) % WORDS.length]}.`,
        createdAt: new Date(now - n * 60000).toISOString()
      });
    }
  }
  for (const [i, b] of [['Ramesh Shah', '919820011001', 'Zaveri Bazaar, Mumbai'], ['Priya Jewellers', '919820011002', 'Johari Bazaar, Jaipur'], ['Kapoor Ornaments', '919820011003', 'Chandni Chowk, Delhi']].entries()) {
    await store.create('buyers', b[1], { id: `merch-demo-${i + 1}`, firmName: b[0], ownerName: b[0], gstin: 'PENDING-VERIFY', phone: b[1], marketHub: b[2], verified: true, createdAt: rec.createdAt });
  }
  console.log(`Seeded store "${ID}": ${COLLECTIONS.length} collections, ${n} designs, 3 buyers.\nOwner: ${OWNER.email} / ${OWNER.password}\nOpen: /?store=${ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
