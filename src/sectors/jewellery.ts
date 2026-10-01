import { DEFAULT_PURITIES, purityTitle } from '../../shared/jewellery';
import type { OrderItem, Product } from '../types';

/**
 * The jewellery sector on the browser side: form options, on-screen wording and the WhatsApp message templates.
 * A new sector supplies its own pack with the same shape (see src/sector.ts).
 */
export const jewelleryPack = {
  id: 'jewellery' as const,

  /** Shown until the owner's own list loads (Admin > Purity options). */
  purities: DEFAULT_PURITIES.map((key) => ({ key, title: purityTitle(key), enabled: true })),
  stockStatuses: [
    { key: 'Ready in Vault', icon: 'verified' },
    { key: 'Made-to-Order', icon: 'hourglass_empty' }
  ],

  copy: {
    tradingModel: 'Pure Gram Basis',
    orders: {
      summarySubtitle: 'Review your items before you order',
      emptyTitle: 'Your order is empty',
      emptyText: 'Browse the catalogue and add designs to your order.',
      lineWeightLabel: 'Total net gold',
      unitWeightLabel: 'Net weight each:',
      totalWeightLabel: 'Total net gold weight',
      dispatchLabel: 'Items in order',
      bookedBanner: 'Order placed',
      bookedText: (grams: string) => `Your order is booked: ${grams} g net gold`,
      whatsappCta: {
        title: 'Send order on WhatsApp',
        subtitle: 'Opens WhatsApp with your item list'
      },
      confirmCta: 'Place order',
      bookedCta: 'Order placed',
      guaranteeFallback: 'Pure Gram Weight Guarantee'
    }
  },

  /** WhatsApp text for the buyer's current batch. */
  orderManifest(args: { brandName: string; store: string; orders: OrderItem[] }): string {
    const { brandName, store, orders } = args;
    const totalNet = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
    return (
      `*${brandName.toUpperCase()} B2B WHOLESALE MANIFEST (GRAM BASIS)*\n` +
      `*Store:* ${store}\n` +
      `*Settlement Terms:* Pure Fine Gold Gram Settlement (No Fiat Price Lock)\n` +
      `*Items in Batch:* ${orders.length} (${orders.reduce((s, i) => s + i.batchQty, 0)} Pcs)\n` +
      `*Total Fine Gold Weight:* ${totalNet.toFixed(3)}g Net\n\n` +
      `*Itemized Manifest:*\n` +
      orders.map((o) => `• ${o.title} (${o.sku}) x ${o.batchQty} — ${o.totalNetGold}g`).join('\n') +
      `\n\n_Please confirm vault allocation slot and physical 999.9 gold bullion handover._`
    );
  },

  /** WhatsApp text for a requisition slip the buyer shares with their own client. */
  quotationMessage(args: {
    brandName: string;
    clientFirm: string;
    clientCity: string;
    items: Product[];
    selectedCount: number;
    totalNetWeight: number;
  }): string {
    const { brandName, clientFirm, clientCity, items, selectedCount, totalNetWeight } = args;
    const totalGross = items.reduce((sum, i) => sum + i.grossWt, 0);
    const byPurity = Object.entries(items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.purity]: (acc[i.purity] ?? 0) + i.netWt }), {}));
    return (
      `*${brandName.toUpperCase()} — WHOLESALE GRAM-BASIS REQUISITION*\n` +
      `*Client:* ${clientFirm}${clientCity ? ` (${clientCity})` : ''}\n` +
      `*Settlement Basis:* Pure Net Gold Weight (No Fiat Price Lock)\n` +
      `*Total Items:* ${selectedCount} Pieces\n` +
      `*Total Net Gold:* ${totalNetWeight.toFixed(3)}g Net\n` +
      byPurity.map(([purity, grams]) => `  • ${purity} Net Wt: ${grams.toFixed(3)}g\n`).join('') +
      `  • Total Gross Weight: ${totalGross.toFixed(3)}g\n\n` +
      `*Itemized SKU Manifest:*\n` +
      items.map((it) => `• ${it.title} (${it.sku}) — Net: ${it.netWt}g [${it.purity}]`).join('\n') +
      `\n\n*Settlement Terms:* Physical 999.9 Bullion Bar Handover or Bullion Banking Gold Metal Loan Credit.\n` +
      `_Sent from the ${brandName} catalogue app_`
    );
  }
};
