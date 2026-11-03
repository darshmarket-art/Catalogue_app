import { useSyncExternalStore } from 'react';

/** Cover photo per collection tag (tag name -> signed photo URL), set by the owner. Empty until loaded; a tag without a cover falls back to its newest design's photo. */
let covers: Record<string, string> = {};
const listeners = new Set<() => void>();
export const setTagCovers = (map: Record<string, string>) => {
  covers = map;
  listeners.forEach((l) => l());
};
export const getTagCovers = () => covers;
export const useTagCovers = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => covers
  );
