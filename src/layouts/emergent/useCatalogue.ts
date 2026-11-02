import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { api, trackSearch, trackSelect } from '../../api';
import { clearOnScreen, setOnScreen } from '../../attention';
import { downloadDesignsPdf } from '../../cataloguePdf';
import { type SortKey } from '../../../shared/jewellery';
import type { KitProps } from './ui';
import { useHideOnScroll } from './useHideOnScroll';
import { useScrollAnchor } from './useScrollAnchor';
import { useDesktop, usePane } from './useDesktop';
import { withTransition } from '../../viewTransition';
import { noteSku, readView, writeView, type CatalogueView } from '../../recent';
import { grams, hn, pur, t, tErr, useLang } from '../../i18n';
import { errorText } from '../../bugReport';

export const PAGE = 24;
/** An open design this close to the end of the loaded list fetches the next page, so swiping never runs dry. */
const SWIPE_AHEAD = 6;

/** Everything a buyer can narrow the catalogue by, besides the collection chips and the search box. */
export interface Filters {
  purity: string[];
  minWt: string;
  maxWt: string;
  availability: string[];
}
export const NO_FILTERS: Filters = { purity: [], minWt: '', maxWt: '', availability: [] };
export const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export type CatalogueProps = KitProps<'Catalogue'>;

/**
 * The Catalogue's state and behaviour (server-side search, filters, sort and paging, the open design, the add-to-cart sheet, the owner's PDF picking),
 * shared by every layout's Catalogue so each one only supplies markup.
 */
export function useCatalogue({
  isAdmin,
  categoryFilter,
  categories,
  onCategoryChange,
  onClearCategoryFilter,
  onAddToOrder,
  purities,
  shortlist,
  onToggleShortlist,
  orderCount,
  initialSearch = '',
  initialSku = null,
  onInitialUsed
}: CatalogueProps) {
  useLang();
  // Desktop buyers get the filters as a panel beside the designs instead of a sheet; the choices and the Apply step are the same.
  const desk = useDesktop() && !isAdmin;
  // On a tablet (wide and tall enough) an open design shows in a pane beside the grid (emergent.css); on a phone it is an overlay, as before.
  const pane = usePane();
  useScrollAnchor();
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
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorAfter, setCursorAfter] = useState<string | undefined>();
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
    setCursor(undefined);
    setCursorAfter(undefined);
    api
      .queryProducts({ ...query, limit: PAGE, offset: 0 })
      .then((page) => {
        if (id !== reqId.current) return;
        setItems(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
        setCursor(page.cursor);
        setCursorAfter(page.cursorAfter);
      })
      .catch((err) => id === reqId.current && setError(tErr(errorText(err, 'Catalogue', t('Could not load the catalogue.')))))
      .finally(() => id === reqId.current && setLoading(false));
  }, [query, retry]);

  const loadMore = () => {
    if (loadingMore || loading || !hasMore || !cursor || !cursorAfter) return;
    const id = reqId.current;
    setLoadingMore(true);
    api
      .queryProducts({ ...query, limit: PAGE, cursor, cursorAfter })
      .then((page) => {
        if (id !== reqId.current) return;
        setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((q) => q.id === p.id))]);
        setTotal(page.total);
        setHasMore(page.hasMore);
        setCursor(page.cursor);
        setCursorAfter(page.cursorAfter);
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

  // Swiping through designs walks the loaded list, and the grid's own sentinel is hidden behind the open design, so fetch the next page
  // a few designs before the end. Keyed on the position and the loaded count (not on loadingMore), so a failed fetch retries on the next swipe, not in a loop.
  useEffect(() => {
    if (openIndex >= 0 && hasMore && openIndex >= items.length - SWIPE_AHEAD) loadMore();
  }, [openIndex, items.length, hasMore]);

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
      setPdfStatus(errorText(err, 'selection PDF', 'Could not create the PDF.'));
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

  return { desk, pane, searchQuery, setSearchQuery, debounced, picking, setPicking, view, filters, setFilters, draft, setDraft, sheet, setSheet, sort, draftSort, setDraftSort, flags, addedNotice, addedCount, openProductId, setOpenProductId, cartFor, setCartFor, selecting, setSelecting, picked, setPicked, pdfStatus, gridRef, sentinelRef, hideBar, hearted, items, total, hasMore, loading, loadingMore, error, setRetry, openProduct, openIndex, pickView, loadMore, handleAdd, togglePick, stopSelecting, makePdf, openOrPick, toggleHeart, collectionChips, inOrder, showCartBar, purityTitle, active, anyNarrowing, clearAll, openSheet, applyDraft, draftCount };
}
