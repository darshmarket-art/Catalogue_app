import { z } from 'zod';
import { ADMIN_ROLES } from '../shared/roles';
import { photoRef } from './media';

export const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const phone = z
  .string()
  .transform((v) => v.replace(/[^0-9]/g, ''))
  .refine((v) => v.length >= 10 && v.length <= 15, 'Please provide a valid mobile number.');

export const retailerSignupSchema = z.object({
  firmName: trimmed(120, 2),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || GSTIN.test(v), 'Please provide a valid 15-character GSTIN.')
    .optional(),
  ownerName: trimmed(100).optional(),
  phone,
  password: trimmed(128, 8),
  marketHub: trimmed(120).optional()
});

export const retailerLoginSchema = z.object({
  phone,
  password: z.string().trim().min(1).max(128),
  authMode: z.string().optional()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().trim().min(1).max(128),
  newPassword: trimmed(128, 8)
});

export const adminLoginSchema = z.object({
  adminId: trimmed(254),
  password: z.string().trim().min(1).max(128)
});

export const adminRegisterSchema = z.object({
  name: trimmed(100).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: trimmed(128, 10),
  role: z.enum(ADMIN_ROLES).default('staff'),
  masterProvisioningKey: z.string().trim().min(1).max(256)
});

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
  note: trimmed(300).optional()
});

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
