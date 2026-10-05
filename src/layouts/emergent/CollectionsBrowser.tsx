import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../../types';
import { Icon, Ph } from './ui';
import { recentCollections } from '../../recent';
import { groupByTag, useTagList } from '../../tagList';

interface Props {
  categories: Category[];
  /** The collection now selected in the Catalogue, or null for all. Shown with a tick. */
  current?: string | null;
  /** Offer an "All collections" row (the Catalogue picker does; Home does not). */
  allowAll?: boolean;
  onPick: (name: string | null) => void;
  onClose: () => void;
}

/** Every collection on one page: search, A to Z with a letter rail, and the buyer's recent ones on top. Built for 30 to 40 collections. */
export const CollectionsBrowser: React.FC<Props> = ({ categories, current, allowAll, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const order = useTagList();
  const tags = useMemo(() => groupByTag(categories, order).map(([t]) => t), [categories, order]);
  const list = useMemo(() => categories.filter((c) => (!term || c.name.toLowerCase().includes(term)) && (!tag || c.tag === tag)).sort((a, b) => a.name.localeCompare(b.name)), [categories, term, tag]);
  // Collections grouped under their tag, in the fixed tag order.
  const groups = useMemo(() => groupByTag(list, order), [list, order]);
  const recent = term || tag ? [] : recentCollections().map((n) => categories.find((c) => c.name === n)).filter((c): c is Category => Boolean(c));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const purities = (c: Category) => (c.eligibleKarats?.length ? ` · ${c.eligibleKarats.map((k) => k.split(' ')[0]).join(' · ')}` : '');
  const row = (c: Category, i: number, key = c.id) => (
    <button key={key} type="button" className="em-li em-colrow" data-testid="collection-row" onClick={() => onPick(c.name)}>
      <Ph src={c.image} tone={i} className="em-thumb" style={{ width: 56, height: 56 }} />
      <span className="em-grow">
        <span className="em-ser" style={{ display: 'block', fontSize: 17 }}>{c.name}</span>
        <span className="em-mut" style={{ fontSize: 11 }}>{c.designCount} {c.designCount === 1 ? 'design' : 'designs'}{purities(c)}</span>
      </span>
      {current === c.name ? <Icon n="check" size={18} /> : <Icon n="right" size={18} />}
    </button>
  );

  return (
    <div className="em-colpage" role="dialog" aria-modal="true" aria-label="All collections" data-testid="collections-browser">
      <div className="em-row em-sb em-pad" style={{ paddingTop: 'calc(18px + var(--sat))' }}>
        <button type="button" className="em-circ" aria-label="Back" onClick={onClose}><Icon n="back" size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="em-ey">{`Collections`}</div>
          <div className="em-ser" style={{ fontSize: 17 }}>{categories.length} to browse</div>
        </div>
        <span style={{ width: 40 }} />
      </div>
      <div className="em-pad" style={{ padding: '12px var(--em-px) 4px' }}>
        <label className="em-srch">
          <Icon n="search" />
          <input aria-label="Search collections" data-testid="collection-search" placeholder="Search collections" type="search" autoFocus={false} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {tags.length > 1 && (
        <div className="em-chips" role="group" aria-label="Collection tags" data-testid="tag-chips" style={{ paddingTop: 8, paddingBottom: 6 }}>
          <button type="button" className={`em-chip${tag ? '' : ' on'}`} aria-pressed={!tag} onClick={() => setTag(null)}>All</button>
          {tags.map((t) => (
            <button key={t} type="button" className={`em-chip${tag === t ? ' on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t}</button>
          ))}
        </div>
      )}
      <div className="em-colbody">
        <div ref={scroller} className="em-colscroll" id="em-colscroll">
          {allowAll && !term && (
            <button type="button" className="em-li em-colrow" data-testid="collection-all" onClick={() => onPick(null)}>
              <span className="em-thumb em-circ" style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--em-tint)' }}><Icon n="grid" size={22} /></span>
              <span className="em-grow"><span className="em-ser" style={{ display: 'block', fontSize: 17 }}>All collections</span><span className="em-mut" style={{ fontSize: 11 }}>Every design in the store</span></span>
              {!current ? <Icon n="check" size={18} /> : <Icon n="right" size={18} />}
            </button>
          )}
          {recent.length > 0 && (
            <>
              <div className="em-ey" style={{ margin: '14px 0 2px' }}>Recent</div>
              {recent.map((c, i) => row(c, i, `r-${c.id}`))}
            </>
          )}
          {groups.map(([t, cs]) => (
            <div key={t} data-testid="tag-group">
              <div className="em-letter em-letter-in em-tag-h">{t} <span>{cs.length}</span></div>
              {cs.map((c, i) => row(c, i))}
            </div>
          ))}
          {list.length === 0 && <p className="em-hint" style={{ textAlign: 'center', padding: '24px 0' }}>No collection with that name.</p>}
        </div>
      </div>
    </div>
  );
};
