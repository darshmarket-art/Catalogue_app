import React, { useState } from 'react';
import { ActiveScreen, Category, Purity } from '../types';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';
import { PageTitle, Field, Notice, Chip, inputClass, btnPrimary, btnDanger } from './ui';

interface AddCategoryScreenProps {
  /** The purities the owner offers. */
  purityOptions: Purity[];
  /** The category being edited, or null when creating a new one. */
  editing: Category | null;
  onNavigate: (screen: ActiveScreen) => void;
  onSave: (category: Partial<Category>, id?: string) => Promise<boolean>;
  onDelete: (category: Category) => Promise<boolean>;
}

export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({ purityOptions, editing, onNavigate, onSave, onDelete }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? '');
  const [photos, setPhotos] = useState<PhotoItem[]>(editing ? [{ ref: editing.image, url: editing.image }] : []);
  const [uploading, setUploading] = useState(false);
  const [minWt, setMinWt] = useState(editing ? String(editing.minTargetWt) : '');
  const [maxWt, setMaxWt] = useState(editing ? String(editing.maxTargetWt) : '');
  const [purities, setPurities] = useState<string[]>(editing?.eligibleKarats ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const min = parseFloat(minWt);
  const max = parseFloat(maxWt);
  const problem = uploading
    ? 'Photo is uploading…'
    : photos.length === 0
      ? 'Add a photo for the category'
      : !name.trim()
        ? 'Enter a category name'
        : minWt && maxWt && min > max
          ? 'The minimum weight cannot be more than the maximum'
          : null;

  const togglePurity = (key: string) =>
    setPurities((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleCreate = async () => {
    if (problem) return;
    setSubmitting(true);
    const ok = await onSave(
      {
        name: name.trim(),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        image: photos[0].ref,
        ...(Number.isFinite(min) ? { minTargetWt: min } : {}),
        ...(Number.isFinite(max) ? { maxTargetWt: max } : {}),
        eligibleKarats: purities
      },
      editing?.id
    );
    if (ok) {
      setSuccess(true);
      setTimeout(() => onNavigate('categories'), 900);
    } else {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(`Delete the category "${editing.name}"? This cannot be undone.`)) return;
    setSubmitting(true);
    if (await onDelete(editing)) onNavigate('categories');
    else setSubmitting(false);
  };

  return (
    <div className="flex flex-col w-full pb-40 max-w-lg mx-auto">
      <PageTitle
        title={editing ? 'Edit collection' : 'New collection'}
        sub="Group your designs so buyers can browse them. The number of designs is counted from the products you add."
      />

      <div className="px-5 flex flex-col gap-5">
        {success && <Notice tone="ok">{editing ? 'Changes saved.' : 'Collection created.'}</Notice>}

        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[22px] text-primary">Photo</h2>
          <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="banner" />
        </section>

        <Field label="Collection name" htmlFor="ac-name">
          <input id="ac-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Temple Antique Haar" />
        </Field>

        <Field label="Short description (optional)" htmlFor="ac-sub">
          <input id="ac-sub" className={inputClass} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Nakshi work, Mayur motifs" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lightest piece (g)" htmlFor="ac-min">
            <input id="ac-min" className={inputClass} value={minWt} onChange={(e) => setMinWt(e.target.value)} inputMode="decimal" placeholder="—" />
          </Field>
          <Field label="Heaviest piece (g)" htmlFor="ac-max">
            <input id="ac-max" className={inputClass} value={maxWt} onChange={(e) => setMaxWt(e.target.value)} inputMode="decimal" placeholder="—" />
          </Field>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[22px] text-primary">Purities sold here</h2>
          <div className="flex flex-wrap gap-2">
            {purityOptions
              .filter((pu) => pu.enabled || purities.includes(pu.key))
              .map((pu) => (
                <Chip key={pu.key} active={purities.includes(pu.key)} onClick={() => togglePurity(pu.key)}>
                  {pu.title}
                </Chip>
              ))}
          </div>
        </section>

        {editing && (
          <button type="button" onClick={handleDelete} disabled={submitting} className={btnDanger}>
            Delete this collection
          </button>
        )}
      </div>

      <aside className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-outline-variant pb-safe">
        <div className="max-w-lg mx-auto px-5 py-3 flex flex-col gap-2">
          <span className={`font-sans text-sm font-bold ${problem ? 'text-outline' : 'text-success'}`}>{problem ?? (editing ? 'Ready to save' : 'Ready to create')}</span>
          <button type="button" disabled={submitting || problem !== null} onClick={handleCreate} className={btnPrimary}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create collection'}
          </button>
        </div>
      </aside>
    </div>
  );
};
