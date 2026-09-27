import React, { useState, useEffect } from 'react';
import { Category, ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { sector } from '../sector';

interface CategoriesScreenProps {
  categories: Category[];
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

export const CategoriesScreen: React.FC<CategoriesScreenProps> = ({
  categories,
  onNavigate: _onNavigate,
  onFilterCategoryInCatalogue
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-advance banner carousel every 6s
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % Math.max(merchant.promotions.length, 1));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const handleShareCategory = (cat: Category) => {
    const text = `*${merchant.brand.name.toUpperCase()}*\n${cat.name} — ${cat.designCount} designs (${cat.avgNetWt})\n${window.location.origin}`;
    openLink(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const handleShareCatalogue = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: merchant.brand.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Catalogue link copied to clipboard');
      }
    } catch {
      // the user closed the share sheet
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-36 max-w-4xl mx-auto px-4">
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

      {/* Promotional carousel (configured per merchant) */}
      {merchant.promotions.length > 0 && (
        <div className="relative w-full overflow-hidden rounded-xl bg-white border border-outline-variant/60 shadow-md my-2">
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {merchant.promotions.map((promo) => {
              const look = PROMO_LOOKS[promo.theme];
              return (
                <div
                  key={promo.title}
                  className={`min-w-full flex-shrink-0 relative overflow-hidden bg-gradient-to-r ${look.background} p-4 text-white`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`${look.tag} font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase shadow-xs`}
                    >
                      {promo.tag}
                    </span>
                    <span className={`font-mono text-[11px] ${look.stamp} font-bold flex items-center gap-1`}>
                      <span className="material-symbols-outlined text-[14px]">{promo.stampIcon}</span>
                      {promo.stampText}
                    </span>
                  </div>
                  <h4 className={`font-serif text-[18px] md:text-[20px] font-bold ${look.title} leading-tight tracking-tight`}>
                    {promo.title}
                  </h4>
                  <p className={`font-sans text-[12px] ${look.subtitle} opacity-90 mt-0.5 line-clamp-1`}>{promo.subtitle}</p>
                  <div className="mt-3 flex items-center justify-between">
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

          {/* Carousel Bottom Control Strip */}
          <div className="py-2 px-3 bg-surface-container flex items-center justify-between border-t border-outline-variant/50">
            <div className="flex items-center gap-1.5">
              {merchant.promotions.map((promo, i) => (
                <button
                  key={promo.title}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setActiveSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    activeSlide === i ? 'w-6 bg-primary' : 'w-2 bg-outline-variant'
                  }`}
                  type="button"
                />
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-primary">campaign</span>
              <span className="font-bold text-primary">{merchant.brand.name} Broadcast</span>
            </div>
          </div>
        </div>
      )}

      {/* Categories Cards Listing */}
      <div className="flex flex-col gap-3.5 my-2">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm border border-outline-variant/40 flex flex-col hover:shadow-md transition-all group"
          >
            {/* Visual Hero */}
            <div className="relative w-full h-40 bg-surface-container overflow-hidden">
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              {cat.eligibleKarats[0] && (
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="bg-white/95 backdrop-blur-md text-primary font-mono text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                    {cat.eligibleKarats[0]}
                  </span>
                </div>
              )}

              <div className="absolute bottom-2.5 left-3 right-3 text-white">
                <h3 className="font-serif text-[17px] font-bold leading-tight drop-shadow-sm">
                  {cat.name}
                </h3>
                <p className="font-sans text-[11px] text-white/80 line-clamp-1 drop-shadow-sm">
                  {cat.subtitle}
                </p>
              </div>
            </div>

            {/* Spec Matrix & Actions */}
            <div className="p-3 bg-surface-container-low flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="flex flex-col items-center justify-center py-1.5 px-3 bg-white border border-outline-variant/40 rounded-lg shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-outline font-semibold">
                    Designs
                  </span>
                  <span className="font-mono text-xs font-bold text-on-surface mt-0.5">
                    {cat.designCount} SKUs
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center py-1.5 px-3 bg-primary-fixed/30 border border-primary-fixed-dim/60 rounded-lg shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-primary font-semibold">
                    Avg Net Wt
                  </span>
                  <span className="font-mono text-xs font-bold text-primary mt-0.5">
                    {cat.avgNetWt}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onFilterCategoryInCatalogue(cat.name)}
                  className="flex-1 py-2 px-3 rounded-lg bg-secondary hover:bg-secondary-dark text-white text-xs font-sans font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">menu_book</span>
                  <span>View All {cat.designCount} Designs</span>
                </button>
                <button
                  onClick={() => handleShareCategory(cat)}
                  className="px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary text-xs font-sans font-semibold flex items-center gap-1 transition-colors"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  <span>Share PDF</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Speed Dial Connect Actions */}
      <div className="fixed bottom-[88px] right-3 z-40 flex flex-col items-end gap-2.5">
        {speedDialOpen && (
          <div className="flex flex-col items-end gap-2 transition-all duration-300 animate-fade-in">
            {/* WhatsApp */}
            <div className="flex items-center gap-2">
              <span className="bg-on-surface text-inverse-on-surface text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                WhatsApp Desk
              </span>
              <a
                href={`https://wa.me/${merchant.contact.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
              </a>
            </div>

            {/* Instagram */}
            {merchant.contact.instagramUrl && (
              <div className="flex items-center gap-2">
                <span className="bg-on-surface text-inverse-on-surface text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                  Instagram
                </span>
                <button
                  onClick={() => openLink(merchant.contact.instagramUrl!)}
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                </button>
              </div>
            )}

            {/* Facebook */}
            {merchant.contact.facebookUrl && (
              <div className="flex items-center gap-2">
                <span className="bg-on-surface text-inverse-on-surface text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                  Facebook
                </span>
                <button
                  onClick={() => openLink(merchant.contact.facebookUrl!)}
                  className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[20px]">group</span>
                </button>
              </div>
            )}

            {/* Location */}
            {merchant.contact.address && (
              <div className="flex items-center gap-2">
                <span className="bg-on-surface text-inverse-on-surface text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                  {merchant.contact.showroomLabel ?? 'Showroom'}
                </span>
                <button
                  onClick={() =>
                    openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(merchant.contact.address!)}`)
                  }
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-tertiary-dark text-white flex items-center justify-center shadow-xl border-2 border-primary-fixed-dim active:scale-95 transition-all ring-2 ring-primary/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[24px]">
            {speedDialOpen ? 'close' : 'support_agent'}
          </span>
        </button>
      </div>

      {/* Bottom White-Label Sticky Tray */}
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
            onClick={handleShareCatalogue}
            className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary-dark text-white text-[11px] font-sans font-bold flex items-center gap-1 active:scale-95 transition-transform whitespace-nowrap shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
            <span>Share to Retailer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
