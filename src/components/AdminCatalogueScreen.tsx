import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen, Banner, Category, Product, Purity } from '../types';
import { Icon, Ph, Sheet, StockPill, Title, Toast, fmtG } from '../layouts/emergent/ui';
import { downloadDesignsPdf } from '../cataloguePdf';
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
  /** Saves the hero collections shown on the buyers' Home: up to four collection ids, in order. */
  onHeroSave: (ids: string[]) => Promise<boolean>;
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
  // The collection the Designs list is showing; opening a collection from the Collections list sets it.
  const [collection, setCollection] = useState('');
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

        {p.segment === 'designs' && <Designs {...p} pdf={flags.pdfCatalogue} collection={collection} onCollection={setCollection} />}
        {p.segment === 'collections' && <Collections {...p} onOpenDesigns={(name) => { setCollection(name); p.onSegment('designs'); }} />}
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

const Designs: React.FC<Props & { pdf: boolean; collection: string; onCollection: (name: string) => void }> = ({ categories, onEditProduct, onDeleteProduct, onNavigate, pdf, collection, onCollection }) => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picking, setPicking] = useState(false);
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
      {categories.length > FEW ? (
        <>
          <button type="button" className="em-colpick" data-testid="admin-collection-pick" onClick={() => setPicking(true)}>
            <Icon n="grid" size={18} />
            <span className="em-grow em-clip" style={{ textAlign: 'left' }}>{collection || 'All collections'} · {collection ? categories.find((c) => c.name === collection)?.designCount ?? 0 : categories.length}</span>
            <Icon n="chev" size={16} />
          </button>
          {collection && (
            <div className="em-seg">
              <button type="button" className="em-chip" aria-pressed="true" onClick={() => onCollection('')}>{collection} <Icon n="x" size={12} /></button>
            </div>
          )}
        </>
      ) : (
        <div className="em-seg" role="group" aria-label="Collections">
          <button type="button" className="em-chip" aria-pressed={!collection} onClick={() => onCollection('')}>All</button>
          {names.map((n) => (
            <button key={n} type="button" className="em-chip" aria-pressed={collection === n} onClick={() => onCollection(collection === n ? '' : n)}>{n}</button>
          ))}
        </div>
      )}
      {picking && <CollectionPicker categories={categories} current={collection} onPick={(n) => { onCollection(n); setPicking(false); }} onClose={() => setPicking(false)} />}
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

/** Up to this many collections the lists stay plain; beyond it they get search, A to Z and a picker (the buyer app does the same). */
const FEW = 6;

/** Every page of a collection's designs (the server returns at most 100 at a time). */
async function designsIn(name: string): Promise<Product[]> {
  const all: Product[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await api.queryProducts({ category: name, sort: 'newest', limit: 100, offset });
    all.push(...page.items);
    if (!page.hasMore) break;
  }
  return all;
}

/** A searchable list of the store's collections in a bottom sheet (used by Designs when there are many). */
const CollectionPicker: React.FC<{ categories: Category[]; current: string; onPick: (name: string) => void; onClose: () => void }> = ({ categories, current, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const list = categories.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Sheet label="Choose a collection" onClose={onClose}>
      <div className="em-ser" style={{ fontSize: 22 }}>Collections · {categories.length}</div>
      <label className="em-srch" style={{ height: 44 }}>
        <Icon n="search" size={16} />
        <input aria-label="Search collections" data-testid="collection-picker-search" placeholder="Search collections" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {!q && (
          <button type="button" className="em-li" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)', cursor: 'pointer' }} onClick={() => onPick('')}>
            <span className="em-grow"><b style={{ fontWeight: 600 }}>All collections</b></span>
            {!current && <Icon n="check" size={18} />}
          </button>
        )}
        {list.map((c) => (
          <button key={c.id} type="button" className="em-li" data-testid="collection-picker-row" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)', cursor: 'pointer' }} onClick={() => onPick(c.name)}>
            <span className="em-grow"><b style={{ fontWeight: 600 }}>{c.name}</b><span className="em-mut" style={{ display: 'block', fontSize: 12 }}>{c.designCount} {c.designCount === 1 ? 'design' : 'designs'}</span></span>
            {current === c.name && <Icon n="check" size={18} />}
          </button>
        ))}
        {list.length === 0 && <p className="em-mut" style={{ textAlign: 'center' }}>No collection with that name.</p>}
      </div>
    </Sheet>
  );
};

