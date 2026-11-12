import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Banner, Category } from '../../types';
import { merchant } from '../../merchant';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { LegalLinks } from '../../components/LegalLinks';
import { Reveal } from '../../components/Reveal';
import { openService } from '../../services';
import { Icon, Ph, type KitProps } from '../emergent/ui';
import { CollectionsBrowser } from '../emergent/CollectionsBrowser';
import { recentSkus } from '../../recent';
import { grams, hl, hn, t, tn, ts, useLang } from '../../i18n';
import { SIZES_FULL, SIZES_GRID } from '../../photoSrcSet';
import { Card, Tile } from './ui';
import { useDesktop } from '../emergent/useDesktop';
import { groupByTag, useTagList } from '../../tagList';
import { useTagCovers } from '../../tagCovers';
import { withTransition } from '../../viewTransition';
import { TagPage, registerHomeSearch, setOpenTag, tagCover, useOpenTag } from './TagPage';
import { useImmersive } from './look';

const FEW = 6;
const AUTOPLAY_MS = 6500;
/** Phones show the wide banner cropped to a full screen, so it is drawn about twice the screen height wide; desktop is full width as before. */
const HERO_SIZES = `(max-width: 1023.98px) 200svh, ${SIZES_FULL}`;

/** `eyebrow` and `sub` are the chapter's small line above and the sentence under the title (Noir's chapters). */
interface Slide { id: string; image?: string; title: string; open: () => void; eyebrow?: string; sub?: string }
const two = (n: number) => String(n).padStart(2, '0');

/**
 * The hero: the store's banners as full-width slides in a scroll-snap strip. The browser does the finger tracking, momentum and snapping;
 * autoplay glides with scrollTo. A copy of the first slide sits after the last, so the loop is a glide forward and then an unseen reset
 * (no rewind, no jump). Autoplay pauses on hover, focus, touch and in a hidden tab, and is off for reduced motion.
 */
