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

const round3 = (n: number) => parseFloat(n.toFixed(3));

/** Net metal weight in grams: gross weight minus stones / tare. */
export const netWeight = (gross: number, stone: number) => round3(Math.max(0, gross - stone));

/** Net weight of an order line. */
export const lineWeight = (netWt: number, qty: number) => round3(netWt * qty);
