export interface Limits { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null }

/** null = unlimited (JSON cannot carry Infinity). */
export const LIMITS: Record<'basic' | 'pro', Limits> = {
  basic: { categories: 5, photos: 200, photosPerDesign: 1, users: 50 },
  pro: { categories: null, photos: 3000, photosPerDesign: 3, users: null }
};

export const TRIAL_DAYS = 14;
