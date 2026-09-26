import React, { useState, useEffect } from 'react';
import { Category, ActiveScreen } from '../types';

interface CategoriesScreenProps {
  categories: Category[];
  onNavigate: (screen: ActiveScreen) => void;
  onFilterCategoryInCatalogue: (categoryName: string) => void;
}

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
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShareCategory = (cat: Category) => {
    showToast(`Curated "${cat.name}" (${cat.designCount} Designs | ${cat.avgNetWt}) ready for WhatsApp Share!`);
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full pb-36 max-w-4xl mx-auto px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1c1c1a] text-[#fcf9f5] px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-sans border border-[#8c6d23]/40 animate-fade-in">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search & Sort Bar */}
      <div className="py-2.5 flex items-center gap-2 sticky top-16 z-20 bg-[#fcf9f5]/95 backdrop-blur-md">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#7f7666] text-[20px]">
            search
          </span>
          <input
            className="w-full pl-10 pr-24 py-2.5 bg-[#f6f3ef] rounded-lg text-[#1c1c1a] text-xs font-sans border border-[#d1c5b3]/40 focus:outline-none focus:bg-white transition-all shadow-xs"
            placeholder="Search 22K, 18K, Polki, Diamond or Bullion..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-1.5 top-1.5 flex items-center">
            <button
              onClick={() => showToast('Categories sorted by Vault Popularity')}
              className="px-2 py-1 bg-[#f0edea] rounded text-[#4d4638] text-[11px] font-sans font-semibold flex items-center gap-1 hover:bg-[#ebe8e4]"
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">tune</span>
              <span>Sort</span>
            </button>
          </div>
        </div>
      </div>

      {/* Promotional Carousel Banner (Pure Gram Settlement) */}
      <div className="relative w-full overflow-hidden rounded-xl bg-white border border-[#d1c5b3]/60 shadow-md my-2">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {/* Slide 1 */}
          <div className="min-w-full flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-[#1c1c1a] via-[#261a00] to-[#1c1c1a] p-4 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="bg-[#715509] text-white font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase shadow-xs">
                Festive Wholesale Window
              </span>
              <span className="font-mono text-[11px] text-[#e8c16f] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                BIS 916 Standard
              </span>
            </div>
            <h4 className="font-serif text-[18px] md:text-[20px] font-bold text-[#ffdf9e] leading-tight tracking-tight">
              Akshaya Tritiya Pre-Booking
            </h4>
            <p className="font-sans text-[12px] text-[#e5e2de] opacity-90 mt-0.5 line-clamp-1">
              Guaranteed vault allocations • Pure fine gold net gram settlement
            </p>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => onFilterCategoryInCatalogue('Bridal')}
                className="px-2.5 py-1 rounded bg-[#ffdf9e]/20 border border-[#e8c16f]/60 text-[#ffdf9e] text-[11px] font-semibold flex items-center gap-1 hover:bg-[#ffdf9e]/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">local_offer</span>
                Explore Pre-Book Lots
              </button>
              <span className="font-mono text-[11px] text-[#e5e2de]">Limited 150 kg Allocation</span>
            </div>
          </div>

          {/* Slide 2 */}
          <div className="min-w-full flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-[#1b2b23] via-[#486458] to-[#1b2b23] p-4 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="bg-[#caeada] text-[#032017] font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase shadow-xs">
                Jaipur Karigar Direct
              </span>
              <span className="font-mono text-[11px] text-[#caeada] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">award_star</span>
                Certified Uncut
              </span>
            </div>
            <h4 className="font-serif text-[18px] md:text-[20px] font-bold text-white leading-tight tracking-tight">
              Exclusive Bridal Kundan Lots 2026
            </h4>
            <p className="font-sans text-[12px] text-[#aecebe] opacity-90 mt-0.5 line-clamp-1">
              Syndicate Polki master sets • 22K 916 BIS with Basra seed pearls
            </p>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => showToast('Jaipur Kundan Line-Sheet PDF download initiated!')}
                className="px-2.5 py-1 rounded bg-[#caeada] text-[#032017] text-[11px] font-semibold flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                Download Line-Sheet
              </button>
              <span className="font-mono text-[11px] text-[#aecebe]">Wholesale Export Lots</span>
            </div>
          </div>

          {/* Slide 3 */}
          <div className="min-w-full flex-shrink-0 relative overflow-hidden bg-gradient-to-r from-[#2e2613] via-[#3d2e0b] to-[#241a05] p-4 text-white">
            <div className="flex items-center justify-between mb-1.5">
              <span className="bg-[#ffdf9e] text-[#261a00] font-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider uppercase shadow-xs">
                Assay Refinery Minted
              </span>
              <span className="font-mono text-[11px] text-[#e8c16f] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">scale</span>
                999.9 Fine Bars
              </span>
            </div>
            <h4 className="font-serif text-[18px] md:text-[20px] font-bold text-[#ffdf9e] leading-tight tracking-tight">
              Minted 24K 999.9 Bullion Coins
            </h4>
            <p className="font-sans text-[12px] text-[#e5e2de] opacity-90 mt-0.5 line-clamp-1">
              Tamper-proof blister packs 1g to 100g • Certified fine gold net weights
            </p>
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => onFilterCategoryInCatalogue('Bullion')}
                className="px-2.5 py-1 rounded bg-[#ffdf9e]/20 border border-[#e8c16f]/60 text-[#ffdf9e] text-[11px] font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">scale</span>
                Select Gram Lots
              </button>
              <span className="font-mono text-[11px] text-[#e5e2de]">Ready Dispatch Stock</span>
            </div>
          </div>
        </div>

        {/* Carousel Bottom Control Strip */}
        <div className="py-2 px-3 bg-[#f0edea] flex items-center justify-between border-t border-[#d1c5b3]/50">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setActiveSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  activeSlide === i ? 'w-6 bg-[#715509]' : 'w-2 bg-[#d1c5b3]'
                }`}
                type="button"
              />
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#4d4638]">
            <span className="material-symbols-outlined text-[14px] text-[#715509]">campaign</span>
            <span className="font-bold text-[#715509]">Wholesale Guild Broadcast</span>
          </div>
        </div>
      </div>

      {/* Categories Cards Listing */}
      <div className="flex flex-col gap-3.5 my-2">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#d1c5b3]/40 flex flex-col hover:shadow-md transition-all group"
          >
            {/* Visual Hero */}
            <div className="relative w-full h-40 bg-[#f0edea] overflow-hidden">
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span className="bg-white/95 backdrop-blur-md text-[#715509] font-mono text-[10px] px-2 py-0.5 rounded font-bold shadow-sm">
                  {cat.eligibleKarats[0] || '22K 916 BIS'}
                </span>
              </div>

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
            <div className="p-3 bg-[#f6f3ef] flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="flex flex-col items-center justify-center py-1.5 px-3 bg-white border border-[#d1c5b3]/40 rounded-lg shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-[#7f7666] font-semibold">
                    Designs
                  </span>
                  <span className="font-mono text-xs font-bold text-[#1c1c1a] mt-0.5">
                    {cat.designCount} SKUs
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center py-1.5 px-3 bg-[#ffdf9e]/30 border border-[#e8c16f]/60 rounded-lg shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-[#715509] font-semibold">
                    Avg Net Wt
                  </span>
                  <span className="font-mono text-xs font-bold text-[#715509] mt-0.5">
                    {cat.avgNetWt}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onFilterCategoryInCatalogue(cat.name)}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#486458] hover:bg-[#3a5247] text-white text-xs font-sans font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">menu_book</span>
                  <span>View All {cat.designCount} Designs</span>
                </button>
                <button
                  onClick={() => handleShareCategory(cat)}
                  className="px-3 py-2 rounded-lg bg-[#ebe8e4] hover:bg-[#e5e2de] text-[#715509] text-xs font-sans font-semibold flex items-center gap-1 transition-colors"
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
              <span className="bg-[#1c1c1a] text-[#f3f0ec] text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                WhatsApp Desk
              </span>
              <a
                href="https://wa.me/912223408899"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
              </a>
            </div>

            {/* Instagram */}
            <div className="flex items-center gap-2">
              <span className="bg-[#1c1c1a] text-[#f3f0ec] text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                Instagram Showcase
              </span>
              <button
                onClick={() => showToast('Opening Bhakti Jewels Instagram Showcase')}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              </button>
            </div>

            {/* Facebook Guild */}
            <div className="flex items-center gap-2">
              <span className="bg-[#1c1c1a] text-[#f3f0ec] text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                Facebook Guild
              </span>
              <button
                onClick={() => showToast('Connecting to Jewellers Guild Network')}
                className="w-10 h-10 rounded-full bg-[#1877F2] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">group</span>
              </button>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2">
              <span className="bg-[#1c1c1a] text-[#f3f0ec] text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-md">
                Zaveri Bazaar Showroom
              </span>
              <button
                onClick={() => showToast('Zaveri Bazaar, Kalbadevi, Mumbai 400002')}
                className="w-10 h-10 rounded-full bg-[#715509] text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px]">pin_drop</span>
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setSpeedDialOpen(!speedDialOpen)}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-[#715509] to-[#5b4300] text-white flex items-center justify-center shadow-xl border-2 border-[#e8c16f] active:scale-95 transition-all ring-2 ring-[#715509]/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[24px]">
            {speedDialOpen ? 'close' : 'support_agent'}
          </span>
        </button>
      </div>

      {/* Bottom White-Label Sticky Tray */}
      <div className="fixed bottom-16 inset-x-0 z-30 px-4 pb-2 pointer-events-none max-w-lg mx-auto">
        <div className="pointer-events-auto bg-[#1c1c1a]/95 backdrop-blur-xl text-white p-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-[#8c6d23]/40">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded bg-[#715509] text-white flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[19px]">share</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-[11px] font-bold text-white truncate">
                Share White-Label Catalogues
              </span>
              <span className="font-mono text-[9px] text-[#e5e2de] truncate">
                Pure gram weights • Custom store branding
              </span>
            </div>
          </div>
          <button
            onClick={() => showToast('White-Label catalogue link copied with your custom retail branding!')}
            className="px-3 py-1.5 rounded-lg bg-[#486458] hover:bg-[#3a5247] text-white text-[11px] font-sans font-bold flex items-center gap-1 active:scale-95 transition-transform whitespace-nowrap shadow-sm"
          >
            <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
            <span>Share to Retailer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
