import React, { useState, useEffect, useRef } from 'react';
import { Category, ActiveScreen, Banner, Product } from '../types';
import { downloadCataloguePdf } from '../cataloguePdf';
import { merchant } from '../merchant';
import { Facebook, Instagram, MapPin, MessageCircle, Youtube } from 'lucide-react';
import { I, Photo, Sheet, Toast } from './ui';

interface CategoriesScreenProps {
  categories: Category[];
  products: Product[];
  banners: Banner[];
  isAdmin: boolean;
  onEditCategory: (category: Category) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onFilterCategoryInCatalogue: (categoryName: string) => void;
}

/** Home (artboard 2.2): search, the banner, then the collections two by two. */
export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({ categories, products, banners, isAdmin, onEditCategory, onNavigate, onFilterCategoryInCatalogue }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const slideCount = banners.length || merchant.promotions.length;
  const [searchQuery, setSearchQuery] = useState('');
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
    { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}`, style: { background: 'var(--wa)', color: '#fff' }, icon: <MessageCircle size={22} /> },
    ...(contact.instagramUrl ? [{ label: 'Instagram', href: contact.instagramUrl, style: { background: 'linear-gradient(45deg,#f09433,#dc2743,#bc1888)', color: '#fff' }, icon: <Instagram size={22} /> }] : []),
    ...(contact.facebookUrl ? [{ label: 'Facebook', href: contact.facebookUrl, style: { background: '#1877F2', color: '#fff' }, icon: <Facebook size={22} /> }] : []),
    ...(contact.youtubeUrl ? [{ label: 'YouTube', href: contact.youtubeUrl, style: { background: '#FF0000', color: '#fff' }, icon: <Youtube size={22} /> }] : []),
    ...(contact.address
      ? [
          {
            label: contact.showroomLabel ?? 'Showroom',
            href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`,
            style: { background: 'var(--plum)', color: 'var(--on-plum)' },
            icon: <MapPin size={22} />
          }
        ]
      : [])
  ];

  const q = searchQuery.toLowerCase();
  const filteredCategories = categories.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  const purityOf = (cat: Category) => (cat.eligibleKarats?.length ? cat.eligibleKarats.map((k) => k.split(' ')[0]).join(', ') : `avg ${cat.avgNetWt}`);

  return (
    <div className="scroll wide" style={{ gap: 16, maxWidth: 760 }}>
      {toastMessage && (
        <Toast>
          <I n="check" size="s" />
          {toastMessage}
        </Toast>
      )}

      <div className="inp-icon">
        <I n="search" />
        <input aria-label="Search the catalogue" className="inp" style={{ borderRadius: 16 }} placeholder="Search name, SKU or collection" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {/* Banners: the owner's photos, or the default messages from merchant.json. Swipe, or use the arrows on desktop. */}
      {slideCount > 0 && (
        <div className="relative" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
          <div
            ref={scroller}
            onScroll={(e) => setActiveSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            onTouchStart={() => (paused.current = true)}
            onTouchEnd={() => (paused.current = false)}
            className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ borderRadius: 24, boxShadow: 'var(--sh-2)' }}
          >
            {banners.length > 0
              ? banners.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!b.category}
                    onClick={() => b.category && onFilterCategoryInCatalogue(b.category)}
                    aria-label={b.category ? `Open ${b.category}` : `Banner ${i + 1}`}
                    className="min-w-full snap-center p-0 border-0 bg-transparent text-left"
                  >
                    <Photo src={b.image} style={{ height: 196, borderRadius: 0 }}>
                      {b.category && (
                        <>
                          <div className="shade" />
                          <div className="over col" style={{ left: 18, right: 18, bottom: 16, gap: 6, color: '#fff7ea' }}>
                            <span className="pro" style={{ alignSelf: 'flex-start' }}>
                              Collection
                            </span>
                            <h2 style={{ fontSize: 27, lineHeight: 1.05, color: '#fff7ea' }}>{b.category}</h2>
                          </div>
                        </>
                      )}
                    </Photo>
                  </button>
                ))
              : merchant.promotions.map((promo) => (
                  <div key={promo.title} className="hero min-w-full snap-center col" style={{ minHeight: 196, borderRadius: 0, gap: 8, justifyContent: 'flex-end', padding: '20px 20px 30px' }}>
                    <span className="pro" style={{ alignSelf: 'flex-start' }}>
                      {promo.tag}
                    </span>
                    <h2 style={{ fontSize: 26, lineHeight: 1.05 }}>{promo.title}</h2>
                    <p className="sub" style={{ fontSize: 13.5 }}>
                      {promo.subtitle}
                    </p>
                    <button type="button" className="lnk" style={{ color: '#e2c389', alignSelf: 'flex-start', minHeight: 32 }} onClick={() => onFilterCategoryInCatalogue(promo.title)}>
                      {promo.actionLabel}
                      <I n="chev" size="s" />
                    </button>
                  </div>
                ))}
          </div>

          {slideCount > 1 && (
            <>
              {(['prev', 'next'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  aria-label={dir === 'prev' ? 'Previous banner' : 'Next banner'}
                  onClick={() => goToSlide(activeSlide + (dir === 'prev' ? -1 : 1))}
                  className={`ib hidden md:inline-flex absolute top-1/2 -translate-y-1/2 ${dir === 'prev' ? 'left-2' : 'right-2'}`}
                  style={{ width: 36, height: 36, zIndex: 3 }}
                >
                  <I n={dir === 'prev' ? 'back' : 'chev'} size="s" />
                </button>
              ))}
              <div className="absolute inset-x-0 flex justify-center gap-1.5" style={{ bottom: 10, zIndex: 3 }}>
                {Array.from({ length: slideCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Banner ${i + 1}`}
                    onClick={() => goToSlide(i)}
                    style={{ height: 5, width: activeSlide === i ? 20 : 6, borderRadius: 9, border: 0, padding: 0, background: activeSlide === i ? '#e2c389' : 'rgb(255 255 255 / 0.7)', transition: 'width .25s' }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Owner only: change the banners, or send the whole catalogue link to a buyer */}
      {isAdmin && (
        <div className="chips">
          <button type="button" className="chip" onClick={() => onNavigate('admin-banners')}>
            <I n="image" size="s" />
            Change banners
          </button>
          <button type="button" className="chip" onClick={() => shareLink(window.location.origin)}>
            <I n="link" size="s" />
            Share catalogue link
          </button>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-end', marginTop: 4 }}>
        <div className="grow">
          <span className="eyebrow">Browse</span>
          <h2 style={{ fontSize: 24, marginTop: 2 }}>Collections</h2>
        </div>
        <button type="button" className="lnk" style={{ minHeight: 36 }} onClick={() => onNavigate('catalogue')}>
          All designs
        </button>
      </div>

      {filteredCategories.length === 0 && <p className="hint" style={{ textAlign: 'center', padding: '24px 0' }}>{categories.length === 0 ? 'No collections have been added yet.' : 'No collections match your search.'}</p>}

      <div className="grid2 md:!grid-cols-3">
        {filteredCategories.map((cat, i) => (
          <div key={cat.id} className="card col" style={{ gap: 8, padding: '8px 8px 12px', position: 'relative' }}>
            <button type="button" aria-label={`Open ${cat.name}`} onClick={() => onFilterCategoryInCatalogue(cat.name)} className="col" style={{ gap: 8, border: 0, padding: 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
              <Photo src={cat.image} tone={i} style={{ height: 104, borderRadius: 14, width: '100%' }} />
              <div style={{ padding: '0 6px' }}>
                <b>{cat.name}</b>
                <p className="sub" style={{ fontSize: 12.5 }}>
                  {cat.designCount} {cat.designCount === 1 ? 'design' : 'designs'} · {purityOf(cat)}
                </p>
              </div>
            </button>
            {isAdmin && (
              <button type="button" className="ib" aria-label={`Options for ${cat.name}`} onClick={() => setMenuFor(cat)} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, zIndex: 3 }}>
                <I n="more" size="s" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Admin menu for one collection */}
      {menuFor && (
        <Sheet label={`Options for ${menuFor.name}`} onClose={() => setMenuFor(null)}>
          <h2 style={{ fontSize: 24 }}>{menuFor.name}</h2>
          <div className="card" style={{ padding: '2px 16px' }}>
            {[
              { label: 'Edit collection', note: 'Name, photo, weight range', icon: 'edit', run: () => onEditCategory(menuFor) },
              { label: 'Share link', note: 'Buyer signs in and lands on this collection', icon: 'link', run: () => shareLink(`${window.location.origin}/?category=${encodeURIComponent(menuFor.name)}`) },
              { label: 'Share as PDF', note: `All photos with the ${merchant.brand.name} watermark`, icon: 'file', run: () => handlePdf(menuFor) }
            ].map((o, i) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setMenuFor(null);
                  o.run();
                }}
                className="row"
                style={{ width: '100%', padding: '12px 0', border: 0, borderTop: i ? '1px solid var(--line-s)' : 0, background: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              >
                <span className="tag gold" style={{ width: 36, height: 36, justifyContent: 'center', padding: 0, borderRadius: 11 }}>
                  <I n={o.icon} size="s" />
                </span>
                <span className="grow">
                  <b>{o.label}</b>
                  <span className="sub" style={{ display: 'block', fontSize: 13.5 }}>
                    {o.note}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Floating contact menu: the owner's own WhatsApp, showroom and social pages (a link only appears once it is set in merchant.json) */}
      <div className="fixed right-4 z-40 flex flex-col items-end gap-3" style={{ bottom: 'calc(96px + var(--sab))' }}>
        {speedDialOpen && (
          <div className="flex flex-col items-end gap-2 animate-fade-in">
            {contactLinks.map((link) => (
              <div key={link.label} className="flex items-center gap-2">
                <span className="tag" style={{ background: 'var(--plum-d)', color: 'var(--on-plum)', fontSize: 13, padding: '6px 10px' }}>
                  {link.label}
                </span>
                <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="flex items-center justify-center" style={{ ...link.style, width: 48, height: 48, borderRadius: 16, boxShadow: 'var(--sh-2)' }}>
                  {link.icon}
                </a>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setSpeedDialOpen(!speedDialOpen)} aria-expanded={speedDialOpen} aria-label={speedDialOpen ? 'Close contact menu' : 'Contact us'} className="mark" style={{ width: 56, height: 56, borderRadius: 18, border: 0 }}>
          <I n={speedDialOpen ? 'x' : 'support'} />
        </button>
      </div>
    </div>
  );
};
