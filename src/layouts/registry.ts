/** Layout registry - exports all available storefront layouts */
import { emergent as emergentLayout } from './emergent';
import { bhaktiTheme as bhaktiThemeLayout } from './bhakti-theme';

export const LAYOUTS = {
  emergent: emergentLayout,
  bhaktiTheme: bhaktiThemeLayout,
} as const;

export type LayoutId = keyof typeof LAYOUTS;
