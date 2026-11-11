/** Storefront layouts a store owner can pick in Store settings. Emergent ("Classic") is the default; Maison is the black-and-white editorial one. Gilded is archived in app_themes/. */
export const LAYOUT_IDS = ['emergent', 'maison'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];
export const DEFAULT_LAYOUT: LayoutId = 'emergent';

/** Colour looks of the Maison layout. Ivory is the black-and-white default; Noir is black, ivory and champagne gold. */
export const MAISON_LOOKS = ['ivory', 'noir', 'midnight', 'garnet'] as const;
export type MaisonLook = (typeof MAISON_LOOKS)[number];
export const LOOK_NAMES: Record<MaisonLook, string> = { ivory: 'Ivory', noir: 'Noir', midnight: 'Midnight', garnet: 'Garnet' };

export const LAYOUTS: ReadonlyArray<{ id: LayoutId; name: string; plan: 'basic' | 'pro' }> = [
  { id: 'emergent', name: 'Classic', plan: 'basic' },
  { id: 'maison', name: 'Maison', plan: 'basic' }
];
