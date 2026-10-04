import type { LayoutId } from '../../shared/layouts';
import { gilded, type LayoutKit } from './gilded';
import { emergent } from './emergent';

export type { LayoutKit };
const KITS: Record<LayoutId, LayoutKit> = { gilded, emergent };

/** The kit for the layout the server embedded for this store (already the effective one for its plan). */
export const kitFor = (id: LayoutId): LayoutKit => KITS[id] ?? gilded;
