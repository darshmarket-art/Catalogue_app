import React, { useState } from 'react';
import { ActiveScreen, Category, Product } from '../types';
import { sector } from '../sector';

interface NewProductScreenProps {
  categories: Category[];
  onNavigate: (screen: ActiveScreen) => void;
  onProductCreated: (newProduct: Partial<Product>) => Promise<boolean>;
}

const inputBox =
  'bg-surface-container-low p-2.5 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white';

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

export const NewProductScreen: React.FC<NewProductScreenProps> = ({ categories, onNavigate, onProductCreated }) => {
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [grossWt, setGrossWt] = useState('');
  const [stoneWt, setStoneWt] = useState('');
  const [purity, setPurity] = useState('');
  const [huid, setHuid] = useState('');
  const [makingCharge, setMakingCharge] = useState('');
  const [price, setPrice] = useState('');
  const [stockStatus, setStockStatus] = useState(sector.stockStatuses[0].key);
  const [imageUrl, setImageUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState(false);

  const gross = parseFloat(grossWt);
  const stone = parseFloat(stoneWt) || 0;
  const net = Number.isFinite(gross) ? Math.max(0, gross - stone) : null;

  const problem = !title.trim()
    ? 'Enter a product title'
    : !category
      ? 'Choose a category'
      : !purity
        ? 'Choose the purity'
        : !(gross > 0)
          ? 'Enter the gross weight'
          : stone >= gross
            ? 'Stone weight must be less than gross weight'
            : imageUrl.trim() && !isHttpUrl(imageUrl.trim())
              ? 'The photo link must start with http:// or https://'
              : null;

  const handlePublish = async () => {
    if (problem) return;
    setIsPublishing(true);
    const num = (v: string) => (v.trim() === '' ? undefined : parseFloat(v));
    const ok = await onProductCreated({
      title: title.trim(),
      ...(sku.trim() ? { sku: sku.trim() } : {}),
      category,
      purity,
      grossWt: gross,
      stoneWt: stone,
      ...(huid.trim() ? { huid: huid.trim() } : {}),
      ...(num(makingCharge) !== undefined ? { makingChargePerGram: num(makingCharge) } : {}),
      ...(num(price) !== undefined ? { priceEstimate: num(price) } : {}),
      stockStatus,
      ...(imageUrl.trim() ? { image: imageUrl.trim() } : {})
    });
    if (ok) {
      setPublishedSuccess(true);
      setTimeout(() => onNavigate('catalogue'), 900);
    } else {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      {publishedSuccess && (
        <div className="bg-secondary-container text-on-secondary-fixed p-3 rounded-lg text-xs font-sans border border-secondary flex items-center gap-1.5 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>Published to the live catalogue.</span>
        </div>
      )}

      {/* Photo */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">Photo</span>
        <div className="flex gap-3 items-start">
          <div className="w-24 h-28 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant/40 flex items-center justify-center">
            {isHttpUrl(imageUrl.trim()) ? (
              <img alt="Preview" className="w-full h-full object-cover" src={imageUrl.trim()} referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-[28px] text-outline">add_a_photo</span>
            )}
          </div>
          <div className="flex flex-col space-y-1 flex-1 min-w-0">
            <label className="text-xs font-sans font-semibold text-on-surface">Photo link (optional)</label>
            <input
              className={inputBox}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
            <p className="text-[11px] font-sans text-outline leading-snug">
              Uploading photos from your phone is coming soon. Until then, paste a link to the photo. Products without a
              photo show a grey placeholder.
            </p>
          </div>
        </div>
      </div>

      {/* Core details */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">Product details</span>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">
            Title <span className="text-primary">*</span>
          </label>
          <input className={inputBox} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Antique Temple Necklace" />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">SKU (optional)</label>
          <input
            className={`${inputBox} font-mono`}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Leave blank to generate one"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-sans font-semibold text-on-surface">
              Category <span className="text-primary">*</span>
            </label>
            <button
              type="button"
              onClick={() => onNavigate('add-category')}
              className="text-[11px] font-sans text-primary font-bold flex items-center gap-0.5 hover:underline"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add New Category</span>
            </button>
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputBox}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weights */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[19px] text-primary">scale</span>
          <span className="text-xs font-sans font-bold text-on-surface">Weight</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-outline">
              Gross weight (g) <span className="text-primary">*</span>
            </label>
            <input className={`${inputBox} font-mono`} value={grossWt} onChange={(e) => setGrossWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-outline">Stone / tare (g)</label>
            <input className={`${inputBox} font-mono`} value={stoneWt} onChange={(e) => setStoneWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
          </div>
        </div>

        <div className="bg-primary-fixed/30 rounded-lg p-2.5 flex items-center justify-between border border-primary-fixed-dim/60">
          <span className="font-sans text-xs font-bold text-primary">Net weight</span>
          <span className="font-mono text-base font-bold text-primary">{net === null ? '—' : `${net.toFixed(3)} g`}</span>
        </div>
      </div>

      {/* Purity & hallmark */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">
          Purity <span className="text-primary">*</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {sector.purities.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPurity(item.key)}
              className={`p-2.5 rounded-lg flex items-center justify-between text-left transition-all border ${
                purity === item.key
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container-high'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold">{item.title}</span>
                <span className={`text-[10px] ${purity === item.key ? 'text-white/80' : 'text-outline'}`}>{item.sub}</span>
              </div>
              {purity === item.key && <span className="material-symbols-outlined text-[17px] text-white">check_circle</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">HUID / hallmark number (optional)</label>
          <input className={`${inputBox} font-mono`} value={huid} onChange={(e) => setHuid(e.target.value)} placeholder="Only if this piece carries one" />
        </div>
      </div>

      {/* Pricing (optional) */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">Pricing (optional)</span>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-outline">Making charge per gram</label>
            <input className={`${inputBox} font-mono`} value={makingCharge} onChange={(e) => setMakingCharge(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
          <div className="flex flex-col space-y-1">
            <label className="text-[11px] font-sans text-outline">Price estimate</label>
            <input className={`${inputBox} font-mono`} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="—" />
          </div>
        </div>
      </div>

      {/* Stock */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3 mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-outline font-bold">Availability</span>
        <div className="grid grid-cols-2 gap-2">
          {sector.stockStatuses.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStockStatus(s.key)}
              className={`p-2.5 rounded-lg flex items-center justify-between text-left transition-all border ${
                stockStatus === s.key
                  ? 'bg-secondary-container text-on-secondary-fixed border-secondary'
                  : 'bg-surface-container-low text-outline border-outline-variant/40'
              }`}
            >
              <span className="text-xs font-sans font-bold">{s.key}</span>
              <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Publish bar */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-outline-variant/40 shadow-xl">
        <div className="max-w-lg mx-auto h-18 px-4 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-mono uppercase tracking-wider text-outline">Status</span>
            <span className={`font-mono text-xs font-bold flex items-center gap-1 ${problem ? 'text-outline' : 'text-secondary'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${problem ? 'bg-outline-variant' : 'bg-secondary'}`}></span>
              <span className="truncate">{problem ?? 'Ready to publish'}</span>
            </span>
          </div>

          <button
            onClick={handlePublish}
            disabled={isPublishing || problem !== null}
            className="flex-1 h-11 rounded-lg bg-secondary hover:bg-secondary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            <span>{isPublishing ? 'Publishing...' : 'Publish to Catalogue'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
