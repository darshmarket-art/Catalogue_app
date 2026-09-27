import { z } from 'zod';

const httpUrl = z
  .string()
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v) && URL.canParse(v), 'Must be an http(s) URL');

const optionalUrl = httpUrl.optional().or(z.literal('').transform(() => undefined));

const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);

const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const ADMIN_ROLES = ['Managing Director', 'Inventory Controller', 'Bullion Desk Director'] as const;

export const ACCESS_LEVELS: Record<(typeof ADMIN_ROLES)[number], string> = {
  'Managing Director': 'L4_FULL_ESCROW_RELEASE',
  'Inventory Controller': 'L3_INVENTORY_DISPATCH',
  'Bullion Desk Director': 'L3_GRAM_SETTLEMENT'
};

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

export const adminLoginSchema = z.object({
  adminId: trimmed(254),
  password: z.string().trim().min(1).max(128)
});

export const adminRegisterSchema = z.object({
  name: trimmed(100).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: trimmed(128, 10),
  role: z.enum(ADMIN_ROLES).default('Inventory Controller'),
  masterProvisioningKey: z.string().trim().min(1).max(256)
});

export const categorySchema = z.object({
  name: trimmed(100),
  slug: trimmed(100).optional(),
  subtitle: trimmed(200).optional(),
  minTargetWt: z.coerce.number().min(0).max(100000).optional(),
  maxTargetWt: z.coerce.number().min(0).max(100000).optional(),
  eligibleKarats: z.array(trimmed(30)).max(10).optional(),
  image: optionalUrl
});

export const productSchema = z.object({
  title: trimmed(200),
  sku: trimmed(60).optional(),
  category: trimmed(100).optional(),
  purity: trimmed(30).optional(),
  grossWt: z.coerce.number().min(0).max(100000).optional(),
  stoneWt: z.coerce.number().min(0).max(100000).optional(),
  stockStatus: trimmed(50).optional(),
  image: optionalUrl,
  angles: z.array(httpUrl).max(10).optional()
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

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0)
});
