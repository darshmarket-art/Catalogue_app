/** Storefront layouts a store owner can pick in Store settings. Emergent ("Classic") is the default; Maison is the black-and-white editorial one. Gilded is archived in app_themes/. */
export const LAYOUT_IDS = ['emergent', 'maison'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'emergent';

export const LAYOUTS: ReadonlyArray<{ id: LayoutId; name: string; plan: 'basic' | 'pro' }> = [
  { id: 'emergent', name: 'Classic', plan: 'basic' },
  { id: 'maison', name: 'Maison', plan: 'basic' }
];