const Hero: React.FC<{ slides: Slide[]; loading: boolean; cap?: boolean; chapters?: boolean }> = ({ slides, loading, cap, chapters }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);
  const settle = useRef(0);
  const n = slides.length;
  const loop = n > 1 ? [...slides, { ...slides[0], id: `${slides[0].id}-loop` }] : slides;

  const go = useCallback((i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
  }, [reduce]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth) % n);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (n > 1 && Math.round(el.scrollLeft / el.clientWidth) >= n) {
        el.style.scrollSnapType = 'none';
        el.scrollLeft = 0;
        requestAnimationFrame(() => { el.style.scrollSnapType = ''; });
      }
    }, 140);
  };

  useEffect(() => {
    if (n < 2 || reduce) return;
    const tick = window.setInterval(() => {
      const el = ref.current;
      if (!el || paused.current || document.hidden) return;
      go(Math.round(el.scrollLeft / el.clientWidth) + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(tick);
    // chapters: the clock restarts with every slide, so the bar that fills under the photo and the glide stay together
  }, [n, reduce, go, chapters ? idx : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const hold = (v: boolean) => () => { paused.current = v; };
  return (
    <section className={`mx-hero${chapters ? ' im' : ''}`} data-mx-float="" aria-roledescription="carousel" aria-label={slides[0]?.title} data-testid="mx-hero" onMouseEnter={hold(true)} onMouseLeave={hold(false)} onFocus={hold(true)} onBlur={hold(false)} onTouchStart={hold(true)} onTouchEnd={hold(false)}>
      <div className="mx-hero-strip" ref={ref} onScroll={onScroll}>
        {loop.map((sl, i) => (
          <div key={sl.id} className={`mx-slide${i % n === idx ? ' on' : ''}`} role="group" aria-roledescription="slide" aria-label={`${(i % n) + 1} / ${n}`} aria-hidden={i >= n || undefined}>
            <div className="mx-hero-media">
              <div className="mx-hero-img">
                {loading ? <span className="em-ph em-skel mx-fill" /> : <Ph src={sl.image} tone={i} className="mx-fill" sizes={HERO_SIZES} priority={i === 0} eager alt="" />}
              </div>
              <button type="button" className="mx-hero-hit" aria-label={sl.title} tabIndex={i >= n ? -1 : undefined} onClick={sl.open} />
              {cap && (
                <div className="mx-hero-cap" aria-hidden="true">
                  {chapters && sl.eyebrow && <span className="mx-ey">{sl.eyebrow}</span>}
                  <h2>{sl.title}</h2>
                  {chapters && sl.sub && <p>{sl.sub}</p>}
                  {chapters ? <span className="mx-cta lt">{t('Discover')}</span> : <span className="mx-btn lt">{t('Shop now')}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="mx-hero-dots" role="group" aria-label={t('Banners')}>
          {slides.map((sl, i) => <button key={sl.id} type="button" className={i === idx ? 'on' : i < idx ? 'was' : ''} aria-label={`Banner ${i + 1}`} aria-current={i === idx || undefined} onClick={() => go(i)}>{chapters && <i key={i === idx ? `run-${idx}` : 'idle'} />}</button>)}
          {chapters && <span className="mx-hero-no" aria-hidden="true">{two(idx + 1)} <i>/</i> {two(n)}</span>}
        </div>
      )}
    </section>
  );
};

/**
 * Maison Home: a banner carousel (the store's own banners), a one-line statement, the collections as a flush grid of tiles with the name
 * inside, later banners as split features, recently viewed, and contact lines.
 */
export const Home: React.FC<KitProps<'Categories'>> = ({ categories, products, banners, loading = false, about, onNavigate, onFilterCategoryInCatalogue, onFilterTagInCatalogue, onSearchDesigns, onOpenDesign }) => {
  useLang();
  const [q, setQ] = useState('');
  const [browsing, setBrowsing] = useState(false);
  // Phones (below 1024px) get the Shop by tag cards and tag pages; desktop keeps its page exactly as it was.
  const desk = useDesktop();
  // Noir on phones is the immersive layout: chapters, a gallery of categories, featured collections (see immersive.css).
  const im = useImmersive() && !desk;
  const tagOrder = useTagList();
  const covers = useTagCovers();
  const groups = groupByTag(categories.filter((c) => c.designCount > 0).sort((a, b) => b.designCount - a.designCount), tagOrder);
  const openTag = useOpenTag();
  const tagGroup = !desk && openTag ? groups.find(([g]) => g === openTag) : undefined;
  const allDesigns = () => (onSearchDesigns ? onSearchDesigns('') : onNavigate('catalogue'));
  // The masthead's search runs through this screen's search.
  useLayoutEffect(() => { registerHomeSearch((s) => onSearchDesigns?.(s)); return () => registerHomeSearch(null); }, [onSearchDesigns]);
  // Back from a tag page returns to where Home was scrolled.
  const homeY = useRef(0);
  const wasTag = useRef(Boolean(tagGroup));
  useLayoutEffect(() => {
    if (wasTag.current && !tagGroup) window.scrollTo(0, homeY.current);
    wasTag.current = Boolean(tagGroup);
  }, [tagGroup]);
  const openCollection = (name: string) => withTransition(() => onFilterCategoryInCatalogue(name));
  const openTagPage = (tag: string, photo: Element | null) => {
    // Noir: a category with one collection opens that collection (a page listing a single card is a wasted tap).
    const only = im ? groups.find(([g]) => g === tag)?.[1] : undefined;
    if (only?.length === 1) return openCollection(only[0].name);
    homeY.current = window.scrollY;
    withTransition(() => { setOpenTag(tag); window.scrollTo(0, 0); }, photo);
  };

  const heroes = useMemo(() => {
    const chosen = categories.filter((c) => typeof c.heroOrder === 'number').sort((a, b) => (a.heroOrder as number) - (b.heroOrder as number));
    const rest = categories.filter((c) => typeof c.heroOrder !== 'number').sort((a, b) => b.designCount - a.designCount);
    return [...chosen, ...rest];
  }, [categories]);
  const many = categories.length > FEW;
  const shown = many ? heroes.slice(0, FEW) : heroes;
  const catName = (name: string) => { const c = categories.find((x) => x.name === name); return hn(name, c?.nameHi); };
  // ponytail: App loads the recently viewed designs, then the newest 24 (sort: newest); New in is that second part. A design both recent and new is left out.
  const fresh = desk ? [] : products.filter((p) => !recentSkus().includes(p.sku)).slice(0, 8);
  const statement = desk ? '' : hl(about?.story, about?.storyHi) || hl(merchant.brand.description);
  const viewed = recentSkus().map((sku) => products.find((p) => p.sku === sku)).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, 8);

  // The hero is the store's own banners (Banners in the owner's catalogue). With none: one plain slide with the store name.
  const slides: Slide[] = banners.length > 0
    ? banners.map((b: Banner) => ({
        id: b.id,
        image: b.image,
        title: b.category ? catName(b.category) : ts(merchant.brand.name),
        open: () => (b.category ? onFilterCategoryInCatalogue(b.category) : onNavigate('catalogue'))
      }))
    : [{ id: 'store', image: heroes[0]?.image, title: ts(merchant.brand.name), open: () => onNavigate('catalogue') }];
  const features = banners.slice(1, 3);
  // Noir's chapters: the banners first, then the collections the owner put forward (hero order), five at most, each with its own line.
  const chapterOf = (c: Category): Slide => ({ id: `col-${c.id}`, image: c.image, title: hn(c.name, c.nameHi), sub: hn(c.subtitle, c.subtitleHi), open: () => onFilterCategoryInCatalogue(c.name) });
  const chapters: Slide[] = !im ? [] : [
    ...(banners.length > 0 ? slides.map((sl, i) => ({ ...sl, sub: hn(categories.find((c) => c.name === banners[i]?.category)?.subtitle ?? '', categories.find((c) => c.name === banners[i]?.category)?.subtitleHi) })) : []),
    ...heroes.filter((c) => c.image && c.designCount > 0 && !banners.some((b) => b.category === c.name)).map(chapterOf)
  ].slice(0, 5).map((sl, i) => ({ ...sl, eyebrow: t('Chapter {n}', { n: two(i + 1) }) }));
  const heroSlides = chapters.length > 0 ? chapters : slides;
  // and the collections shown in full under the gallery: the first three the hero did not already use up
  const featured = !im ? [] : heroes.filter((c) => c.image && c.designCount > 0).slice(0, 3);

  const { contact } = merchant;
  const links = [
    { id: 'instagram', label: ts('Instagram'), href: about?.instagram || contact.instagramUrl || '' },
    { id: 'facebook', label: ts('Facebook'), href: about?.facebook || contact.facebookUrl || '' },
    ...(contact.whatsapp ? [{ id: 'whatsapp', label: ts('WhatsApp'), href: `https://wa.me/${contact.whatsapp}` }] : []),
    ...(contact.address ? [{ id: 'location', label: contact.showroomLabel ? ts(contact.showroomLabel) : t('Location'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.mapPin || contact.address)}` }] : [])
  ];

  const tile = (cat: Category, i: number) => (
    <Reveal key={cat.id} className={`mx-tile${i === 0 ? ' lead' : ''}`} delay={(i % 3) * 90}>
      <button type="button" data-testid="home-collection" style={{ ['--i' as string]: i }} aria-label={t('Open {name}', { name: hn(cat.name, cat.nameHi) })} onClick={() => onFilterCategoryInCatalogue(cat.name)}>
        <span className="mx-frame">
          <Ph src={cat.image} tone={i} className="mx-fill" sizes={i === 0 ? SIZES_FULL : SIZES_GRID} alt={hn(cat.name, cat.nameHi)} />
          <span className="mx-ov">
            <span className="mx-tt">{hn(cat.name, cat.nameHi)}</span>
            <span className="mx-pw">{tn(cat.designCount, '{n} design', '{n} designs')} · {t('avg {w}', { w: grams(cat.avgNetWt) })}</span>
          </span>
        </span>
      </button>
    </Reveal>
  );

  if (tagGroup)
    return (
      <div className={`mx-home${im ? ' mx-im' : ''}`}>
        <TagPage tag={tagGroup[0]} cols={tagGroup[1]} cover={tagCover(covers[tagGroup[0]], tagGroup[1], products)} onCollection={openCollection} onAll={onFilterTagInCatalogue ? () => withTransition(() => onFilterTagInCatalogue(tagGroup[0])) : allDesigns} />
      </div>
    );

  return (
    <div className={`mx-home${im ? ' mx-im' : ''}`}>
      <h1 className="em-sr">{ts(merchant.brand.name)}</h1>
      <Hero slides={heroSlides} loading={loading} cap={!desk} chapters={im} />

      {statement && (
        <section className="mx-state" data-testid="mx-statement">
          {im && <Reveal><span className="mx-ey">{t('The house')}</span></Reveal>}
          <Reveal><h2>{ts(merchant.brand.name)}</h2></Reveal>
          <Reveal delay={120}><p>{statement}</p></Reveal>
          {im && <Reveal delay={200}><button type="button" className="mx-cta" data-testid="mx-our-story" onClick={() => onNavigate('about')}>{t('Our story')}</button></Reveal>}
        </section>
      )}

      {!desk && (
        <section className="mx-shop" data-testid="mx-shop-by">
          {im && <Reveal><span className="mx-ey">{t('Explore')}</span></Reveal>}
          <Reveal><h2 className="mx-shop-h">{t('Shop by Category')}</h2></Reveal>
          {!loading && groups.length === 0 && <p className="mx-note">{t('No collections have been added yet.')}</p>}
          <div className="mx-cards">
            {groups.map(([tag, cs], i) => (
              <Card key={tag} testId="mx-tag-card" no={im ? two(i + 1) : undefined} name={ts(tag)} sub={cs.length === 1 && im ? tn(cs[0].designCount, '{n} design', '{n} designs') : tn(cs.length, '{n} collection', '{n} collections')} src={tagCover(covers[tag], cs, products)} tone={i} onOpen={(ph) => openTagPage(tag, ph)} />
            ))}
          </div>
          <Reveal><button type="button" className="mx-shop-all" data-testid="mx-all-designs" onClick={allDesigns}>{t('View all designs')}</button></Reveal>
        </section>
      )}

      {featured.map((c, i) => (
        <section key={c.id} className={`mx-chap${i % 2 ? ' alt' : ''}`} data-testid="mx-chapter">
          <Reveal>
            <button type="button" aria-label={t('Open {name}', { name: hn(c.name, c.nameHi) })} onClick={() => openCollection(c.name)}>
              <span className="mx-chap-im"><Ph src={c.image} tone={i + 2} className="mx-fill" sizes={SIZES_FULL} alt="" /></span>
              <span className="mx-chap-tx">
                <span className="mx-ey">{t('Collection')} · {tn(c.designCount, '{n} design', '{n} designs')}</span>
                <span className="mx-chap-h">{hn(c.name, c.nameHi)}</span>
                {(c.story || hn(c.subtitle, c.subtitleHi)) && <span className="mx-chap-p">{(c.story ?? '').split('\n')[0] || hn(c.subtitle, c.subtitleHi)}</span>}
                <span className="mx-cta">{t('Discover')}</span>
              </span>
            </button>
          </Reveal>
        </section>
      ))}

      {fresh.length > 0 && (
        <section className="mx-sec" data-testid="mx-new-in">
          <Reveal className="mx-head"><h2 className="mx-st">{t('New in')}</h2></Reveal>
          <Reveal delay={120}><div className="mx-strip">
            {fresh.map((p, i) => <Tile key={p.id} prod={p} index={i} testId="new-card" onOpen={() => onOpenDesign?.(p.sku)} />)}
          </div></Reveal>
        </section>
      )}

      {desk && <section className="mx-intro">
        <Reveal>
          <label className="mx-search">
            <Icon n="search" size={18} />
            <input aria-label={t('Search the catalogue')} data-testid="home-search" type="search" placeholder={t('Search name, SKU or collection')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q.trim() && onSearchDesigns?.(q.trim())} />
          </label>
        </Reveal>
      </section>}

      {desk && <section className="mx-sec">
        <div className="mx-head">
          <h2 className="mx-st">{t('Collections')}</h2>
          <button type="button" className="mx-cta" onClick={() => (many ? setBrowsing(true) : onNavigate('catalogue'))} data-testid={many ? 'browse-collections' : undefined}>
            {many ? t('Browse all {n} collections', { n: categories.length }) : t('All designs')}
          </button>
        </div>
        {!loading && shown.length === 0 && <p className="mx-note">{t('No collections have been added yet.')}</p>}
        <div className="mx-grid" data-testid="home-collections" aria-busy={loading || undefined}>
          {loading && categories.length === 0 && Array.from({ length: 3 }, (_, i) => <div key={i} className="mx-tile"><span className="mx-frame em-skel" /></div>)}
          {shown.map(tile)}
        </div>
      </section>}

      {desk && features.map((b, i) => (
        <section key={b.id} className={`mx-split${i % 2 ? ' rev' : ''}`}>
          <Reveal className="mx-split-img"><Ph src={b.image} tone={i + 1} className="mx-fill" sizes={SIZES_FULL} alt="" /></Reveal>
          <Reveal className="mx-split-txt" delay={120}>
            <span className="mx-ey">{t('Collection')}</span>
            <h2 className="mx-h2">{b.category ? catName(b.category) : ts(merchant.brand.name)}</h2>
            <button type="button" className="mx-cta" onClick={() => (b.category ? onFilterCategoryInCatalogue(b.category) : onNavigate('catalogue'))}>{t('Discover')}</button>
          </Reveal>
        </section>
      ))}

      <section className="mx-serv" data-testid="mx-services">
        <Reveal><span className="mx-ey">{t('At your service')}</span><h2 className="mx-serv-h">{t('The house, on your terms')}</h2></Reveal>
        <div className="mx-serv-rows">
          <Reveal><button type="button" data-testid="home-viewing" onClick={() => openService({ kind: 'viewing' })}><Icon n="clock" size={20} /><span><b>{t('Private viewing')}</b><small>{t('In the boutique or on a video call, with your pieces laid out.')}</small></span><Icon n="next" size={16} /></button></Reveal>
          <Reveal delay={90}><button type="button" data-testid="home-bespoke" onClick={() => openService({ kind: 'bespoke' })}><Icon n="edit" size={20} /><span><b>{t('Bespoke atelier')}</b><small>{t('Tell us what you have in mind. The atelier answers with a sketch.')}</small></span><Icon n="next" size={16} /></button></Reveal>
          <Reveal delay={180}><button type="button" data-testid="home-care" onClick={() => openService({ kind: 'care' })}><Icon n="shield" size={20} /><span><b>{t('Size guide and care')}</b><small>{t('Ring and bangle sizes, cleaning, resizing and repair.')}</small></span><Icon n="next" size={16} /></button></Reveal>
        </div>
      </section>

      {viewed.length > 0 && (
        <section className="mx-sec" data-testid="recently-viewed">
          <Reveal className="mx-head"><h2 className="mx-st">{t('Recently viewed')}</h2></Reveal>
          <Reveal delay={120}><div className="mx-strip">
            {viewed.map((p, i) => <Tile key={p.id} prod={p} index={i} testId="recent-card" onOpen={() => onOpenDesign?.(p.sku)} />)}
          </div></Reveal>
        </section>
      )}

      <footer className="mx-foot" data-testid="social-links">
        <div className="mx-foot-in">
          <div>
            <span className="mx-ey">{t('Find us')}</span>
            <p className="mx-h2 sm">{t('Stay in touch with {name}', { name: ts(merchant.brand.name) })}</p>
            {contact.address && <p className="mx-note">{ts(contact.address)}{contact.deskPhone ? <><br /><a href={`tel:${contact.deskPhone.replace(/\s/g, '')}`}>{contact.deskPhone}</a></> : null}</p>}
          </div>
          <ul className="mx-links">
            <li><button type="button" onClick={() => onNavigate('about')}>{t('About us')}</button></li>
            {links.map((l) => (
              <li key={l.id}>
                {l.href ? <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a> : <span data-testid={`social-soon-${l.id}`}>{l.label} · {t('Coming soon')}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-foot-b"><PoweredByAntarixs /><LegalLinks /></div>
      </footer>

      {browsing && (
        <CollectionsBrowser categories={categories} onClose={() => setBrowsing(false)} onPick={(name) => { setBrowsing(false); if (name) onFilterCategoryInCatalogue(name); }} />
      )}
    </div>
  );
};
