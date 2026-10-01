import { z } from 'zod';
import { PURITY_KEYS, STOCK_STATUSES, lineWeight, netWeight } from '../../shared/jewellery';
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
    purity: z.enum(PURITY_KEYS),
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

  confirmationMessage(args: { brandName: string; poId: string; totalNet: number; itemCount: number }) {
    return (
      `*${args.brandName.toUpperCase()} B2B WHOLESALE CONFIRMATION (GRAM BASIS)*\n` +
      `*PO:* ${args.poId}\n` +
      `*Total Fine Gold Weight:* ${args.totalNet.toFixed(3)}g Net\n` +
      `*Items in Batch:* ${args.itemCount}\n` +
      `*Settlement Terms:* Pure Fine Gold Gram Settlement (999.9 Bullion Bar Handover or Gold Metal Loan Credit)\n` +
      `Kindly confirm dispatch slot.`
    );
  }
};

export type SectorPack = typeof jewelleryPack;
