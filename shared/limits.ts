export interface Limits { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null }

/** null = unlimited (JSON cannot carry Infinity). */
export const LIMITS: Record<'basic' | 'pro', Limits> = {
  basic: { categories: 5, photos: 200, photosPerDesign: 1, users: 50 },
  pro: { categories: null, photos: null, photosPerDesign: 3, users: null }
};

export const TRIAL_DAYS = 14;

/**
 * Live Rate product limits and flags. Provisional: the real tiers follow the pricing decision (docs/LIVE_RATE_PLAN.md, section 10).
 * Kept apart from the Catalogue tables above so neither product's plan can change the other's.
 */
export interface LiveRateLimits { rows: number | null; users: number | null }
export const LIVE_RATE_LIMITS: Record<'basic' | 'pro', LiveRateLimits> = {
  basic: { rows: 6, users: 50 },
  pro: { rows: null, users: null }
};
export const liveRateFlagsFor = (p: 'basic' | 'pro') => ({ rateBoard: true, rateAlerts: p === 'pro', bullionTrade: p === 'pro' });

/** Feature flags per plan: Basic has no ordering, insights or PDF; banners and purities are on both. Shared so the Plans screen reads the table the server enforces. */
export const flagsFor = (p: 'basic' | 'pro') => ({
  orders: p === 'pro', insights: p === 'pro', liveVisitors: p === 'pro', buyerEngagement: p === 'pro',
  auditLog: p === 'pro', alerts: p === 'pro', enquiries: p === 'pro', pdfCatalogue: p === 'pro', banners: true, purities: true
});
