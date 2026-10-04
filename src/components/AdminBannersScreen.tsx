import React, { useState } from 'react';
import type { Banner, Category } from '../types';
import { I, Photo } from './ui';
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

/** Home banners (artboard 3.7): one card per banner, in the order buyers swipe through them. */
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

  const collectionSelect = (id: string, value: string, onChange: (v: string) => void, extra?: string | null) => (
    <div>
      <label className="lab" htmlFor={id}>
        Opens collection (optional)
      </label>
      <select id={id} className="inp" style={{ height: 46 }} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Nothing, just a picture</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
        {extra && !categories.some((c) => c.name === extra) && <option value={extra}>{extra}</option>}
      </select>
    </div>
  );

  return (
    <div className="scroll" style={{ gap: 12 }}>
      <p className="sub">Photos shown at the top of your buyers' home, in this order. Use a wide photo. Banner photos count toward your photo limit.</p>

      {banners.map((b, i) => (
        <div key={b.id} className="card col" style={{ gap: 10 }}>
          <Photo src={b.image} tone={i} style={{ height: 110 }} />
          {collectionSelect(`banner-${b.id}`, b.category ?? '', (v) => onLink(b, v || null), b.category)}
          <div className="row">
            <button type="button" className="ib" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>
              <I n="back" style={{ transform: 'rotate(90deg)' }} />
            </button>
            <button type="button" className="ib" aria-label="Move later" disabled={i === banners.length - 1} onClick={() => move(i, 1)}>
              <I n="back" style={{ transform: 'rotate(-90deg)' }} />
            </button>
            <span className="grow" />
            <button type="button" className="btn sm alt danger" onClick={() => askDelete(b)} aria-label={confirming === b.id ? 'Tap again to remove this banner' : 'Remove banner'}>
              {confirming === b.id ? 'Tap again' : 'Remove'}
            </button>
          </div>
        </div>
      ))}

      <div className="card col" style={{ gap: 10 }}>
        <PhotoPicker photos={photos} onChange={setPhotos} max={1} onBusyChange={setUploading} tile="banner" />
        {photos.length > 0 && (
          <>
            {collectionSelect('banner-new-link', newLink, setNewLink)}
            <button type="button" className="btn" disabled={uploading || saving} onClick={add}>
              {uploading ? 'Photo is uploading…' : saving ? 'Adding…' : 'Add banner'}
            </button>
          </>
        )}
      </div>
      {banners.length === 0 && <p className="hint">With no banners, buyers see the default messages.</p>}
    </div>
  );
};
