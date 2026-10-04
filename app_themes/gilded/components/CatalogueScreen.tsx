import { usePlan } from '../plan';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Category, Product, Purity } from '../types';
import { trackProductView, trackSearch, trackSelect } from '../api';
import { setOnScreen, clearOnScreen } from '../attention';
import { ProductDetailSheet } from './ProductDetailSheet';
import { downloadDesignsPdf } from '../cataloguePdf';
import { I, Photo, StockTag, Toast } from './ui';

interface CatalogueScreenProps {
  products: Product[];
  isAdmin: boolean;
  /** Only show designs from this collection. */
  categoryFilter: string | null;
  categories: Category[];
  onCategoryChange: (name: string | null) => void;
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
  { key: 'net-asc', label: 'Lightest first' },
  { key: 'net-desc', label: 'Heaviest first' },
  { key: 'name', label: 'A to Z' }
];

/** Catalogue (artboard 2.3); the owner's "Select" mode is artboard 3.10, picking designs for a PDF. */
export const CatalogueScreen: React.FC<CatalogueScreenProps> = ({
  products,
  isAdmin,
  categoryFilter,
  categories,
  onCategoryChange,
  onClearCategoryFilter,
  onEditProduct,
  onAddToOrder,
  purities,
  shortlist,
  onToggleShortlist
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { flags } = usePlan();
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('default');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  // Admin only: pick designs by hand and turn them into one PDF
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.purity.toLowerCase().includes(q);
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

  const handleAdd = (prod: Product, purity: string | undefined, qty: number) => {
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

  // Collections that have designs, in the owner's order, plus any the filter names
  const collectionChips = categories.map((c) => c.name).filter((n) => products.some((p) => p.category === n) || n === categoryFilter);

  return (
    <div className="scroll wide" style={{ gap: 12 }}>
      {(pdfStatus || addedNotice) && (
        <Toast>
          <I n="check" size="s" />
          {pdfStatus ?? `Added ${addedNotice} to your order`}
        </Toast>
      )}

      {selecting ? (
        <div className="row">
          <h2 className="grow" style={{ fontSize: 24 }}>
            Select designs
          </h2>
          <span className="pro">Pro</span>
          <button type="button" className="lnk" style={{ minHeight: 36 }} onClick={stopSelecting}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="row" style={{ gap: 10 }}>
          <div className="inp-icon grow">
            <I n="search" />
            <input aria-label="Search designs" className="inp" placeholder="Search name, SKU or collection" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          {isAdmin && flags.pdfCatalogue && (
            <button type="button" className="btn sm alt" style={{ height: 52 }} onClick={() => setSelecting(true)}>
              <I n="file" size="s" />
              Select
            </button>
          )}
        </div>
      )}

      <div className="chips">
        <button type="button" className={`chip${categoryFilter ? '' : ' on'}`} onClick={onClearCategoryFilter}>
          All
        </button>
        {collectionChips.map((name) => (
          <button key={name} type="button" className={`chip${categoryFilter === name ? ' on' : ''}`} onClick={() => onCategoryChange(categoryFilter === name ? null : name)}>
            {name}
          </button>
        ))}
        <select aria-label="Sort designs" className="chip" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div ref={gridRef} className="grid2 md:!grid-cols-3 lg:!grid-cols-4">
        {filteredProducts.map((prod, i) => {
          const isHearted = hearted.has(prod.sku);
          const isPicked = picked.has(prod.id);
          return (
            <article key={prod.id} data-sku={prod.sku} className="card col" style={{ gap: 6, padding: 10, position: 'relative', outline: selecting && isPicked ? '2.5px solid var(--plum)' : undefined }}>
              <button type="button" aria-label={selecting ? `Select ${prod.title}` : `View ${prod.title}`} onClick={() => openOrPick(prod)} className="col" style={{ gap: 6, border: 0, padding: 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
                <Photo src={prod.image} tone={i} style={{ height: selecting ? 112 : 128, width: '100%' }}>
                  {selecting && (
                    <span
                      aria-hidden="true"
                      className={isPicked ? 'mark' : ''}
                      style={{ position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: '50%', zIndex: 2, ...(isPicked ? {} : { background: 'var(--card)', border: '2px solid var(--dash)' }) }}
                    >
                      {isPicked && <I n="check" size="s" />}
                    </span>
                  )}
                </Photo>
                <b style={{ fontSize: 14.5, lineHeight: 1.3 }} className="line-clamp-2">
                  {prod.title}
                </b>
                <span className="sub" style={{ fontSize: 13 }}>
                  {prod.sku}
                  {selecting ? '' : ` · ${prod.netWt.toFixed(3)} g net`}
                </span>
                {!selecting && (
                  <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <span className="tag">{prod.purity.split(' ')[0]}</span>
                    <StockTag status={prod.stockStatus} />
                  </span>
                )}
              </button>
              {!isAdmin && !selecting && (
                <button
                  type="button"
                  onClick={() => toggleHeart(prod)}
                  aria-pressed={isHearted}
                  aria-label={isHearted ? `Remove ${prod.title} from shortlist` : `Add ${prod.title} to shortlist`}
                  className="ib"
                  style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, zIndex: 3, color: isHearted ? 'var(--bad)' : 'var(--ink)' }}
                >
                  <I n="heart" size="s" style={isHearted ? { background: 'var(--bad)' } : undefined} />
                </button>
              )}
            </article>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', padding: '40px 0', gap: 10 }}>
          <I n="search" size="l" style={{ color: 'var(--mut)' }} />
          <p className="sub">{products.length === 0 ? 'No designs have been added yet.' : 'No designs match your search.'}</p>
          {(searchQuery || categoryFilter) && (
            <button
              type="button"
              className="lnk"
              onClick={() => {
                setSearchQuery('');
                onClearCategoryFilter();
              }}
            >
              Clear search
            </button>
          )}
        </div>
      )}

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

      {isAdmin && selecting && (
        <div className="dock">
          <div className="card row" style={{ gap: 12, padding: '12px 16px', boxShadow: 'var(--sh-2)' }}>
            <div className="grow">
              <b>{picked.size} selected</b>
              <button type="button" className="lnk" style={{ display: 'flex', minHeight: 30, fontSize: 13.5 }} onClick={() => setPicked(picked.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map((p) => p.id)))}>
                {picked.size === filteredProducts.length ? 'Clear' : `Select all ${filteredProducts.length}`}
              </button>
            </div>
            <button type="button" className="btn sm" style={{ padding: '0 20px' }} disabled={picked.size === 0} onClick={makePdf}>
              <I n="download" size="s" />
              Download PDF
            </button>
          </div>
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
