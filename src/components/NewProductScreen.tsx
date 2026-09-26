import React, { useState } from 'react';
import { ActiveScreen, Category, Product } from '../types';

interface NewProductScreenProps {
  categories: Category[];
  onNavigate: (screen: ActiveScreen) => void;
  onProductCreated: (newProduct: Partial<Product>) => void;
}

export const NewProductScreen: React.FC<NewProductScreenProps> = ({
  categories,
  onNavigate,
  onProductCreated
}) => {
  const [sku, setSku] = useState('B2B-KND-9085');
  const [title, setTitle] = useState('Royal Heritage Kundan Choker with Zambian Drops');
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name || 'Bridal Chokers & Haar');
  const [grossWt, setGrossWt] = useState('48.700');
  const [stoneWt, setStoneWt] = useState('6.200');
  const [purity, setPurity] = useState<'22K 916' | '24K 999.9' | '18K 750' | '14K 585'>('22K 916');
  const [stockStatus, setStockStatus] = useState<'Ready in Vault' | 'Made-to-Order'>('Ready in Vault');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);

  // Dynamic Net Weight computation
  const grossNum = parseFloat(grossWt) || 0;
  const stoneNum = parseFloat(stoneWt) || 0;
  const netNum = Math.max(0, grossNum - stoneNum);

  const regenerateSku = () => {
    const letters = 'KND,TMP,KDA,NAV,JHM,POL'.split(',')[Math.floor(Math.random() * 6)];
    const num = Math.floor(1000 + Math.random() * 9000);
    setSku(`B2B-${letters}-${num}`);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    const newProd: Partial<Product> = {
      sku,
      title,
      category: selectedCategory,
      purity,
      grossWt: grossNum,
      stoneWt: stoneNum,
      netWt: parseFloat(netNum.toFixed(3)),
      stockStatus,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIsSLygqtbsznRrAdfmUnc8_R_QWPPR5vQhZP7zb_PCgoEKMjO3lzcvoL9aMEnweTS2dcfBxrXrgMCcOUO88C12QPI971NGCvM-ki5UXZ8AeU37Q5jzrK3Rb9gd5WO-MEFufGhGYkdKpgF0Mqj8lS5JruO-BsDiVDes_AnDmpKgGjDw4B0uCZIhXll1ySWRsw6LPaWpH70iEOthlECQEaRDjERq5L0TpW_abzycLbrFTb3vR2RaYN4',
      angles: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAIsSLygqtbsznRrAdfmUnc8_R_QWPPR5vQhZP7zb_PCgoEKMjO3lzcvoL9aMEnweTS2dcfBxrXrgMCcOUO88C12QPI971NGCvM-ki5UXZ8AeU37Q5jzrK3Rb9gd5WO-MEFufGhGYkdKpgF0Mqj8lS5JruO-BsDiVDes_AnDmpKgGjDw4B0uCZIhXll1ySWRsw6LPaWpH70iEOthlECQEaRDjERq5L0TpW_abzycLbrFTb3vR2RaYN4',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBAzPFuEg7p_K-UKncoJe9qLAWimHqHcTB4hsXjp4QQ_yLwuwxvKy0SXa-i_xyNYKq7zo9xVU_Ac67vz_YjV-1bZUFsvl-QL8n8OZDhtsjXM_fYi9WSlrK66yKlfKCzO8cIPN570E3QEwJysX1scrIB4UF-wwZ6LRxjL0wA2gsqksKJ69HB1OyuWDj_hNZbia0x7oMu1PKPHPHFe_4RegmepaJFOiXiDX9Kci5BhhgKcAQyCuYTUC4R',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuBkTLv3BP4JUA01VZAEG4RBAFuZ8PA0aPq3oJGiEPryaoVat4Qi_MA_7Whw-1U6LoXJISpW-OOan8z6zmnPAWRVwyl0HdmkmI4hnBGoCyQBnY8ojJJwapTLIsqSqrRsdo51djSTmK5JnaSW_uNsiL6F0alNUFpmsVVXhLXjZx1ZQoMOdAXFIKRLVXQNuQ2FNKMST3WGf1YAO4ZFi_t0cMsbPGuH4BSEAM4kTaN95ymI2FproTEcCpFa'
      ]
    };

    onProductCreated(newProd);
    setPublishedSuccess(true);
    setTimeout(() => {
      setIsPublishing(false);
      onNavigate('catalogue');
    }, 1200);
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      {publishedSuccess && (
        <div className="bg-[#c7e7d7] text-[#032017] p-3 rounded-lg text-xs font-sans border border-[#486458] flex items-center gap-1.5 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>Published to live B2B catalogue! Syncing catalogue cache...</span>
        </div>
      )}

      {/* Media Strip Section */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#7f7666] font-bold">
            Selected Angles (3/6)
          </span>
          <button
            type="button"
            className="font-sans text-xs text-[#715509] font-bold flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">tune</span>
            <span>Reorder</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {/* Angle 1 */}
          <div className="relative w-24 h-28 rounded-xl bg-[#f0edea] overflow-hidden shrink-0 shadow-sm border border-[#d1c5b3]/40">
            <img
              alt="Cover Angle"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIsSLygqtbsznRrAdfmUnc8_R_QWPPR5vQhZP7zb_PCgoEKMjO3lzcvoL9aMEnweTS2dcfBxrXrgMCcOUO88C12QPI971NGCvM-ki5UXZ8AeU37Q5jzrK3Rb9gd5WO-MEFufGhGYkdKpgF0Mqj8lS5JruO-BsDiVDes_AnDmpKgGjDw4B0uCZIhXll1ySWRsw6LPaWpH70iEOthlECQEaRDjERq5L0TpW_abzycLbrFTb3vR2RaYN4"
            />
            <div className="absolute top-1 left-1 bg-[#715509] text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              Cover
            </div>
            <div className="absolute bottom-1 right-1 bg-[#1c1c1a]/80 text-white w-5 h-5 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[13px]">360</span>
            </div>
          </div>

          {/* Angle 2 */}
          <div className="relative w-24 h-28 rounded-xl bg-[#f0edea] overflow-hidden shrink-0 shadow-sm border border-[#d1c5b3]/40">
            <img
              alt="Side 45"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBAzPFuEg7p_K-UKncoJe9qLAWimHqHcTB4hsXjp4QQ_yLwuwxvKy0SXa-i_xyNYKq7zo9xVU_Ac67vz_YjV-1bZUFsvl-QL8n8OZDhtsjXM_fYi9WSlrK66yKlfKCzO8cIPN570E3QEwJysX1scrIB4UF-wwZ6LRxjL0wA2gsqksKJ69HB1OyuWDj_hNZbia0x7oMu1PKPHPHFe_4RegmepaJFOiXiDX9Kci5BhhgKcAQyCuYTUC4R"
            />
            <div className="absolute top-1 left-1 bg-[#e5e2de] text-[#1c1c1a] font-mono text-[9px] font-bold px-1 py-0.5 rounded">
              Side 45°
            </div>
          </div>

          {/* Angle 3 */}
          <div className="relative w-24 h-28 rounded-xl bg-[#f0edea] overflow-hidden shrink-0 shadow-sm border border-[#d1c5b3]/40">
            <img
              alt="HUID Seal Macro"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBkTLv3BP4JUA01VZAEG4RBAFuZ8PA0aPq3oJGiEPryaoVat4Qi_MA_7Whw-1U6LoXJISpW-OOan8z6zmnPAWRVwyl0HdmkmI4hnBGoCyQBnY8ojJJwapTLIsqSqrRsdo51djSTmK5JnaSW_uNsiL6F0alNUFpmsVVXhLXjZx1ZQoMOdAXFIKRLVXQNuQ2FNKMST3WGf1YAO4ZFi_t0cMsbPGuH4BSEAM4kTaN95ymI2FproTEcCpFa"
            />
            <div className="absolute top-1 left-1 bg-[#e5e2de] text-[#1c1c1a] font-mono text-[9px] font-bold px-1 py-0.5 rounded">
              HUID Seal
            </div>
          </div>

          {/* Add Slot */}
          <button
            type="button"
            className="w-24 h-28 rounded-xl bg-[#f6f3ef] border border-dashed border-[#d1c5b3] flex flex-col items-center justify-center gap-1 text-[#7f7666] hover:bg-[#f0edea] active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[22px] text-[#715509]">add_a_photo</span>
            <span className="text-[10px] font-sans font-bold">Add Angle</span>
          </button>
        </div>
      </div>

      {/* Core SKU Metadata Card */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#7f7666] font-bold">
            Core SKU Metadata
          </span>
          <div className="flex items-center gap-1 bg-[#f0edea] px-2 py-0.5 rounded border border-[#d1c5b3]/40">
            <span className="font-mono text-xs font-semibold text-[#715509]">SKU: {sku}</span>
            <button
              type="button"
              onClick={regenerateSku}
              className="text-[#7f7666] hover:text-[#715509]"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-[#1c1c1a]">
            Product Title / Wholesale Heading
          </label>
          <input
            className="bg-[#f6f3ef] p-2.5 rounded-lg text-xs font-sans text-[#1c1c1a] border border-[#d1c5b3]/40 focus:outline-none focus:bg-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] uppercase tracking-wider text-[#7f7666] font-bold">
              Category
            </label>
            <button
              type="button"
              onClick={() => onNavigate('add-category')}
              className="text-[11px] font-sans text-[#715509] font-bold flex items-center gap-0.5 hover:underline"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add New Category</span>
            </button>
          </div>
          <div className="relative bg-[#f6f3ef] rounded-lg border border-[#d1c5b3]/40">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-transparent p-2.5 pr-8 text-xs font-sans text-[#1c1c1a] outline-none appearance-none cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined text-[18px] text-[#7f7666] absolute right-2.5 top-2.5 pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Weight & Bullion Breakdown */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[19px] text-[#715509]">scale</span>
            <span className="text-xs font-sans font-bold text-[#1c1c1a]">
              Weight & Bullion Breakdown
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#486458] font-bold bg-[#caeada]/50 px-2 py-0.5 rounded">
            Precision 0.001g
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-[#7f7666]">Gross Wt (g)</label>
            <div className="bg-[#f6f3ef] rounded-lg p-2 flex items-center justify-between border border-[#d1c5b3]/40">
              <input
                className="w-full bg-transparent font-mono text-sm font-bold text-[#1c1c1a] outline-none"
                value={grossWt}
                onChange={(e) => setGrossWt(e.target.value)}
              />
              <span className="font-mono text-xs text-[#7f7666]">g</span>
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-[#7f7666]">Stone / Tare (g)</label>
            <div className="bg-[#f6f3ef] rounded-lg p-2 flex items-center justify-between border border-[#d1c5b3]/40">
              <input
                className="w-full bg-transparent font-mono text-sm font-bold text-[#ba1a1a] outline-none"
                value={stoneWt}
                onChange={(e) => setStoneWt(e.target.value)}
              />
              <span className="font-mono text-xs text-[#7f7666]">g</span>
            </div>
          </div>
        </div>

        {/* Computed Net Weight Banner */}
        <div className="bg-[#ffdf9e]/30 rounded-lg p-2.5 flex items-center justify-between border border-[#e8c16f]/60">
          <span className="font-sans text-xs font-bold text-[#715509]">Computed Net Gold Weight:</span>
          <span className="font-mono text-base font-bold text-[#715509]">
            {netNum.toFixed(3)} g
          </span>
        </div>
      </div>

      {/* Purity & Hallmarking */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#7f7666] font-bold">
            Purity & Hallmarking
          </span>
          <span className="font-mono text-[10px] text-[#715509] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            Government Assay
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: '22K 916', title: '22K • 916', sub: 'Standard Luxury' },
            { key: '24K 999.9', title: '24K • 999', sub: 'Bullion Grade' },
            { key: '18K 750', title: '18K • 750', sub: 'Diamond Setting' },
            { key: '14K 585', title: '14K • 585', sub: 'Export Lightweight' }
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPurity(item.key as any)}
              className={`p-2.5 rounded-lg flex items-center justify-between text-left transition-all border ${
                purity === item.key
                  ? 'bg-[#715509] text-white border-[#715509] shadow-xs'
                  : 'bg-[#f6f3ef] text-[#1c1c1a] border-[#d1c5b3]/40 hover:bg-[#ebe8e4]'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold">{item.title}</span>
                <span className={`text-[10px] ${purity === item.key ? 'text-white/80' : 'text-[#7f7666]'}`}>
                  {item.sub}
                </span>
              </div>
              {purity === item.key && (
                <span className="material-symbols-outlined text-[17px] text-white">check_circle</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory & Merchant Access */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-[#d1c5b3]/40 flex flex-col space-y-3 mb-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#7f7666] font-bold">
            Inventory & Merchant Access
          </span>
          <span className="w-2 h-2 rounded-full bg-[#486458]"></span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStockStatus('Ready in Vault')}
            className={`p-2.5 rounded-lg flex flex-col text-left transition-all border ${
              stockStatus === 'Ready in Vault'
                ? 'bg-[#c7e7d7] text-[#032017] border-[#486458]'
                : 'bg-[#f6f3ef] text-[#7f7666] border-[#d1c5b3]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-bold">Ready in Vault</span>
              <span className="material-symbols-outlined text-[16px]">verified</span>
            </div>
            <span className="text-[10px] font-mono mt-0.5">Dispatch in 24 Hrs</span>
          </button>

          <button
            type="button"
            onClick={() => setStockStatus('Made-to-Order')}
            className={`p-2.5 rounded-lg flex flex-col text-left transition-all border ${
              stockStatus === 'Made-to-Order'
                ? 'bg-[#c7e7d7] text-[#032017] border-[#486458]'
                : 'bg-[#f6f3ef] text-[#7f7666] border-[#d1c5b3]/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-bold">Made-to-Order</span>
              <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
            </div>
            <span className="text-[10px] font-mono mt-0.5">14 Days Lead</span>
          </button>
        </div>
      </div>

      {/* Sticky Bottom Publish Bar */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-[#d1c5b3]/40 shadow-xl">
        <div className="max-w-lg mx-auto h-18 px-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#7f7666]">Status</span>
            <span className="font-mono text-xs font-bold text-[#486458] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#486458]"></span>
              Ready to Verify
            </span>
          </div>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex-1 h-11 rounded-lg bg-[#486458] hover:bg-[#3a5247] text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            <span>{isPublishing ? 'Publishing...' : 'Publish to Live Catalogue'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
