import fs from 'fs';
import path from 'path';
import { z } from 'zod';

/** Theme colour tokens a merchant may override. Must stay in sync with the @theme block in src/index.css. */
export const THEME_TOKENS = [
  'primary',
  'primary-container',
  'on-primary',
  'on-primary-container',
  'primary-fixed',
  'primary-fixed-dim',
  'secondary',
  'secondary-container',
  'on-secondary',
  'on-secondary-container',
  'secondary-fixed',
  'secondary-fixed-dim',
  'tertiary',
  'tertiary-container',
  'on-tertiary',
  'tertiary-fixed',
  'tertiary-fixed-dim',
  'surface',
  'surface-dim',
  'surface-bright',
  'surface-container-lowest',
  'surface-container-low',
  'surface-container',
  'surface-container-high',
  'surface-container-highest',
  'surface-variant',
  'on-surface',
  'on-surface-variant',
  'inverse-surface',
  'inverse-on-surface',
  'on-secondary-fixed',
  'on-secondary-fixed-variant',
  'secondary-dark',
  'secondary-hover',
  'secondary-deep',
  'tertiary-dark',
  'on-tertiary-fixed',
  'brown-dark',
  'brown-darker',
  'brown-darkest',
  'whatsapp',
  'on-whatsapp',
  'success',
  'success-container',
  'info',
  'info-container',
  'scrim',
  'outline',
  'outline-variant',
  'error',
  'error-container'
] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour such as #715509');
const httpUrl = z
  .string()
  .max(2048)
  .refine((v) => /^https?:\/\//i.test(v) && URL.canParse(v), 'Must be an http(s) URL');
const fontName = z.string().trim().regex(/^[A-Za-z0-9 ]{2,60}$/, 'Use just the font name, such as "Playfair Display"');
const googleFontsUrl = z
  .string()
  .max(2048)
  .refine((v) => v.startsWith('https://fonts.googleapis.com/') && URL.canParse(v), 'Must be a Google Fonts link (https://fonts.googleapis.com/...)');
const text = (max: number) => z.string().trim().min(1).max(max);

const feature = z.object({
  icon: text(40),
  title: text(80),
  badge: text(30).optional(),
  description: text(160)
});

const promotion = z.object({
  theme: z.enum(['gold', 'green', 'brown']),
  tag: text(40),
  stampIcon: text(40),
  stampText: text(40),
  title: text(80),
  subtitle: text(140),
  actionLabel: text(40),
  actionIcon: text(40),
  note: text(40)
});

/** An extra detail a merchant records on every product (e.g. "Collection", "Finish"), on top of the sector's own fields. */
const productField = z
  .object({
    key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,29}$/, 'Start with a lower-case letter; letters and digits only'),
    label: text(40),
    type: z.enum(['text', 'number', 'select']).default('text'),
    options: z.array(text(60)).min(1).max(20).optional(),
    required: z.boolean().default(false),
    unit: text(12).optional()
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, { message: 'A "select" field needs options', path: ['options'] });

export type ProductField = z.infer<typeof productField>;

export const merchantSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Lower-case letters, digits and dashes only'),
  sector: z.enum(['jewellery']),
  /** "public" lets anyone browse the catalogue; "login" requires an account. Ordering always needs an account. */
  catalogueAccess: z.enum(['public', 'login']).default('login'),
  orderFlow: z.enum(['direct']).default('direct'),

  brand: z.object({
    name: text(60),
    tagline: text(60),
    description: text(200),
    logoUrl: httpUrl,
    seoTitle: text(120),
    seoDescription: text(300)
  }),

  /** Colours, and optionally fonts: a merchant can look completely different from every other. */
  theme: z
    .object({
      colors: z.record(z.enum(THEME_TOKENS), hexColor).default({}),
      fonts: z
        .object({
          /** Headings and the brand name, e.g. "Playfair Display". */
          display: fontName.optional(),
          /** Body text, e.g. "Mukta". */
          body: fontName.optional(),
          /** A Google Fonts stylesheet that loads both, e.g. https://fonts.googleapis.com/css2?family=... */
          url: googleFontsUrl.optional()
        })
        .default({})
    })
    .default({ colors: {}, fonts: {} }),

  contact: z.object({
    /** Digits only, with country code, as used by wa.me links. */
    whatsapp: z.string().regex(/^[0-9]{8,15}$/),
    deskPhone: text(30),
    address: text(200).optional(),
    showroomLabel: text(60).optional(),
    instagramUrl: httpUrl.optional(),
    facebookUrl: httpUrl.optional(),
    youtubeUrl: httpUrl.optional()
  }),

  legal: z.object({
    registrationLine: text(160).optional(),
    privacyUrl: httpUrl.optional(),
    termsUrl: httpUrl.optional()
  }),

  orders: z.object({
    poPrefix: z.string().regex(/^[A-Z0-9-]{2,20}$/),
    guaranteeLine: text(200).optional(),
    bookedNote: text(240).optional()
  }),

  /** Extra product details this merchant records; shown on the product form, card and detail sheet. */
  productFields: z
    .array(productField)
    .max(10)
    .default([])
    .refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, 'Each product field needs a unique key'),

  /** Banner carousel on the Categories screen; hidden when empty. */
  promotions: z.array(promotion).max(5).default([]),

  welcome: z.object({
    features: z.array(feature).min(1).max(4),
    footerLine: text(120).optional()
  }),

  onboarding: z.object({
    defaultMarketHub: text(120),
    marketHubPlaceholder: text(120)
  })
});

