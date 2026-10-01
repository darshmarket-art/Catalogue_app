import React, { useState } from 'react';
import { ActiveScreen, Category, Product } from '../types';
import { sector } from '../sector';
import { merchant } from '../merchant';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';

interface NewProductScreenProps {
  categories: Category[];
  /** The product being edited, or null when adding a new one. */
  editing: Product | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSave: (product: Partial<Product>, id?: string) => Promise<boolean>;
  onDelete: (product: Product) => Promise<boolean>;
}

const inputBox =
  'bg-surface-container-low p-2.5 rounded-lg text-xs font-sans text-on-surface border border-outline-variant/40 focus:outline-none focus:bg-white';

const card = 'bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col space-y-3';
const cardTitle = 'font-mono text-[10px] uppercase tracking-wider text-outline font-bold';

export const NewProductScreen: React.FC<NewProductScreenProps> = ({ categories, editing, onNavigate, onSave, onDelete }) => {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [sku, setSku] = useState(editing?.sku ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [grossWt, setGrossWt] = useState(editing ? String(editing.grossWt) : '');
  const [stoneWt, setStoneWt] = useState(editing?.stoneWt ? String(editing.stoneWt) : '');
  const [purity, setPurity] = useState(editing?.purity ?? '');
  const [huid, setHuid] = useState(editing?.huid ?? '');
  const [stockStatus, setStockStatus] = useState(editing?.stockStatus ?? sector.stockStatuses[0].key);
  const [photos, setPhotos] = useState<PhotoItem[]>(editing ? editing.images.map((url) => ({ ref: url, url })) : []);
  const [extra, setExtra] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(editing?.extra ?? {}).map(([k, v]) => [k, String(v)]))
  );
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const gross = parseFloat(grossWt);
  const stone = parseFloat(stoneWt) || 0;
  const net = Number.isFinite(gross) ? Math.max(0, gross - stone) : null;
  const missingExtra = merchant.productFields.find((f) => f.required && !(extra[f.key] ?? '').trim());

  const problem = uploading
    ? 'Photo is uploading…'
    : photos.length === 0
      ? 'Add at least one photo'
      : !title.trim()
        ? 'Enter a product title'
        : !category
          ? 'Choose a category'
          : !purity
            ? 'Choose the purity'
            : !(gross > 0)
              ? 'Enter the gross weight'
              : stone >= gross
                ? 'Stone weight must be less than gross weight'
                : missingExtra
                  ? `Enter ${missingExtra.label}`
                  : null;

  const handleSave = async () => {
    if (problem) return;
    setIsSaving(true);
    const extraOut = Object.fromEntries(Object.entries(extra).filter(([, v]) => v.trim() !== ''));
    const ok = await onSave(
      {
        title: title.trim(),
        ...(sku.trim() ? { sku: sku.trim() } : {}),
        category,
        purity,
        grossWt: gross,
        stoneWt: stone,
        ...(huid.trim() ? { huid: huid.trim() } : {}),
        stockStatus,
        images: photos.map((p) => p.ref),
        extra: extraOut
      } as Partial<Product>,
      editing?.id
    );
    if (ok) {
      setSaved(true);
      setTimeout(() => onNavigate('catalogue'), 900);
    } else {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`Delete "${editing.title}" from the catalogue? This cannot be undone.`)) return;
    setIsSaving(true);
    if (await onDelete(editing)) onNavigate('catalogue');
    else setIsSaving(false);
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-lg mx-auto px-4 pt-3 space-y-4">
      {saved && (
        <div className="bg-secondary-container text-on-secondary-fixed p-3 rounded-lg text-xs font-sans border border-secondary flex items-center gap-1.5 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">done_all</span>
          <span>{editing ? 'Changes saved.' : 'Published to the live catalogue.'}</span>
        </div>
      )}

      {/* Photos */}
      <div className={card}>
        <span className={cardTitle}>
          Photos <span className="text-primary">*</span>
        </span>
        <PhotoPicker photos={photos} onChange={setPhotos} max={3} onBusyChange={setUploading} />
      </div>

      {/* Core details */}
      <div className={card}>
        <span className={cardTitle}>Product details</span>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">
            Title <span className="text-primary">*</span>
          </label>
          <input className={inputBox} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Antique Temple Necklace" />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-sans font-semibold text-on-surface">SKU {editing ? '' : '(optional)'}</label>
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
      <div className={card}>
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
      <div className={card}>
        <span className={cardTitle}>
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

      {/* Merchant-defined details */}
      {merchant.productFields.length > 0 && (
        <div className={card}>
          <span className={cardTitle}>More details</span>
          {merchant.productFields.map((field) => (
            <div key={field.key} className="flex flex-col space-y-1">
              <label className="text-xs font-sans font-semibold text-on-surface">
                {field.label}
                {field.unit ? ` (${field.unit})` : ''} {field.required && <span className="text-primary">*</span>}
              </label>
              {field.type === 'select' ? (
                <select className={inputBox} value={extra[field.key] ?? ''} onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })}>
                  <option value="">Select</option>
                  {field.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={inputBox}
                  value={extra[field.key] ?? ''}
                  inputMode={field.type === 'number' ? 'decimal' : 'text'}
                  onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stock */}
      <div className={`${card} mb-2`}>
        <span className={cardTitle}>Availability</span>
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

      {editing && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSaving}
          className="w-full py-2.5 rounded-lg border border-error/40 text-error font-sans text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-error-container/40 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
          <span>Delete this product</span>
        </button>
      )}

      {/* Publish bar */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-outline-variant/40 shadow-xl">
        <div className="max-w-lg mx-auto h-18 px-4 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-mono uppercase tracking-wider text-outline">Status</span>
            <span className={`font-mono text-xs font-bold flex items-center gap-1 ${problem ? 'text-outline' : 'text-secondary'}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${problem ? 'bg-outline-variant' : 'bg-secondary'}`}></span>
              <span className="truncate">{problem ?? (editing ? 'Ready to save' : 'Ready to publish')}</span>
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || problem !== null}
            className="flex-1 h-11 rounded-lg bg-secondary hover:bg-secondary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">{editing ? 'save' : 'publish'}</span>
            <span>{isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Publish to Catalogue'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
