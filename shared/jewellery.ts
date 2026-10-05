// Constants and pure helpers for the jewellery sector, shared by the server and the browser app.

/** Purities offered until the owner saves their own list (Admin > Purity options). */
export const DEFAULT_PURITIES = ['22K 916', '20K 830', '18K 750', '14K 585', '9K 385'];

/** "22K 916": a karat and a fineness (parts per thousand, optionally with one decimal). */
export const PURITY_KEY = /^[0-9]{1,2}K [0-9]{3}(.[0-9])?$/;

/** How a purity is shown: "22K 916" becomes "22K · 916". */
export const purityTitle = (key: string) => key.replace(' ', ' · ');

/** "Draft" is accepted by the API but is not offered on the product form. */
export const STOCK_STATUSES = ['Ready in Vault', 'Made-to-Order', 'Draft'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** How a design is priced: on gram weight (the trade default), a fixed amount, or only on request. */
/** Sort orders the catalogue offers; the server and the Catalogue screen read the same list. */
export const SORT_KEYS = ['newest', 'weight-asc', 'weight-desc', 'name'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_LABELS: Record<SortKey, string> = { newest: 'Newest', 'weight-asc': 'Lightest first', 'weight-desc': 'Heaviest first', name: 'A to Z' };

const round3 = (n: number) => parseFloat(n.toFixed(3));

/** Net metal weight in grams: gross weight minus stones / tare. */
export const netWeight = (gross: number, stone: number) => round3(Math.max(0, gross - stone));

/** Net weight of an order line. */
export const lineWeight = (netWt: number, qty: number) => round3(netWt * qty);

/** The types a collection is filed under. Every new collection must pick one, so Browse all can group them (all rings together, all pendants together). */
export const COLLECTION_TAGS = ['Rings', 'Necklaces', 'Pendants', 'Earrings', 'Bangles', 'Bracelets', 'Chains', 'Coins & Bars', 'Sets', 'Other'] as const;
export type CollectionTag = (typeof COLLECTION_TAGS)[number];

/** A best guess from the name, only for older collections made before tags were required. */
export const guessTag = (name: string): CollectionTag => {
  const n = name.toLowerCase();
  const rules: Array<[RegExp, CollectionTag]> = [
    [/\bring/, 'Rings'], [/pendant|mangalsutra|locket/, 'Pendants'], [/chain/, 'Chains'], [/bracelet/, 'Bracelets'], [/bangle|kada|kadas|kangan/, 'Bangles'],
    [/earring|jhumk|chandbali|stud|tops/, 'Earrings'], [/necklace|choker|haar|rani/, 'Necklaces'], [/coin|bar\b|bars\b|bullion/, 'Coins & Bars'], [/\bset\b|sets\b|jadau|polki|temple/, 'Sets']
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? 'Other';
};
/** The tag a collection is filed under: its own, or a guess for one that predates tags. */
export const tagOf = (c: { name: string; tag?: string }): string => (c.tag && (COLLECTION_TAGS as readonly string[]).includes(c.tag) ? c.tag : guessTag(c.name));
/** Tags in the fixed order, only those in use. */
export const tagsInUse = (cats: Array<{ name: string; tag?: string }>) => COLLECTION_TAGS.filter((t) => cats.some((c) => tagOf(c) === t));
