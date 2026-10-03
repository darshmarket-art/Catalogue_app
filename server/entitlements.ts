import type { Store } from './store';
import { HttpError } from './http';

export type Plan = 'basic' | 'pro' | 'founder';
export interface PlanDoc { plan: Plan; trialEndsAt?: string; ownApp?: boolean }
export interface Limits { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null }

/** null = unlimited (JSON cannot carry Infinity). */
export const LIMITS: Record<'basic' | 'pro', Limits> = {
  basic: { categories: 5, photos: 200, photosPerDesign: 1, users: 50 },
  pro: { categories: null, photos: 3000, photosPerDesign: 3, users: null }
};

export const TRIAL_DAYS = 14;
export const trialEnd = (from = new Date()) => new Date(from.getTime() + TRIAL_DAYS * 86400000).toISOString();

/** Pro while founder, own-app, or inside the trial; otherwise basic. Computed per request, nothing to expire. */
export function effectivePlan(doc: PlanDoc, now = Date.now()): 'basic' | 'pro' {
  if (doc.plan === 'pro' || doc.plan === 'founder' || doc.ownApp) return 'pro';
  return doc.trialEndsAt && Date.parse(doc.trialEndsAt) > now ? 'pro' : 'basic';
}

/** Feature flags: Basic has no ordering/insights; banners and purities are on both plans. */
export const flagsFor = (p: 'basic' | 'pro') => ({
  orders: p === 'pro', insights: p === 'pro', liveVisitors: p === 'pro', buyerEngagement: p === 'pro',
  auditLog: p === 'pro', alerts: p === 'pro', pdfCatalogue: p === 'pro', staffRoles: p === 'pro', banners: true, purities: true
});

export const makeEntitlements = (doc: PlanDoc, now = Date.now()) => {
  const effective = effectivePlan(doc, now);
  return { plan: doc.plan, effectivePlan: effective, trialEndsAt: doc.trialEndsAt ?? null, ownApp: Boolean(doc.ownApp), limits: LIMITS[effective], flags: flagsFor(effective) };
};


/** Distinct photos in use across designs, categories and banners. Uploaded-but-unused (orphan) files are not counted. */
export async function photosInUse(store: Store): Promise<Set<string>> {
  const [products, categories, banners] = await Promise.all([store.list('products'), store.list('categories'), store.list('banners')]);
  const used = new Set<string>();
  for (const p of products) for (const i of p.images ?? [p.image]) if (i) used.add(i);
  for (const d of [...categories, ...banners]) if (d.image) used.add(d.image);
  return used;
}

export type FlagName = keyof ReturnType<typeof flagsFor>;

/** `plan` reads the store record (plan, trialEndsAt, ownApp); `store` is that store's scoped data. */
export function entitlements(store: Store, plan: () => Promise<PlanDoc>) {
  const load = async () => makeEntitlements(await plan());
  const deny = (what: string, limit: number) => new HttpError(402, `Your plan allows ${limit} ${what}. Upgrade to Pro for more.`);
  return {
    load,
    /** Express middleware: 402 when the plan lacks the feature. `when` lets a route gate only some requests. */
    requireFlag: (flag: FlagName, what: string, when: (req: any) => boolean = () => true) =>
      async (req: any, _res: any, next: (e?: unknown) => void) => {
        try {
          if (when(req) && !(await load()).flags[flag]) throw new HttpError(402, `${what} is a Pro feature. Upgrade to Pro to use it.`);
          next();
        } catch (e) {
          next(e);
        }
      },
    async usage() {
      return { categories: (await store.list('categories')).length, photos: (await photosInUse(store)).size, users: (await store.list('buyers')).length };
    },
    /** A NEW buyer phone is refused once the plan's user limit is reached; existing buyers always pass. */
    async assertCanAddBuyer(phone: string) {
      const { limits } = await load();
      if (limits.users === null || (await store.get('buyers', phone))) return;
      if ((await store.list('buyers')).length >= limits.users) {
        throw new HttpError(403, 'This catalogue is full and cannot accept new buyers right now. Please contact the store.', 'CATALOGUE_FULL');
      }
    },
    async assertCanAddCategory() {
      const { limits } = await load();
      if (limits.categories !== null && (await store.list('categories')).length >= limits.categories) throw deny('categories', limits.categories);
    },
    /** Call before saving a design/category/banner with `refs`; only photos not already in use count as new. */
    async assertPhotos(refs: string[], perDesign = false) {
      const { limits } = await load();
      if (perDesign && refs.length > limits.photosPerDesign) throw deny('photo(s) per design', limits.photosPerDesign);
      if (limits.photos === null) return;
      const used = await photosInUse(store);
      const added = new Set(refs.filter((r) => !used.has(r))).size;
      if (used.size + added > limits.photos) throw deny('photos in total', limits.photos);
    },
    /** Upload gate: a full store cannot upload more. */
    async assertCanUpload() {
      const { limits } = await load();
      if (limits.photos !== null && (await photosInUse(store)).size >= limits.photos) throw deny('photos in total', limits.photos);
    }
  };
}
export type Entitlements = ReturnType<typeof entitlements>;
