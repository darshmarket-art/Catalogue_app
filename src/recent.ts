/** What a buyer opened lately, kept on their own device (names and SKUs only). Reading or writing never throws. */
const read = (key: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const write = (key: string, list: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage blocked: the list simply is not remembered
  }
};
const bump = (key: string, value: string, max: number) => write(key, [value, ...read(key).filter((x) => x !== value)].slice(0, max));

export const recentCollections = () => read('recent-collections');
export const noteCollection = (name: string) => bump('recent-collections', name, 4);
export const recentSkus = () => read('recent-skus');
export const noteSku = (sku: string) => bump('recent-skus', sku, 12);
/** The layout the buyer prefers in the Catalogue. */
export type CatalogueView = 'grid2' | 'grid3' | 'list';
export const readView = (): CatalogueView => {
  try {
    const v = localStorage.getItem('catalogue-view');
    return v === 'grid3' || v === 'list' ? v : 'grid2';
  } catch {
    return 'grid2';
  }
};
export const writeView = (v: CatalogueView) => {
  try {
    localStorage.setItem('catalogue-view', v);
  } catch {
    // not remembered
  }
};
