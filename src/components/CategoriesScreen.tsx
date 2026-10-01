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
    stamp: 'text-primary-fixed-dim',
    title: 'text-primary-fixed',
    subtitle: 'text-surface-container-highest',
    action: 'bg-primary-fixed/20 border border-primary-fixed-dim/60 text-primary-fixed hover:bg-primary-fixed/30 transition-colors',
    note: 'text-surface-container-highest'
  },
  green: {
    background: 'from-secondary-deep via-secondary to-secondary-deep',
    tag: 'bg-secondary-fixed text-on-secondary-fixed',
    stamp: 'text-secondary-fixed',
    title: 'text-white',
    subtitle: 'text-secondary-fixed-dim',
    action: 'bg-secondary-fixed text-on-secondary-fixed shadow-sm',
    note: 'text-secondary-fixed-dim'
  },
  brown: {
    background: 'from-brown-darker via-brown-dark to-brown-darkest',
    tag: 'bg-primary-fixed text-on-tertiary-fixed',
    stamp: 'text-primary-fixed-dim',
    title: 'text-primary-fixed',
    subtitle: 'text-surface-container-highest',
    action: 'bg-primary-fixed/20 border border-primary-fixed-dim/60 text-primary-fixed',
    note: 'text-surface-container-highest'
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
    { label: 'WhatsApp', href: `https://wa.me/${contact.whatsapp}`, className: 'bg-[#25D366]', icon: <MessageCircle size={22} /> },
    ...(contact.instagramUrl
      ? [{ label: 'Instagram', href: contact.instagramUrl, className: 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]', icon: <Instagram size={22} /> }]
      : []),
    ...(contact.facebookUrl ? [{ label: 'Facebook', href: contact.facebookUrl, className: 'bg-[#1877F2]', icon: <Facebook size={22} /> }] : []),
    ...(contact.youtubeUrl ? [{ label: 'YouTube', href: contact.youtubeUrl, className: 'bg-[#FF0000]', icon: <Youtube size={22} /> }] : []),
    ...(contact.address
      ? [
          {
            label: contact.showroomLabel ?? 'Showroom',
            href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`,
            className: 'bg-primary',
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
    <div className="flex flex-col w-full pb-36 max-w-5xl mx-auto px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface text-surface px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-sans border border-primary-container/40 animate-fade-in">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search & Sort Bar */}
      <div className="py-2.5 flex items-center gap-2 sticky top-16 z-20 bg-surface/95 backdrop-blur-md">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[20px]">
            search
          </span>
          <input
            className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low rounded-lg text-on-surface text-xs font-sans border border-outline-variant/40 focus:outline-none focus:bg-white transition-all shadow-xs"
            placeholder={sector.copy.categorySearchPlaceholder}
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
                      className={`min-w-full h-full snap-center flex flex-col justify-between bg-gradient-to-r ${look.background} p-4 md:px-8 text-white`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`${look.tag} font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase`}>{promo.tag}</span>
                        <span className={`font-mono text-[11px] ${look.stamp} font-bold flex items-center gap-1`}>
                          <span className="material-symbols-outlined text-[14px]">{promo.stampIcon}</span>
                          {promo.stampText}
                        </span>
                      </div>
                      <div>
                        <h4 className={`font-serif text-[18px] md:text-[26px] font-bold ${look.title} leading-tight`}>{promo.title}</h4>
                        <p className={`font-sans text-[12px] md:text-sm ${look.subtitle} opacity-90 mt-0.5 line-clamp-2`}>{promo.subtitle}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onFilterCategoryInCatalogue(promo.title)}
                          className={`px-2.5 py-1 rounded ${look.action} text-[11px] font-semibold flex items-center gap-1`}
                        >
                          <span className="material-symbols-outlined text-[15px]">{promo.actionIcon}</span>
                          {promo.actionLabel}
                        </button>
                        <span className={`font-mono text-[11px] ${look.note}`}>{promo.note}</span>
                      </div>
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

      {isAdmin && (
        <button type="button" onClick={() => onNavigate('admin-banners')} className="self-start text-[11px] font-sans font-bold text-primary flex items-center gap-1 mb-1">
          <span className="material-symbols-outlined text-[15px]">edit</span>Change banners
        </button>
      )}

      {filteredCategories.length === 0 && (
        <p className="py-10 text-center font-sans text-xs text-outline">
          {categories.length === 0 ? 'No categories have been added yet.' : 'No categories match your search.'}
        </p>
      )}

      {/* Category tiles: square photo, name and numbers over its lower half so the jewellery stays visible */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 my-2">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="relative aspect-square rounded-xl overflow-hidden bg-surface-container shadow-sm border border-outline-variant/40 group">
            <img
              src={cat.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
            <button
              type="button"
              aria-label={`Open ${cat.name}`}
              onClick={() => onFilterCategoryInCatalogue(cat.name)}
              className="absolute inset-0 text-left"
            >
              <span className="absolute bottom-2.5 left-3 right-3 text-white">
                <span className="block font-serif text-[15px] md:text-[17px] font-bold leading-tight drop-shadow line-clamp-2">{cat.name}</span>
                <span className="block font-mono text-[10px] md:text-[11px] text-white/85 mt-0.5 drop-shadow">
                  {cat.designCount} SKUs · avg {cat.avgNetWt}
                </span>
              </span>
            </button>

            {cat.eligibleKarats[0] && (
              <span className="absolute top-2 left-2 bg-white/95 text-primary font-mono text-[10px] px-2 py-0.5 rounded font-bold shadow-sm pointer-events-none">
                {cat.eligibleKarats[0]}
              </span>
            )}

            {isAdmin && (
              <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                {[
                  { label: 'Edit', icon: 'edit', run: () => onEditCategory(cat) },
                  { label: 'Share link', icon: 'link', run: () => shareLink(`${window.location.origin}/?category=${encodeURIComponent(cat.name)}`) },
                  { label: 'Share PDF', icon: 'picture_as_pdf', run: () => handlePdf(cat) }
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    aria-label={`${a.label}: ${cat.name}`}
                    title={a.label}
                    onClick={a.run}
                    className="w-8 h-8 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-sm active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[17px]">{a.icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating contact menu: the owner's own WhatsApp, showroom and social pages (a link only appears once it is set in merchant.json) */}
      <div className="fixed bottom-[88px] right-3 z-40 flex flex-col items-end gap-2.5">
        {speedDialOpen && (
          <div className="flex flex-col items-end gap-2 transition-all duration-300 animate-fade-in">
            {contactLinks.map((link) => (
              <div key={link.label} className="flex items-center gap-2">
                <span className="bg-on-surface text-inverse-on-surface text-xs font-semibold px-2.5 py-1 rounded-md shadow-md">{link.label}</span>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className={`w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform ${link.className}`}
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
          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-tertiary-dark text-white flex items-center justify-center shadow-xl border-2 border-primary-fixed-dim active:scale-95 transition-all ring-2 ring-primary/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[24px]">{speedDialOpen ? 'close' : 'support_agent'}</span>
        </button>
      </div>

      {/* Owner only: send the catalogue link to a buyer */}
      {isAdmin && (
      <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2 pointer-events-none max-w-lg mx-auto">
        <div className="pointer-events-auto bg-on-surface/95 backdrop-blur-xl text-white p-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-primary-container/40">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[19px]">share</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-[11px] font-bold text-white truncate">
                Share Catalogue Link
              </span>
              <span className="font-mono text-[9px] text-surface-container-highest truncate">
                {merchant.brand.name} • Members portal
              </span>
            </div>
          </div>
          <button
            onClick={() => shareLink(window.location.origin)}
            className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary-dark text-white text-[11px] font-sans font-bold flex items-center gap-1 active:scale-95 transition-transform whitespace-nowrap shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
            <span>Share to Retailer</span>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
