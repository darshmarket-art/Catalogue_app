import React from 'react';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { SORT_KEYS, SORT_LABELS } from '../../../shared/jewellery';
import { Icon, Toast, type KitProps } from '../emergent/ui';
import { CollectionsBrowser } from '../emergent/CollectionsBrowser';
import { NO_FILTERS, toggle, useCatalogue } from '../emergent/useCatalogue';
import { withTransition } from '../../viewTransition';
import { noteCollection } from '../../recent';
import { hn, pur, t, tn, ts } from '../../i18n';
import { Drawer, Tile } from './ui';
import { ProductDetail } from './ProductDetail';
import { CartSheet } from './CartSheet';

/** After this many tiles an editorial tile (the way into the collections) sits in the grid, as the Maison pages do. */
const EDITORIAL_AT = 7;

/**
 * Maison's Catalogue: a hairline bar (search, collection, "Filter & sort") over a full-width grid of square tiles. The filters open in a drawer,
 * never a sidebar. State, paging and the server calls are Emergent's (useCatalogue).
 */
export const Catalogue: React.FC<KitProps<'Catalogue'>> = (props) => {
  const { isAdmin, categoryFilter, categories, onCategoryChange, onEditProduct, purities, orderCount, onNavigate, onToggleShortlist } = props;
  const {
    searchQuery, setSearchQuery, picking, setPicking, view, pickView, filters, setFilters, draft, setDraft, sheet, setSheet, sort, draftSort, setDraftSort,
    flags, addedNotice, openProductId, setOpenProductId, cartFor, setCartFor, gridRef, sentinelRef, hearted, items, total, hasMore, loading, loadingMore, error, setRetry,
    openProduct, openIndex, loadMore, handleAdd, openOrPick, toggleHeart, inOrder, showCartBar, purityTitle, active, anyNarrowing, clearAll, openSheet, applyDraft, draftCount, collectionChips
  } = useCatalogue(props);
  const current = categoryFilter ? hn(categoryFilter, categories.find((c) => c.name === categoryFilter)?.nameHi) : t('All collections');
  const narrowing = active.length + (sort !== 'newest' ? 1 : 0);
  const cols = view === 'list' ? 'list' : view === 'grid3' ? 'compact' : 'large';
  void purityTitle;

  return (
    <div className="mx-cat">
      {addedNotice && <Toast>{t('Added {name} to your order', { name: addedNotice })}</Toast>}
      <header className="mx-cat-head">
        {onNavigate && (
          <nav className="mx-crumbs flat" aria-label="Breadcrumb">
            <button type="button" className="mx-back" onClick={() => onNavigate('categories')}>{t('Home')}</button>
            <span className="mx-crumb-d" aria-hidden="true">/</span>
            <span className="mx-crumb-d" aria-current="page">{t('Catalogue')}</span>
          </nav>
        )}
        <h1 className="mx-h2">{categoryFilter ? current : t('Catalogue')}</h1>
        <span className="mx-ey" data-testid="catalogue-count">
          {loading && items.length === 0 ? `${ts(merchant.brand.name)} · ${t('searching…')}` : `${ts(merchant.brand.name)} · ${tn(total, '{n} design', '{n} designs')}`}
        </span>
      </header>

      <div className="mx-fbar">
        <label className="mx-fsearch">
          <Icon n="search" size={16} />
          <input aria-label={t('Search designs')} data-testid="catalogue-search" placeholder={t(sector.filters.searchPlaceholder)} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <button type="button" aria-label={t('Clear search')} className="mx-x" onClick={() => setSearchQuery('')}>
              <Icon n="x" size={14} />
            </button>
          )}
        </label>
        <button type="button" className={`mx-fb${categoryFilter ? ' on' : ''}`} data-testid="collection-picker" aria-haspopup="dialog" onClick={() => setPicking(true)}>
          <span data-testid="collection-current">{current}<i> · {categoryFilter ? (categories.find((c) => c.name === categoryFilter)?.designCount ?? total) : collectionChips.length}</i></span>
          <Icon n="chev" size={14} />
        </button>
        <button type="button" className={`mx-fb${narrowing ? ' on' : ''}`} data-testid="catalogue-filter-button" aria-label={t('Filter and sort')} aria-haspopup="dialog" onClick={openSheet}>
          <span>{t('Filter and sort')}{narrowing > 0 && <i> · {narrowing}</i>}</span>
          <Icon n="sliders" size={14} />
        </button>
      </div>

      {active.length > 0 && (
        <div className="mx-active" role="group" aria-label={t('Active filters')} data-testid="active-filters">
          {active.map((a) => (
            <button key={a.key} type="button" className="mx-chip on" onClick={a.clear} aria-label={t('Remove filter {name}', { name: a.label })}>
              {a.label}
              <Icon n="x" size={12} />
            </button>
          ))}
          <button type="button" className="mx-cta" data-testid="clear-filters" onClick={clearAll}>{t('Clear all')}</button>
        </div>
      )}

      <div className="mx-cat-body">
        {error && (
          <div className="mx-empty">
            <p className="mx-note">{error}</p>
            <button type="button" className="mx-cta" onClick={() => setRetry((n) => n + 1)}>{t('Try again')}</button>
          </div>
        )}
        <div className="mx-count-row">
          <span className="mx-ey" data-testid="result-count">{tn(total, '{n} design', '{n} designs')}</span>
          <span className="mx-views" role="group" aria-label={t('Layout')} data-testid="layout-switch">
            {([['grid2', 'Large photos', 'grid'], ['grid3', 'Compact grid', 'dense'], ['list', 'List', 'list']] as const).map(([v, label, icon]) => (
              <button key={v} type="button" aria-pressed={view === v} aria-label={t(label)} data-testid={`view-${v}`} className={view === v ? 'on' : ''} onClick={() => pickView(v)}>
                <Icon n={icon} size={16} />
              </button>
            ))}
          </span>
        </div>

        <div key={`${cols}|${categoryFilter ?? ""}|${active.length}|${sort}`} ref={gridRef} className={`mx-pgrid mx-flip ${cols}`} aria-busy={loading} style={{ opacity: loading && items.length > 0 ? 0.55 : 1 }}>
          {loading && items.length === 0 && !error && Array.from({ length: 8 }, (_, i) => <div key={`skel-${i}`} className="mx-ptile" aria-hidden="true"><div className="mx-pframe em-skel" /></div>)}
          {items.map((prod, i) => (
            <React.Fragment key={prod.id}>
              {i === EDITORIAL_AT && view === 'grid2' && !categoryFilter && (
                <button type="button" className="mx-ed" onClick={() => setPicking(true)}>
                  <span className="mx-ey">{t('Collections')}</span>
                  <span className="mx-h2 sm">{ts(merchant.brand.tagline)}</span>
                  <span className="mx-cta lt">{t('All collections')}</span>
                </button>
              )}
              <Tile
                prod={prod}
                index={i}
                hearted={hearted.has(prod.sku)}
                current={prod.id === openProductId}
                onOpen={(photo) => openOrPick(prod, photo)}
                onHeart={() => toggleHeart(prod)}
                onAdd={flags.orders ? () => setCartFor(prod) : undefined}
              />
            </React.Fragment>
          ))}
        </div>

        {hasMore && !error && (
          <div ref={sentinelRef} className="mx-more" data-testid="load-more">
            <button type="button" className="mx-btn sec" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? t('Loading…') : t('Show more · {n} left', { n: total - items.length })}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="mx-empty" data-testid="catalogue-empty">
            <p className="mx-lede">{t(anyNarrowing ? 'No designs match your search and filters.' : 'No designs have been added yet.')}</p>
            {anyNarrowing && <button type="button" className="mx-cta" onClick={clearAll}>{t('Clear search and filters')}</button>}
          </div>
        )}
      </div>

      {sheet && (
        <Drawer label={t('Filter and sort')} onClose={() => setSheet(false)} testId="filter-panel">
          <div className="mx-fgroup">
            <span className="mx-ey">{t('Sort by')}</span>
            <div className="mx-chips" data-testid="catalogue-sort">
              {SORT_KEYS.map((k) => (
                <button key={k} type="button" className={`mx-chip${draftSort === k ? ' on' : ''}`} aria-pressed={draftSort === k} onClick={() => setDraftSort(k)}>{t(SORT_LABELS[k])}</button>
              ))}
            </div>
          </div>
          <div className="mx-fgroup">
            <span className="mx-ey">{t(sector.filters.purity)}</span>
            <div className="mx-checks">
              {purities.filter((p) => p.enabled).map((p) => (
                <label key={p.key} className="mx-check">
                  <input type="checkbox" checked={draft.purity.includes(p.key)} onChange={() => setDraft({ ...draft, purity: toggle(draft.purity, p.key) })} />
                  {pur(p.title)}
                </label>
              ))}
            </div>
          </div>
          <div className="mx-fgroup">
            <span className="mx-ey">{t(sector.filters.weight)}</span>
            <div className="mx-wrange">
              <input aria-label={t('Minimum net weight')} data-testid="filter-min-weight" inputMode="decimal" placeholder={t('Min')} value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
              <span>{t('to')}</span>
              <input aria-label={t('Maximum net weight')} data-testid="filter-max-weight" inputMode="decimal" placeholder={t('Max')} value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
            </div>
          </div>
          <div className="mx-fgroup">
            <span className="mx-ey">{t(sector.filters.availability)}</span>
            <div className="mx-checks">
              {sector.stockStatuses.map((s) => (
                <label key={s.key} className="mx-check">
                  <input type="checkbox" checked={draft.availability.includes(s.key)} onChange={() => setDraft({ ...draft, availability: toggle(draft.availability, s.key) })} />
                  {t(s.key)}
                </label>
              ))}
            </div>
          </div>
          <div className="mx-drawer-f">
            <button type="button" className="mx-cta" onClick={() => { setDraft(NO_FILTERS); setDraftSort('newest'); }} disabled={draftCount === 0}>{t('Reset')}</button>
            <button type="button" className="mx-btn" data-testid="apply-filters" onClick={applyDraft}>
              {draftCount ? tn(draftCount, 'Apply {n} change', 'Apply {n} changes') : t('Show all designs')}
            </button>
          </div>
        </Drawer>
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

      {cartFor && <CartSheet product={cartFor} purities={purities} categories={categories} onClose={() => setCartFor(null)} onAdd={(p, qty, pu) => handleAdd(p, pu, qty)} />}

      <ProductDetail
        product={openProduct}
        isAdmin={isAdmin}
        purities={purities}
        categories={categories}
        hearted={openProduct ? hearted.has(openProduct.sku) : false}
        position={openIndex >= 0 ? { index: openIndex, total: items.length, of: Math.max(total, items.length) } : undefined}
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
        onAddToOrder={(p, qty, pu) => handleAdd(p, pu, qty)}
      />

      {showCartBar && (
        <div className="mx-cartbar">
          <span key={inOrder} className="mx-ey">{orderCount !== undefined ? tn(inOrder, '{n} design in your order', '{n} designs in your order') : t('{n} added to your order', { n: inOrder })}</span>
          {onNavigate && <button type="button" className="mx-btn lt" onClick={() => onNavigate('orders')}>{t('Review')}</button>}
        </div>
      )}
    </div>
  );
};
