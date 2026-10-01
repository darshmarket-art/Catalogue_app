import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';

/** A photo on a form: `ref` is what gets saved, `url` is what is shown. */
export interface PhotoItem {
  ref: string;
  url: string;
}

interface PhotoPickerProps {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max: number;
  /** Reports whether any photo is still uploading, so the form can hold back its save button. */
  onBusyChange?: (busy: boolean) => void;
  /** Shape of the preview tiles. */
  tile?: 'square' | 'banner';
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024;

export const PhotoPicker: React.FC<PhotoPickerProps> = ({ photos, onChange, max, onBusyChange, tile = 'square' }) => {
  const [uploading, setUploading] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const nextId = useRef(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onBusyChange?.(uploading.length > 0);
  }, [uploading.length]);

  const room = max - photos.length - uploading.length;

  const upload = async (file: File) => {
    const id = nextId.current++;
    setUploading((prev) => [...prev, { id, name: file.name }]);
    try {
      const { ref, url } = await api.uploadPhoto(file);
      // Uploads of a multi-select finish independently, so build on the latest list rather than the last render's.
      photosRef.current = [...photosRef.current, { ref, url }];
      onChange(photosRef.current);
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) {
        setError(err instanceof Error ? err.message : 'The photo could not be uploaded.');
      }
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const handleFiles = (list: FileList | null) => {
    setError(null);
    if (!list || list.length === 0) return;
    const files = [...list];
    const bad = files.find((f) => !ACCEPTED.includes(f.type));
    if (bad) {
      setError(`"${bad.name}" is not a JPEG, PNG or WebP photo. On iPhone, choose "Most Compatible" or share the photo as JPEG.`);
      return;
    }
    const big = files.find((f) => f.size > MAX_BYTES);
    if (big) {
      setError(`"${big.name}" is larger than 25 MB.`);
      return;
    }
    const accepted = files.slice(0, Math.max(room, 0));
    if (accepted.length < files.length) {
      setError(max === 1 ? 'Only one photo is allowed here. Remove the current one to replace it.' : `You can add up to ${max} photos. Extra photos were skipped.`);
    }
    accepted.forEach(upload);
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));
  const tileClass = tile === 'banner' ? 'w-full h-36' : 'w-24 h-28';

  return (
    <div className="flex flex-col gap-3">
      <div className={tile === 'banner' ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}>
        {photos.map((photo, i) => (
          <div key={photo.ref} className={`relative ${tileClass} rounded-xl overflow-hidden bg-surface-container border border-outline-variant/40`}>
            <img src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {max > 1 && i === 0 && (
              <span className="absolute bottom-1 left-1 bg-black/60 text-white font-mono text-xs px-1.5 py-0.5 rounded">Cover</span>
            )}
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
        ))}
        {uploading.map((u) => (
          <div key={u.id} data-testid="photo-uploading" className={`${tileClass} rounded-xl bg-surface-container border border-dashed border-outline-variant flex flex-col items-center justify-center gap-1`}>
            <span className="material-symbols-outlined text-[24px] text-primary animate-pulse">cloud_upload</span>
            <span className="text-xs font-sans text-outline">Uploading…</span>
          </div>
        ))}
        {photos.length === 0 && uploading.length === 0 && (
          <div className={`${tileClass} rounded-xl bg-surface-container border border-dashed border-outline-variant flex items-center justify-center`}>
            <span className="material-symbols-outlined text-[28px] text-outline">add_a_photo</span>
          </div>
        )}
      </div>

      {room > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="py-2.5 rounded-lg bg-primary text-white font-sans text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            <span>Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/40 font-sans text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">collections</span>
            <span>From Gallery</span>
          </button>
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            data-testid="photo-camera-input"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={galleryInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            className="hidden"
            data-testid="photo-gallery-input"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      )}

      <p className="text-xs font-sans text-outline leading-snug">
        {max === 1 ? 'One photo.' : `1 to ${max} photos.`} Photos are saved at full quality the moment you pick them.
      </p>
      {error && <p role="alert" className="text-xs font-sans text-error font-semibold">{error}</p>}
    </div>
  );
};
