import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Category } from '../../types';
import { Icon, Ph } from './ui';
import { useBackLayer } from '../../backLayer';
import { groupByTag, useTagList } from '../../tagList';
import { t, tn, useLang } from '../../i18n';

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
  useBackLayer(true, onClose);
  useLang();
  const [q, setQ] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const [tag, setTag] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const order = useTagList();
  const tags = useMemo(() => groupByTag(categories, order).map(([t]) => t), [categories, order]);
  const list = useMemo(() => categories.filter((c) => (!term || c.name.toLowerCase().includes(term)) && (!tag || c.tag === tag)).sort((a, b) => a.name.localeCompare(b.name)), [categories, term, tag]);
  // Collections grouped under their tag, in the fixed tag order.
  const groups = useMemo(() => groupByTag(list, order), [list, order]);

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

  // One collection as a card: the photo, then its name and design count underneath.
  const card = (c: Category, i: number, key = c.id) => (
    <button key={key} type="button" className="em-colcard" data-testid="collection-row" aria-label={t('Open {name}', { name: c.name })} onClick={() => onPick(c.name)}>
      <span className="em-sq" style={current === c.name ? { outline: '2.5px solid var(--em-gold)', outlineOffset: -2.5 } : undefined}>
        <Ph src={c.image} tone={i} className="em-fill" />
        {current === c.name && <span className="em-pick" style={{ background: 'var(--em-primary)', borderColor: 'var(--em-primary)' }}><Icon n="check" size={15} /></span>}
      </span>
      <span className="em-ser em-colcard-n">{c.name}</span>
      <span className="em-mut" style={{ fontSize: 11 }}>{tn(c.designCount, '{n} design', '{n} designs')}</span>
    </button>
  );

  return (
    <div className="em-colpage" role="dialog" aria-modal="true" aria-label={t('All collections')} data-testid="collections-browser">
      <div className="em-row em-sb em-pad" style={{ paddingTop: 'calc(18px + var(--sat))' }}>
        <button type="button" className="em-circ" aria-label={t('Back')} onClick={onClose}><Icon n="back" size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="em-ey">{t('Collections')}</div>
          <div className="em-ser" style={{ fontSize: 17 }}>{t('{n} to browse', { n: categories.length })}</div>
        </div>
        <span style={{ width: 40 }} />
      </div>
      <div className="em-pad" style={{ padding: '12px var(--em-px) 4px' }}>
        <label className="em-srch">
          <Icon n="search" />
          <input aria-label={t('Search collections')} data-testid="collection-search" placeholder={t('Search collections')} type="search" autoFocus={false} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {tags.length > 1 && (
        <div className="em-chips" role="group" aria-label={t('Collection tags')} data-testid="tag-chips" style={{ paddingTop: 8, paddingBottom: 6 }}>
          <button type="button" className={`em-chip${tag ? '' : ' on'}`} aria-pressed={!tag} onClick={() => setTag(null)}>{t('All')}</button>
          {tags.map((tg) => (
            <button key={tg} type="button" className={`em-chip${tag === tg ? ' on' : ''}`} aria-pressed={tag === tg} onClick={() => setTag(tag === tg ? null : tg)}>{t(tg)}</button>
          ))}
        </div>
      )}
      <div className="em-colbody">
        <div ref={scroller} className="em-colscroll" id="em-colscroll">
          {allowAll && !term && (
            <button type="button" className="em-li em-colrow" data-testid="collection-all" onClick={() => onPick(null)}>
              <span className="em-thumb em-circ" style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--em-tint)' }}><Icon n="grid" size={22} /></span>
              <span className="em-grow"><span className="em-ser" style={{ display: 'block', fontSize: 17 }}>{t('All collections')}</span><span className="em-mut" style={{ fontSize: 11 }}>{t('Every design in the store')}</span></span>
              {!current ? <Icon n="check" size={18} /> : <Icon n="right" size={18} />}
            </button>
          )}
          {groups.map(([tg, cs]) => (
            <div key={tg} data-testid="tag-group">
              <div className="em-letter em-letter-in em-tag-h">{t(tg)} <span>{cs.length}</span></div>
              <div className="em-colgrid">{cs.map((c, i) => card(c, i))}</div>
            </div>
          ))}
          {list.length === 0 && <p className="em-hint" style={{ textAlign: 'center', padding: '24px 0' }}>{t('No collection with that name.')}</p>}
        </div>
      </div>
    </div>
  );
};
