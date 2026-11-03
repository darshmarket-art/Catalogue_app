import type { Store } from './store';
import { HttpError } from './http';
import { loadTagCovers } from './tags';
import { UPGRADE_TO_PRO } from '../shared/sales';
import { LIMITS, TRIAL_DAYS, flagsFor, type Limits } from '../shared/limits';
export { LIMITS, TRIAL_DAYS, flagsFor };
export type { Limits };

export type Plan = 'basic' | 'pro' | 'founder';
export interface PlanDoc { plan: Plan; trialEndsAt?: string; ownApp?: boolean; trialNotice?: string }

export const trialEnd = (from = new Date()) => new Date(from.getTime() + TRIAL_DAYS * 86400000).toISOString();

/** Pro while founder, own-app, or inside the trial; otherwise basic. Computed per request, nothing to expire. */
export function effectivePlan(doc: PlanDoc, now = Date.now()): 'basic' | 'pro' {
  if (doc.plan === 'pro' || doc.plan === 'founder' || doc.ownApp) return 'pro';
  return doc.trialEndsAt && Date.parse(doc.trialEndsAt) > now ? 'pro' : 'basic';
}

export const makeEntitlements = (doc: PlanDoc, now = Date.now()) => {
  const effective = effectivePlan(doc, now);
  return { plan: doc.plan, effectivePlan: effective, trialEndsAt: doc.trialEndsAt ?? null, ownApp: Boolean(doc.ownApp), trialNotice: effective === 'basic' && doc.plan === 'basic' ? doc.trialNotice || null : null, limits: LIMITS[effective], flags: flagsFor(effective) };
};


/** Distinct photos in use across designs, categories, banners and tag covers. Uploaded-but-unused (orphan) files are not counted. */
export async function photosInUse(store: Store, products?: { photos(): Promise<Set<string> | null> }): Promise<Set<string>> {
  // With a catalogue handle the design photos come from its in-memory index; without one (or when the store is too big to index) the products are scanned.
  const fromIndex = await products?.photos();
  const [productDocs, categories, banners, covers] = await Promise.all([fromIndex ? [] : store.list('products'), store.list('categories'), store.list('banners'), loadTagCovers(store)]);
  const used = new Set<string>(fromIndex ?? []);
  for (const p of productDocs) for (const i of p.images ?? [p.image]) if (i) used.add(i);
  for (const d of [...categories, ...banners]) if (d.image) used.add(d.image);
  for (const ref of Object.values(covers)) used.add(ref);
  return used;
}

const photosInUseOf = photosInUse;
export type FlagName = keyof ReturnType<typeof flagsFor>;

/** `plan` reads the store record (plan, trialEndsAt, ownApp); `store` is that store's scoped data. */
export function entitlements(store: Store, plan: () => Promise<PlanDoc>, catalogue?: { photos(): Promise<Set<string> | null> }) {
  const photosInUse = (s: Store) => photosInUseOf(s, catalogue);
  const load = async () => makeEntitlements(await plan());
  const deny = (what: string, limit: number) => new HttpError(402, `Your plan allows ${limit} ${what}. ${UPGRADE_TO_PRO}`);
  return {
    load,
    /** Express middleware: 402 when the plan lacks the feature. `when` lets a route gate only some requests. */
    requireFlag: (flag: FlagName, what: string, when: (req: any) => boolean = () => true) =>
      async (req: any, _res: any, next: (e?: unknown) => void) => {
        try {
          if (when(req) && !(await load()).flags[flag]) throw new HttpError(402, `${what} is a Pro feature. ${UPGRADE_TO_PRO}`);
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
