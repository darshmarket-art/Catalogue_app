import { z } from 'zod';
import { ADMIN_ROLES } from '../shared/roles';
import { photoRef } from './media';

export const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const adminLoginSchema = z.object({
  adminId: trimmed(254),
  password: z.string().trim().min(1).max(128)
});

export const adminRegisterSchema = z.object({
  name: trimmed(100).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: trimmed(128, 10),
  role: z.enum(ADMIN_ROLES).default('owner'),
  masterProvisioningKey: z.string().trim().min(1).max(256)
});

export const bannerSchema = z.object({
  image: photoRef.refine((v) => v !== '', 'Add a photo for the banner.'),
  /** The collection this banner opens when a buyer taps it. Empty means it does nothing. */
  category: trimmed(100).nullish()
});

export const bannerLinkSchema = z.object({ category: trimmed(100).nullable() });

export const shortlistSchema = z.object({
  skus: z.array(trimmed(60)).max(500).transform((l) => Array.from(new Set(l)))
});

export const bannerOrderSchema = z.object({ ids: z.array(trimmed(80)).max(50) });

export const categorySchema = z.object({
  name: trimmed(100),
  slug: trimmed(100).optional(),
  subtitle: trimmed(200).optional(),
  minTargetWt: z.coerce.number().min(0).max(100000).optional(),
  maxTargetWt: z.coerce.number().min(0).max(100000).optional(),
  eligibleKarats: z.array(trimmed(30)).max(10).optional(),
  /** Exactly one photo per category. */
  image: photoRef.refine((v) => v !== '', 'Add a photo for the category.')
});

export const cartItemSchema = z.object({
  sku: trimmed(60),
  batchQty: z.coerce.number().int().min(1).max(10000).default(1),
  qtyUnit: trimmed(30).optional(),
  /** The purity the buyer wants; used only if the owner offers it, otherwise the design's own purity applies. */
  purity: trimmed(30).optional(),
  note: trimmed(300).optional()
});

/** The buyer's optional note to the store, sent with the order (delivery date, finish, size changes). */
export const orderConfirmSchema = z.object({ note: trimmed(300).optional() });

export const inquirySchema = z.object({
  clientFirm: trimmed(120).optional(),
  itemsCount: z.coerce.number().int().min(0).max(100000).optional(),
  totalNetWeight: z.coerce.number().min(0).max(1e9).optional()
});

const sessionId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const heartbeatSchema = z.object({ sessionId });

export const productViewsSchema = z.object({
  sessionId,
  skus: z.array(trimmed(60)).min(1).max(50)
});

const activityEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('dwell'), sku: trimmed(60), ms: z.coerce.number().int().min(1).max(5 * 60 * 1000) }),
  z.object({ type: z.literal('search'), term: trimmed(80, 2) }),
  z.object({ type: z.literal('select'), sku: trimmed(60) })
]);

export const activitySchema = z.object({ sessionId, events: z.array(activityEvent).min(1).max(60) });

export const ORDER_STATUSES = ['new', 'confirmed', 'dispatched', 'cancelled'] as const;

export const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

export const orderListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(ORDER_STATUSES).optional()
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0)
});
