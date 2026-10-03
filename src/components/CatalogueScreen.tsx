import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Purity } from '../types';
import { trackProductView, trackSearch, trackSelect } from '../api';
import { setOnScreen, clearOnScreen } from '../attention';
import { ProductDetailSheet } from './ProductDetailSheet';
import { downloadDesignsPdf } from '../cataloguePdf';

interface CatalogueScreenProps {
  products: Product[];
  isAdmin: boolean;
  /** Only show designs from this collection (set from the Catalogue screen). */
  categoryFilter: string | null;
  onClearCategoryFilter: () => void;
  onEditProduct: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  /** Purities the owner currently offers. */
  purities: Purity[];
  /** SKUs the buyer has hearted. */
  shortlist: string[];
  onToggleShortlist: (product: Product) => void;
}

type SortKey = 'default' | 'net-asc' | 'net-desc' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Newest' },
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
  purities,
  shortlist,
  onToggleShortlist
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('default');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  // Admin only: pick designs by hand and turn them into one PDF
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLElement>(null);
  const openProduct = products.find((p) => p.id === openProductId) ?? null;
  const hearted = useMemo(() => new Set(shortlist), [shortlist]);

  // What a buyer searches for tells the owner what they are after. Recorded once they pause typing.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => trackSearch(term), 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = products.filter((p) => {
      const matchesSearch =
        !q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.purity.toLowerCase().includes(q);
      return matchesSearch && (!categoryFilter || p.category === categoryFilter);
    });
    if (sort === 'net-asc') list.sort((a, b) => a.netWt - b.netWt);
    else if (sort === 'net-desc') list.sort((a, b) => b.netWt - a.netWt);
    else if (sort === 'name') list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [products, searchQuery, categoryFilter, sort]);

  // Counts one view per design once it has been on screen, and times how long each is looked at.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !('IntersectionObserver' in window)) return;
    const counted = new Observer((el) => {
      const sku = el.dataset.sku;
      if (sku) trackProductView(sku);
    });
    const seen = new Set<string>();
    const timing = new IntersectionObserver(
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
    grid.querySelectorAll<HTMLElement>('[data-sku]').forEach((el) => {
      counted.watch(el);
      timing.observe(el);
    });
    return () => {
      counted.stop();
      timing.disconnect();
      seen.forEach((sku) => setOnScreen(sku, false));
    };
  }, [filteredProducts]);

  useEffect(() => clearOnScreen, []);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const handleAdd = (prod: Product, purity?: string, qty = quantities[prod.id] || 1) => {
    onAddToOrder(prod, qty, purity);
    setAddedNotice(prod.title);
    setTimeout(() => setAddedNotice(null), 1800);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  const makePdf = async () => {
    const chosen = products.filter((p) => picked.has(p.id));
    setPdfStatus('Preparing the PDF…');
    try {
      await downloadDesignsPdf('Selection', chosen, (done, total) => setPdfStatus(`Preparing the PDF… ${done} of ${total} photos`));
      setPdfStatus('PDF downloaded');
      stopSelecting();
    } catch (err) {
      setPdfStatus(err instanceof Error ? err.message : 'Could not create the PDF.');
    }
    setTimeout(() => setPdfStatus(null), 3500);
  };

  /** Tapping a design opens its details; while the owner is picking designs it ticks them instead. */
  const openOrPick = (prod: Product) => (selecting ? togglePick(prod.id) : setOpenProductId(prod.id));

  const toggleHeart = (prod: Product) => {
    if (!hearted.has(prod.sku)) trackSelect(prod.sku);
    onToggleShortlist(prod);
  };

  return (
    <div className="flex flex-col w-full pb-28 max-w-6xl mx-auto">
      {pdfStatus && (
        <div role="status" className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-full shadow-lg text-sm font-sans animate-fade-in">
          {pdfStatus}
        </div>
      )}

      {addedNotice && (
        <div role="status" className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-sans animate-fade-in">
          <span className="material-symbols-outlined text-success-container text-[18px]">check_circle</span>
          <span>Added {addedNotice} to your order</span>
        </div>
      )}

      {/* Search, count and sort stay in view while scrolling */}
      <section className="sticky top-[calc(var(--header-h)+var(--sat))] z-30 bg-surface/95 backdrop-blur-md px-4 pt-2 pb-2 flex flex-col gap-2.5">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-outline">search</span>
          <input
            aria-label="Search designs"
            className="w-full bg-white text-on-surface font-sans text-sm pl-11 pr-3 py-3 rounded-2xl border border-outline-variant focus:outline-none focus:border-primary"
            placeholder="Search name, SKU or collection"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-sans text-sm text-on-surface-variant whitespace-nowrap">
              <strong className="text-on-surface">{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'design' : 'designs'}
            </span>
            {categoryFilter && (
              <button
                type="button"
                onClick={onClearCategoryFilter}
                className="flex items-center gap-1 min-w-0 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-bold"
                aria-label={`Showing ${categoryFilter}. Clear`}
              >
                <span className="truncate">{categoryFilter}</span>
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              aria-pressed={selecting}
              className={`min-h-11 px-4 rounded-xl border-[1.5px] font-sans text-sm font-extrabold ${selecting ? 'bg-primary border-primary text-on-primary' : 'bg-white border-outline-variant text-primary'}`}
            >
              {selecting ? 'Done' : 'Select'}
            </button>
          )}
          <label className="flex items-center gap-2 text-sm font-sans text-on-surface-variant">
            <span className="sr-only sm:not-sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-white border border-outline-variant rounded-xl px-2.5 py-2 text-sm font-sans font-semibold text-on-surface focus:outline-none focus:border-primary max-w-[11rem] sm:max-w-none"
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

      <section ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-5 md:gap-x-4 px-4 pt-3">
        {filteredProducts.map((prod) => {
          const qty = quantities[prod.id] || 1;
          const isHearted = hearted.has(prod.sku);
          return (
            <article key={prod.id} data-sku={prod.sku} className="group flex flex-col">
              <div className={`relative w-full aspect-square rounded-3xl bg-surface-container overflow-hidden ${selecting && picked.has(prod.id) ? 'ring-4 ring-primary' : ''}`}>
                <button type="button" aria-label={selecting ? `Select ${prod.title}` : `View ${prod.title}`} onClick={() => openOrPick(prod)} className="block w-full h-full">
                  <img
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={prod.image}
                    referrerPolicy="no-referrer"
                  />
                </button>
                <span className="absolute top-2.5 left-2.5 bg-white/95 px-2 py-0.5 rounded-lg text-xs font-extrabold text-primary pointer-events-none">
                  {prod.purity.split(' ')[0]}
                </span>
                {selecting && (
                  <span
                    aria-hidden="true"
                    className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center pointer-events-none shadow-sm ${picked.has(prod.id) ? 'bg-primary text-on-primary' : 'bg-white/95 text-outline'}`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{picked.has(prod.id) ? 'check' : 'add'}</span>
                  </span>
                )}
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => toggleHeart(prod)}
                    aria-pressed={isHearted}
                    aria-label={isHearted ? `Remove ${prod.title} from shortlist` : `Add ${prod.title} to shortlist`}
                    className={`absolute top-1 right-1 w-11 h-11 flex items-center justify-center`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${isHearted ? 'bg-primary text-white' : 'bg-white/95 text-primary'}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: `'FILL' ${isHearted ? 1 : 0}` }}>
                        favorite
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2 flex-1">
                <div>
                  <h2 className="font-sans text-[15px] leading-snug font-bold text-on-surface line-clamp-2">
                    <button type="button" onClick={() => openOrPick(prod)} className="text-left">
                      {prod.title}
                    </button>
                  </h2>
                  <p className="font-sans text-[15px] font-extrabold text-on-surface mt-0.5">Net {prod.netWt.toFixed(2)} g</p>
                  <p className="font-sans text-sm text-on-surface-variant">Gross {prod.grossWt.toFixed(2)} g</p>
                  <span className="font-sans text-xs text-outline">{prod.sku}</span>
                </div>

                {isAdmin ? (
                  selecting ? null : <button
                    type="button"
                    onClick={() => onEditProduct(prod)}
                    className="mt-auto w-full h-11 rounded-xl border border-outline-variant text-primary font-sans text-sm font-bold flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mt-auto">
                    {/* On phones the quantity is chosen in the design's detail sheet; here Add puts one piece in the order. */}
                    <div className="hidden md:flex items-center rounded-xl bg-white border border-outline-variant">
                      <button
                        onClick={() => updateQuantity(prod.id, -1)}
                        aria-label={`Decrease quantity of ${prod.title}`}
                        className="w-10 h-11 flex items-center justify-center text-primary"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                      </button>
                      <span className="min-w-5 text-center text-sm font-extrabold" aria-live="polite">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQuantity(prod.id, 1)}
                        aria-label={`Increase quantity of ${prod.title}`}
                        className="w-10 h-11 flex items-center justify-center text-primary"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleAdd(prod)}
                      aria-label={`Add ${prod.title} to order`}
                      className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary-dark text-white font-sans text-sm font-bold flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 transition-all"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                      Add
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <ProductDetailSheet
        product={openProduct}
        isAdmin={isAdmin}
        purities={purities}
        hearted={openProduct ? hearted.has(openProduct.sku) : false}
        onToggleShortlist={onToggleShortlist}
        onClose={() => setOpenProductId(null)}
        onEdit={(p) => {
          setOpenProductId(null);
          onEditProduct(p);
        }}
        onAddToOrder={(p, qty, purity) => handleAdd(p, purity, qty)}
      />

      {isAdmin && selecting && picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+var(--sab))] z-40 px-3 pb-2">
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-outline-variant shadow-[0_-6px_24px_rgba(0,0,0,0.1)] p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[22px] text-primary leading-tight">
                {picked.size} {picked.size === 1 ? 'design' : 'designs'} selected
              </p>
              <button type="button" onClick={() => setPicked(new Set(filteredProducts.map((p) => p.id)))} className="min-h-11 font-sans text-sm font-bold text-primary hover:underline text-left">
                Select all {filteredProducts.length}
              </button>
            </div>
            <button type="button" onClick={() => setPicked(new Set())} className="min-h-12 px-4 rounded-2xl border-[1.5px] border-outline-variant font-sans text-sm font-extrabold text-on-surface-variant">
              Clear
            </button>
            <button type="button" onClick={makePdf} className="min-h-12 px-5 rounded-2xl bg-secondary text-on-secondary font-sans text-sm font-extrabold">
              Create PDF
            </button>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="px-4 py-16 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[40px] text-outline">search_off</span>
          <p className="font-sans text-sm text-on-surface-variant">
            {products.length === 0 ? 'No designs have been added yet.' : 'No designs match your search.'}
          </p>
          {(searchQuery || categoryFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                onClearCategoryFilter();
              }}
              className="font-sans text-sm text-primary font-bold hover:underline"
              type="button"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Calls back once for each element that is at least half visible, then stops watching it. */
class Observer {
  private io: IntersectionObserver;
  constructor(onSeen: (el: HTMLElement) => void) {
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          onSeen(entry.target as HTMLElement);
          this.io.unobserve(entry.target);
        }
      },
      { threshold: 0.5 }
    );
  }
  watch(el: HTMLElement) {
    this.io.observe(el);
  }
  stop() {
    this.io.disconnect();
  }
}
