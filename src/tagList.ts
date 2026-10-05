import { useSyncExternalStore } from 'react';
import { COLLECTION_TAGS } from '../shared/jewellery';

/** The store's collection tags in the owner's order. Loaded once after sign-in; the defaults until then. */
let tags: string[] = [...COLLECTION_TAGS];
const listeners = new Set<() => void>();
export const setTagList = (list: string[]) => {
  tags = list;
  listeners.forEach((l) => l());
};
export const getTagList = () => tags;
export const useTagList = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => tags
  );

/** Collections grouped under their tag, in the owner's tag order. A tag the list no longer knows goes last. */
export function groupByTag<T extends { tag: string }>(items: T[], order: string[]): Array<[string, T[]]> {
  const names = [...order, ...items.map((c) => c.tag).filter((t, i, a) => !order.includes(t) && a.indexOf(t) === i)];
  return names.map((t) => [t, items.filter((c) => c.tag === t)] as [string, T[]]).filter(([, cs]) => cs.length > 0);
}
