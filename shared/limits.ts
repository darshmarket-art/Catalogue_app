export interface Limits { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null }

/** null = unlimited (JSON cannot carry Infinity). */
export const LIMITS: Record<'basic' | 'pro', Limits> = {
  basic: { categories: 5, photos: 200, photosPerDesign: 1, users: 50 },
  pro: { categories: null, photos: 3000, photosPerDesign: 3, users: null }
};

export const TRIAL_DAYS = 14;

/** Feature flags per plan: Basic has no ordering, insights or PDF; banners and purities are on both. Shared so the Plans screen reads the table the server enforces. */
export const flagsFor = (p: 'basic' | 'pro') => ({
  orders: p === 'pro', insights: p === 'pro', liveVisitors: p === 'pro', buyerEngagement: p === 'pro',
  auditLog: p === 'pro', alerts: p === 'pro', pdfCatalogue: p === 'pro', staffRoles: p === 'pro', banners: true, purities: true
});
