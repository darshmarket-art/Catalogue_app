/** The products Antarixs sells. A store has one or both; each is switched on per store and carries its own plan. */
export const PRODUCTS = ['catalogue', 'liveRate'] as const;
export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABELS: Record<Product, string> = { catalogue: 'Catalogue', liveRate: 'Live Rate' };

/**
 * The products a store has, in a fixed order. A record without `products` predates Live Rate, so it has the Catalogue only:
 * every store that exists today keeps working with no data change.
 */
export const productsOf = (r: { products?: readonly string[] }): Product[] => {
  const picked = PRODUCTS.filter((p) => r.products?.includes(p));
  return picked.length ? picked : ['catalogue'];
};

export const hasProduct = (r: { products?: readonly string[] }, product: Product) => productsOf(r).includes(product);
