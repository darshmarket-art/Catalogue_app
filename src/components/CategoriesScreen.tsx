import React, { useState, useEffect, useRef } from 'react';
import { Category, ActiveScreen, Banner, Product } from '../types';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { Facebook, Instagram, MapPin, MessageCircle, Youtube } from 'lucide-react';

interface CategoriesScreenProps {
  categories: Category[];
  products: Product[];
  banners: Banner[];
  isAdmin: boolean;
  onEditCategory: (category: Category) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onFilterCategoryInCatalogue: (categoryName: string) => void;
}

const PROMO_LOOKS = {
  gold: {
    background: 'from-on-surface via-on-tertiary-fixed to-on-surface',
    tag: 'bg-primary text-white',
    title: 'text-primary-fixed',
    subtitle: 'text-surface-container-highest',
    action: 'bg-primary-fixed/20 border border-primary-fixed-dim/60 text-primary-fixed hover:bg-primary-fixed/30 transition-colors'
  },
  green: {
    background: 'from-secondary-deep via-secondary to-secondary-deep',
    tag: 'bg-secondary-fixed text-on-secondary-fixed',
    title: 'text-white',
    subtitle: 'text-secondary-fixed-dim',
    action: 'bg-secondary-fixed text-on-secondary-fixed shadow-sm'
  },
  brown: {
    background: 'from-brown-darker via-brown-dark to-brown-darkest',
    tag: 'bg-primary-fixed text-on-tertiary-fixed',
    title: 'text-primary-fixed',
    subtitle: 'text-surface-container-highest',
    action: 'bg-primary-fixed/20 border border-primary-fixed-dim/60 text-primary-fixed'
  }
} as const;

