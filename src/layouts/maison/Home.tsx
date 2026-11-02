import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import type { Category } from '../../types';
import { merchant } from '../../merchant';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { LegalLinks } from '../../components/LegalLinks';
import { Reveal } from '../../components/Reveal';
import { Icon, Ph, fmtG, type KitProps } from '../emergent/ui';
import { CollectionsBrowser } from '../emergent/CollectionsBrowser';
import { recentSkus } from '../../recent';
import { grams, hn, t, tl, tn, ts, useLang } from '../../i18n';
import { SIZES_FULL, SIZES_GRID, SIZES_THUMB } from '../../photoSrcSet';

const FEW = 6;

/**
 * Maison Home: a full-bleed hero (the first banner) with a slow parallax, a one-line statement, the collections as an editorial
 * grid (one column on phones, an asymmetric grid on desktop), later banners as split features, recently viewed, and contact lines.
 */
export const Home: React.FC<KitProps<'Categories'>> = ({ categories, products, banners, loading = false, about, onNavigate, onFilterCategoryInCatalogue, onSearchDesigns, onOpenDesign }) => {
  useLang();
  const [q, setQ] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  // The hero image drifts at a third of the scroll speed and the words lift and fade a little faster: depth without moving layout.
  const imgY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 260]);
  const textY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -60]);
  const textO = useTransform(scrollY, [0, 450], [1, reduce ? 1 : 0]);

  const heroes = useMemo(() => {
    const chosen = categories.filter((c) => typeof c.heroOrder === 'number').sort((a, b) => (a.heroOrder as number) - (b.heroOrder as number));
    const rest = categories.filter((c) => typeof c.heroOrder !== 'number').sort((a, b) => b.designCount - a.designCount);
    return [...chosen, ...rest];
  }, [categories]);
  const many = categories.length > FEW;
  const shown = many ? heroes.slice(0, FEW) : heroes;
  const catName = (name: string) => { const c = categories.find((x) => x.name === name); return hn(name, c?.nameHi); };
  const viewed = recentSkus().map((sku) => products.find((p) => p.sku === sku)).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, 8);

  const hero = banners[0];
  const promo = merchant.promotions[0];
  const heroTitle = hero?.category ? catName(hero.category) : promo ? ts(promo.title) : ts(merchant.brand.tagline);
  const heroOpen = () => (hero?.category ? onFilterCategoryInCatalogue(hero.category) : promo ? onFilterCategoryInCatalogue(promo.title) : onNavigate('catalogue'));
  const features = banners.slice(1, 3);

  const { contact } = merchant;
  const links = [
    { id: 'instagram', label: ts('Instagram'), href: about?.instagram || contact.instagramUrl || '' },
    { id: 'facebook', label: ts('Facebook'), href: about?.facebook || contact.facebookUrl || '' },
    ...(contact.whatsapp ? [{ id: 'whatsapp', label: ts('WhatsApp'), href: `https://wa.me/${contact.whatsapp}` }] : []),
    ...(contact.address ? [{ id: 'location', label: contact.showroomLabel ? ts(contact.showroomLabel) : t('Location'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.mapPin || contact.address)}` }] : [])
  ];

  const tile = (cat: Category, i: number) => (
    <Reveal key={cat.id} className={`mx-tile${i === 0 ? ' lead' : ''}`} delay={(i % 3) * 90}>
      <button type="button" data-testid="home-collection" aria-label={t('Open {name}', { name: hn(cat.name, cat.nameHi) })} onClick={() => onFilterCategoryInCatalogue(cat.name)}>
        <span className="mx-frame"><Ph src={cat.image} tone={i} className="mx-fill" sizes={i === 0 ? SIZES_FULL : SIZES_GRID} alt={hn(cat.name, cat.nameHi)} /></span>
        <span className="mx-ey">{tn(cat.designCount, '{n} design', '{n} designs')} · {t('avg {w}', { w: grams(cat.avgNetWt) })}</span>
        <span className="mx-tt">{hn(cat.name, cat.nameHi)}</span>
        <span className="mx-cta">{t('Discover')}</span>
      </button>
    </Reveal>
  );

  return (
    <div className="mx-home">
      <h1 className="em-sr">{ts(merchant.brand.name)}</h1>
      <section className="mx-hero" aria-label={heroTitle}>
        <div className="mx-hero-media">
        <motion.div className="mx-hero-img" style={{ y: imgY }}>
          {loading ? <span className="em-ph em-skel mx-fill" /> : <Ph src={hero?.image ?? heroes[0]?.image} tone={0} className="mx-fill" sizes={SIZES_FULL} priority alt="" />}
        </motion.div>
        <span className="mx-hero-sc" />
        </div>
        <motion.div className="mx-hero-txt" style={{ y: textY, opacity: textO }}>
          <span className="mx-ey">{hero?.category ? t('Collection') : promo ? ts(promo.tag) : ts(merchant.brand.name)}</span>
          <h2 className="mx-display">{heroTitle}</h2>
          <button type="button" className="mx-cta lt" onClick={heroOpen}>{promo && !hero ? ts(promo.actionLabel) : t('Discover')}</button>
        </motion.div>
      </section>

      <section className="mx-intro">
        <Reveal><p className="mx-ey">{ts(merchant.brand.tagline)}</p></Reveal>
        <Reveal delay={80}><p className="mx-lede">{tl(merchant.brand.description)}</p></Reveal>
        <Reveal delay={160}>
          <label className="mx-search">
            <Icon n="search" size={18} />
            <input aria-label={t('Search the catalogue')} data-testid="home-search" type="search" placeholder={t('Search name, SKU or collection')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && q.trim() && onSearchDesigns?.(q.trim())} />
          </label>
        </Reveal>
      </section>

      <section className="mx-sec">
        <div className="mx-head">
          <h2 className="mx-h2">{t('Collections')}</h2>
          <button type="button" className="mx-cta" onClick={() => (many ? setBrowsing(true) : onNavigate('catalogue'))} data-testid={many ? 'browse-collections' : undefined}>
            {many ? t('Browse all {n} collections', { n: categories.length }) : t('All designs')}
          </button>
        </div>
        {!loading && shown.length === 0 && <p className="mx-note">{t('No collections have been added yet.')}</p>}
        <div className="mx-grid" data-testid="home-collections" aria-busy={loading || undefined}>
          {loading && categories.length === 0 && Array.from({ length: 3 }, (_, i) => <div key={i} className="mx-tile"><span className="mx-frame em-skel" /></div>)}
          {shown.map(tile)}
        </div>
      </section>

      {features.map((b, i) => (
        <section key={b.id} className={`mx-split${i % 2 ? ' rev' : ''}`}>
          <Reveal className="mx-split-img"><Ph src={b.image} tone={i + 1} className="mx-fill" sizes={SIZES_FULL} alt="" /></Reveal>
          <Reveal className="mx-split-txt" delay={120}>
            <span className="mx-ey">{t('Collection')}</span>
            <h2 className="mx-h2">{b.category ? catName(b.category) : ts(merchant.brand.name)}</h2>
            <button type="button" className="mx-cta" onClick={() => (b.category ? onFilterCategoryInCatalogue(b.category) : onNavigate('catalogue'))}>{t('Discover')}</button>
          </Reveal>
        </section>
      ))}

      {viewed.length > 0 && (
        <section className="mx-sec" data-testid="recently-viewed">
          <div className="mx-head"><h2 className="mx-h2 sm">{t('Recently viewed')}</h2></div>
          <div className="mx-strip">
            {viewed.map((p, i) => (
              <button key={p.id} type="button" className="mx-prod" aria-label={t('Open {name}', { name: hn(p.title, p.titleHi) })} onClick={() => onOpenDesign?.(p.sku)}>
                <span className="mx-frame sq"><Ph src={p.image} tone={i} className="mx-fill" sizes={SIZES_THUMB} /></span>
                <span className="mx-tt sm">{hn(p.title, p.titleHi)}</span>
                <span className="mx-ey">{t('{w} net', { w: fmtG(p.netWt) })}</span>
              </button>
            ))}
          </div>
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
