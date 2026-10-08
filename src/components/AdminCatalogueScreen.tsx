import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen, Banner, Category, Product, Purity } from '../types';
import { Icon, Ph, Sheet, StockPill, Title, Toast, fmtG } from '../layouts/emergent/ui';
import { downloadDesignsPdf } from '../cataloguePdf';
import { AdminBannersScreen } from './AdminBannersScreen';
import { AdminPuritiesScreen } from './AdminPuritiesScreen';
import { groupByTag, setTagList, useTagList } from '../tagList';

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
  /** Called after a tag is renamed or deleted, so the collections reload with their new tags. */
  onTagsChanged: () => void;
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
            <button key={s.key} type="button" className="em-chip" data-seg={s.key} data-testid={`catalogue-seg-${s.key}`} aria-pressed={p.segment === s.key} onClick={() => p.onSegment(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="em-seg-bar" aria-hidden="true" style={{ background: { designs: 'var(--em-primary)', collections: '#1f6b4f', banners: 'var(--em-gold)', purities: '#2f5d9f' }[p.segment] }} />
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
  // The design whose three-dot menu (Edit, Delete) is open.
  const [menuFor, setMenuFor] = useState<Product | null>(null);
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
    setMenuFor(null);
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
      <div className="em-grid em-grid-c2" data-testid="admin-design-list">
        {items.map((d, i) => (
          <div key={d.id} className="em-cardwrap" data-testid="admin-design-row">
            <div className="em-sq">
              <button type="button" className="em-hit" onClick={() => onEditProduct(d)} aria-label={`Edit ${d.title}`}>
                <Ph src={d.image} tone={i} className="em-fill" />
              </button>
              <button type="button" className="em-circ f em-opts" style={{ left: "auto", right: 10 }} data-testid="admin-design-menu" aria-label={`Options for ${d.title}`} onClick={() => { setMenuFor(d); setConfirming(null); }}>
                <Icon n="more" size={16} />
              </button>
            </div>
            <div className="em-card-t">
              <span className="em-ser em-clip">{d.title}</span>
              <span className="em-wt">{fmtG(d.netWt)}</span>
              <span className="em-mut" style={{ fontSize: 11 }}>{d.sku}</span>
              <span style={{ marginTop: 4 }}><StockPill status={d.stockStatus} small /></span>
            </div>
          </div>
        ))}
      </div>
      <div>
        {loading && items.length === 0 && <p className="em-hint" style={{ textAlign: 'center' }}>Loading…</p>}
        {!loading && items.length === 0 && !error && <p className="em-mut" style={{ textAlign: 'center', padding: '24px 0' }}>{debounced || collection ? 'No designs match.' : 'No designs yet. Tap + to add the first one.'}</p>}
      </div>
      {menuFor && (
        <Sheet label={`Options for ${menuFor.title}`} onClose={() => setMenuFor(null)}>
          <h2 className="em-ser" style={{ fontSize: 22 }}>{menuFor.title}</h2>
          <button type="button" className="em-opt" data-testid="admin-design-edit" onClick={() => { const d = menuFor; setMenuFor(null); onEditProduct(d); }}>
            <span className="em-badge"><Icon n="edit" size={16} /></span>
            <span className="em-grow"><b style={{ fontWeight: 600 }}>Edit design</b><span className="em-mut" style={{ display: 'block', fontSize: 13 }}>Photos, weights, details</span></span>
          </button>
          <button type="button" className="em-opt" data-testid="admin-design-delete" onClick={() => void remove(menuFor)} style={confirming === menuFor.id ? { color: 'var(--em-bad)' } : undefined}>
            <span className="em-badge" style={{ color: 'var(--em-bad)' }}><Icon n={confirming === menuFor.id ? 'check' : 'trash'} size={16} /></span>
            <span className="em-grow"><b style={{ fontWeight: 600, color: 'var(--em-bad)' }}>{confirming === menuFor.id ? 'Tap again to delete for good' : 'Delete design'}</b><span className="em-mut" style={{ display: 'block', fontSize: 13 }}>This cannot be undone</span></span>
          </button>
        </Sheet>
      )}
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
  const order = useTagList();
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
        {groupByTag(list, order).map(([t, cs]) => (
          <div key={t}>
            <div className="em-letter em-tag-h">{t} <span>{cs.length}</span></div>
          {cs.map((c) => (
          <button key={c.id} type="button" className="em-li" data-testid="collection-picker-row" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)', cursor: 'pointer' }} onClick={() => onPick(c.name)}>
            <span className="em-grow"><b style={{ fontWeight: 600 }}>{c.name}</b><span className="em-mut" style={{ display: 'block', fontSize: 12 }}>{c.designCount} {c.designCount === 1 ? 'design' : 'designs'}</span></span>
            {current === c.name && <Icon n="check" size={18} />}
          </button>
          ))}
          </div>
        ))}
        {list.length === 0 && <p className="em-mut" style={{ textAlign: 'center' }}>No collection with that name.</p>}
      </div>
    </Sheet>
  );
};

