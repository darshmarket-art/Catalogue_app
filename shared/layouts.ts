/** Storefront layouts. */
export const LAYOUT_IDS = ['emergent', 'bhakti-theme'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'emergent';

export const LAYOUTS: ReadonlyArray<{ id: LayoutId; name: string; plan: 'basic' | 'pro' }> = [
  { id: 'emergent', name: 'Emergent', plan: 'basic' },
  { id: 'bhakti-theme', name: 'Bhakti Theme', plan: 'basic' },
];
