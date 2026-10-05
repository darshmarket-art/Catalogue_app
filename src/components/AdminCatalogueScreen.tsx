import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen, Banner, Category, Product, Purity } from '../types';
import { Icon, Ph, Sheet, StockPill, Title, fmtG } from '../layouts/emergent/ui';
import { AdminBannersScreen } from './AdminBannersScreen';
import { AdminPuritiesScreen } from './AdminPuritiesScreen';

export type CatalogueSegment = 'designs' | 'collections' | 'banners' | 'purities';

interface Props {
  segment: CatalogueSegment;
  onSegment: (s: CatalogueSegment) => void;
  categories: Category[];
  banners: Banner[];
  purities: Purity[];
  onNavigate: (screen: ActiveScreen) => void;
  onNewProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => Promise<boolean>;
  onNewCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => Promise<boolean>;
  onBannerLink: (banner: Banner, category: string | null) => Promise<void>;
  onBannerAdd: (image: string, category?: string) => Promise<boolean>;
  onBannerDelete: (banner: Banner) => Promise<void>;
  onBannerReorder: (ids: string[]) => Promise<void>;
  onPuritiesSave: (list: Array<{ key: string; enabled: boolean }>) => Promise<boolean>;
}

const PAGE = 24;
const SEGMENTS: Array<{ key: CatalogueSegment; label: string }> = [
  { key: 'designs', label: 'Designs' },
  { key: 'collections', label: 'Collections' },
  { key: 'banners', label: 'Banners' },
  { key: 'purities', label: 'Purities' }
];

