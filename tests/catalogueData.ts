import type { Doc } from '../server/store';

const CATS = ['Rings', 'Bridal Chokers & Haar', 'Pendants', 'Jhumka', 'Bangles'];
const PURITIES = ['22K 916', '18K 750', '14K 585'];
const STOCK = ['Ready in Vault', 'Made-to-Order', 'Draft'];
const WORDS = ['Necklace', 'Lakshmi', 'Temple', 'Floral', 'Peacock', 'Classic', 'Heavy', 'Light', 'Kada', 'Choker'];

/** Deterministic pseudo-random products. createdAt repeats on purpose so sort ties are exercised. */
export function makeProducts(n: number, prefix = 'item'): Doc[] {
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  return Array.from({ length: n }, (_, i) => {
    const gross = Math.round((1 + rnd() * 60) * 1000) / 1000;
    const stone = rnd() < 0.3 ? Math.round(gross * 0.1 * 1000) / 1000 : 0;
    const cat = pick(CATS);
    const id = `${prefix}-${String(i).padStart(6, '0')}`;
    return {
      id, sku: `SKU-${i}`, title: `${pick(WORDS)} ${pick(WORDS)} ${i % 97}`, category: cat, purity: pick(PURITIES), grossWt: gross, stoneWt: stone,
      netWt: Math.round((gross - stone) * 1000) / 1000, stockStatus: pick(STOCK), images: [`media:${i}a`, `media:${i % 50}b`], image: `media:${i}a`,
      createdAt: new Date(Date.UTC(2026, 0, 1) + Math.floor(rnd() * 300) * 60000).toISOString(),
      ...(i % 7 === 0 ? { description: 'Hand finished with kundan', huid: `HM${i}` } : {}), ...(i % 11 === 0 ? { titleHi: 'सुंदर हार' } : {})
    };
  });
}

