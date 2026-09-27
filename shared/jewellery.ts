// Constants and pure helpers for the jewellery sector, shared by the server and the browser app.

export const PURITY_KEYS = ['22K 916', '24K 999.9', '18K 750', '14K 585'] as const;
export type PurityKey = (typeof PURITY_KEYS)[number];

/** How each purity is presented on the product form. */
export const PURITY_LABELS: Record<PurityKey, { title: string; sub: string }> = {
  '22K 916': { title: '22K • 916', sub: 'Standard Luxury' },
  '24K 999.9': { title: '24K • 999', sub: 'Bullion Grade' },
  '18K 750': { title: '18K • 750', sub: 'Diamond Setting' },
  '14K 585': { title: '14K • 585', sub: 'Export Lightweight' }
};

/** "Draft" is accepted by the API but is not offered on the product form. */
export const STOCK_STATUSES = ['Ready in Vault', 'Made-to-Order', 'Draft'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** How a piece is priced: by weight (gram basis, optional making charge), a fixed price, or on request. */
export const PRICE_MODES = ['weight', 'fixed', 'on_request'] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

const round3 = (n: number) => parseFloat(n.toFixed(3));

/** Net metal weight in grams: gross weight minus stones / tare. */
export const netWeight = (gross: number, stone: number) => round3(Math.max(0, gross - stone));

/** Net weight of an order line. */
export const lineWeight = (netWt: number, qty: number) => round3(netWt * qty);
