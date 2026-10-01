import { z } from 'zod';
import type { Store } from './store';
import { DEFAULT_PURITIES, PURITY_KEY, purityTitle } from '../shared/jewellery';

export interface PurityOption {
  /** "22K 916": karat and fineness, as stored on products. */
  key: string;
  title: string;
  enabled: boolean;
}

/** The owner's list of purities: defaults until they save their own. */
export async function loadPurities(store: Store): Promise<PurityOption[]> {
  const doc = await store.get<{ list?: Array<{ key: string; enabled: boolean }> }>('settings', 'purities');
  const list = doc?.list ?? DEFAULT_PURITIES.map((key) => ({ key, enabled: true }));
  return list.map((p) => ({ key: p.key, title: purityTitle(p.key), enabled: p.enabled }));
}

export const puritiesSchema = z.object({
  purities: z
    .array(z.object({ key: z.string().trim().regex(PURITY_KEY, 'Use a karat and fineness such as "22K 916".'), enabled: z.boolean() }))
    .min(1)
    .max(12)
    .refine((l) => new Set(l.map((p) => p.key)).size === l.length, 'Each purity can only be listed once.')
    .refine((l) => l.some((p) => p.enabled), 'Keep at least one purity switched on.')
});

export const enabledKeys = (list: PurityOption[]) => list.filter((p) => p.enabled).map((p) => p.key);
