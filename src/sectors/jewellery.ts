import { PRICE_MODES, PURITY_KEYS, PURITY_LABELS } from '../../shared/jewellery';
import type { OrderItem, Product } from '../types';

/**
 * The jewellery sector on the browser side: form options, on-screen wording and the WhatsApp message templates.
 * A new sector supplies its own pack with the same shape (see src/sector.ts).
 */
export const jewelleryPack = {
  id: 'jewellery' as const,

  purities: PURITY_KEYS.map((key) => ({ key, ...PURITY_LABELS[key] })),
  /** How a piece can be priced, as the merchant chooses on the product form. */
  priceModes: PRICE_MODES.map((key) => ({
    key,
    ...{
      weight: { title: 'By weight', sub: 'Gram basis, optional making charge' },
      fixed: { title: 'Fixed price', sub: 'One price for the piece' },
      on_request: { title: 'On request', sub: 'Buyer asks for a quote' }
    }[key]
  })),
  stockStatuses: [
    { key: 'Ready in Vault', icon: 'verified' },
    { key: 'Made-to-Order', icon: 'hourglass_empty' }
  ],

  /** The price line shown on a product card and its detail sheet, or null when there is nothing to show. */
  priceLabel(product: Product): string | null {
    const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
    if (product.priceMode === 'fixed' && product.fixedPrice) return money(product.fixedPrice);
    if (product.priceMode === 'weight') {
      return product.makingChargePerGram ? `By weight + ${money(product.makingChargePerGram)}/g making` : 'By weight';
    }
    return 'Price on request';
  },

  copy: {
    tradingModel: 'Pure Gram Basis',
    headerTicker: { label: 'Pure Gram Settlement', badge: '916 / 999.9 Purity' },
    categorySearchPlaceholder: 'Search 22K, 18K, Polki, Diamond or Bullion...',
    orders: {
      banner: {
        title: 'Pure Gram-Basis Settlement',
        subtitle: 'Settlement via Fine Gold Weight (Physical / GML)',
        badge: 'NET WT BASIS',
        note: 'Zero Price Slippage'
      },
      summarySubtitle: 'Review your items before you order',
      emptyTitle: 'Your order is empty',
      emptyText: 'Browse the catalogue and add designs to your order.',
      lineWeightLabel: 'Total net gold',
      unitWeightLabel: 'Net weight each:',
      totalWeightLabel: 'Total net gold weight',
      dispatchLabel: 'Items in order',
      bookedBanner: 'Order placed',
      bookedText: (grams: string) => `Your order is booked on pure gram settlement terms: ${grams} g net gold`,
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
    const netOf = (needle: string) => items.filter((i) => i.purity.includes(needle)).reduce((sum, i) => sum + i.netWt, 0);
    const totalGross = items.reduce((sum, i) => sum + i.grossWt, 0);
    return (
      `*${brandName.toUpperCase()} — WHOLESALE GRAM-BASIS REQUISITION*\n` +
      `*Client:* ${clientFirm}${clientCity ? ` (${clientCity})` : ''}\n` +
      `*Settlement Basis:* Pure Net Gold Weight (No Fiat Price Lock)\n` +
      `*Total Items:* ${selectedCount} Pieces\n` +
      `*Total Net Gold:* ${totalNetWeight.toFixed(3)}g Net\n` +
      `  • 22K (916) Net Wt: ${netOf('22K').toFixed(3)}g\n` +
      `  • 24K (999.9) Pure Wt: ${netOf('24K').toFixed(3)}g\n` +
      `  • Total Gross Weight: ${totalGross.toFixed(3)}g\n\n` +
      `*Itemized SKU Manifest:*\n` +
      items.map((it) => `• ${it.title} (${it.sku}) — Net: ${it.netWt}g [${it.purity}]`).join('\n') +
      `\n\n*Settlement Terms:* Physical 999.9 Bullion Bar Handover or Bullion Banking Gold Metal Loan Credit.\n` +
      `_Sent from the ${brandName} catalogue app_`
    );
  }
};
