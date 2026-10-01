import React, { useState } from 'react';
import { ActiveScreen, Category, Product, Purity } from '../types';
import { sector } from '../sector';
import { merchant } from '../merchant';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';
import { PageTitle, Field, Notice, Chip, inputClass, btnPrimary, btnDanger, btnLink } from './ui';

interface NewProductScreenProps {
  categories: Category[];
  /** The purities the owner offers. */
  purities: Purity[];
  /** The product being edited, or null when adding a new one. */
  editing: Product | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSave: (product: Partial<Product>, id?: string) => Promise<boolean>;
  onDelete: (product: Product) => Promise<boolean>;
}

export const NewProductScreen: React.FC<NewProductScreenProps> = ({ categories, purities, editing, onNavigate, onSave, onDelete }) => {
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
    <div className="flex flex-col w-full pb-40 max-w-lg mx-auto">
      <PageTitle title={editing ? 'Edit design' : 'New design'} />

      <div className="px-5 flex flex-col gap-5">
        {saved && <Notice tone="ok">{editing ? 'Changes saved.' : 'Published to the live catalogue.'}</Notice>}

        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[22px] text-primary">Photos</h2>
          <PhotoPicker photos={photos} onChange={setPhotos} max={3} onBusyChange={setUploading} />
        </section>

        <Field label="Design name" htmlFor="np-title">
          <input id="np-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Antique Temple Necklace" />
        </Field>

        <Field label={`SKU ${editing ? '' : '(optional)'}`} htmlFor="np-sku">
          <input id="np-sku" className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Leave blank to generate one" />
        </Field>

        <Field label="Collection" htmlFor="np-category">
          <select id="np-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="">Select a collection</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onNavigate('add-category')} className={`${btnLink} self-start -ml-3`}>
            + Add a new collection
          </button>
        </Field>

        <Field label="Purity" htmlFor="np-purity" hint="The list comes from Admin, Purity options.">
          <select id="np-purity" className={inputClass} value={purity} onChange={(e) => setPurity(e.target.value)}>
            <option value="">Choose the purity</option>
            {purities
              .filter((pu) => pu.enabled || pu.key === editing?.purity)
              .map((pu) => (
                <option key={pu.key} value={pu.key}>
                  {pu.title}
                </option>
              ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gross weight (g)" htmlFor="np-gross">
            <input id="np-gross" className={inputClass} value={grossWt} onChange={(e) => setGrossWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
          </Field>
          <Field label="Stone or tare (g)" htmlFor="np-stone">
            <input id="np-stone" className={inputClass} value={stoneWt} onChange={(e) => setStoneWt(e.target.value)} inputMode="decimal" placeholder="0.000" />
          </Field>
        </div>
        <div className="flex items-baseline justify-between rounded-2xl bg-primary-fixed px-4 py-3">
          <span className="font-sans text-[15px] font-extrabold text-primary">Net weight</span>
          <span className="font-serif text-[26px] text-primary">{net === null ? '—' : `${net.toFixed(3)} g`}</span>
        </div>

        <Field label="HUID or hallmark number (optional)" htmlFor="np-huid">
          <input id="np-huid" className={inputClass} value={huid} onChange={(e) => setHuid(e.target.value)} placeholder="Only if this piece carries one" />
        </Field>

        {merchant.productFields.map((field) => (
          <Field key={field.key} label={`${field.label}${field.unit ? ` (${field.unit})` : ''}${field.required ? ' *' : ''}`} htmlFor={`np-${field.key}`}>
            {field.type === 'select' ? (
              <select id={`np-${field.key}`} className={inputClass} value={extra[field.key] ?? ''} onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })}>
                <option value="">Select</option>
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`np-${field.key}`}
                className={inputClass}
                value={extra[field.key] ?? ''}
                inputMode={field.type === 'number' ? 'decimal' : 'text'}
                onChange={(e) => setExtra({ ...extra, [field.key]: e.target.value })}
              />
            )}
          </Field>
        ))}

        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[22px] text-primary">Availability</h2>
          <div className="flex flex-wrap gap-2">
            {sector.stockStatuses.map((st) => (
              <Chip key={st.key} active={stockStatus === st.key} onClick={() => setStockStatus(st.key)}>
                {st.key}
              </Chip>
            ))}
          </div>
        </section>

        {editing && (
          <button type="button" onClick={handleDelete} disabled={isSaving} className={btnDanger}>
            Delete this design
          </button>
        )}
      </div>

      {/* Publish bar */}
      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-outline-variant pb-safe">
        <div className="max-w-lg mx-auto px-5 py-3 flex flex-col gap-2">
          <span className={`font-sans text-sm font-bold ${problem ? 'text-outline' : 'text-success'}`}>{problem ?? (editing ? 'Ready to save' : 'Ready to publish')}</span>
          <button onClick={handleSave} disabled={isSaving || problem !== null} className={btnPrimary} type="button">
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'List in catalogue'}
          </button>
        </div>
      </aside>
    </div>
  );
};
