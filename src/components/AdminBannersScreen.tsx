import React, { useState } from 'react';
import type { Banner, Category } from '../types';
import { Field, inputClass } from './ui';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';

interface Props {
  banners: Banner[];
  /** The collections a banner can open. */
  categories: Category[];
  /** Changes which collection a banner opens (null: none). */
  onLink: (banner: Banner, category: string | null) => Promise<void>;
  onAdd: (image: string, category?: string) => Promise<boolean>;
  onDelete: (banner: Banner) => Promise<void>;
  /** Saves the new first-to-last order. */
  onReorder: (ids: string[]) => Promise<void>;
}

export const AdminBannersScreen: React.FC<Props> = ({ banners, categories, onLink, onAdd, onDelete, onReorder }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLink, setNewLink] = useState('');
  // A banner is deleted on the second tap, so no browser pop-up is needed.
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    if (await onAdd(photos[0].ref, newLink || undefined)) {
      setPhotos([]);
      setNewLink('');
    }
    setSaving(false);
  };

  const move = (index: number, delta: number) => {
    const ids = banners.map((b) => b.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(ids);
  };

  const askDelete = (banner: Banner) => {
    if (confirming === banner.id) {
      setConfirming(null);
      onDelete(banner);
      return;
    }
    setConfirming(banner.id);
    setTimeout(() => setConfirming((c) => (c === banner.id ? null : c)), 3000);
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl md:max-w-3xl mx-auto px-4 pt-3 space-y-4">
      <div>
        <h2 className="font-serif text-[26px] text-primary leading-tight">Home banners</h2>
        <p className="font-sans text-sm text-on-surface-variant leading-relaxed mt-1">
          Buyers swipe through these on the Catalogue home, in the order shown here. A banner can open one of your collections when a buyer taps it. Use a wide photo (about 3:1); it is cropped to fit phones and desktops. With no banners, the default messages show.
        </p>
      </div>

      <section className="bg-white rounded-2xl p-4 border border-outline-variant flex flex-col gap-3">
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="banner" />
        <Field label="Opens collection (optional)" htmlFor="banner-new-link">
          <select id="banner-new-link" className={inputClass} value={newLink} onChange={(e) => setNewLink(e.target.value)}>
            <option value="">Nothing, just a picture</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          disabled={photos.length === 0 || uploading || saving}
          onClick={add}
          className="w-full h-12 bg-secondary hover:bg-secondary-dark disabled:opacity-40 text-white rounded-2xl text-sm font-sans font-extrabold"
        >
          {uploading ? 'Photo is uploading…' : saving ? 'Adding…' : 'Add banner'}
        </button>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {banners.map((b, i) => (
          <div key={b.id} className="flex flex-col gap-2">
          <div className="relative rounded-2xl overflow-hidden border border-outline-variant aspect-[3/1] bg-surface-container">
            <img src={b.image} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label={confirming === b.id ? 'Tap again to delete this banner' : 'Delete banner'}
              onClick={() => askDelete(b)}
              className="absolute top-2 right-2 h-9 px-3 rounded-full bg-white/95 text-error text-xs font-extrabold flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              {confirming === b.id ? 'Tap again to delete' : 'Delete'}
            </button>
            <div className="absolute bottom-2 left-2 flex gap-1.5">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="w-10 h-10 rounded-xl bg-white/95 text-primary flex items-center justify-center disabled:opacity-40">
                <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
              </button>
              <button type="button" aria-label="Move later" disabled={i === banners.length - 1} onClick={() => move(i, 1)} className="w-10 h-10 rounded-xl bg-white/95 text-primary flex items-center justify-center disabled:opacity-40">
                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 font-sans text-sm font-bold text-on-surface-variant">
            <span className="whitespace-nowrap">Opens</span>
            <select
              aria-label={`Collection that banner ${i + 1} opens`}
              className="flex-1 min-w-0 h-11 bg-white border-[1.5px] border-outline-variant rounded-xl px-3 font-sans text-sm font-bold text-on-surface focus:outline-none focus:border-primary"
              value={b.category ?? ''}
              onChange={(e) => onLink(b, e.target.value || null)}
            >
              <option value="">Nothing</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {b.category && !categories.some((c) => c.name === b.category) && <option value={b.category}>{b.category}</option>}
            </select>
          </label>
          </div>
        ))}
      </div>
    </div>
  );
};
