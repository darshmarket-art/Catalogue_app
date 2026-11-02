import React from 'react';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { SORT_KEYS, SORT_LABELS } from '../../../shared/jewellery';
import { Icon, Ph, Pill, Sheet, Title, Toast, fmtG, type KitProps } from './ui';
import { ProductDetail } from './ProductDetail';
import { CartSheet } from './CartSheet';
import { withTransition } from '../../viewTransition';
import { CollectionsBrowser } from './CollectionsBrowser';
import { noteCollection } from '../../recent';
import { grams, hn, pur, t, tn, ts } from '../../i18n';
import { SIZES_GRID, SIZES_THUMB } from '../../photoSrcSet';
import { NO_FILTERS, toggle, useCatalogue } from './useCatalogue';

type CatalogueProps = KitProps<'Catalogue'>;

/**
 * Catalogue (atlas Catalogue): sticky title, search, collection chips and a filter sheet over a two-column grid of photo cards.
 * The state and the server calls live in useCatalogue (shared with the other layouts); this file is Emergent's markup.
 */
export const Catalogue: React.FC<CatalogueProps> = (props) => {
  const { isAdmin, categoryFilter, categories, onCategoryChange, onEditProduct, purities, orderCount, onNavigate, onToggleShortlist } = props;
  const {
    desk, pane, searchQuery, setSearchQuery, debounced, picking, setPicking, view, filters, setFilters, draft, setDraft, sheet, setSheet, sort, draftSort, setDraftSort, flags, addedNotice, addedCount, openProductId, setOpenProductId, cartFor, setCartFor, selecting, setSelecting, picked, setPicked, pdfStatus, gridRef, sentinelRef, hideBar, hearted, items, total, hasMore, loading, loadingMore, error, setRetry, openProduct, openIndex, pickView, loadMore, handleAdd, togglePick, stopSelecting, makePdf, openOrPick, toggleHeart, collectionChips, inOrder, showCartBar, purityTitle, active, anyNarrowing, clearAll, openSheet, applyDraft, draftCount
  } = useCatalogue(props);
  /** The caption under a photo opens the design too, so the whole card is the target (the photo button stays the keyboard and screen-reader one). */
  const openFromCaption = (prod: Product) => (e: React.MouseEvent<HTMLElement>) => openOrPick(prod, e.currentTarget.closest('.em-cardwrap')?.querySelector('.em-ph'));

  // Desktop: the same choices as the filter sheet, always open beside the designs. Nothing changes until Apply, as in the sheet.
  const filterPanel = (
    <aside className="em-fside" aria-label={t('Filter and sort')} data-testid="filter-panel">
      <div className="em-fcard">
        <div className="em-row em-sb">
          <span className="em-ser" style={{ fontSize: '1.25rem' }}>{t('Filter and sort')}</span>
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
          <input aria-label={t('Minimum net weight')} data-testid="filter-min-weight" className="inp" style={{ minHeight: 44 }} inputMode="decimal" placeholder={t('Min')} value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
          <span className="em-mut">{t('to')}</span>
          <input aria-label={t('Maximum net weight')} data-testid="filter-max-weight" className="inp" style={{ minHeight: 44 }} inputMode="decimal" placeholder={t('Max')} value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
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
    <div className={`em-page wide em-pane${openProduct ? ' em-pane-open' : ''}${selecting ? ' dock1' : ''}`} style={{ paddingTop: 0, paddingBottom: showCartBar ? 'calc(var(--em-tab-h) + var(--sab) + 100px)' : undefined }}>
      {(pdfStatus || addedNotice) && <Toast>{pdfStatus ?? t('Added {name} to your order', { name: addedNotice ?? '' })}</Toast>}

      <div className="em-pane-main">
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
            <button type="button" className="em-link" style={{ flex: 'none', fontSize: '0.75rem' }} data-testid="clear-filters" onClick={clearAll}>
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
                <div key={prod.id} data-sku={prod.sku} data-testid="product-row" className={`em-lrow${prod.id === openProductId ? ' current' : ''}`}>
                  <button type="button" className="em-row" style={{ gap: 12, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} aria-label={t('View {name}', { name: hn(prod.title, prod.titleHi) })} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                    <Ph src={prod.image} tone={i} className="em-thumb" style={{ width: 64, height: 64 }} sizes={SIZES_THUMB} alt={hn(prod.title, prod.titleHi)} />
                    <span className="em-grow" style={{ minWidth: 0 }}>
                      <span className="em-ser em-clip" style={{ display: 'block', fontSize: '0.9688rem' }}>{hn(prod.title, prod.titleHi)}</span>
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
                  <article data-sku={prod.sku} data-testid="product-card" className={`em-sq${prod.id === openProductId ? ' current' : ''}`}>
                    <button type="button" className="em-hit" aria-label={t('View {name}', { name: hn(prod.title, prod.titleHi) })} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                      <Ph src={prod.image} tone={i} className="em-fill" sizes={SIZES_GRID} alt={hn(prod.title, prod.titleHi)} />
                    </button>
                    {!isAdmin && flags.orders && (
                      <button type="button" className="em-tadd" data-testid="card-add-to-cart" aria-label={t('Add {name} to cart', { name: hn(prod.title, prod.titleHi) })} onClick={() => setCartFor(prod)}>
                        <Icon n="plus" size={16} />
                      </button>
                    )}
                  </article>
                  <div className="em-card-t" style={{ cursor: 'pointer' }} onClick={openFromCaption(prod)}>
                    <span className="em-ser em-clip">{hn(prod.title, prod.titleHi)}</span>
                    <span className="em-wt">{fmtG(prod.netWt)}</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={prod.id} className="em-cardwrap">
              <article data-sku={prod.sku} data-testid="product-card" className={`em-sq${selecting && isPicked ? ' picked' : ''}${prod.id === openProductId ? ' current' : ''}`}>
                <button type="button" className="em-hit" aria-label={selecting ? `Select ${prod.title}` : t('View {name}', { name: hn(prod.title, prod.titleHi) })} aria-pressed={selecting ? isPicked : undefined} onClick={(e) => openOrPick(prod, e.currentTarget.querySelector('.em-ph'))}>
                  <Ph src={prod.image} tone={i} className="em-fill" sizes={SIZES_GRID} alt={hn(prod.title, prod.titleHi)} />
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
              <div className="em-card-t" style={{ cursor: 'pointer' }} onClick={openFromCaption(prod)}>
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
      </div>

      {sheet && (
        <Sheet label={t('Filter and sort designs')} onClose={() => setSheet(false)}>
          <div className="em-row em-sb">
            <span className="em-ser" style={{ fontSize: '1.375rem' }}>
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
            <input aria-label={t('Minimum net weight')} data-testid="filter-min-weight" className="inp" style={{ minHeight: 44 }} inputMode="decimal" placeholder={t('Min')} value={draft.minWt} onChange={(e) => setDraft({ ...draft, minWt: e.target.value.replace(/[^\d.]/g, '') })} />
            <span className="em-mut">{t('to')}</span>
            <input aria-label={t('Maximum net weight')} data-testid="filter-max-weight" className="inp" style={{ minHeight: 44 }} inputMode="decimal" placeholder={t('Max')} value={draft.maxWt} onChange={(e) => setDraft({ ...draft, maxWt: e.target.value.replace(/[^\d.]/g, '') })} />
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
        pane={pane}
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
