import { z } from 'zod';
import { PURITY_KEYS, STOCK_STATUSES, lineWeight, netWeight } from '../../shared/jewellery';
import { PLACEHOLDER_IMAGE } from '../placeholder';
import type { Doc } from '../store';
import { httpUrl, optionalUrl, trimmed } from '../schemas';

/**
 * The jewellery sector: which fields a product has, how weights are derived, and how an order is worded.
 * Nothing here is invented for the merchant: hallmark IDs and prices are only stored when someone enters them.
 */
const money = z.coerce.number().min(0).max(1e9);

const productSchema = z
  .object({
    title: trimmed(200),
    sku: trimmed(60).optional(),
    category: trimmed(100),
    purity: z.enum(PURITY_KEYS),
    grossWt: z.coerce.number().positive().max(100000),
    stoneWt: z.coerce.number().min(0).max(100000).default(0),
    huid: trimmed(40).optional(),
    makingChargePerGram: money.optional(),
    priceEstimate: money.optional(),
    stockStatus: z.enum(STOCK_STATUSES).default('Ready in Vault'),
    image: optionalUrl,
    angles: z.array(httpUrl).max(10).optional()
  })
  .refine((p) => p.stoneWt < p.grossWt, { path: ['stoneWt'], message: 'Stone weight must be less than gross weight.' });

export type JewelleryProductInput = z.infer<typeof productSchema>;

const randomSku = () =>
  `SKU-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

export const jewelleryPack = {
  id: 'jewellery' as const,
  productSchema,

  buildProduct(input: JewelleryProductInput, meta: { id: string; now: string }): Doc {
    return {
      id: meta.id,
      sku: input.sku ?? randomSku(),
      title: input.title,
      category: input.category,
      purity: input.purity,
      grossWt: input.grossWt,
      netWt: netWeight(input.grossWt, input.stoneWt),
      stoneWt: input.stoneWt,
      ...(input.huid ? { huid: input.huid } : {}),
      ...(input.makingChargePerGram !== undefined ? { makingChargePerGram: input.makingChargePerGram } : {}),
      ...(input.priceEstimate !== undefined ? { priceEstimate: input.priceEstimate } : {}),
      image: input.image ?? input.angles?.[0] ?? PLACEHOLDER_IMAGE,
      angles: input.angles ?? [],
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