/** Collections: search, A to Z with a letter rail, one tap to open a collection's designs, one tap to make its PDF, one tap to edit. */
const Collections: React.FC<Props & { onOpenDesigns: (name: string) => void }> = ({ categories, onNewCategory, onEditCategory, onOpenDesigns, onHeroSave }) => {
  const { flags } = usePlan();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const many = categories.length > FEW;

  // The hero collections: the tiles the buyers' Home shows first. Up to four, in the order set here.
  const heroes = categories.filter((c) => typeof c.heroOrder === 'number').sort((a, b) => (a.heroOrder as number) - (b.heroOrder as number));
  const notice = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(null), 3500); };
  const saveHeroes = async (ids: string[]) => { if (!(await onHeroSave(ids))) notice('Could not save the hero collections. Try again.'); };
  const toggleHero = (c: Category) => {
    const ids = heroes.map((h) => h.id);
    if (ids.includes(c.id)) return void saveHeroes(ids.filter((x) => x !== c.id));
    if (ids.length >= 4) return void notice('Home shows four hero collections. Remove one first.');
    void saveHeroes([...ids, c.id]);
  };
  const moveHero = (i: number, d: -1 | 1) => { const ids = heroes.map((h) => h.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]]; void saveHeroes(ids); };

  const makePdf = async (c: Category) => {
    if (!flags.pdfCatalogue) return void upgradeNotice('PDF catalogue');
    if (busy) return;
    setBusy(c.name);
    setStatus(`Preparing the ${c.name} PDF…`);
    try {
      const items = await designsIn(c.name);
      if (items.length === 0) throw new Error('This collection has no designs yet.');
      await downloadDesignsPdf(c.name, items, (done, total) => setStatus(`Preparing the ${c.name} PDF… ${done} of ${total} photos`));
      setStatus(`${c.name} PDF downloaded`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not create the PDF.');
    } finally {
      setBusy(null);
      setTimeout(() => setStatus(null), 3500);
    }
  };

  const term = q.trim().toLowerCase();
  const list = categories.filter((c) => !term || c.name.toLowerCase().includes(term)).sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, Category[]>();
  list.forEach((c) => groups.set(c.name[0].toUpperCase(), [...(groups.get(c.name[0].toUpperCase()) ?? []), c]));
  const letters = [...groups.keys()];
  const showRail = many && !term && letters.length > 1;

  const row = (c: Category, i: number) => (
    <div key={c.id} className="em-li" data-testid="admin-collection-row">
      <button type="button" className="em-row" style={{ gap: 14, flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onOpenDesigns(c.name)} aria-label={`Open the designs in ${c.name}`}>
        <Ph src={c.image} tone={i} className="em-thumb" />
        <span className="em-grow">
          <span className="em-ser em-clip" style={{ display: 'block', fontSize: 17 }}>{c.name}</span>
          <span className="em-mut" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
            {c.designCount} {c.designCount === 1 ? 'design' : 'designs'}
            {c.eligibleKarats?.length ? ` · ${c.eligibleKarats.map((k) => k.split(' ')[0]).join(' · ')}` : ''}
          </span>
        </span>
      </button>
      <div className="em-row" style={{ gap: 6 }}>
        <button type="button" className="em-circ" data-testid="collection-hero" aria-pressed={typeof c.heroOrder === 'number'} aria-label={typeof c.heroOrder === 'number' ? `Remove ${c.name} from the hero collections` : `Make ${c.name} a hero collection on Home`} onClick={() => toggleHero(c)} style={typeof c.heroOrder === 'number' ? { color: 'var(--em-gold-ink)', borderColor: 'var(--em-gold)' } : { color: 'var(--em-mut)' }}>
          <Icon n="star" size={16} fill={typeof c.heroOrder === 'number'} />
        </button>
        <button type="button" className="em-circ" data-testid="collection-pdf" disabled={busy !== null && busy !== c.name} aria-label={flags.pdfCatalogue ? `Make a PDF of ${c.name}` : `PDF of ${c.name} (Pro)`} onClick={() => makePdf(c)} style={busy === c.name ? { background: 'var(--em-primary)', color: 'var(--em-on-primary)' } : undefined}>
          <Icon n={flags.pdfCatalogue ? 'file' : 'lock'} size={16} />
        </button>
        <button type="button" className="em-circ" data-testid="collection-edit" aria-label={`Edit ${c.name}`} onClick={() => onEditCategory(c)}>
          <Icon n="edit" size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {status && <Toast>{status}</Toast>}
      <div className="em-card" data-testid="hero-collections">
        <div className="em-row em-sb">
          <b style={{ fontWeight: 600 }}>Hero collections on Home</b>
          <span className="em-mut" style={{ fontSize: 12 }}>{heroes.length} of 4</span>
        </div>
        <p className="em-mut" style={{ fontSize: 12.5, margin: '4px 0 6px' }}>Buyers see these first. Tap the star on a collection to add it.</p>
        {heroes.length === 0 ? (
          <p className="em-hint" style={{ margin: 0 }}>None chosen yet, so Home shows your four busiest collections.</p>
        ) : (
          heroes.map((h, i) => (
            <div key={h.id} className="em-row" data-testid="hero-row" style={{ gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--em-line)' : 0 }}>
              <span className="em-ser" style={{ width: 18, color: 'var(--em-gold-ink)' }}>{i + 1}</span>
              <span className="em-grow em-clip" style={{ fontWeight: 500 }}>{h.name}</span>
              <button type="button" className="em-circ" style={{ width: 32, height: 32 }} disabled={i === 0} aria-label={`Move ${h.name} earlier`} onClick={() => moveHero(i, -1)}><Icon n="up" size={14} /></button>
              <button type="button" className="em-circ" style={{ width: 32, height: 32 }} disabled={i === heroes.length - 1} aria-label={`Move ${h.name} later`} onClick={() => moveHero(i, 1)}><Icon n="chev" size={14} /></button>
              <button type="button" className="em-circ" style={{ width: 32, height: 32 }} aria-label={`Remove ${h.name} from the hero collections`} onClick={() => toggleHero(h)}><Icon n="x" size={14} /></button>
            </div>
          ))
        )}
      </div>
      {many && (
        <label className="em-srch" style={{ height: 44 }}>
          <Icon n="search" size={16} />
          <input aria-label="Search collections" data-testid="admin-collection-search" placeholder={`Search ${categories.length} collections`} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {categories.length === 0 && <p className="em-mut" style={{ textAlign: 'center', padding: '16px 0' }}>No collections yet.</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div className="em-grow" data-testid="admin-collection-list">
          {many && !term
            ? letters.map((L) => (
                <div key={L}>
                  <div id={`AL-${L}`} className="em-letter">{L}</div>
                  {groups.get(L)!.map((c, i) => row(c, i))}
                </div>
              ))
            : list.map((c, i) => row(c, i))}
          {many && list.length === 0 && <p className="em-mut" style={{ textAlign: 'center', padding: '16px 0' }}>No collection with that name.</p>}
        </div>
        {showRail && (
          <div className="em-rail" aria-label="Jump to letter">
            {letters.map((L) => (
              <button key={L} type="button" aria-label={`Jump to ${L}`} onClick={() => document.getElementById(`AL-${L}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>{L}</button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="em-btn sec" onClick={onNewCategory}>
        <Icon n="plus" size={18} />
        New collection
      </button>
    </>
  );
};