const esc = (v: string | number) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Opens a print view of one category with the brand watermark; the browser's "Save as PDF" makes the file. */
function openCataloguePdf(cat: Category, products: Product[]) {
  const items = products.filter((p) => p.category === cat.name);
  const w = window.open('', '_blank');
  if (!w) return false;
  const cards = items
    .map(
      (p) => `<div class="c"><img src="${esc(new URL(p.image, window.location.origin).href)}"><b>${esc(p.title)}</b><span>${esc(p.sku)} · ${esc(p.purity)} · Net ${esc(p.netWt)}g</span></div>`
    )
    .join('');
  w.document.write(`<!doctype html><title>${esc(merchant.brand.name)} - ${esc(cat.name)}</title><style>
body{font-family:sans-serif;margin:16px}h1{font-size:20px}.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.c{break-inside:avoid;border:1px solid #ddd;padding:8px}.c img{width:100%;aspect-ratio:1;object-fit:cover}.c b,.c span{display:block;font-size:12px;margin-top:4px}
.w{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:700;color:rgba(113,85,9,.14);transform:rotate(-30deg);pointer-events:none;text-align:center}
</style><div class="w">${esc(merchant.brand.name.toUpperCase())}</div><h1>${esc(merchant.brand.name)} · ${esc(cat.name)} (${items.length} designs)</h1><div class="g">${cards}</div>
<script>onload=()=>setTimeout(()=>print(),600)</script>`);
  w.document.close();
  return true;
}

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  categories,
  products,
  banners,
  isAdmin,
  onEditCategory,
  onNavigate,
  onFilterCategoryInCatalogue
}) => {
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

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

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

  const handlePdf = (cat: Category) => {
    if (!openCataloguePdf(cat, products)) showToast('Allow pop-ups to create the PDF');
  };

  const { contact } = merchant;
  const contactLinks: Array<{ label: string; href: string; className: string; icon: React.ReactNode }> = [
    { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}`, className: 'bg-whatsapp text-on-whatsapp', icon: <MessageCircle size={22} /> },
    ...(contact.instagramUrl
      ? [{ label: 'Instagram', href: contact.instagramUrl, className: 'text-white bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]', icon: <Instagram size={22} /> }]
      : []),
    ...(contact.facebookUrl ? [{ label: 'Facebook', href: contact.facebookUrl, className: 'text-white bg-[#1877F2]', icon: <Facebook size={22} /> }] : []),
    ...(contact.youtubeUrl ? [{ label: 'YouTube', href: contact.youtubeUrl, className: 'text-white bg-[#FF0000]', icon: <Youtube size={22} /> }] : []),
    ...(contact.address
      ? [
          {
            label: contact.showroomLabel ?? 'Showroom',
            href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`,
            className: 'text-on-primary bg-primary',
            icon: <MapPin size={22} />
          }
        ]
      : [])
  ];

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-36 max-w-3xl mx-auto px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div role="status" className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-sm font-sans animate-fade-in">
          <span className="material-symbols-outlined text-success-container text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search & Sort Bar */}
      <div className="py-2 flex items-center gap-2 sticky top-[72px] z-20 bg-surface/95 backdrop-blur-md">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">
            search
          </span>
          <input
            aria-label="Search the catalogue" className="w-full h-[52px] pl-11 pr-3 bg-white rounded-2xl text-on-surface text-base font-sans border-[1.5px] border-outline-variant focus:outline-none focus:border-primary"
            placeholder="Search name, SKU or collection"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Banners: the owner's photos, or the default messages from merchant.json. Swipe, or use the arrows on desktop. */}
      {slideCount > 0 && (
        <div className="relative w-full my-2" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
          <div
            ref={scroller}
            onScroll={(e) => setActiveSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            onTouchStart={() => (paused.current = true)}
            onTouchEnd={() => (paused.current = false)}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-xl border border-outline-variant/60 shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden aspect-[16/9] sm:aspect-[2/1] md:aspect-[3/1]"
          >
            {banners.length > 0
              ? banners.map((b) => (
                  <img key={b.id} src={b.image} alt="" className="min-w-full h-full object-cover snap-center" referrerPolicy="no-referrer" />
                ))
              : merchant.promotions.map((promo) => {
                  const look = PROMO_LOOKS[promo.theme];
                  return (
                    <div
                      key={promo.title}
                      className={`min-w-full h-full snap-center flex flex-col justify-end gap-2 bg-gradient-to-r ${look.background} px-5 pt-4 pb-9 md:px-8 text-white`}
                    >
                      <span className={`self-start ${look.tag} font-sans text-xs px-2.5 py-1 rounded-full font-extrabold tracking-wide uppercase`}>{promo.tag}</span>
                      <h3 className={`font-serif text-[24px] md:text-[30px] ${look.title} leading-tight`}>{promo.title}</h3>
                      <p className={`font-sans text-sm md:text-base ${look.subtitle} line-clamp-2`}>{promo.subtitle}</p>
                      <button
                        onClick={() => onFilterCategoryInCatalogue(promo.title)}
                        className={`self-start min-h-11 px-4 rounded-xl ${look.action} text-sm font-extrabold`}
                      >
                        {promo.actionLabel}
                      </button>
                    </div>
                  );
                })}
          </div>

          {slideCount > 1 && (
            <>
              {(['prev', 'next'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  aria-label={dir === 'prev' ? 'Previous banner' : 'Next banner'}
                  onClick={() => goToSlide(activeSlide + (dir === 'prev' ? -1 : 1))}
                  className={`hidden md:flex absolute top-1/2 -translate-y-1/2 ${dir === 'prev' ? 'left-2' : 'right-2'} w-9 h-9 rounded-full bg-white/85 text-primary items-center justify-center shadow`}
                >
                  <span className="material-symbols-outlined text-[22px]">{dir === 'prev' ? 'chevron_left' : 'chevron_right'}</span>
                </button>
              ))}
              <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
                {Array.from({ length: slideCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Banner ${i + 1}`}
                    onClick={() => goToSlide(i)}
                    className={`h-1.5 rounded-full transition-all shadow ${activeSlide === i ? 'w-6 bg-primary' : 'w-2 bg-white/80'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Owner only: change the banners, or send the whole catalogue link to a buyer */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2 mb-1">
          <button type="button" onClick={() => onNavigate('admin-banners')} className="min-h-11 px-4 rounded-full border border-outline-variant bg-white text-sm font-sans font-extrabold text-primary">
            Change banners
          </button>
          <button type="button" onClick={() => shareLink(window.location.origin)} className="min-h-11 px-4 rounded-full border border-outline-variant bg-white text-sm font-sans font-extrabold text-primary">
            Share catalogue link
          </button>
        </div>
      )}

      {filteredCategories.length === 0 && (
        <p className="py-10 text-center font-sans text-xs text-outline">
          {categories.length === 0 ? 'No categories have been added yet.' : 'No categories match your search.'}
        </p>
      )}

      {/* Collections: one square each. One column on phones, two squares per row on larger screens. */}
      <h2 className="font-serif text-[22px] text-primary mt-3 mb-2">Collections</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="relative aspect-square rounded-3xl overflow-hidden bg-surface-container shadow-sm group">
            <img
              src={cat.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
            <button type="button" aria-label={`Open ${cat.name}`} onClick={() => onFilterCategoryInCatalogue(cat.name)} className="absolute inset-0 text-left">
              <span className="absolute bottom-4 left-5 right-5 text-white">
                <span className="block font-serif text-[26px] leading-tight drop-shadow line-clamp-2">{cat.name}</span>
                <span className="block font-sans text-sm font-semibold text-white/90 mt-1 drop-shadow">
                  {cat.designCount} {cat.designCount === 1 ? 'design' : 'designs'} · avg {cat.avgNetWt}
                </span>
              </span>
            </button>

            {isAdmin && (
              <button
                type="button"
                aria-label={`Options for ${cat.name}`}
                onClick={() => setMenuFor(cat)}
                className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-sm active:scale-95"
              >
                <span className="material-symbols-outlined text-[24px]">more_horiz</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Admin menu for one collection */}
      {menuFor && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Options for ${menuFor.name}`}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-scrim/50" onClick={() => setMenuFor(null)} />
          <div className="relative w-full max-w-md bg-surface rounded-t-3xl p-4 pb-6 animate-fade-in">
            <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-3" />
            <h3 className="font-serif text-[22px] text-primary mb-1">{menuFor.name}</h3>
            {[
              { label: 'Edit collection', note: 'Name, photo, weight range', icon: 'edit', run: () => onEditCategory(menuFor) },
              {
                label: 'Share link',
                note: 'Buyer signs in and lands on this collection',
                icon: 'link',
                run: () => shareLink(`${window.location.origin}/?category=${encodeURIComponent(menuFor.name)}`)
              },
              { label: 'Share as PDF', note: `All photos with the ${merchant.brand.name} watermark`, icon: 'picture_as_pdf', run: () => handlePdf(menuFor) }
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setMenuFor(null);
                  o.run();
                }}
                className="w-full flex items-center gap-3 py-3 border-t border-outline-variant text-left min-h-14"
              >
                <span className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[22px]">{o.icon}</span>
                </span>
                <span>
                  <span className="block font-sans text-[15px] font-extrabold text-on-surface">{o.label}</span>
                  <span className="block font-sans text-sm text-on-surface-variant">{o.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating contact menu: the owner's own WhatsApp, showroom and social pages (a link only appears once it is set in merchant.json) */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3">
        {speedDialOpen && (
          <div className="flex flex-col items-end gap-2 transition-all duration-300 animate-fade-in">
            {contactLinks.map((link) => (
              <div key={link.label} className="flex items-center gap-2">
                <span className="bg-on-surface text-inverse-on-surface text-sm font-bold px-3 py-1.5 rounded-xl shadow-md">{link.label}</span>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform ${link.className}`}
                >
                  {link.icon}
                </a>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          aria-expanded={speedDialOpen}
          aria-label={speedDialOpen ? 'Close contact menu' : 'Contact us'}
          className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-xl active:scale-95 transition-all"
          type="button"
        >
          <span className="material-symbols-outlined text-[24px]">{speedDialOpen ? 'close' : 'support_agent'}</span>
        </button>
      </div>
    </div>
  );
};
