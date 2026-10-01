import React, { useState } from 'react';
import type { Banner } from '../types';
import { PhotoPicker, type PhotoItem } from './PhotoPicker';

interface Props {
  banners: Banner[];
  onAdd: (image: string) => Promise<boolean>;
  onDelete: (banner: Banner) => Promise<void>;
}

export const AdminBannersScreen: React.FC<Props> = ({ banners, onAdd, onDelete }) => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    if (await onAdd(photos[0].ref)) setPhotos([]);
    setSaving(false);
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl md:max-w-3xl mx-auto px-4 pt-3 space-y-4">
      <div>
        <h2 className="font-serif text-[22px] font-bold text-on-surface">Home banners</h2>
        <p className="font-sans text-xs text-outline leading-relaxed">
          Buyers swipe through these on the Catalogue home. Use a wide photo (about 3:1); it is cropped to fit phones and desktops. With no banners, the default messages show.
        </p>
      </div>

      <section className="bg-white rounded-xl p-4 shadow-xs border border-outline-variant/40 flex flex-col gap-3">
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="banner" />
        <button
          type="button"
          disabled={photos.length === 0 || uploading || saving}
          onClick={add}
          className="w-full py-3 bg-secondary hover:bg-secondary-dark disabled:opacity-40 text-white rounded-lg text-xs font-sans font-bold"
        >
          {uploading ? 'Photo is uploading…' : saving ? 'Adding…' : 'Add banner'}
        </button>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        {banners.map((b) => (
          <div key={b.id} className="relative rounded-xl overflow-hidden border border-outline-variant/40 aspect-[3/1] bg-surface-container">
            <img src={b.image} alt="Banner" className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label="Delete banner"
              onClick={() => window.confirm('Delete this banner?') && onDelete(b)}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-white/95 text-error text-[11px] font-bold flex items-center gap-1 shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
