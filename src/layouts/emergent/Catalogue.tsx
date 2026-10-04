import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { trackProductView, trackSearch, trackSelect } from '../../api';
import { clearOnScreen, setOnScreen } from '../../attention';
import { downloadDesignsPdf } from '../../cataloguePdf';
import { Icon, Ph, Pill, StockPill, Title, Toast, fmtG, type KitProps } from './ui';
import { ProductDetail } from './ProductDetail';
import { withTransition } from '../../viewTransition';

type SortKey = 'default' | 'net-asc' | 'net-desc' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Newest' },
  { key: 'net-asc', label: 'Lightest first' },
  { key: 'net-desc', label: 'Heaviest first' },
  { key: 'name', label: 'A to Z' }
];

// The bar at the foot of the grid (atlas "cart bar") shows the order's size (orderCount) and opens it (onNavigate); App.tsx passes both.
type CatalogueProps = KitProps<'Catalogue'>;

/** Catalogue (atlas Catalogue): sticky title, search and collection chips over a two-column grid of photo cards. The owner's "Select" mode builds a PDF. */
export const Catalogue: React.FC<CatalogueProps> = ({
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
  onToggleShortlist,
  orderCount,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { flags } = usePlan();
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [sort, setSort] = useState<SortKey>('default');
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  // Admin only: pick designs by hand and turn them into one PDF
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const openProduct = products.find((p) => p.id === openProductId) ?? null;
  const hearted = useMemo(() => new Set(shortlist), [shortlist]);

  // The Back button closes an open design before it leaves the screen (see goBack in App).
  useEffect(() => {
    if (!openProductId) return;
    const close = (e: Event) => {
      e.preventDefault();
      withTransition(() => setOpenProductId(null));
    };
    window.addEventListener('app-back', close);
    return () => window.removeEventListener('app-back', close);
  }, [openProductId]);

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
    setAddedCount((n) => n + 1);
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
  const openOrPick = (prod: Product, photo?: Element | null) => (selecting ? togglePick(prod.id) : withTransition(() => setOpenProductId(prod.id), photo));

  const toggleHeart = (prod: Product) => {
    if (!hearted.has(prod.sku)) trackSelect(prod.sku);
    onToggleShortlist(prod);
  };

  // Collections that have designs, in the owner's order, plus any the filter names
  const collectionChips = categories.map((c) => c.name).filter((n) => products.some((p) => p.category === n) || n === categoryFilter);
  const inOrder = orderCount ?? addedCount;
  const showCartBar = flags.orders && !isAdmin && !selecting && inOrder > 0;

  return (
    <div className={`em-page wide${selecting ? ' dock1' : ''}`} style={{ paddingTop: 0, paddingBottom: showCartBar ? 'calc(var(--em-tab-h) + var(--sab) + 100px)' : undefined }}>
      {(pdfStatus || addedNotice) && <Toast>{pdfStatus ?? `Added ${addedNotice} to your order`}</Toast>}

      <div className="em-sticky">
        <div className="em-pad" style={{ paddingTop: 12, paddingBottom: 10 }}>
          {selecting ? (
            <Title
              eyebrow="Pick designs for a PDF"
              title="Select designs"
              right={
                <span className="em-row" style={{ gap: 10, marginBottom: 8 }}>
                  <Pill tone="gold">Pro</Pill>
                  <button type="button" className="em-link" onClick={stopSelecting}>
                    Cancel
                  </button>
                </span>
              }
            />
          ) : (
            <Title
              eyebrow={`${merchant.brand.name} · ${filteredProducts.length} ${filteredProducts.length === 1 ? 'design' : 'designs'}`}
              title="Catalogue"
              right={
                <span className="em-row" style={{ gap: 8, marginBottom: 8 }}>
                  {isAdmin && flags.pdfCatalogue && (
                    <button type="button" className="em-btn sec sm" onClick={() => setSelecting(true)}>
                      <Icon n="file" size={15} />
                      Select
                    </button>
                  )}
                  <label className="em-circ gold em-sortbox" title="Sort designs">
                    <Icon n="sliders" />
                    <select aria-label="Sort designs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </span>
              }
            />
          )}
          {!selecting && (
            <label className="em-srch" style={{ height: 44 }}>
              <Icon n="search" size={16} />
              <input aria-label="Search designs" placeholder="Search name, SKU or collection" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </label>
          )}
        </div>
        <div className="em-chips" role="group" aria-label="Collections">
          <button type="button" className={`em-chip${categoryFilter ? '' : ' on'}`} aria-pressed={!categoryFilter} onClick={onClearCategoryFilter}>
            All
          </button>
          {collectionChips.map((name) => (
            <button key={name} type="button" className={`em-chip${categoryFilter === name ? ' on' : ''}`} aria-pressed={categoryFilter === name} onClick={() => onCategoryChange(categoryFilter === name ? null : name)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="em-pad" style={{ paddingTop: 16 }}>
        <div ref={gridRef} className="em-grid">
          {filteredProducts.map((prod, i) => {
            const isHearted = hearted.has(prod.sku);
            const isPicked = picked.has(prod.id);
            return (
              <article key={prod.id} data-sku={prod.sku} className={`em-sq${selecting && isPicked ? ' picked' : ''}`}>
                <button type="button" className="em-hit" aria-label={selecting ? `Select ${prod.title}` : `View ${prod.title}`} aria-pressed={selecting ? isPicked : undefined} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                  <Ph src={prod.image} tone={i} className="em-fill" />
                  <span className="em-sc" />
                  <span className="em-tl">
                    <StockPill status={prod.stockStatus} small />
                  </span>
                  <span className="em-ov">
                    <span className="em-ser">{prod.title}</span>
                    <span className="em-ov-r">
                      <span>
                        <i>{prod.sku}</i>
                        &nbsp;·&nbsp;
                        <b className="g">{prod.purity.split(' ')[0]}</b>
                      </span>
                      <b>{fmtG(prod.netWt)}</b>
                    </span>
                  </span>
                </button>
                {selecting && (
                  <span className="em-pick" aria-hidden="true">
                    {isPicked && <Icon n="check" size={15} />}
                  </span>
                )}
                {!isAdmin && !selecting && (
                  <button
                    type="button"
                    className={`em-heart${isHearted ? ' on' : ''}`}
                    onClick={() => toggleHeart(prod)}
                    aria-pressed={isHearted}
                    aria-label={isHearted ? `Remove ${prod.title} from shortlist` : `Add ${prod.title} to shortlist`}
                  >
                    <Icon n="heart" size={15} fill={isHearted} />
                  </button>
                )}
              </article>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="em-empty" style={{ paddingTop: 40 }}>
            <span className="em-badge">
              <Icon n="search" size={24} />
            </span>
            <p className="em-mut">{products.length === 0 ? 'No designs have been added yet.' : 'No designs match your search.'}</p>
            {(searchQuery || categoryFilter) && (
              <button
                type="button"
                className="em-link"
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
      </div>

      <ProductDetail
        product={openProduct}
        isAdmin={isAdmin}
        purities={purities}
        hearted={openProduct ? hearted.has(openProduct.sku) : false}
        onToggleShortlist={onToggleShortlist}
        onClose={() => withTransition(() => setOpenProductId(null))}
        onEdit={(p) => {
          setOpenProductId(null);
          onEditProduct(p);
        }}
        onAddToOrder={(p, qty, purity) => handleAdd(p, purity, qty)}
      />

      {showCartBar && (
        <div className="em-cartbar">
          <div>
            <span className="n">{inOrder}</span>
            <b style={{ flex: 1, fontWeight: 600 }}>{orderCount !== undefined ? `${inOrder} ${inOrder === 1 ? 'design' : 'designs'} in your order` : `${inOrder} added to your order`}</b>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('orders')}>
                Review
                <Icon n="right" size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {isAdmin && selecting && (
        <div className="em-dock">
          <div className="em-dock-in">
            <div className="em-grow">
              <b style={{ fontWeight: 600 }}>{picked.size} selected</b>
              <button type="button" className="em-link" style={{ display: 'flex', minHeight: 30 }} onClick={() => setPicked(picked.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map((p) => p.id)))}>
                {picked.size === filteredProducts.length ? 'Clear' : `Select all ${filteredProducts.length}`}
              </button>
            </div>
            <button type="button" className="em-btn" disabled={picked.size === 0} onClick={makePdf}>
              <Icon n="down" size={16} />
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
