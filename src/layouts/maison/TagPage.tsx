import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ActiveScreen, Category, Product } from '../../types';
import { useBackLayer } from '../../backLayer';
import { Ph } from '../emergent/ui';
import { hn, t, tn, ts } from '../../i18n';
import { SIZES_FULL } from '../../photoSrcSet';
import { Card } from './ui';
import { withTransition } from '../../viewTransition';
import { useImmersive } from './look';

/*
 * Phone navigation state shared by the masthead and Home (phones only; desktop never reads it).
 * The open tag lives here, not in Home, so Back from a collection opened on a tag page lands on that tag page again, and the masthead knows
 * to show Back. A shared link /?tag=Rings opens it on arrival.
 */
let openTag: string | null = new URLSearchParams(window.location.search).get('tag');
const subs = new Set<() => void>();
export const setOpenTag = (tag: string | null) => {
  openTag = tag;
  subs.forEach((f) => f());
};
export const useOpenTag = () => useSyncExternalStore((cb) => (subs.add(cb), () => void subs.delete(cb)), () => openTag);

/** The masthead's search runs through Home's own search (onSearchDesigns): Home registers it while mounted; from any other screen the query waits here and Home runs it on arrival. */
let homeSearch: ((q: string) => void) | null = null;
let pendingSearch: string | null = null;
export const registerHomeSearch = (f: ((q: string) => void) | null) => {
  homeSearch = f;
  if (f && pendingSearch !== null) {
    const q = pendingSearch;
    pendingSearch = null;
    f(q);
  }
};
export const searchDesigns = (q: string, onNavigate: (s: ActiveScreen) => void) => {
  setOpenTag(null);
  if (homeSearch) return homeSearch(q);
  pendingSearch = q;
  onNavigate('categories');
};

/** The cover of a tag: the owner's tag photo, else its first collection's photo, else the first design photo filed under it. */
export const tagCover = (cover: string | undefined, cols: Category[], products: Product[]) =>
  cover || cols.find((c) => c.image)?.image || products.find((p) => p.image && cols.some((c) => c.name === p.category))?.image;

/**
 * A tag's page on phones: its cover as a banner under the floating masthead, the tag's name, a sticky bar with the count and "All <tag>", then
 * one card per collection. Back (the phone's, or the masthead's) closes it.
 */
export const TagPage: React.FC<{ tag: string; cols: Category[]; cover?: string; onCollection: (name: string) => void; onAll: () => void }> = ({ tag, cols, cover, onCollection, onAll }) => {
  // The Back layer is added a tick after the page appears: arriving here by Back (from a collection) happens inside that Back's popstate, which
  // would otherwise close the layer it had just opened.
  const [armed, setArmed] = useState(false);
  useEffect(() => { const id = setTimeout(() => setArmed(true)); return () => clearTimeout(id); }, []);
  useBackLayer(armed, () => withTransition(() => setOpenTag(null)));
  const ban = useRef<HTMLDivElement>(null);
  const name = ts(tag);
  const count = tn(cols.length, '{n} collection', '{n} collections');
  const im = useImmersive();
  return (
    <div className={`mx-tagp${im ? ' mx-im' : ''}`} data-testid="mx-tag-page">
      <div className="mx-tagp-ban" data-mx-float="" ref={ban}>
        <Ph src={cover} className="mx-fill" sizes={SIZES_FULL} priority eager alt="" style={im ? undefined : ({ viewTransitionName: 'product-photo' } as React.CSSProperties)} />
      </div>
      <div className="mx-tagp-intro">
        <nav className="mx-trail" aria-label="Breadcrumb">
          <button type="button" onClick={() => { setOpenTag(null); window.scrollTo(0, 0); }}>{t('Home')}</button><i aria-hidden="true">/</i><span>{t('Category')}</span>
        </nav>
        <h1 className="mx-h2">{name}</h1>
      </div>
      <div className="mx-sbar">
        <b data-testid="mx-tag-count">{count}</b>
        <button type="button" className="mx-pill" data-testid="mx-tag-all" onClick={onAll}>{t('All {name}', { name })}</button>
      </div>
      <div className="mx-cards">
        {cols.map((c, i) => (
          <Card
            key={c.id}
            testId="mx-col-card"
            no={im ? String(i + 1).padStart(2, '0') : undefined}
            name={hn(c.name, c.nameHi)}
            sub={tn(c.designCount, '{n} design', '{n} designs')}
            src={c.image}
            tone={i}
            onOpen={() => {
              // only one element may carry the photo's transition name at a time
              ban.current?.querySelector<HTMLElement>('.em-ph')?.style.setProperty('view-transition-name', 'none');
              onCollection(c.name);
            }}
          />
        ))}
      </div>
    </div>
  );
};
