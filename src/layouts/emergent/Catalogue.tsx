import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { api, trackProductView, trackSearch, trackSelect } from '../../api';
import { clearOnScreen, setOnScreen } from '../../attention';
import { downloadDesignsPdf } from '../../cataloguePdf';
import { SORT_KEYS, SORT_LABELS, type SortKey } from '../../../shared/jewellery';
import { Icon, Ph, Pill, Sheet, StockPill, Title, Toast, fmtG, type KitProps } from './ui';
import { ProductDetail } from './ProductDetail';
import { CartSheet } from './CartSheet';
import { withTransition } from '../../viewTransition';

const PAGE = 24;

/** Everything a buyer can narrow the catalogue by, besides the collection chips and the search box. */
interface Filters {
  purity: string[];
  minWt: string;
  maxWt: string;
  availability: string[];
}
const NO_FILTERS: Filters = { purity: [], minWt: '', maxWt: '', availability: [] };
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// The bar at the foot of the grid (atlas "cart bar") shows the order's size (orderCount) and opens it (onNavigate); App.tsx passes both.
type CatalogueProps = KitProps<'Catalogue'>;

/**
 * Catalogue (atlas Catalogue): sticky title, search, collection chips and a filter sheet over a two-column grid of photo cards.
 * The server does the searching, filtering, sorting and paging; the grid loads more as the buyer scrolls. The owner's "Select" mode builds a PDF.
 */
