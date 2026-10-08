/** Storefront layouts. Emergent is the only live one, for every store and plan. Gilded is archived outside the build in app_themes/ (see its README). */
export const LAYOUT_IDS = ['emergent'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'emergent';

export const LAYOUTS: ReadonlyArray<{ id: LayoutId; name: string; plan: 'basic' | 'pro' }> = [{ id: 'emergent', name: 'Emergent', plan: 'basic' }];
