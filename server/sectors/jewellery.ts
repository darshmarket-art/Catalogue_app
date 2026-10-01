import { z } from 'zod';
import { STOCK_STATUSES, lineWeight, netWeight } from '../../shared/jewellery';
import type { Doc } from '../store';
import { photoRef } from '../media';
import { trimmed } from '../schemas';

/**
 * The jewellery sector: which fields a product has, how weights are derived, and how an order is worded.
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
    stockStatus: z.enum(STOCK_STATUSES).default('Ready in Vault'),
    /** One to three photos: uploaded ("media:...") or, for imports, an http(s) link. */
    images: z.array(photoRef).min(1, 'Add at least one photo.').max(3, 'A product can have at most 3 photos.')
  })
  .refine((p) => p.stoneWt < p.grossWt, { path: ['stoneWt'], message: 'Stone weight must be less than gross weight.' });

export type JewelleryProductInput = z.infer<typeof productSchema>;

const randomSku = () =>
  `SKU-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

export const jewelleryPack = {
  id: 'jewellery' as const,
  productSchema,

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
      images: input.images,
      image: input.images[0],
      stockStatus: input.stockStatus,
      createdAt: meta.now
    };
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