export const Catalogue: React.FC<CatalogueProps> = ({
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
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  const [draftSort, setDraftSort] = useState<SortKey>('newest');
  const { flags } = usePlan();
  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  // The design whose Add to cart sheet is open (from the grid, without opening the design).
  const [cartFor, setCartFor] = useState<Product | null>(null);
  // Admin only: pick designs by hand and turn them into one PDF
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hearted = useMemo(() => new Set(shortlist), [shortlist]);

  // What the server has answered so far: the loaded pages, the full count and whether more exist.
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const reqId = useRef(0);
  const openProduct = items.find((p) => p.id === openProductId) ?? null;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const query = useMemo(
    () => ({
      search: debounced,
      category: categoryFilter ?? '',
      purity: filters.purity.join(','),
      minWt: filters.minWt,
      maxWt: filters.maxWt,
      availability: filters.availability.join(','),
      sort
    }),
    [debounced, categoryFilter, filters, sort]
  );

  // First page for the current search, filters and sort. A later answer never overwrites a newer question.
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    api
      .queryProducts({ ...query, limit: PAGE, offset: 0 })
      .then((page) => {
        if (id !== reqId.current) return;
        setItems(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
      })
      .catch((err) => id === reqId.current && setError(err instanceof Error ? err.message : 'Could not load the catalogue.'))
      .finally(() => id === reqId.current && setLoading(false));
  }, [query, retry]);

  const loadMore = () => {
    if (loadingMore || loading || !hasMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    api
      .queryProducts({ ...query, limit: PAGE, offset: items.length })
      .then((page) => {
        if (id !== reqId.current) return;
        setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((q) => q.id === p.id))]);
        setTotal(page.total);
        setHasMore(page.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // Loads the next page when the buyer nears the foot of the grid.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '480px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, items.length, loading, loadingMore]);

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
  }, [items]);

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
    const chosen = items.filter((p) => picked.has(p.id));
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
  const collectionChips = categories.filter((c) => c.designCount > 0 || c.name === categoryFilter).map((c) => c.name);
  const inOrder = orderCount ?? addedCount;
  const showCartBar = flags.orders && !isAdmin && !selecting && inOrder > 0;

  // The chips under the search that name every active filter, each removable on its own.
  const purityTitle = (key: string) => purities.find((p) => p.key === key)?.title ?? key;
  const active: Array<{ key: string; label: string; clear: () => void }> = [
    ...filters.purity.map((v) => ({ key: `purity:${v}`, label: purityTitle(v), clear: () => setFilters((f) => ({ ...f, purity: f.purity.filter((x) => x !== v) })) })),
    ...(filters.minWt || filters.maxWt
      ? [{ key: 'weight', label: `${filters.minWt || '0'} – ${filters.maxWt || '∞'} g`, clear: () => setFilters((f) => ({ ...f, minWt: '', maxWt: '' })) }]
      : []),
    ...filters.availability.map((v) => ({ key: `avail:${v}`, label: v, clear: () => setFilters((f) => ({ ...f, availability: f.availability.filter((x) => x !== v) })) }))
  ];
  const anyNarrowing = Boolean(debounced || categoryFilter || active.length);
  const clearAll = () => {
    setSearchQuery('');
    setFilters(NO_FILTERS);
    onClearCategoryFilter();
  };
  const openSheet = () => {
    setDraft(filters);
    setDraftSort(sort);
    setSheet(true);
  };
  const applyDraft = () => {
    setFilters(draft);
    setSort(draftSort);
    setSheet(false);
  };
  const draftCount = draft.purity.length + draft.availability.length + (draft.minWt || draft.maxWt ? 1 : 0) + (draftSort !== 'newest' ? 1 : 0);

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
              eyebrow={<span data-testid="catalogue-count">{loading && items.length === 0 ? `${merchant.brand.name} · searching…` : `${merchant.brand.name} · ${total} ${total === 1 ? 'design' : 'designs'}`}</span>}
              title="Catalogue"
              right={
                <span className="em-row" style={{ gap: 8, marginBottom: 8 }}>
                  {isAdmin && flags.pdfCatalogue && (
                    <button type="button" className="em-btn sec sm" onClick={() => setSelecting(true)}>
                      <Icon n="file" size={15} />
                      Select
                    </button>
                  )}
                </span>
              }
            />
          )}
          {!selecting && (
            <div className="em-row" style={{ gap: 8 }}>
              <label className="em-srch em-grow" style={{ height: 44 }}>
                <Icon n="search" size={16} />
                <input aria-label="Search designs" data-testid="catalogue-search" placeholder={sector.filters.searchPlaceholder} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && (
                  <button type="button" aria-label="Clear search" className="em-x" onClick={() => setSearchQuery('')}>
                    <Icon n="x" size={14} />
                  </button>
                )}
              </label>
              <button type="button" className={`em-filterbtn${active.length || sort !== 'newest' ? ' on' : ''}`} data-testid="catalogue-filter-button" aria-label="Filter and sort" onClick={openSheet}>
                <Icon n="sliders" size={16} />
                {active.length + (sort !== 'newest' ? 1 : 0) > 0 && <i>{active.length + (sort !== 'newest' ? 1 : 0)}</i>}
              </button>
            </div>
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
        {active.length > 0 && !selecting && (
          <div className="em-chips em-active" role="group" aria-label="Active filters" data-testid="active-filters">
            {active.map((a) => (
              <button key={a.key} type="button" className="em-chip on" onClick={a.clear} aria-label={`Remove filter ${a.label}`}>
                {a.label}
                <Icon n="x" size={12} />
              </button>
            ))}
            <button type="button" className="em-link" style={{ flex: 'none', fontSize: 12 }} data-testid="clear-filters" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="em-pad" style={{ paddingTop: 16 }}>
        {error && (
          <div className="em-empty" style={{ paddingTop: 24 }}>
            <p className="em-mut">{error}</p>
            <button type="button" className="em-link" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}
        <div ref={gridRef} className="em-grid" aria-busy={loading} style={{ opacity: loading && items.length > 0 ? 0.55 : 1, transition: 'opacity 0.2s' }}>
          {loading && items.length === 0 && !error && Array.from({ length: 6 }, (_, i) => <div key={`skel-${i}`} className="em-sq em-skel" aria-hidden="true" />)}
          {items.map((prod, i) => {
            const isHearted = hearted.has(prod.sku);
            const isPicked = picked.has(prod.id);
            return (
              <article key={prod.id} data-sku={prod.sku} data-testid="product-card" className={`em-sq${selecting && isPicked ? ' picked' : ''}`}>
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
                {!isAdmin && !selecting && flags.orders && (
                  <button type="button" className="em-addcart" data-testid="card-add-to-cart" aria-label={`Add ${prod.title} to cart`} onClick={() => setCartFor(prod)}>
                    <Icon n="bag" size={16} />
                  </button>
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

        {hasMore && !error && (
          <div ref={sentinelRef} className="em-more" data-testid="load-more">
            <button type="button" className="em-btn sec sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? 'Loading…' : `Show more · ${total - items.length} left`}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="em-empty" style={{ paddingTop: 40 }} data-testid="catalogue-empty">
            <span className="em-badge">
              <Icon n="search" size={24} />
            </span>
            <p className="em-mut">{anyNarrowing ? 'No designs match your search and filters.' : 'No designs have been added yet.'}</p>
            {anyNarrowing && (
              <button type="button" className="em-link" onClick={clearAll}>
                Clear search and filters
              </button>
            )}
          </div>
        )}
      </div>

      {sheet && (
        <Sheet label="Filter and sort designs" onClose={() => setSheet(false)}>
          <div className="em-row em-sb">
            <span className="em-ser" style={{ fontSize: 22 }}>
              Filter and sort
            </span>
            <button type="button" className="em-link" onClick={() => { setDraft(NO_FILTERS); setDraftSort('newest'); }} disabled={draftCount === 0}>
              Reset
            </button>
          </div>

          <div className="em-ey">Sort by</div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }} data-testid="catalogue-sort">
            {SORT_KEYS.map((k) => (
              <button key={k} type="button" className={`em-chip${draftSort === k ? ' on' : ''}`} aria-pressed={draftSort === k} onClick={() => setDraftSort(k)}>
                {SORT_LABELS[k]}
              </button>
            ))}
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>{sector.filters.purity}</div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {purities
              .filter((p) => p.enabled)
              .map((p) => (
                <button key={p.key} type="button" className={`em-chip${draft.purity.includes(p.key) ? ' on' : ''}`} aria-pressed={draft.purity.includes(p.key)} onClick={() => setDraft({ ...draft, purity: toggle(draft.purity, p.key) })}>
                  {p.title}
                </button>
              ))}
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>
            {sector.filters.weight}
          </div>
          <div className="em-row" style={{ gap: 10 }}>
            <input aria-label="Minimum net weight" data-testid="filter-min-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder="Min" value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
            <span className="em-mut">to</span>
            <input aria-label="Maximum net weight" data-testid="filter-max-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder="Max" value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>
            {sector.filters.availability}
          </div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sector.stockStatuses.map((s) => (
              <button key={s.key} type="button" className={`em-chip${draft.availability.includes(s.key) ? ' on' : ''}`} aria-pressed={draft.availability.includes(s.key)} onClick={() => setDraft({ ...draft, availability: toggle(draft.availability, s.key) })}>
                {s.key}
              </button>
            ))}
          </div>

          <button type="button" className="em-btn" style={{ marginTop: 8 }} data-testid="apply-filters" onClick={applyDraft}>
            {draftCount ? `Apply ${draftCount} ${draftCount === 1 ? 'change' : 'changes'}` : 'Show all designs'}
          </button>
        </Sheet>
      )}

      {cartFor && <CartSheet product={cartFor} purities={purities} onClose={() => setCartFor(null)} onAdd={(p, qty, pur) => handleAdd(p, pur, qty)} />}

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
              <button type="button" className="em-link" style={{ display: 'flex', minHeight: 30 }} onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((p) => p.id)))}>
                {picked.size === items.length ? 'Clear' : `Select all ${items.length}`}
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