export type MerchantConfig = z.infer<typeof merchantSchema>;

/** Validates a parsed merchant.json; `source` names where it came from in the error message. */
export function parseMerchant(raw: unknown, source: string, expectedId?: string): MerchantConfig {
  const result = merchantSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid merchant config ${source}:\n - ${problems.join('\n - ')}`);
  }
  if (expectedId && result.data.id !== expectedId) throw new Error(`${source}: id "${result.data.id}" does not match "${expectedId}"`);
  return result.data;
}

/** Loads and validates merchants/<id>/merchant.json. The id comes from the MERCHANT env var. */
export function loadMerchant(env: NodeJS.ProcessEnv = process.env, root: string = process.cwd()): MerchantConfig {
  const id = env.MERCHANT?.trim() || 'bhakti';
  if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new Error(`Invalid MERCHANT id "${id}"`);

  const file = path.resolve(root, 'merchants', id, 'merchant.json');
  if (!fs.existsSync(file)) throw new Error(`Merchant config not found: ${file}`);

  return parseMerchant(JSON.parse(fs.readFileSync(file, 'utf-8')), file, id);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `:root{...}` declarations for the colours this merchant overrides. Values are regex-validated hex. */
export function themeCss(merchant: MerchantConfig): string {
  const rules = Object.entries(merchant.theme.colors).map(([token, value]) => `--color-${token}:${value}`);
  const { display, body } = merchant.theme.fonts;
  // Font names are validated (letters, digits and spaces only), so they are safe inside the stylesheet.
  if (display) rules.push(`--font-serif:"${display}",Georgia,serif`);
  if (body) rules.push(`--font-sans:"${body}",-apple-system,"Segoe UI",Roboto,sans-serif`, `--font-mono:"${body}",-apple-system,"Segoe UI",Roboto,sans-serif`);
  return rules.length ? `:root{${rules.join(';')}}` : '';
}

/** Fills the placeholders in index.html so link previews, the tab title and colours are right on first paint. */
export function renderIndexHtml(html: string, merchant: MerchantConfig): string {
  const themeColor = merchant.theme.colors.surface ?? '#fbf4f1';
  // "<" is escaped so the JSON can never close its own script tag.
  const json = JSON.stringify(merchant).replace(/</g, '\\u003c');
  const replacements: Record<string, string> = {
    '{{SEO_TITLE}}': escapeHtml(merchant.brand.seoTitle),
    '{{SEO_DESCRIPTION}}': escapeHtml(merchant.brand.seoDescription),
    '{{OG_IMAGE}}': escapeHtml(merchant.brand.logoUrl),
    '{{THEME_COLOR}}': themeColor,
    '{{THEME_STYLE}}':
      (merchant.theme.fonts.url ? `<link rel="stylesheet" href="${escapeHtml(merchant.theme.fonts.url)}">` : '') +
      (themeCss(merchant) ? `<style id="merchant-theme">${themeCss(merchant)}</style>` : ''),
    '{{MERCHANT_CONFIG}}': `<script id="merchant-config" type="application/json">${json}</script>`
  };
  let out = html;
  for (const [key, value] of Object.entries(replacements)) out = out.split(key).join(value);
  return out;
}
