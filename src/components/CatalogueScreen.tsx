import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { trackProductView, trackSearch, trackSelect } from '../api';
import { setOnScreen, clearOnScreen } from '../attention';
import { ProductDetailSheet } from './ProductDetailSheet';

interface CatalogueScreenProps {
  products: Product[];
  isAdmin: boolean;
  /** Only show designs from this category (set from the Categories screen). */
  categoryFilter: string | null;
  onClearCategoryFilter: () => void;
  onEditProduct: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number) => void;
  onOpenQuotation: (selectedCount: number, netWeight: number, items: Product[]) => void;
  onNavigateCategories: () => void;
}

type SortKey = 'default' | 'net-asc' | 'net-desc' | 'name';

const PURITY_FILTERS = ['all', '22K', '24K', '18K'];
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default order' },
  { key: 'net-asc', label: 'Net weight: low to high' },
  { key: 'net-desc', label: 'Net weight: high to low' },
  { key: 'name', label: 'Name: A to Z' }
];

export const CatalogueScreen: React.FC<CatalogueScreenProps> = ({
  products,
  isAdmin,
  categoryFilter,
  onClearCategoryFilter,
  onEditProduct,
  onAddToOrder,
  onOpenQuotation,
  onNavigateCategories
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [purity, setPurity] = useState<string>('all');
  const [category, setCategory] = useState<string | null>(categoryFilter);
  const [minWt, setMinWt] = useState('');
  const [maxWt, setMaxWt] = useState('');
  const [sort, setSort] = useState<SortKey>('default');
  // Filters are open by default on wide screens, where there is room for them.
  const [showFilters, setShowFilters] = useState(() => window.innerWidth >= 1024);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const gridRef = useRef<HTMLElement>(null);
  const openProduct = products.find((p) => p.id === openProductId) ?? null;

  // A category picked on the Categories screen arrives as a prop.
  useEffect(() => setCategory(categoryFilter), [categoryFilter]);

  const categoryNames = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  // What a buyer searches for tells the owner what they are after. Recorded once they pause typing.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => trackSearch(term), 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const min = minWt === '' ? null : Number(minWt);
    const max = maxWt === '' ? null : Number(maxWt);
    const list = products.filter((p) => {
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const matchesPurity = purity === 'all' || p.purity.includes(purity);
      const matchesCategory = !category || p.category === category;
      const matchesMin = min === null || Number.isNaN(min) || p.netWt >= min;
      const matchesMax = max === null || Number.isNaN(max) || p.netWt <= max;
      return matchesSearch && matchesPurity && matchesCategory && matchesMin && matchesMax;
    });
    if (sort === 'net-asc') list.sort((a, b) => a.netWt - b.netWt);
    else if (sort === 'net-desc') list.sort((a, b) => b.netWt - a.netWt);
    else if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [products, searchQuery, purity, category, minWt, maxWt, sort]);

  const activeFilterCount =
    (purity !== 'all' ? 1 : 0) + (category ? 1 : 0) + (minWt !== '' ? 1 : 0) + (maxWt !== '' ? 1 : 0);

  const resetFilters = () => {
    setPurity('all');
    setCategory(null);
    setMinWt('');
    setMaxWt('');
    setSearchQuery('');
    onClearCategoryFilter();
  };

  const pickCategory = (name: string | null) => {
    setCategory(name);
    if (!name) onClearCategoryFilter();
  };

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const sku = (entry.target as HTMLElement).dataset.sku;
          if (sku) trackProductView(sku);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.5 }
    );
    grid.querySelectorAll<HTMLElement>('[data-sku]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [filteredProducts]);

  // Which cards are on screen right now, so time spent looking at each product can be measured.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !('IntersectionObserver' in window)) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const sku = (entry.target as HTMLElement).dataset.sku;
          if (!sku) continue;
          setOnScreen(sku, entry.isIntersecting);
          if (entry.isIntersecting) seen.add(sku);
          else seen.delete(sku);
        }
      },
      { threshold: 0.5 }
    );
    grid.querySelectorAll<HTMLElement>('[data-sku]').forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      seen.forEach((sku) => setOnScreen(sku, false));
    };
  }, [filteredProducts]);

  useEffect(() => clearOnScreen, []);

  const { selectedCount, totalNetWeight } = useMemo(() => {
    let count = 0;
    let net = 0;
    products.forEach((p) => {
      if (selectedIds.has(p.id)) {
        const qty = quantities[p.id] || 1;
        count += qty;
        net += p.netWt * qty;
      }
    });
    return { selectedCount: count, totalNetWeight: parseFloat(net.toFixed(2)) };
  }, [products, selectedIds, quantities]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const picked = products.find((p) => p.id === id);
        if (picked) trackSelect(picked.sku);
      }
      return next;
    });
  };

  const allShownSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));
  const toggleSelectAll = () => {
    setSelectedIds(allShownSelected ? new Set() : new Set(filteredProducts.map((p) => p.id)));
  };

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const handleAdd = (prod: Product) => {
    onAddToOrder(prod, quantities[prod.id] || 1);
    setAddedNotice(prod.title);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const chip = (active: boolean) =>
    `px-3.5 py-2 rounded-full text-[13px] font-sans font-semibold transition-colors ${
      active ? 'bg-primary text-white shadow-xs' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
    }`;

  return (
    <div className="flex flex-col w-full pb-36 max-w-7xl mx-auto">
      {addedNotice && (
        <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-sans animate-fade-in border border-primary-container/40">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>Added {addedNotice} to your order</span>
        </div>
      )}

      {/* Search, filters and sort stay in view while scrolling on phones and tablets (on large screens the open filter panel would cover too much) */}
      <section className="sticky lg:static top-16 md:top-[4.5rem] z-30 bg-surface/95 backdrop-blur-md px-4 pt-3 pb-3 flex flex-col gap-3 border-b border-outline-variant/30">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline">search</span>
            <input
              aria-label="Search designs"
              className="w-full bg-white text-on-surface font-sans text-sm pl-10 pr-3 py-3 rounded-xl shadow-xs border border-outline-variant/50 focus:outline-none focus:border-primary/60 transition-colors"
              placeholder="Search by name, SKU or category"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className="flex items-center gap-1.5 h-11 px-3.5 rounded-xl bg-white border border-outline-variant/50 text-on-surface font-sans text-sm font-semibold active:scale-95 transition-transform hover:bg-surface-container-low"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-white text-[11px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white p-4 rounded-xl border border-outline-variant/50 shadow-xs flex flex-col gap-4 animate-fade-in max-h-[60vh] overflow-y-auto">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-sans font-bold text-on-surface-variant">Purity</span>
              <div className="flex flex-wrap gap-2">
                {PURITY_FILTERS.map((p) => (
                  <button key={p} onClick={() => setPurity(p)} className={chip(purity === p)} aria-pressed={purity === p} type="button">
                    {p === 'all' ? 'All' : p}
                  </button>
                ))}
              </div>
            </div>

            {categoryNames.length > 1 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold text-on-surface-variant">Category</span>
                  <button onClick={onNavigateCategories} className="text-xs text-secondary font-sans font-semibold hover:underline" type="button">
                    See category photos
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => pickCategory(null)} className={chip(!category)} aria-pressed={!category} type="button">
                    All
                  </button>
                  {categoryNames.map((name) => (
                    <button key={name} onClick={() => pickCategory(name)} className={chip(category === name)} aria-pressed={category === name} type="button">
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-xs font-sans font-bold text-on-surface-variant">Net weight (grams)</span>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  aria-label="Minimum net weight in grams"
                  inputMode="decimal"
                  placeholder="Min"
                  value={minWt}
                  onChange={(e) => setMinWt(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm font-mono border border-outline-variant/40 focus:outline-none focus:border-primary/60"
                />
                <span className="text-outline">to</span>
                <input
                  aria-label="Maximum net weight in grams"
                  inputMode="decimal"
                  placeholder="Max"
                  value={maxWt}
                  onChange={(e) => setMaxWt(e.target.value)}
                  className="w-full bg-surface-container-low rounded-lg px-3 py-2.5 text-sm font-mono border border-outline-variant/40 focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="self-start text-sm text-primary font-sans font-semibold hover:underline" type="button">
                Clear all filters
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-sans text-sm text-on-surface-variant whitespace-nowrap">
              <strong className="text-on-surface">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'design' : 'designs'}
            </span>
            {filteredProducts.length > 0 && (
              <button onClick={toggleSelectAll} className="font-sans text-sm text-secondary font-semibold hover:underline whitespace-nowrap" type="button">
                {allShownSelected ? 'Clear selection' : 'Select all'}
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-sans text-on-surface-variant">
            <span className="sr-only sm:not-sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-white border border-outline-variant/50 rounded-lg px-2 py-2 text-sm font-sans text-on-surface focus:outline-none focus:border-primary/60 max-w-[9.5rem] sm:max-w-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Product grid: 2 columns on phones, up to 5 on large screens */}
      <section ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 px-4 pt-4">
        {filteredProducts.map((prod) => {
          const isSelected = selectedIds.has(prod.id);
          const qty = quantities[prod.id] || 1;
          const is24K = prod.purity.includes('24K');

          return (
            <article
              key={prod.id}
              data-sku={prod.sku}
              className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm border transition-shadow hover:shadow-md flex flex-col ${
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant/40'
              }`}
            >
              <div className="relative w-full aspect-square bg-surface-container overflow-hidden">
                <button type="button" aria-label={`View ${prod.title}`} onClick={() => setOpenProductId(prod.id)} className="block w-full h-full">
                  <img
                    alt={prod.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={prod.image}
                    referrerPolicy="no-referrer"
                  />
                </button>
                {prod.images.length > 1 && (
                  <span className="absolute top-12 right-2 bg-black/60 text-white font-sans text-[11px] px-1.5 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
                    <span className="material-symbols-outlined text-[13px]">photo_library</span>
                    {prod.images.length}
                  </span>
                )}
                <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-primary shadow-xs">
                  {prod.purity}
                </span>
                {/* Weights sit on the photo with the purity, in the same badge style */}
                <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 pointer-events-none">
                  {!is24K && (
                    <span className="bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-primary shadow-xs">
                      Net {prod.netWt.toFixed(2)} g
                    </span>
                  )}
                  <span className="bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-on-surface shadow-xs">
                    Gross {prod.grossWt.toFixed(2)} g
                  </span>
                </div>
                <label className="absolute top-1 right-1 w-11 h-11 flex items-center justify-center cursor-pointer">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(prod.id)} className="peer sr-only" aria-label={`Select ${prod.title}`} />
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                      isSelected ? 'bg-primary text-white' : 'bg-white/90 text-outline hover:bg-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{isSelected ? 'check' : 'add'}</span>
                  </span>
                </label>
              </div>

              <div className="p-3 flex flex-col gap-2 flex-1">
                <div>
                  <span className="font-mono text-[11px] text-outline block leading-tight">{prod.sku}</span>
                  <h2 className="font-serif text-[15px] leading-snug font-bold text-on-surface line-clamp-2 mt-0.5">
                    <button type="button" onClick={() => setOpenProductId(prod.id)} className="text-left">
                      {prod.title}
                    </button>
                  </h2>
                </div>

                <div className="flex flex-col gap-2 mt-auto pt-1">
                  <div className="flex items-center justify-between rounded-lg bg-surface-container-low border border-outline-variant/40">
                    <button
                      onClick={() => updateQuantity(prod.id, -1)}
                      aria-label={`Decrease quantity of ${prod.title}`}
                      className="w-11 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-90"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">remove</span>
                    </button>
                    <span className="font-mono text-sm font-bold text-on-surface" aria-live="polite">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQuantity(prod.id, 1)}
                      aria-label={`Increase quantity of ${prod.title}`}
                      className="w-11 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-90"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleAdd(prod)}
                    className="w-full h-10 rounded-lg bg-secondary hover:bg-secondary-dark text-white font-sans text-sm font-bold flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 transition-all shadow-xs"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                    <span>Add to order</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <ProductDetailSheet
        product={openProduct}
        isAdmin={isAdmin}
        onClose={() => setOpenProductId(null)}
        onEdit={(p) => {
          setOpenProductId(null);
          onEditProduct(p);
        }}
        onAddToOrder={onAddToOrder}
      />

      {filteredProducts.length === 0 && (
        <div className="px-4 py-16 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[40px] text-outline">search_off</span>
          <p className="font-sans text-sm text-on-surface-variant">
            {products.length === 0 ? 'No designs have been added yet.' : 'No designs match your search or filters.'}
          </p>
          {products.length > 0 && (
            <button onClick={resetFilters} className="font-sans text-sm text-primary font-semibold hover:underline" type="button">
              Clear search and filters
            </button>
          )}
        </div>
      )}

      {/* Appears once designs are selected: share them with your own customer */}
      {selectedCount > 0 && (
        <aside className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg animate-fade-in">
          <div className="bg-on-surface text-inverse-on-surface pl-4 pr-2 py-2 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-primary-container/50">
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-sm font-bold text-primary-fixed truncate">
                {selectedIds.size} {selectedIds.size === 1 ? 'design' : 'designs'} selected
              </span>
              <span className="font-sans text-xs text-inverse-on-surface/80 truncate">
                {selectedCount} {selectedCount === 1 ? 'piece' : 'pieces'} · {totalNetWeight} g net
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setSelectedIds(new Set())}
                aria-label="Clear selection"
                className="w-10 h-10 rounded-xl flex items-center justify-center text-inverse-on-surface/80 hover:text-white"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
              <button
                onClick={() => onOpenQuotation(selectedCount, totalNetWeight, products.filter((p) => selectedIds.has(p.id)))}
                className="bg-primary hover:bg-primary-container text-white font-sans text-sm font-bold px-4 h-10 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5 shadow-md"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
                <span className="hidden sm:inline">Share with customer</span>
                <span className="sm:hidden">Share</span>
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
