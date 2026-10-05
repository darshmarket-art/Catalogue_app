import React, { useEffect, useRef, useState } from 'react';
import { Facebook, Instagram, MapPin, MessageCircle, Youtube } from 'lucide-react';
import type { Category } from '../../types';
import { downloadCataloguePdf } from '../../cataloguePdf';
import { merchant } from '../../merchant';
import { PoweredByAntarixs } from '../../components/AntarixsBrand';
import { Icon, Ph, Pill, Sheet, Title, Toast, fmtG, type KitProps } from './ui';
import { useHideOnScroll } from './useHideOnScroll';

/**
 * Home (atlas Home; the 'categories' screen): pill search, the owner's banners, one featured piece, the collections one per row as full-width square cards
 * with index badges, and "The House". The brand row and profile button are in the top bar.
 */
export const Home: React.FC<KitProps<'Categories'>> = ({ categories, products, banners, isAdmin, onEditCategory, onNavigate, onFilterCategoryInCatalogue }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const slideCount = banners.length || merchant.promotions.length;
  const [searchQuery, setSearchQuery] = useState('');
  const hideBar = useHideOnScroll();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
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
        showToast('Link copied to clipboard');
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
  const contactLinks: Array<{ label: string; href: string; style: React.CSSProperties; icon: React.ReactNode }> = [
    { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}`, style: { background: 'var(--em-wa)', color: '#fff' }, icon: <MessageCircle size={22} /> },
    ...(contact.instagramUrl ? [{ label: 'Instagram', href: contact.instagramUrl, style: { background: 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)', color: '#fff' }, icon: <Instagram size={22} /> }] : []),
    ...(contact.facebookUrl ? [{ label: 'Facebook', href: contact.facebookUrl, style: { background: '#1877F2', color: '#fff' }, icon: <Facebook size={22} /> }] : []),
    ...(contact.youtubeUrl ? [{ label: 'YouTube', href: contact.youtubeUrl, style: { background: '#FF0000', color: '#fff' }, icon: <Youtube size={22} /> }] : []),
    ...(contact.address
      ? [{ label: contact.showroomLabel ?? 'Showroom', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`, style: { background: 'var(--em-primary)', color: 'var(--em-on-primary)' }, icon: <MapPin size={22} /> }]
      : [])
  ];

  const q = searchQuery.toLowerCase();
  const filteredCategories = categories.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  const purityOf = (cat: Category) => (cat.eligibleKarats?.length ? cat.eligibleKarats.map((k) => k.split(' ')[0]).join(' · ') : `avg ${cat.avgNetWt}`);

  return (
    <div className="em-page home">
      {toastMessage && <Toast>{toastMessage}</Toast>}

      <div className={`em-sticky${hideBar ? ' hide' : ''}`} style={{ borderBottom: 0 }}>
        <div className="em-pad" style={{ paddingTop: 4, paddingBottom: 8 }}>
          <label className="em-srch">
            <Icon n="search" />
            <input aria-label="Search the catalogue" placeholder="Search name, SKU or collection" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </label>
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
                    <button key={b.id} type="button" className="em-slide" disabled={!b.category} onClick={() => b.category && onFilterCategoryInCatalogue(b.category)} aria-label={b.category ? `Open ${b.category}` : `Banner ${i + 1}`}>
                      <Ph src={b.image} tone={i} className="em-fill" />
                      {b.category && (
                        <>
                          <span className="em-sc" />
                          <span className="em-ov">
                            <span className="em-ey g">Collection</span>
                            <span className="em-ser">{b.category}</span>
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
                        <span className="em-ey g">{promo.tag}</span>
                        <span className="em-ser">{promo.title}</span>
                        <p>{promo.subtitle}</p>
                        <button type="button" className="em-link" onClick={() => onFilterCategoryInCatalogue(promo.title)}>
                          {promo.actionLabel}
                          <Icon n="right" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
            </div>

            {slideCount > 1 && (
              <>
                {(['prev', 'next'] as const).map((dir) => (
                  <button key={dir} type="button" aria-label={dir === 'prev' ? 'Previous banner' : 'Next banner'} onClick={() => goToSlide(activeSlide + (dir === 'prev' ? -1 : 1))} className="em-circ f em-arrow" style={dir === 'prev' ? { left: 8 } : { right: 8 }}>
                    <Icon n={dir === 'prev' ? 'back' : 'next'} />
                  </button>
                ))}
                <div className="em-dots">
                  {Array.from({ length: slideCount }, (_, i) => (
                    <button key={i} type="button" aria-label={`Banner ${i + 1}`} aria-current={activeSlide === i ? 'true' : undefined} className={activeSlide === i ? 'on' : ''} onClick={() => goToSlide(i)} />
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

      <div className="em-pad" style={{ marginTop: 28 }}>
        <Title
          eyebrow="Curated"
          title="Collections"
          size="h2"
          right={
            <button type="button" className="em-link" onClick={() => onNavigate('catalogue')} style={{ marginBottom: 8 }}>
              All designs
              <Icon n="right" size={14} />
            </button>
          }
        />

        {filteredCategories.length === 0 && <p className="em-hint" style={{ textAlign: 'center', padding: '24px 0' }}>{categories.length === 0 ? 'No collections have been added yet.' : 'No collections match your search.'}</p>}

        <div className="em-grid em-grid-1" style={{ marginTop: 14 }}>
          {filteredCategories.map((cat, i) => (
            <div key={cat.id} className="em-sq">
              <button type="button" className="em-hit" aria-label={`Open ${cat.name}`} onClick={() => onFilterCategoryInCatalogue(cat.name)}>
                <Ph src={cat.image} tone={i} className="em-fill" />
                <span className="em-sc" />
                <span className="em-col-ov">
                  <span className="em-ey g">{purityOf(cat)}</span>
                  <span className="em-ser">{cat.name}</span>
                  <small>
                    {cat.designCount} {cat.designCount === 1 ? 'design' : 'designs'}
                  </small>
                </span>
              </button>
              <span className="em-idx em-ser" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              {isAdmin && (
                <button type="button" className="em-circ f em-opts" aria-label={`Options for ${cat.name}`} onClick={() => setMenuFor(cat)}>
                  <Icon n="more" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="em-pad" style={{ marginTop: 28 }}>
        <div className="em-house">
          <div className="em-ey g">The House</div>
          <p className="em-ser">{merchant.brand.description}</p>
          <button type="button" className="em-link" onClick={() => onNavigate('about')}>
            Visit about us
            <Icon n="right" size={14} />
          </button>
        </div>
      </div>

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

      {/* Floating contact menu: the owner's own WhatsApp, showroom and social pages (a link only appears once it is set in merchant.json) */}
      <div className="em-fab">
        {speedDialOpen &&
          contactLinks.map((link) => (
            <div key={link.label} className="em-fab-item animate-fade-in">
              <Pill tone="plum">{link.label}</Pill>
              <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} style={link.style}>
                {link.icon}
              </a>
            </div>
          ))}
        <button type="button" className="em-fab-btn" onClick={() => setSpeedDialOpen(!speedDialOpen)} aria-expanded={speedDialOpen} aria-label={speedDialOpen ? 'Close contact menu' : 'Contact us'}>
          <Icon n={speedDialOpen ? 'x' : 'chat'} size={22} />
        </button>
      </div>
    </div>
  );
};
