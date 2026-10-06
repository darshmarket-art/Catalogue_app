import { z } from 'zod';
import { SORT_KEYS, STOCK_STATUSES, lineWeight, netWeight } from '../../shared/jewellery';
import type { Doc } from '../store';
import { photoRef } from '../media';
import { trimmed } from '../schemas';
import { toHindi } from '../../shared/hindi';

/**
 * The jewellery sector: which fields a product has, how weights are derived, how the catalogue is searched, and how an order is worded.
 * Nothing here is invented for the merchant: hallmark IDs are only stored when someone enters them.
 * Products carry no price: trade is on gram weight, so a request that still sends price fields has them ignored.
 */
const productSchema = z
  .object({
    title: trimmed(200),
    sku: trimmed(60).optional(),
    category: trimmed(100),
    /** Checked against the owner's purity list when the product is saved (see catalogue routes). */
    purity: trimmed(30),
    grossWt: z.coerce.number().positive().max(100000),
    stoneWt: z.coerce.number().min(0).max(100000).default(0),
    huid: trimmed(40).optional(),
    description: trimmed(600).optional(),
    /** The name and description in Hindi, for buyers who use the app in Hindi (optional: the name is written in Hindi automatically otherwise). */
    titleHi: trimmed(200).optional(),
    descriptionHi: trimmed(600).optional(),
    stockStatus: z.enum(STOCK_STATUSES).default('Ready in Vault'),
    /** One to three photos: uploaded ("media:...") or, for imports, an http(s) link. */
    images: z.array(photoRef).min(1, 'Add at least one photo.').max(3, 'A product can have at most 3 photos.')
  })
  .refine((p) => p.stoneWt < p.grossWt, { path: ['stoneWt'], message: 'Stone weight must be less than gross weight.' });

export type JewelleryProductInput = z.infer<typeof productSchema>;

/** What a buyer may ask the catalogue for. Every field is optional; they combine. */
const querySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  purity: z.string().trim().max(200).optional(),
  minWt: z.coerce.number().min(0).max(100000).optional(),
  maxWt: z.coerce.number().min(0).max(100000).optional(),
  availability: z.string().trim().max(120).optional(),
  sort: z.enum(SORT_KEYS).default('newest'),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0)
});
export type CatalogueQuery = z.infer<typeof querySchema>;

const list = (v?: string) => (v ? v.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s && s !== 'all') : []);

const randomSku = () =>
  `SKU-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

export const jewelleryPack = {
  id: 'jewellery' as const,
  productSchema,
  querySchema,

  buildProduct(input: JewelleryProductInput, meta: { id: string; now: string; sku?: string }): Doc {
    return {
      id: meta.id,
      sku: input.sku ?? meta.sku ?? randomSku(),
      title: input.title,
      category: input.category,
      purity: input.purity,
      grossWt: input.grossWt,
      netWt: netWeight(input.grossWt, input.stoneWt),
      stoneWt: input.stoneWt,
      ...(input.huid ? { huid: input.huid } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.titleHi ? { titleHi: input.titleHi } : {}),
      ...(input.descriptionHi ? { descriptionHi: input.descriptionHi } : {}),
      images: input.images,
      image: input.images[0],
      stockStatus: input.stockStatus,
      createdAt: meta.now
    };
  },

  /** Everything a search term is matched against: name, SKU, collection, purity, hallmark, description and the store's extra details. */
  searchText(p: Doc): string {
    const extra = p.extra && typeof p.extra === 'object' ? Object.values(p.extra as Record<string, unknown>) : [];
    // Hindi too, so a buyer can search in Hindi: the owner's own Hindi, else the automatic Hindi of the name and collection.
    const hi = [p.titleHi || toHindi(p.title), toHindi(p.category), p.descriptionHi];
    return [p.title, p.sku, p.category, p.purity, p.huid, p.description, ...extra, ...hi].filter(Boolean).join(' ').toLowerCase();
  },

  /** Applies a query to the full product list: every word of the search must appear; filters narrow further; then sort. */
  applyQuery(products: Doc[], q: CatalogueQuery): Doc[] {
    const words = (q.search ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const categories = list(q.category);
    const purities = list(q.purity);
    const stock = list(q.availability);
    const out = products.filter((p) => {
      if (words.length) {
        const text = this.searchText(p);
        if (!words.every((w) => text.includes(w))) return false;
      }
      if (categories.length && !categories.includes(String(p.category).toLowerCase())) return false;
      if (purities.length && !purities.includes(String(p.purity).toLowerCase())) return false;
      if (stock.length && !stock.includes(String(p.stockStatus).toLowerCase())) return false;
      if (q.minWt !== undefined && Number(p.netWt) < q.minWt) return false;
      if (q.maxWt !== undefined && Number(p.netWt) > q.maxWt) return false;
      return true;
    });
    const byCreated = (a: Doc, b: Doc) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    out.sort(
      q.sort === 'weight-asc'
        ? (a, b) => Number(a.netWt) - Number(b.netWt) || byCreated(a, b)
        : q.sort === 'weight-desc'
          ? (a, b) => Number(b.netWt) - Number(a.netWt) || byCreated(a, b)
          : q.sort === 'name'
            ? (a, b) => String(a.title).localeCompare(String(b.title)) || byCreated(a, b)
            : byCreated
    );
    return out;
  },

  /** One order line, priced entirely from the catalogue entry. */
  cartLine(product: Doc, qty: number) {
    return {
      purity: product.purity as string,
      unitWt: product.netWt as number,
      totalNetGold: lineWeight(product.netWt, qty),
      unitDescription: `${product.netWt} g / pc`,
      note: product.huid ? `HUID: ${product.huid}` : ''
    };
  },

  /** The message the buyer sends after placing an order: who, how much, and every design with its quantity. */
  confirmationMessage(args: {
    brandName: string;
    poId: string;
    firmName: string;
    totalNet: number;
    items: Array<{ title: string; sku: string; purity: string; batchQty: number; qtyUnit?: string; totalNetGold: number }>;
  }) {
    const pieces = args.items.reduce((sum, i) => sum + i.batchQty, 0);
    return (
      `*${args.brandName.toUpperCase()} ORDER ${args.poId}*\n` +
      `*From:* ${args.firmName}\n` +
      `*Total:* ${args.totalNet.toFixed(3)} g net · ${args.items.length} ${args.items.length === 1 ? 'design' : 'designs'} · ${pieces} ${pieces === 1 ? 'piece' : 'pieces'}\n\n` +
      `*Order:*\n` +
      args.items.map((i, n) => `${n + 1}. ${i.title} (${i.sku}) · ${i.purity} · Qty ${i.batchQty}${i.qtyUnit ? ` ${i.qtyUnit}` : ''} · ${i.totalNetGold.toFixed(3)} g`).join('\n') +
      `\n\nPlease confirm the dispatch slot.`
    );
  }
};

export type SectorPack = typeof jewelleryPack;
