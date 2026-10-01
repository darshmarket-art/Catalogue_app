import React, { useState } from 'react';
import type { Banner } from '../types';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';

interface Props {
  banners: Banner[];
  onAdd: (image: string) => Promise<boolean>;
  onDelete: (banner: Banner) => Promise<void>;
  /** Saves the new first-to-last order. */
  onReorder: (ids: string[]) => Promise<void>;
}

export const AdminBannersScreen: React.FC<Props> = ({ banners, onAdd, onDelete, onReorder }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // A banner is deleted on the second tap, so no browser pop-up is needed.
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    if (await onAdd(photos[0].ref)) setPhotos([]);
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
          Buyers swipe through these on the Catalogue home, in the order shown here. Use a wide photo (about 3:1); it is cropped to fit phones and desktops. With no banners, the default messages show.
        </p>
      </div>

      <section className="bg-white rounded-2xl p-4 border border-outline-variant flex flex-col gap-3">
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="banner" />
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
          <div key={b.id} className="relative rounded-2xl overflow-hidden border border-outline-variant aspect-[3/1] bg-surface-container">
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
        ))}
      </div>
    </div>
  );
};
