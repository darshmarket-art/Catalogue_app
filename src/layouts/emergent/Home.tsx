import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Facebook, Instagram, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Category } from '../../types';
import { downloadCataloguePdf } from '../../cataloguePdf';
import { merchant } from '../../merchant';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { Icon, Ph, Sheet, Title, Toast, fmtG, type KitProps } from './ui';
import { useHideOnScroll } from './useHideOnScroll';
import { CollectionsBrowser } from './CollectionsBrowser';
import { recentCollections, recentSkus } from '../../recent';
import { grams, hn, pur, t, tl, tn, ts, useLang } from '../../i18n';
import { toHindi } from '../../../shared/hindi';

/** Up to this many collections are all shown on Home; more than this and Home features four (the owner's hero collections) plus a Browse all page. */
const FEW = 6;

/**
 * Home (atlas Home; the 'categories' screen): pill search, the owner's banners, one featured piece, the collections one per row as full-width square cards
 * with index badges, and "The House". The brand row and profile button are in the top bar.
 */
export const Home: React.FC<KitProps<'Categories'>> = ({ categories, products, banners, isAdmin, buyerName, onEditCategory, onNavigate, onFilterCategoryInCatalogue, onSearchDesigns, onOpenDesign }) => {
  useLang();
  const [browsing, setBrowsing] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const slideCount = banners.length || merchant.promotions.length;
  const [searchQuery, setSearchQuery] = useState('');
  const hideBar = useHideOnScroll();
  // The collection whose admin menu (edit, share link, share PDF) is open
  const [menuFor, setMenuFor] = useState<Category | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const goToSlide = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: ((i + slideCount) % slideCount) * el.clientWidth, behavior: 'smooth' });
  };

  // Auto-advance every 6s unless the buyer is touching or hovering the banner
  useEffect(() => {
    if (slideCount < 2) return;
    const timer = setInterval(() => !paused.current && goToSlide(activeSlide + 1), 6000);
    return () => clearInterval(timer);
  }, [activeSlide, slideCount]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const shareLink = async (url: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: merchant.brand.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast(t('Link copied to clipboard'));
      }
    } catch {
      // the user closed the share sheet
    }
  };

  const handlePdf = async (cat: Category) => {
    setToastMessage('Preparing the PDF…');
    try {
      await downloadCataloguePdf(cat, products, (done, total) => setToastMessage(`Preparing the PDF… ${done} of ${total} photos`));
      showToast('PDF downloaded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create the PDF.');
    }
  };

  const { contact } = merchant;
  // Where buyers can reach the store: only the pages the owner has set (WhatsApp and the showroom map are always offered when known).
  // Instagram and Facebook always show; until the owner adds their pages in merchant.json they read "Coming soon" and do nothing.
  const socialLinks: Array<{ id: string; label: string; href: string; style: React.CSSProperties; icon: React.ReactNode }> = [
    { id: 'instagram', label: ts('Instagram'), href: contact.instagramUrl ?? '', style: { background: 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)', color: '#fff' }, icon: <Instagram size={26} /> },
    { id: 'facebook', label: ts('Facebook'), href: contact.facebookUrl ?? '', style: { background: '#1877F2', color: '#fff' }, icon: <Facebook size={26} /> },
    ...(contact.whatsapp ? [{ id: 'whatsapp', label: ts('WhatsApp'), href: `https://wa.me/${contact.whatsapp}`, style: { background: 'var(--em-wa)', color: '#fff' }, icon: <MessageCircle size={26} /> }] : []),
    ...(contact.address
      ? [{ id: 'location', label: contact.showroomLabel ? ts(contact.showroomLabel) : t('Location'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, style: { background: 'var(--em-primary)', color: 'var(--em-on-primary)' }, icon: <MapPin size={26} /> }]
      : [])
  ];

  const q = searchQuery.trim().toLowerCase();
  const many = categories.length > FEW;
  // The owner's hero collections in their order; short of four, the busiest others fill in.
  const heroes = useMemo(() => {
    const chosen = categories.filter((c) => typeof c.heroOrder === 'number').sort((a, b) => (a.heroOrder as number) - (b.heroOrder as number));
    const rest = categories.filter((c) => typeof c.heroOrder !== 'number').sort((a, b) => b.designCount - a.designCount);
    return [...chosen, ...rest].slice(0, 4);
  }, [categories]);
  const matches = categories.filter((c) => [c.name, c.subtitle, c.nameHi, toHindi(c.name)].some((v) => v?.toLowerCase().includes(q)));
  const shown = q ? matches : many ? heroes : categories;
  const jumpBack = q || !many ? [] : recentCollections().map((n) => categories.find((c) => c.name === n)).filter((c): c is Category => Boolean(c));
  const viewed = q ? [] : recentSkus().map((sku) => products.find((p) => p.sku === sku)).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, 8);
  const purityOf = (cat: Category) => (cat.eligibleKarats?.length ? cat.eligibleKarats.map((k) => pur(k.split(' ')[0])).join(' · ') : t('avg {w}', { w: grams(cat.avgNetWt) }));
  const catName = (name: string) => { const c = categories.find((x) => x.name === name); return hn(name, c?.nameHi); };
  const searchDesigns = () => onSearchDesigns?.(searchQuery.trim());
  // Desktop only: the greeting that sits beside the search. First name only, by the time of day.
  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'Good morning, {name}' : hour < 17 ? 'Good afternoon, {name}' : 'Good evening, {name}';
  const firstName = (buyerName ?? '').trim().split(' ')[0];

  return (
    <div className="em-page home">
      {toastMessage && <Toast>{toastMessage}</Toast>}
      {/* Phones have no greeting, so the page's one heading is the store's name, for screen readers. Desktop's greeting is the heading there. */}
      <h1 className="em-sr em-mb">{ts(merchant.brand.name)}</h1>

      <div className={`em-sticky em-home-top${hideBar ? ' hide' : ''}`} style={{ borderBottom: 0 }}>
        <div className="em-pad em-home-row" style={{ paddingTop: 4, paddingBottom: 8 }}>
          {!isAdmin && firstName && (
            <div className="em-dk em-greet">
              <span className="em-ey" style={{ color: 'var(--em-gold-ink)' }}>{t('Welcome back')}</span>
              <h1 className="em-ser em-h1">{t(greetKey, { name: firstName })}</h1>
            </div>
          )}
          <div className="em-home-search">
            <label className="em-srch">
              <Icon n="search" />
              <input aria-label={t('Search the catalogue')} data-testid="home-search" placeholder={t('Search name, SKU or collection')} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchQuery.trim() && searchDesigns()} />
            </label>
            <span className="em-dk em-hint">{t('Name, SKU or weight across the catalogue')}</span>
          </div>
        </div>
      </div>

      {/* Banners: the owner's photos, or the default messages from merchant.json. Swipe, or use the arrows on desktop. */}
      {slideCount > 0 && (
        <div className="em-pad" style={{ marginTop: 18 }}>
          <div className="em-car" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
            <div
              ref={scroller}
              className="em-car-track"
              onScroll={(e) => setActiveSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              onTouchStart={() => (paused.current = true)}
              onTouchEnd={() => (paused.current = false)}
            >
              {banners.length > 0
                ? banners.map((b, i) => (
                    <button key={b.id} type="button" className="em-slide" disabled={!b.category} onClick={() => b.category && onFilterCategoryInCatalogue(b.category)} aria-label={b.category ? t('Open {name}', { name: catName(b.category) }) : t('Banner {n}', { n: i + 1 })}>
                      <Ph src={b.image} tone={i} className="em-fill" alt={b.category ? catName(b.category) : t('Banner {n}', { n: i + 1 })} />
                      {b.category && (
                        <>
                          <span className="em-sc" />
                          <span className="em-ov">
                            <span className="em-ey g">{t('Collection')}</span>
                            <span className="em-ser">{catName(b.category)}</span>
                          </span>
                        </>
                      )}
                    </button>
                  ))
                : merchant.promotions.map((promo, i) => (
                    <div key={promo.title} className="em-slide">
                      <Ph tone={i} className="em-fill" />
                      <span className="em-sc l" />
                      <div className="em-ov">
                        <span className="em-ey g em-mb">{ts(promo.tag)}</span>
                        <span className="em-dk fx em-promo-pills">
                          <span className="em-pill gold">{ts(promo.tag)}</span>
                          {promo.stampText && <span className="em-pill stamp"><Icon n="shield" size={13} />{ts(promo.stampText)}</span>}
                        </span>
                        <span className="em-ser">{ts(promo.title)}</span>
                        {tl(promo.subtitle) && <p>{tl(promo.subtitle)}</p>}
                        <span className="em-promo-act">
                          <button type="button" className="em-link" onClick={() => onFilterCategoryInCatalogue(promo.title)}>
                            {ts(promo.actionLabel)}
                            <Icon n="right" size={14} />
                          </button>
                          {promo.note && <span className="em-dk em-promo-note">{ts(promo.note)}</span>}
                        </span>
                      </div>
                    </div>
                  ))}
            </div>

            {slideCount > 1 && (
              <>
                {(['prev', 'next'] as const).map((dir) => (
                  <button key={dir} type="button" aria-label={dir === 'prev' ? t('Previous banner') : t('Next banner')} onClick={() => goToSlide(activeSlide + (dir === 'prev' ? -1 : 1))} className="em-circ f em-arrow" style={dir === 'prev' ? { left: 8 } : { right: 8 }}>
                    <Icon n={dir === 'prev' ? 'back' : 'next'} />
                  </button>
                ))}
                <div className="em-dots">
                  {Array.from({ length: slideCount }, (_, i) => (
                    <button key={i} type="button" aria-label={t('Banner {n}', { n: i + 1 })} aria-current={activeSlide === i ? 'true' : undefined} className={activeSlide === i ? 'on' : ''} onClick={() => goToSlide(i)} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Owner only: change the banners, or send the whole catalogue link to a buyer */}
      {isAdmin && (
        <div className="em-chips" style={{ marginTop: 12, paddingBottom: 0 }}>
          <button type="button" className="em-chip" onClick={() => onNavigate('admin-banners')}>
            <Icon n="image" size={15} />
            Change banners
          </button>
          <button type="button" className="em-chip" onClick={() => shareLink(window.location.origin)}>
            <Icon n="link" size={15} />
            Share catalogue link
          </button>
        </div>
      )}

      {jumpBack.length > 0 && (
        <div style={{ marginTop: 22 }} data-testid="jump-back">
          <div className="em-ey em-pad">{t('Jump back in')}</div>
          <div className="em-chips" style={{ paddingTop: 8, paddingBottom: 0 }}>
            {jumpBack.map((c) => (
              <button key={c.id} type="button" className="em-chip" onClick={() => onFilterCategoryInCatalogue(c.name)}>
                {hn(c.name, c.nameHi)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="em-pad" style={{ marginTop: 28 }}>
        <Title
          eyebrow={t(q ? 'Matching' : many ? 'Featured' : 'Curated')}
          title={t('Collections')}
          size="h2"
          right={
            <button type="button" className="em-link" onClick={() => onNavigate('catalogue')} style={{ marginBottom: 8 }}>
              {t('All designs')}
              <Icon n="right" size={14} />
            </button>
          }
        />

        {q && (
          <button type="button" className="em-li" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)' }} data-testid="home-search-designs" onClick={searchDesigns}>
            <span className="em-badge"><Icon n="search" size={16} /></span>
            <span className="em-grow"><b style={{ fontWeight: 600 }}>{t('Search designs for “{q}”', { q: searchQuery.trim() })}</b><span className="em-mut" style={{ display: 'block', fontSize: 13 }}>{t('Name, SKU or weight across the catalogue')}</span></span>
            <Icon n="right" size={16} />
          </button>
        )}

        {shown.length === 0 && <p className="em-hint" style={{ textAlign: 'center', padding: '24px 0' }}>{t(categories.length === 0 ? 'No collections have been added yet.' : 'No collections match your search.')}</p>}

        <div className="em-grid em-grid-2" data-testid="home-collections" style={{ marginTop: 14 }}>
          {shown.map((cat, i) => (
            <div key={cat.id} className="em-sq" data-testid="home-collection">
              <button type="button" className="em-hit" aria-label={t('Open {name}', { name: hn(cat.name, cat.nameHi) })} onClick={() => onFilterCategoryInCatalogue(cat.name)}>
                <Ph src={cat.image} tone={i} className="em-fill" alt={hn(cat.name, cat.nameHi)} />
                <span className="em-sc" />
                {cat.tag && <span className="em-dk em-pill em-col-tag">{ts(cat.tag)}</span>}
                <span className="em-col-ov">
                  <span className="em-ey g em-mb">{purityOf(cat)}</span>
                  <span className="em-ser">{hn(cat.name, cat.nameHi)}</span>
                  <small className="em-mb">
                    {tn(cat.designCount, '{n} design', '{n} designs')}
                  </small>
                  <small className="em-dk">
                    {tn(cat.designCount, '{n} design', '{n} designs')} · {t('avg {w}', { w: grams(cat.avgNetWt) })}
                  </small>
                </span>
              </button>
              {isAdmin && (
                <button type="button" className="em-circ f em-opts" aria-label={`Options for ${cat.name}`} onClick={() => setMenuFor(cat)}>
                  <Icon n="more" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {many && !q && (
          <button type="button" className="em-browse" data-testid="browse-collections" onClick={() => setBrowsing(true)}>
            <span className="em-badge"><Icon n="grid" size={18} /></span>
            <span className="em-grow">
              <b className="em-ser" style={{ fontSize: 17, fontWeight: 500 }}>{t('Browse all {n} collections', { n: categories.length })}</b>
              <span className="em-mut" style={{ display: 'block', fontSize: 13 }}>{t('Search or browse by type')}</span>
            </span>
            <Icon n="right" size={18} />
          </button>
        )}
      </div>

      {viewed.length > 0 && (
        <div style={{ marginTop: 28 }} data-testid="recently-viewed">
          <div className="em-ey em-pad">{t('Recently viewed')}</div>
          <div className="em-chips em-strip" style={{ paddingTop: 10, paddingBottom: 0 }}>
            {viewed.map((p, i) => (
              <button key={p.id} type="button" className="em-strip-i" aria-label={t('Open {name}', { name: hn(p.title, p.titleHi) })} onClick={() => onOpenDesign?.(p.sku)}>
                <Ph src={p.image} tone={i} className="em-strip-ph" />
                <span>{hn(p.title, p.titleHi)}</span>
                <b className="em-dk em-strip-wt">{t('{w} net', { w: fmtG(p.netWt) })}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      {socialLinks.length > 0 && (
        <div className="em-pad" style={{ marginTop: 28 }}>
          <div className="em-card em-social" data-testid="social-links">
            <div className="em-social-head">
              <div className="em-ey" style={{ color: 'var(--em-gold-ink)' }}>{t('Find us')}</div>
              <p className="em-ser" style={{ fontSize: 20, margin: '4px 0 14px' }}>{t('Stay in touch with {name}', { name: ts(merchant.brand.name) })}</p>
              {contact.address && (
                <div className="em-dk em-find-addr">
                  <MapPin size={22} aria-hidden="true" />
                  <div>
                    <span className="em-ey" style={{ color: 'var(--em-gold-ink)' }}>{contact.showroomLabel ? ts(contact.showroomLabel) : t('Location')}</span>
                    <b>{ts(contact.address)}</b>
                    {contact.deskPhone && (
                      <a className="em-find-call" href={`tel:${contact.deskPhone.replace(/\s/g, '')}`}>
                        <Phone size={14} aria-hidden="true" />
                        {contact.deskPhone}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="em-social-row">
              {socialLinks.map((link) =>
                link.href ? (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="em-social-i" aria-label={link.label}>
                    <span style={link.style}>{link.icon}</span>
                    <small>{link.label}</small>
                  </a>
                ) : (
                  <div key={link.label} className="em-social-i soon" aria-label={`${link.label}, ${t('Coming soon')}`} data-testid={`social-soon-${link.id}`}>
                    <span style={link.style}>{link.icon}</span>
                    <small>{link.label}</small>
                    <em>{t('Coming soon')}</em>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
        <PoweredByAntarixs />
      </div>

      {/* Admin menu for one collection */}
      {menuFor && (
        <Sheet label={`Options for ${menuFor.name}`} onClose={() => setMenuFor(null)}>
          <h2 className="em-ser" style={{ fontSize: 24 }}>
            {menuFor.name}
          </h2>
          <div>
            {[
              { label: 'Edit collection', note: 'Name, photo, weight range', icon: 'edit', run: () => onEditCategory(menuFor) },
              { label: 'Share link', note: 'Buyer signs in and lands on this collection', icon: 'link', run: () => shareLink(`${window.location.origin}/?category=${encodeURIComponent(menuFor.name)}`) },
              { label: 'Share as PDF', note: `All photos, watermarked with ${merchant.brand.name}`, icon: 'file', run: () => handlePdf(menuFor) }
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                className="em-opt"
                onClick={() => {
                  setMenuFor(null);
                  o.run();
                }}
              >
                <span className="em-badge">
                  <Icon n={o.icon} size={16} />
                </span>
                <span className="em-grow">
                  <b style={{ fontWeight: 600 }}>{o.label}</b>
                  <span className="em-mut" style={{ display: 'block', fontSize: 13 }}>
                    {o.note}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {browsing && (
        <CollectionsBrowser
          categories={categories}
          onClose={() => setBrowsing(false)}
          onPick={(name) => {
            setBrowsing(false);
            if (name) onFilterCategoryInCatalogue(name);
          }}
        />
      )}
    </div>
  );
};
