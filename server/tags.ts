import { z } from 'zod';
import type { Store } from './store';
import { COLLECTION_TAGS, guessTag } from '../shared/jewellery';

/** The owner's list of collection tags, in order: the defaults until they change it. */
export async function loadTags(store: Store): Promise<string[]> {
  const doc = await store.get<{ list?: string[] }>('settings', 'tags');
  return doc?.list?.length ? doc.list : [...COLLECTION_TAGS];
}

export const saveTags = (store: Store, list: string[]) => store.set('settings', 'tags', { id: 'tags', list, updatedAt: new Date().toISOString() });

export const MAX_TAGS = 30;
export const tagNameSchema = z.object({ name: z.string().trim().min(1, 'Enter a tag name.').max(30, 'Keep the tag to 30 characters.') });

/** A collection's tag as buyers and the owner see it: its own, or a guess (then the first of "Other"/the list) for one made before tags were required. */
export const resolveTag = (c: { name: string; tag?: string }, list: string[]) => (c.tag && list.includes(c.tag) ? c.tag : list.includes(guessTag(c.name)) ? guessTag(c.name) : list.includes('Other') ? 'Other' : list[0]);

export const sameTag = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
