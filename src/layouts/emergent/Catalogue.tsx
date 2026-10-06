import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { api, trackSearch, trackSelect } from '../../api';
import { clearOnScreen, setOnScreen } from '../../attention';
import { downloadDesignsPdf } from '../../cataloguePdf';
import { SORT_KEYS, SORT_LABELS, type SortKey } from '../../../shared/jewellery';
import { Icon, Ph, Pill, Sheet, Title, Toast, fmtG, type KitProps } from './ui';
import { ProductDetail } from './ProductDetail';
import { CartSheet } from './CartSheet';
import { useHideOnScroll } from './useHideOnScroll';
import { useDesktop } from './useDesktop';
import { withTransition } from '../../viewTransition';
import { CollectionsBrowser } from './CollectionsBrowser';
import { noteCollection, noteSku, readView, writeView, type CatalogueView } from '../../recent';
import { grams, hn, pur, t, tErr, tn, ts, useLang } from '../../i18n';


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
  onNavigate,
  initialSearch = '',
  initialSku = null,
  onInitialUsed
}) => {
  useLang();
  // Desktop buyers get the filters as a panel beside the designs instead of a sheet; the choices and the Apply step are the same.
  const desk = useDesktop() && !isAdmin;
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debounced, setDebounced] = useState(initialSearch.trim());
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<CatalogueView>(readView);
  // A design opened from Home's Recently viewed: it may not be in the first page, so it is fetched on its own.
  const [extra, setExtra] = useState<Product | null>(null);
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
  const hideBar = useHideOnScroll(selecting);
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
  const openProduct = items.find((p) => p.id === openProductId) ?? (extra && extra.id === openProductId ? extra : null);
  const openIndex = openProduct ? items.findIndex((p) => p.id === openProduct.id) : -1;

  useEffect(() => {
    onInitialUsed?.();
    if (!initialSku) return;
    api.queryProducts({ search: initialSku, limit: 5, offset: 0 }).then((page) => {
      const hit = page.items.find((p) => p.sku === initialSku);
      if (hit) {
        setExtra(hit);
        setOpenProductId(hit.id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (openProduct) noteSku(openProduct.sku);
  }, [openProduct?.id]);

  const pickView = (v: CatalogueView) => {
    setView(v);
    writeView(v);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
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
      .catch((err) => id === reqId.current && setError(err instanceof Error ? tErr(err.message) : t('Could not load the catalogue.')))
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

  // What a buyer searches for tells the owner what they are after. Recorded once they pause typing.
  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => trackSearch(term), 1500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Times how long each design is on screen (a view itself is counted when its details page opens, in ProductDetail).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !('IntersectionObserver' in window)) return;
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
      timing.observe(el);
    });
    return () => {
      timing.disconnect();
      seen.forEach((sku) => setOnScreen(sku, false));
    };
  }, [items]);

  useEffect(() => clearOnScreen, []);

  const handleAdd = (prod: Product, purity: string | undefined, qty: number) => {
    onAddToOrder(prod, qty, purity);
    setAddedNotice(hn(prod.title, prod.titleHi));
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
  const purityTitle = (key: string) => pur(purities.find((p) => p.key === key)?.title ?? key);
  const active: Array<{ key: string; label: string; clear: () => void }> = [
    ...filters.purity.map((v) => ({ key: `purity:${v}`, label: purityTitle(v), clear: () => setFilters((f) => ({ ...f, purity: f.purity.filter((x) => x !== v) })) })),
    ...(filters.minWt || filters.maxWt
      ? [{ key: 'weight', label: grams(`${filters.minWt || '0'} – ${filters.maxWt || '∞'} g`), clear: () => setFilters((f) => ({ ...f, minWt: '', maxWt: '' })) }]
      : []),
    ...filters.availability.map((v) => ({ key: `avail:${v}`, label: t(v), clear: () => setFilters((f) => ({ ...f, availability: f.availability.filter((x) => x !== v) })) }))
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
  useEffect(() => {
    if (!desk) return;
    setDraft(filters);
    setDraftSort(sort);
  }, [desk, filters, sort]);
  const draftCount = draft.purity.length + draft.availability.length + (draft.minWt || draft.maxWt ? 1 : 0) + (draftSort !== 'newest' ? 1 : 0);

  // Desktop: the same choices as the filter sheet, always open beside the designs. Nothing changes until Apply, as in the sheet.
  const filterPanel = (
    <aside className="em-fside" aria-label={t('Filter and sort')} data-testid="filter-panel">
      <div className="em-fcard">
        <div className="em-row em-sb">
          <span className="em-ser" style={{ fontSize: 20 }}>{t('Filter and sort')}</span>
          <button type="button" className="em-link" onClick={() => { setDraft(NO_FILTERS); setDraftSort('newest'); }} disabled={draftCount === 0}>
            {t('Reset')}
          </button>
        </div>

        <div className="em-ey">{t('Sort by')}</div>
        <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }} data-testid="catalogue-sort">
          {SORT_KEYS.map((k) => (
            <button key={k} type="button" className={`em-chip${draftSort === k ? ' on' : ''}`} aria-pressed={draftSort === k} onClick={() => setDraftSort(k)}>
              {t(SORT_LABELS[k])}
            </button>
          ))}
        </div>

        <div className="em-ey">{t(sector.filters.purity)}</div>
        <div className="em-checks">
          {purities
            .filter((p) => p.enabled)
            .map((p) => (
              <label key={p.key} className="em-check">
                <input type="checkbox" checked={draft.purity.includes(p.key)} onChange={() => setDraft({ ...draft, purity: toggle(draft.purity, p.key) })} />
                {pur(p.title)}
              </label>
            ))}
        </div>

        <div className="em-ey">{t(sector.filters.weight)}</div>
        <div className="em-row" style={{ gap: 10 }}>
          <input aria-label={t('Minimum net weight')} data-testid="filter-min-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder={t('Min')} value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
          <span className="em-mut">{t('to')}</span>
          <input aria-label={t('Maximum net weight')} data-testid="filter-max-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder={t('Max')} value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
        </div>

        <div className="em-ey">{t(sector.filters.availability)}</div>
        <div className="em-checks">
          {sector.stockStatuses.map((s) => (
            <label key={s.key} className="em-check">
              <input type="checkbox" checked={draft.availability.includes(s.key)} onChange={() => setDraft({ ...draft, availability: toggle(draft.availability, s.key) })} />
              {t(s.key)}
            </label>
          ))}
        </div>

        <button type="button" className="em-btn" data-testid="apply-filters" onClick={applyDraft}>
          {draftCount ? tn(draftCount, 'Apply {n} change', 'Apply {n} changes') : t('Show all designs')}
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`em-page wide${selecting ? ' dock1' : ''}`} style={{ paddingTop: 0, paddingBottom: showCartBar ? 'calc(var(--em-tab-h) + var(--sab) + 100px)' : undefined }}>
      {(pdfStatus || addedNotice) && <Toast>{pdfStatus ?? t('Added {name} to your order', { name: addedNotice ?? '' })}</Toast>}

      <div className={`em-sticky em-cat-head${hideBar ? ' hide' : ''}`}>
        <div className="em-pad em-cat-top" style={{ paddingTop: 12, paddingBottom: 10 }}>
          {onNavigate && !selecting && (
            <nav className="em-dk fx em-crumbs" aria-label="Breadcrumb">
              <button type="button" className="em-link" onClick={() => onNavigate('categories')}>{t('Home')}</button>
              <Icon n="right" size={14} />
              <span aria-current="page">{t('Catalogue')}</span>
            </nav>
          )}
          {selecting ? (
            <Title
              eyebrow="Pick designs for a PDF"
              title="Select designs"
              right={
                <span className="em-row" style={{ gap: 10, marginBottom: 8 }}>
                  <Pill tone="gold">{t('Pro')}</Pill>
                  <button type="button" className="em-link" onClick={stopSelecting}>
                    Cancel
                  </button>
                </span>
              }
            />
          ) : (
            <Title
              eyebrow={<span data-testid="catalogue-count">{loading && items.length === 0 ? `${ts(merchant.brand.name)} · ${t('searching…')}` : `${ts(merchant.brand.name)} · ${tn(total, '{n} design', '{n} designs')}`}</span>}
              title={t('Catalogue')}
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
            <div className="em-row em-cat-search" style={{ gap: 8 }}>
              <label className="em-srch em-grow" style={{ height: 44 }}>
                <Icon n="search" size={16} />
                <input aria-label={t('Search designs')} data-testid="catalogue-search" placeholder={t(sector.filters.searchPlaceholder)} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                {searchQuery && (
                  <button type="button" aria-label={t('Clear search')} className="em-x" onClick={() => setSearchQuery('')}>
                    <Icon n="x" size={14} />
                  </button>
                )}
              </label>
              <button type="button" className={`em-filterbtn em-mb${active.length || sort !== 'newest' ? ' on' : ''}`} data-testid="catalogue-filter-button" aria-label={t('Filter and sort')} onClick={openSheet}>
                <Icon n="sliders" size={16} />
                {active.length + (sort !== 'newest' ? 1 : 0) > 0 && <i>{active.length + (sort !== 'newest' ? 1 : 0)}</i>}
              </button>
            </div>
          )}
        </div>
        {/* The collection in view is named here; tapping opens every collection (grouped by tag) to switch. */}
        {!selecting && (
          <div className="em-cat-pick" style={{ padding: '2px var(--em-px) 10px' }}>
            <button type="button" className={`em-colpick${categoryFilter ? ' on' : ''}`} data-testid="collection-picker" aria-haspopup="dialog" onClick={() => setPicking(true)}>
              <Icon n="grid" size={16} />
              <span className="em-grow em-clip" data-testid="collection-current" style={{ textAlign: 'left' }}>
                {categoryFilter ? hn(categoryFilter, categories.find((c) => c.name === categoryFilter)?.nameHi) : t('All collections')}
                <i style={{ fontStyle: 'normal', opacity: 0.65 }}> · {categoryFilter ? (categories.find((c) => c.name === categoryFilter)?.designCount ?? total) : collectionChips.length}</i>
              </span>
              <Icon n="right" size={14} />
            </button>
          </div>
        )}
        {active.length > 0 && !selecting && (
          <div className="em-chips em-active" role="group" aria-label={t('Active filters')} data-testid="active-filters">
            {active.map((a) => (
              <button key={a.key} type="button" className="em-chip on" onClick={a.clear} aria-label={t('Remove filter {name}', { name: a.label })}>
                {a.label}
                <Icon n="x" size={12} />
              </button>
            ))}
            <button type="button" className="em-link" style={{ flex: 'none', fontSize: 12 }} data-testid="clear-filters" onClick={clearAll}>
              {t('Clear all')}
            </button>
          </div>
        )}
      </div>

      <div className="em-pad em-cat-body" style={{ paddingTop: 16 }}>
        {desk && !selecting && filterPanel}
        <div className="em-cat-main">
        {error && (
          <div className="em-empty" style={{ paddingTop: 24 }}>
            <p className="em-mut">{error}</p>
            <button type="button" className="em-link" onClick={() => setRetry((n) => n + 1)}>
              {t('Try again')}
            </button>
          </div>
        )}
        {!selecting && (
          <div className="em-row em-sb" style={{ marginBottom: 12 }}>
            <span className="em-ey" data-testid="result-count">{tn(total, '{n} design', '{n} designs')}</span>
            <span className="em-seg-v" role="group" aria-label={t('Layout')} data-testid="layout-switch">
              {([['grid2', 'Large photos', 'grid'], ['grid3', 'Compact grid', 'dense'], ['list', 'List', 'list']] as const).map(([v, label, icon]) => (
                <button key={v} type="button" aria-pressed={view === v} aria-label={t(label)} data-testid={`view-${v}`} className={view === v ? 'on' : ''} onClick={() => pickView(v)}>
                  <Icon n={icon} size={16} />
                </button>
              ))}
            </span>
          </div>
        )}
        <div ref={gridRef} className={`em-grid${view === 'grid3' ? ' em-grid-3' : view === 'list' ? ' em-grid-list' : ' em-grid-c2'}`} aria-busy={loading} style={{ opacity: loading && items.length > 0 ? 0.55 : 1, transition: 'opacity 0.2s' }}>
          {loading && items.length === 0 && !error && Array.from({ length: 6 }, (_, i) => <div key={`skel-${i}`} className="em-sq em-skel" aria-hidden="true" />)}
          {items.map((prod, i) => {
            const isHearted = hearted.has(prod.sku);
            const isPicked = picked.has(prod.id);
            if (view === 'list' && !selecting) {
              return (
                <div key={prod.id} data-sku={prod.sku} data-testid="product-row" className="em-lrow">
                  <button type="button" className="em-row" style={{ gap: 12, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} aria-label={t('View {name}', { name: hn(prod.title, prod.titleHi) })} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                    <Ph src={prod.image} tone={i} className="em-thumb" style={{ width: 64, height: 64 }} />
                    <span className="em-grow" style={{ minWidth: 0 }}>
                      <span className="em-ser em-clip" style={{ display: 'block', fontSize: 15.5 }}>{hn(prod.title, prod.titleHi)}</span>
                      <span className="em-wt" style={{ display: 'block', marginTop: 3 }}>{fmtG(prod.netWt)}</span>
                    </span>
                  </button>
                  {!isAdmin && (
                    <button type="button" className={`em-circ${isHearted ? ' on' : ''}`} aria-pressed={isHearted} aria-label={t(isHearted ? 'Remove {name} from shortlist' : 'Add {name} to shortlist', { name: hn(prod.title, prod.titleHi) })} onClick={() => toggleHeart(prod)} style={isHearted ? { color: 'var(--em-bad)' } : undefined}>
                      <Icon n="heart" size={16} fill={isHearted} />
                    </button>
                  )}
                  {!isAdmin && flags.orders && (
                    <button type="button" className="em-circ" data-testid="card-add-to-cart" style={{ background: 'var(--em-primary)', color: 'var(--em-on-primary)', borderColor: 'var(--em-primary)' }} aria-label={t('Add {name} to cart', { name: hn(prod.title, prod.titleHi) })} onClick={() => setCartFor(prod)}>
                      <Icon n="bag" size={16} />
                    </button>
                  )}
                </div>
              );
            }
            if (view === 'grid3' && !selecting) {
              return (
                <div key={prod.id} className="em-cardwrap em-tile">
                  <article data-sku={prod.sku} data-testid="product-card" className="em-sq">
                    <button type="button" className="em-hit" aria-label={t('View {name}', { name: hn(prod.title, prod.titleHi) })} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                      <Ph src={prod.image} tone={i} className="em-fill" />
                    </button>
                    {!isAdmin && flags.orders && (
                      <button type="button" className="em-tadd" data-testid="card-add-to-cart" aria-label={t('Add {name} to cart', { name: hn(prod.title, prod.titleHi) })} onClick={() => setCartFor(prod)}>
                        <Icon n="plus" size={16} />
                      </button>
                    )}
                  </article>
                  <div className="em-card-t">
                    <span className="em-ser em-clip">{hn(prod.title, prod.titleHi)}</span>
                    <span className="em-wt">{fmtG(prod.netWt)}</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={prod.id} className="em-cardwrap">
              <article data-sku={prod.sku} data-testid="product-card" className={`em-sq${selecting && isPicked ? ' picked' : ''}`}>
                <button type="button" className="em-hit" aria-label={selecting ? `Select ${prod.title}` : t('View {name}', { name: hn(prod.title, prod.titleHi) })} aria-pressed={selecting ? isPicked : undefined} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                  <Ph src={prod.image} tone={i} className="em-fill" />
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
                    aria-label={t(isHearted ? 'Remove {name} from shortlist' : 'Add {name} to shortlist', { name: hn(prod.title, prod.titleHi) })}
                  >
                    <Icon n="heart" size={15} fill={isHearted} />
                  </button>
                )}
              </article>
              <div className="em-card-t">
                <span className="em-ser em-clip">{hn(prod.title, prod.titleHi)}</span>
                <span className="em-wt">{fmtG(prod.netWt)}</span>
              </div>
              {!isAdmin && !selecting && flags.orders && (
                <button type="button" className="em-addbar" data-testid="card-add-to-cart" aria-label={t('Add {name} to cart', { name: hn(prod.title, prod.titleHi) })} onClick={() => setCartFor(prod)}>
                  <Icon n="bag" size={16} />
                  {t('Add to cart')}
                </button>
              )}
              </div>
            );
          })}
        </div>

        {hasMore && !error && (
          <div ref={sentinelRef} className="em-more" data-testid="load-more">
            <button type="button" className="em-btn sec sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? t('Loading…') : t('Show more · {n} left', { n: total - items.length })}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="em-empty" style={{ paddingTop: 40 }} data-testid="catalogue-empty">
            <span className="em-badge">
              <Icon n="search" size={24} />
            </span>
            <p className="em-mut">{t(anyNarrowing ? 'No designs match your search and filters.' : 'No designs have been added yet.')}</p>
            {anyNarrowing && (
              <button type="button" className="em-link" onClick={clearAll}>
                {t('Clear search and filters')}
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      {sheet && (
        <Sheet label={t('Filter and sort designs')} onClose={() => setSheet(false)}>
          <div className="em-row em-sb">
            <span className="em-ser" style={{ fontSize: 22 }}>
              {t('Filter and sort')}
            </span>
            <button type="button" className="em-link" onClick={() => { setDraft(NO_FILTERS); setDraftSort('newest'); }} disabled={draftCount === 0}>
              {t('Reset')}
            </button>
          </div>

          <div className="em-ey">{t('Sort by')}</div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }} data-testid="catalogue-sort">
            {SORT_KEYS.map((k) => (
              <button key={k} type="button" className={`em-chip${draftSort === k ? ' on' : ''}`} aria-pressed={draftSort === k} onClick={() => setDraftSort(k)}>
                {t(SORT_LABELS[k])}
              </button>
            ))}
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>{t(sector.filters.purity)}</div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {purities
              .filter((p) => p.enabled)
              .map((p) => (
                <button key={p.key} type="button" className={`em-chip${draft.purity.includes(p.key) ? ' on' : ''}`} aria-pressed={draft.purity.includes(p.key)} onClick={() => setDraft({ ...draft, purity: toggle(draft.purity, p.key) })}>
                  {pur(p.title)}
                </button>
              ))}
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>
            {t(sector.filters.weight)}
          </div>
          <div className="em-row" style={{ gap: 10 }}>
            <input aria-label={t('Minimum net weight')} data-testid="filter-min-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder={t('Min')} value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
            <span className="em-mut">{t('to')}</span>
            <input aria-label={t('Maximum net weight')} data-testid="filter-max-weight" className="inp" style={{ height: 44 }} inputMode="decimal" placeholder={t('Max')} value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
          </div>

          <div className="em-ey" style={{ marginTop: 6 }}>
            {t(sector.filters.availability)}
          </div>
          <div className="em-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sector.stockStatuses.map((s) => (
              <button key={s.key} type="button" className={`em-chip${draft.availability.includes(s.key) ? ' on' : ''}`} aria-pressed={draft.availability.includes(s.key)} onClick={() => setDraft({ ...draft, availability: toggle(draft.availability, s.key) })}>
                {t(s.key)}
              </button>
            ))}
          </div>

          <button type="button" className="em-btn" style={{ marginTop: 8 }} data-testid="apply-filters" onClick={applyDraft}>
            {draftCount ? tn(draftCount, 'Apply {n} change', 'Apply {n} changes') : t('Show all designs')}
          </button>
        </Sheet>
      )}

      {picking && (
        <CollectionsBrowser
          categories={categories.filter((c) => c.designCount > 0 || c.name === categoryFilter)}
          current={categoryFilter}
          allowAll
          onClose={() => setPicking(false)}
          onPick={(name) => {
            setPicking(false);
            if (name) noteCollection(name);
            onCategoryChange(name);
          }}
        />
      )}

      {cartFor && <CartSheet product={cartFor} purities={purities} categories={categories} onClose={() => setCartFor(null)} onAdd={(p, qty, pur) => handleAdd(p, pur, qty)} />}

      <ProductDetail
        product={openProduct}
        isAdmin={isAdmin}
        purities={purities}
        categories={categories}
        hearted={openProduct ? hearted.has(openProduct.sku) : false}
        position={openIndex >= 0 ? { index: openIndex, total: items.length } : undefined}
        onStep={(dir) => {
          const next = items[openIndex + dir];
          if (next) setOpenProductId(next.id);
        }}
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
            <span key={inOrder} className="n">{inOrder}</span>
            <b style={{ flex: 1, fontWeight: 600 }}>{orderCount !== undefined ? tn(inOrder, '{n} design in your order', '{n} designs in your order') : t('{n} added to your order', { n: inOrder })}</b>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('orders')}>
                {t('Review')}
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