/** The owner's Catalogue tab: designs, collections, home banners and purities in one place, with edit and delete on each row. */
export const AdminCatalogueScreen: React.FC<Props> = (p) => {
  const { flags } = usePlan();
  const [adding, setAdding] = useState(false);
  const designs = p.categories.reduce((n, c) => n + c.designCount, 0);

  return (
    <div className="em-page" data-testid="admin-catalogue">
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Title
          eyebrow={`${designs} ${designs === 1 ? 'design' : 'designs'} · ${p.categories.length} ${p.categories.length === 1 ? 'collection' : 'collections'}`}
          title="Catalogue"
          right={
            <button type="button" className="em-circ" style={{ background: 'var(--em-primary)', color: 'var(--em-on-primary)', borderColor: 'var(--em-primary)', marginBottom: 8 }} data-testid="catalogue-add" aria-label="Add to the catalogue" onClick={() => setAdding(true)}>
              <Icon n="plus" size={20} />
            </button>
          }
        />
        <div className="em-seg" role="group" aria-label="Catalogue sections">
          {SEGMENTS.map((s) => (
            <button key={s.key} type="button" className="em-chip" data-testid={`catalogue-seg-${s.key}`} aria-pressed={p.segment === s.key} onClick={() => p.onSegment(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        {p.segment === 'designs' && <Designs {...p} pdf={flags.pdfCatalogue} />}
        {p.segment === 'collections' && <Collections {...p} />}
        {p.segment === 'banners' && (
          <div className="em-embed">
            <AdminBannersScreen banners={p.banners} categories={p.categories} onLink={p.onBannerLink} onAdd={p.onBannerAdd} onDelete={p.onBannerDelete} onReorder={p.onBannerReorder} />
          </div>
        )}
        {p.segment === 'purities' && (
          <div className="em-embed">
            <AdminPuritiesScreen purities={p.purities} onSave={p.onPuritiesSave} />
          </div>
        )}
      </div>

      {adding && (
        <Sheet label="Add to the catalogue" onClose={() => setAdding(false)}>
          <div className="em-ser" style={{ fontSize: 22 }}>Add to your catalogue</div>
          {[
            { icon: 'plus', t: 'New design', n: 'Photo, weights and purity in under a minute', go: p.onNewProduct },
            { icon: 'layers', t: 'New collection', n: 'Group designs so buyers can browse', go: p.onNewCategory },
            { icon: 'image', t: 'Banner photo', n: "Shown at the top of the buyers' home", go: () => p.onSegment('banners') }
          ].map((o) => (
            <button key={o.t} type="button" className="em-row" data-testid={`add-${o.icon}`} style={{ gap: 14, padding: '12px 0', border: 0, borderTop: '1px solid var(--em-line)', background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => { setAdding(false); o.go(); }}>
              <span className="em-circ" style={{ background: 'var(--em-tint)' }}><Icon n={o.icon} size={18} /></span>
              <span className="em-grow"><b style={{ display: 'block', fontWeight: 600 }}>{o.t}</b><span className="em-mut" style={{ fontSize: 12 }}>{o.n}</span></span>
              <Icon n="right" size={18} />
            </button>
          ))}
        </Sheet>
      )}
    </div>
  );
};

const Designs: React.FC<Props & { pdf: boolean }> = ({ categories, onEditProduct, onDeleteProduct, onNavigate, pdf }) => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [collection, setCollection] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => ({ search: debounced, category: collection, sort: 'newest' }), [debounced, collection]);
  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    api
      .queryProducts({ ...query, limit: PAGE, offset: 0 })
      .then((page) => {
        if (id !== req.current) return;
        setItems(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
      })
      .catch((e) => id === req.current && setError(e instanceof Error ? e.message : 'Could not load the designs.'))
      .finally(() => id === req.current && setLoading(false));
  }, [query]);

  const more = () =>
    api.queryProducts({ ...query, limit: PAGE, offset: items.length }).then((page) => {
      setItems((prev) => [...prev, ...page.items.filter((x) => !prev.some((y) => y.id === x.id))]);
      setHasMore(page.hasMore);
    });

  const remove = async (product: Product) => {
    if (confirming !== product.id) {
      setConfirming(product.id);
      setTimeout(() => setConfirming((c) => (c === product.id ? null : c)), 4000);
      return;
    }
    setConfirming(null);
    if (await onDeleteProduct(product)) {
      setItems((prev) => prev.filter((x) => x.id !== product.id));
      setTotal((n) => Math.max(0, n - 1));
    }
  };

  const names = categories.filter((c) => c.designCount > 0).map((c) => c.name);
  return (
    <>
      <div className="em-row" style={{ gap: 8 }}>
        <label className="em-srch em-grow" style={{ height: 44 }}>
          <Icon n="search" size={16} />
          <input aria-label="Search designs" data-testid="admin-design-search" placeholder="Search name or SKU" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="button" className="em-btn sec sm" data-testid="catalogue-pdf" onClick={() => (pdf ? onNavigate('admin-pdf') : upgradeNotice('PDF catalogue'))}>
          <Icon n="file" size={15} />
          PDF {!pdf && <span className="pro">Pro</span>}
        </button>
      </div>
      <div className="em-seg" role="group" aria-label="Collections">
        <button type="button" className="em-chip" aria-pressed={!collection} onClick={() => setCollection('')}>All</button>
        {names.map((n) => (
          <button key={n} type="button" className="em-chip" aria-pressed={collection === n} onClick={() => setCollection(collection === n ? '' : n)}>{n}</button>
        ))}
      </div>
      {error && <div role="alert" className="em-card" style={{ color: 'var(--em-bad)' }}>{error}</div>}
      <div data-testid="admin-design-list">
        {items.map((d, i) => (
          <div key={d.id} className="em-li" data-testid="admin-design-row">
            <button type="button" className="em-row" style={{ gap: 14, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onEditProduct(d)} aria-label={`Edit ${d.title}`}>
              <Ph src={d.image} tone={i} className="em-thumb" />
              <span className="em-grow">
                <span className="em-ser em-clip" style={{ display: 'block', fontSize: 16 }}>{d.title}</span>
                <span className="em-mut" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{d.sku} · {d.purity} · {fmtG(d.netWt)}</span>
                <span style={{ display: 'block', marginTop: 6 }}><StockPill status={d.stockStatus} small /></span>
              </span>
            </button>
            <div className="em-row" style={{ gap: 6 }}>
              <button type="button" className="em-circ" aria-label={`Edit ${d.title}`} onClick={() => onEditProduct(d)}><Icon n="edit" size={16} /></button>
              <button type="button" className="em-circ" data-testid="admin-design-delete" aria-label={confirming === d.id ? `Tap again to delete ${d.title}` : `Delete ${d.title}`} style={confirming === d.id ? { background: 'var(--em-bad)', color: '#fff', borderColor: 'var(--em-bad)' } : { color: 'var(--em-bad)' }} onClick={() => remove(d)}>
                <Icon n={confirming === d.id ? 'check' : 'trash'} size={16} />
              </button>
            </div>
          </div>
        ))}
        {loading && items.length === 0 && <p className="em-hint" style={{ textAlign: 'center' }}>Loading…</p>}
        {!loading && items.length === 0 && !error && <p className="em-mut" style={{ textAlign: 'center', padding: '24px 0' }}>{debounced || collection ? 'No designs match.' : 'No designs yet. Tap + to add the first one.'}</p>}
      </div>
      {hasMore && (
        <button type="button" className="em-btn sec sm" onClick={() => void more()}>
          Show more · {total - items.length} left
        </button>
      )}
    </>
  );
};

const Collections: React.FC<Props> = ({ categories, onNewCategory, onEditCategory, onDeleteCategory }) => {
  const [confirming, setConfirming] = useState<number | string | null>(null);
  return (
    <>
      {categories.length === 0 && <p className="em-mut" style={{ textAlign: 'center', padding: '16px 0' }}>No collections yet.</p>}
      {categories.map((c, i) => (
        <div key={c.id} className="em-card" data-testid="admin-collection-row">
          <div className="em-row" style={{ gap: 14 }}>
            <Ph src={c.image} tone={i} className="em-thumb" />
            <div className="em-grow">
              <div className="em-ser" style={{ fontSize: 18 }}>{c.name}</div>
              <div className="em-mut" style={{ fontSize: 12 }}>
                {c.designCount} {c.designCount === 1 ? 'design' : 'designs'}
                {c.eligibleKarats?.length ? ` · ${c.eligibleKarats.map((k) => k.split(' ')[0]).join(', ')}` : ''}
              </div>
            </div>
            <button type="button" className="em-circ" aria-label={`Edit ${c.name}`} onClick={() => onEditCategory(c)}><Icon n="edit" size={16} /></button>
          </div>
          {confirming === c.id ? (
            <div className="em-note" style={{ marginTop: 10 }}>
              <b>Delete {c.name}{c.designCount > 0 ? ` and its ${c.designCount} ${c.designCount === 1 ? 'design' : 'designs'}` : ''}?</b> Photos stay in storage. This cannot be undone.
              <div className="em-row" style={{ gap: 12, marginTop: 8 }}>
                <button type="button" className="em-btn danger sm" data-testid="confirm-delete-collection" onClick={async () => { setConfirming(null); await onDeleteCategory(c); }}>
                  {c.designCount > 0 ? 'Delete collection and designs' : 'Delete collection'}
                </button>
                <button type="button" className="em-link" onClick={() => setConfirming(null)}>Keep</button>
              </div>
            </div>
          ) : (
            <button type="button" className="em-link" data-testid="delete-collection" style={{ marginTop: 6, color: 'var(--em-bad)', display: 'inline-flex', gap: 6, alignItems: 'center' }} onClick={() => setConfirming(c.id)}>
              <Icon n="trash" size={14} />
              Delete collection
            </button>
          )}
        </div>
      ))}
      <button type="button" className="em-btn sec" onClick={onNewCategory}>
        <Icon n="plus" size={18} />
        New collection
      </button>
    </>
  );
};