/** Create, rename and delete the tags collections are filed under. A tag in use is deleted by choosing where its collections go. */
const TagManager: React.FC<{ categories: Category[]; onChanged: () => void }> = ({ categories, onChanged }) => {
  const tags = useTagList();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const countOf = (t: string) => categories.filter((c) => c.tag === t).length;
  const run = async (job: () => Promise<string[]>, after?: () => void) => {
    setBusy(true);
    setProblem(null);
    try {
      setTagList(await job());
      after?.();
      onChanged();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not save the tag.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="em-card" data-testid="tag-manager">
      <button type="button" className="em-row em-sb" style={{ width: '100%', border: 0, background: 'none', font: 'inherit', color: 'inherit', padding: 0, cursor: 'pointer' }} aria-expanded={open} onClick={() => setOpen(!open)}>
        <b style={{ fontWeight: 600 }}>Tags</b>
        <span className="em-mut" style={{ fontSize: 12 }}>{tags.length} tags · {open ? 'Hide' : 'Manage'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <p className="em-mut" style={{ fontSize: 12.5, margin: '0 0 6px' }}>Every collection is filed under one tag. Buyers browse collections by tag.</p>
          {problem && <p role="alert" style={{ color: 'var(--em-bad)', fontSize: 13, margin: '4px 0' }}>{problem}</p>}
          {tags.map((t, i) => (
            <div key={t} data-testid="tag-row" style={{ padding: '8px 0', borderTop: i ? '1px solid var(--em-line)' : 0 }}>
              {editing === t ? (
                <form className="em-row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void run(() => api.renameTag(t, draft.trim()), () => setEditing(null)); }}>
                  <input className="inp" style={{ height: 40, flex: 1, minWidth: 0 }} aria-label={`New name for ${t}`} data-testid="tag-rename-input" value={draft} maxLength={30} autoFocus onChange={(e) => setDraft(e.target.value)} />
                  <button type="submit" className="em-btn sm" disabled={busy || !draft.trim()}>Save</button>
                  <button type="button" className="em-link" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <div className="em-row" style={{ gap: 8 }}>
                  <span className="em-grow em-clip" style={{ fontWeight: 500 }}>{t}</span>
                  <span className="em-mut" style={{ fontSize: 12 }}>{countOf(t)} {countOf(t) === 1 ? 'collection' : 'collections'}</span>
                  <button type="button" className="em-circ" style={{ width: 32, height: 32 }} data-testid="tag-edit" aria-label={`Rename ${t}`} onClick={() => { setEditing(t); setDraft(t); setDeleting(null); setProblem(null); }}><Icon n="edit" size={14} /></button>
                  <button type="button" className="em-circ" style={{ width: 32, height: 32 }} data-testid="tag-delete" disabled={tags.length <= 1} aria-label={`Delete ${t}`} onClick={() => { setDeleting(deleting === t ? null : t); setMoveTo(''); setEditing(null); setProblem(null); }}><Icon n="x" size={14} /></button>
                </div>
              )}
              {deleting === t && (
                <div style={{ marginTop: 8 }} data-testid="tag-delete-confirm">
                  {countOf(t) > 0 ? (
                    <>
                      <p className="em-mut" style={{ fontSize: 12.5, margin: '0 0 6px' }}>Move its {countOf(t)} {countOf(t) === 1 ? 'collection' : 'collections'} to:</p>
                      <select className="inp" style={{ height: 40, width: '100%' }} aria-label="Move collections to" data-testid="tag-move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        <option value="">Choose a tag…</option>
                        {tags.filter((x) => x !== t).map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </>
                  ) : (
                    <p className="em-mut" style={{ fontSize: 12.5, margin: '0 0 6px' }}>No collections use this tag.</p>
                  )}
                  <div className="em-row" style={{ gap: 8, marginTop: 8 }}>
                    <button type="button" className="em-btn sm" data-testid="tag-delete-go" disabled={busy || (countOf(t) > 0 && !moveTo)} onClick={() => void run(() => api.deleteTag(t, moveTo || undefined), () => setDeleting(null))}>Delete tag</button>
                    <button type="button" className="em-link" onClick={() => setDeleting(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          <form className="em-row" style={{ gap: 8, marginTop: 10, borderTop: '1px solid var(--em-line)', paddingTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) void run(() => api.createTag(name.trim()), () => setName('')); }}>
            <input className="inp" style={{ height: 40, flex: 1, minWidth: 0 }} aria-label="New tag name" data-testid="tag-new-input" placeholder="New tag, e.g. Anklets" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="em-btn sm" data-testid="tag-add" disabled={busy || !name.trim()}>Add</button>
          </form>
        </div>
      )}
    </div>
  );
};

/** Collections: search, A to Z with a letter rail, one tap to open a collection's designs, one tap to make its PDF, one tap to edit. */
const Collections: React.FC<Props & { onOpenDesigns: (name: string) => void }> = ({ categories, onNewCategory, onEditCategory, onOpenDesigns, onHeroSave, onTagsChanged }) => {
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

  const [tag, setTag] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const order = useTagList();
  const tags = groupByTag(categories, order).map(([t]) => t);
  const list = categories.filter((c) => (!term || c.name.toLowerCase().includes(term)) && (!tag || c.tag === tag)).sort((a, b) => a.name.localeCompare(b.name));
  // Grouped under each tag (Rings, Pendants, …) in the fixed tag order.
  const groups = groupByTag(list, order);

  // One collection as a card: the photo (tap to open its designs), name and count underneath, and the star, PDF and edit buttons.
  const row = (c: Category, i: number) => (
    <div key={c.id} className="em-cardwrap" data-testid="admin-collection-row">
      <div className="em-sq">
        <button type="button" className="em-hit" onClick={() => onOpenDesigns(c.name)} aria-label={`Open the designs in ${c.name}`}>
          <Ph src={c.image} tone={i} className="em-fill" />
        </button>
      </div>
      <div className="em-card-t">
        <span className="em-ser em-clip">{c.name}</span>
        <span className="em-mut" style={{ fontSize: 12 }}>{c.designCount} {c.designCount === 1 ? 'design' : 'designs'}</span>
      </div>
      <div className="em-row em-sb" style={{ padding: '0 10px 10px', gap: 6 }}>
        <button type="button" className="em-circ" data-testid="collection-hero" aria-pressed={typeof c.heroOrder === 'number'} aria-label={typeof c.heroOrder === 'number' ? `Remove ${c.name} from the hero collections` : `Make ${c.name} a hero collection on Home`} onClick={() => toggleHero(c)} style={typeof c.heroOrder === 'number' ? { color: 'var(--em-gold-ink)', borderColor: 'var(--em-gold)', background: 'color-mix(in srgb, var(--em-gold) 22%, var(--em-card))' } : { color: 'var(--em-mut)' }}>
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
      <TagManager categories={categories} onChanged={onTagsChanged} />
      {many && (
        <label className="em-srch" style={{ height: 44 }}>
          <Icon n="search" size={16} />
          <input aria-label="Search collections" data-testid="admin-collection-search" placeholder={`Search ${categories.length} collections`} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {categories.length === 0 && <p className="em-mut" style={{ textAlign: 'center', padding: '16px 0' }}>No collections yet.</p>}
      {tags.length > 1 && (
        <div className="em-chips" role="group" aria-label="Collection tags" data-testid="admin-tag-chips" style={{ padding: '0 0 4px' }}>
          <button type="button" className={`em-chip${tag ? '' : ' on'}`} aria-pressed={!tag} onClick={() => setTag(null)}>All</button>
          {tags.map((t) => (
            <button key={t} type="button" className={`em-chip${tag === t ? ' on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t}</button>
          ))}
        </div>
      )}
      <div data-testid="admin-collection-list">
        {groups.map(([t, cs]) => (
          <div key={t} data-testid="admin-tag-group">
            <div className="em-letter em-tag-h">{t} <span>{cs.length}</span></div>
            <div className="em-grid em-grid-c2" style={{ margin: '10px 0 6px' }}>{cs.map((c, i) => row(c, i))}</div>
          </div>
        ))}
        {list.length === 0 && categories.length > 0 && <p className="em-mut" style={{ textAlign: 'center', padding: '16px 0' }}>No collection matches.</p>}
      </div>
      <button type="button" className="em-btn sec" onClick={onNewCategory}>
        <Icon n="plus" size={18} />
        New collection
      </button>
    </>
  );
};
