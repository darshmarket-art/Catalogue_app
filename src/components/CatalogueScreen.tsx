import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../types';
import { trackProductView, trackSearch, trackSelect } from '../api';
import { setOnScreen, clearOnScreen } from '../attention';
import { sector } from '../sector';
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
  const [selectedPurityFilter, setSelectedPurityFilter] = useState<string>('all');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const gridRef = useRef<HTMLElement>(null);
  const openProduct = products.find((p) => p.id === openProductId) ?? null;

  // What a buyer searches for tells the owner what they are after. Recorded once they pause typing.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => trackSearch(term), 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPurity =
        selectedPurityFilter === 'all' || p.purity.includes(selectedPurityFilter);
      const matchesCategory = !categoryFilter || p.category === categoryFilter;

      return matchesSearch && matchesPurity && matchesCategory;
    });
  }, [products, searchQuery, selectedPurityFilter, categoryFilter]);

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

  // Selected Items Calculation
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => {
      const cur = prev[id] || 1;
      const next = Math.max(1, cur + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleAdd = (prod: Product) => {
    const qty = quantities[prod.id] || 1;
    onAddToOrder(prod, qty);
    setAddedNotice(prod.title);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const getSelectedProductObjects = () => {
    return products.filter((p) => selectedIds.has(p.id));
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-4xl mx-auto">
      {/* Toast Notification */}
      {addedNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-sans animate-fade-in border border-primary-container/40">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>Added {addedNotice} to Wholesale Batch Order!</span>
        </div>
      )}

      {/* Filter & Rapid Search Bar */}
      <section className="px-4 pt-3 pb-2 flex flex-col gap-2.5">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline">search</span>
          <input
            className="w-full bg-white text-on-surface font-sans text-xs pl-9 pr-24 py-2.5 rounded-lg shadow-xs border border-outline-variant/40 focus:outline-none focus:bg-surface-container-low transition-colors"
            placeholder="Search by SKU, design code, or weight range..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className="flex items-center gap-1 bg-surface-container px-2.5 py-1 rounded text-on-surface-variant font-sans text-[11px] font-semibold active:scale-95 transition-transform hover:bg-surface-container-high"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>Filter</span>
            </button>
          </div>
        </div>

        {categoryFilter && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-primary-fixed/40 text-primary font-sans text-[11px] font-bold pl-2.5 pr-1 py-1 rounded-full">
              {categoryFilter}
              <button aria-label="Show all designs" onClick={onClearCategoryFilter} className="w-5 h-5 rounded-full hover:bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          </div>
        )}

        {/* Filter Drawer / Badges */}
        {showFilterDrawer && (
          <div className="bg-white p-3 rounded-lg border border-outline-variant/60 shadow-sm flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider font-mono">
                Purity & Karat Filter
              </span>
              <button
                onClick={() => setSelectedPurityFilter('all')}
                className="text-[10px] text-outline hover:underline"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['all', '22K', '24K', '18K'].map((purity) => (
                <button
                  key={purity}
                  onClick={() => setSelectedPurityFilter(purity)}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                    selectedPurityFilter === purity
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {purity === 'all' ? 'All Karats' : purity}
                </button>
              ))}
              <button
                onClick={onNavigateCategories}
                className="ml-auto text-xs text-secondary font-sans font-semibold flex items-center gap-1 hover:underline"
              >
                <span>Browse by Category</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* B2B Wholesale Bulk Actions Banner */}
      <section className="mx-4 mt-1 mb-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/50 shadow-xs flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[15px]">done_all</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-[12px] font-bold text-on-surface truncate">
                Wholesale Batch Selection
              </span>
              <span className="font-mono text-[11px] text-primary font-bold">
                {selectedCount} items selected • Net Gold: {totalNetWeight}g
              </span>
            </div>
          </div>
          <button
            onClick={toggleSelectAll}
            className="font-sans text-[11px] text-secondary font-bold px-2.5 py-1 rounded bg-secondary-container/50 hover:bg-secondary-container transition-colors"
            type="button"
          >
            {selectedIds.size === filteredProducts.length && filteredProducts.length > 0
              ? 'Deselect All'
              : 'Select All'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-secondary text-white font-sans text-xs font-semibold active:scale-95 transition-all shadow-xs hover:bg-secondary-hover"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            <span>Share with Client</span>
          </button>

          <button
            onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-white font-sans text-xs font-semibold active:scale-95 transition-all shadow-xs hover:bg-tertiary-dark"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
            <span>RFQ Batch Order</span>
          </button>
        </div>
      </section>

      {/* Product Catalogue 2-Column Grid */}
      <section ref={gridRef} className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 px-4 pb-20">
        {filteredProducts.map((prod) => {
          const isSelected = selectedIds.has(prod.id);
          const qty = quantities[prod.id] || 1;

          return (
            <article
              key={prod.id}
              data-sku={prod.sku}
              className="product-card group relative bg-white rounded-xl p-2.5 shadow-sm border border-outline-variant/40 hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Product Image Container with Overlays */}
                <div className="relative w-full aspect-square bg-surface-container rounded-lg overflow-hidden mb-2">
                  <button type="button" aria-label={`View ${prod.title}`} onClick={() => setOpenProductId(prod.id)} className="block w-full h-full">
                    <img
                      alt={prod.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={prod.image}
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  {prod.images.length > 1 && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white font-mono text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 pointer-events-none">
                      <span className="material-symbols-outlined text-[11px]">photo_library</span>
                      {prod.images.length}
                    </span>
                  )}
                  <span className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-md px-1.5 py-0.5 rounded font-mono text-[9px] font-bold text-primary shadow-xs border border-primary-container/20">
                    {prod.purity}
                  </span>
                  <label className="cursor-pointer absolute top-1.5 right-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(prod.id)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors shadow-xs ${
                        isSelected
                          ? 'bg-primary text-white'
                          : 'bg-surface-container-high text-transparent hover:bg-surface-dim'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </div>
                  </label>
                </div>

                {/* SKU & Title */}
                <div className="mb-1.5">
                  <span className="font-mono text-[9px] text-outline font-medium block leading-tight">
                    SKU: {prod.sku}
                  </span>
                  <h2 className="font-serif text-[13px] leading-tight font-bold text-on-surface line-clamp-1 mt-0.5">
                    <button type="button" onClick={() => setOpenProductId(prod.id)} className="text-left">
                      {prod.title}
                    </button>
                  </h2>
                  <span className="font-mono text-[10px] text-primary font-semibold block mt-0.5 line-clamp-1">
                    {sector.priceLabel(prod)}
                  </span>
                </div>

                {/* Micro Spec Grid */}
                <div className="grid grid-cols-2 gap-1 bg-surface-container-low p-1 rounded-lg text-center mb-2 border border-outline-variant/40">
                  <div className="flex flex-col py-0.5">
                    <span className="font-sans text-[8px] text-outline font-medium uppercase tracking-wider">
                      Gross
                    </span>
                    <span className="font-mono text-[11px] font-bold text-on-surface">
                      {prod.grossWt.toFixed(2)}g
                    </span>
                  </div>
                  <div className="flex flex-col bg-white rounded py-0.5 shadow-xs border border-primary/20">
                    <span className="font-sans text-[8px] text-primary font-bold uppercase tracking-wider">
                      {prod.purity.includes('24K') ? 'Purity' : 'Net'}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-primary">
                      {prod.purity.includes('24K') ? '999.9' : `${prod.netWt.toFixed(2)}g`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stepper & Action */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between bg-surface-container-low px-1.5 py-1 rounded">
                  <button
                    onClick={() => updateQuantity(prod.id, -1)}
                    className="w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-90"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">remove</span>
                  </button>
                  <span className="font-mono text-[11px] font-bold text-on-surface">
                    {qty}
                  </span>
                  <button
                    onClick={() => updateQuantity(prod.id, 1)}
                    className="w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-90"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                  </button>
                </div>

                <button
                  onClick={() => handleAdd(prod)}
                  className="w-full h-7 rounded bg-secondary hover:bg-secondary-dark text-white font-sans text-[10px] font-bold flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {prod.purity.includes('24K') ? 'scale' : 'add_shopping_cart'}
                  </span>
                  <span>{prod.purity.includes('24K') ? 'Add Gram Batch' : 'Add to Order'}</span>
                </button>
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
        <p className="px-4 pb-10 text-center font-sans text-xs text-outline">
          {products.length === 0 ? 'No designs have been added yet.' : 'No designs match your search.'}
        </p>
      )}

      {/* Floating Quick Action Pill for WhatsApp Wholesale Quotation */}
      {selectedCount > 0 && (
        <aside className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md animate-fade-in">
          <div className="bg-on-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-between gap-2 border border-primary-container/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white flex-shrink-0">
                <span className="material-symbols-outlined text-[18px]">chat</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-[11px] font-bold text-primary-fixed truncate">
                  {selectedCount} Pcs ({totalNetWeight}g Net) Selected
                </span>
                <span className="font-sans text-[10px] text-inverse-on-surface/80 truncate">
                  Tap to send Gram Requisition Slip to Retailer
                </span>
              </div>
            </div>
            <button
              onClick={() => onOpenQuotation(selectedCount, totalNetWeight, getSelectedProductObjects())}
              className="flex-shrink-0 bg-primary hover:bg-primary-container text-white font-sans text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform flex items-center gap-1 shadow-md"
              type="button"
            >
              <span>Send</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
