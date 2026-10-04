/** Storefront layouts. Gilded is the standard one (every plan); Emergent is the boutique layout (Pro). */
export const LAYOUT_IDS = ['gilded', 'emergent'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'gilded';

export const LAYOUTS: ReadonlyArray<{ id: LayoutId; name: string; blurb: string; plan: 'basic' | 'pro' }> = [
  { id: 'gilded', name: 'Gilded', blurb: 'Ivory and gold. The standard storefront.', plan: 'basic' },
  { id: 'emergent', name: 'Emergent', blurb: 'Boutique. Photo-led cards, a featured piece and a bottom tab bar.', plan: 'pro' }
];

export const layoutPlan = (id: LayoutId) => LAYOUTS.find((l) => l.id === id)?.plan ?? 'pro';
