import React, { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { fitCheck, PHOTO_SPECS, type PhotoKind } from '../../shared/photoSpecs';
import { I, Photo } from './ui';
import { PhotoCropper } from './PhotoCropper';

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
  /** What the photo is for: shows the shape rule, and fits (banner, collection) or advises (design) before upload. */
  kind?: PhotoKind;
  /** Extra slots shown locked (Basic: photos 2 and 3), tapping one calls onLocked. */
  locked?: number;
  onLocked?: () => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024;

/** Photos on a form, as the canvas draws them: a row of tiles with dashed "Add" slots (artboards 3.3, 4.2, 3.7). */
export const PhotoPicker: React.FC<PhotoPickerProps> = ({ photos, onChange, max, onBusyChange, tile = 'square', kind, locked = 0, onLocked }) => {
  const [crop, setCrop] = useState<File[]>([]);
  const spec = kind ? PHOTO_SPECS[kind] : null;
  const [uploading, setUploading] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

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

  /** Checks the photo against the rule; right-shaped ones upload as they are, wrong-shaped ones go to the crop step. */
  const prepare = async (file: File) => {
    if (!spec) return upload(file);
    const size = await createImageBitmap(file).then((b) => ({ w: b.width, h: b.height })).catch(() => null);
    const fit = size ? fitCheck(size.w, size.h, spec) : 'ok';
    if (fit === 'ok') return upload(file);
    if (fit === 'small' && spec.strict) {
      setError(`"${file.name}" is too small (${size!.w} x ${size!.h} px). ${spec.label} photos need at least ${spec.minW} x ${spec.minH} px.`);
      return;
    }
    if (fit === 'small') return upload(file); // designs: advice only
    setCrop((q) => [...q, file]);
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
    accepted.forEach((f) => void prepare(f));
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));
  const banner = tile === 'banner';
  const h = banner ? 110 : 92;
  const tileStyle: React.CSSProperties = banner ? { aspectRatio: '2 / 1' } : { height: h };

  return (
    <div className="col" style={{ gap: 8 }}>
      {spec && <p className="hint" style={{ margin: 0 }}>{spec.tip}</p>}
      {crop[0] && spec && (
        <PhotoCropper
          file={crop[0]}
          spec={spec}
          onDone={(f) => {
            setCrop((q) => q.slice(1));
            void upload(f);
          }}
          onCancel={() => setCrop((q) => q.slice(1))}
          onSkip={spec.strict ? undefined : () => {
            const f = crop[0];
            setCrop((q) => q.slice(1));
            void upload(f);
          }}
        />
      )}
      <div className="grid2" style={banner ? { gridTemplateColumns: '1fr', gap: 10 } : { gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
        {photos.map((photo, i) => (
          <Photo key={photo.ref} src={photo.url} style={tileStyle}>
            {max > 1 && i === 0 && (
              <span className="tag over" style={{ left: 6, bottom: 6, background: 'var(--card)' }}>
                Cover
              </span>
            )}
            <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => remove(i)} className="ib over" style={{ top: 6, right: 6, width: 30, height: 30, borderRadius: 10 }}>
              <I n="x" size="s" />
            </button>
          </Photo>
        ))}
        {uploading.map((u) => (
          <div key={u.id} data-testid="photo-uploading" className="dashtile on animate-pulse" style={tileStyle}>
            <I n="upload" />
            Uploading…
          </div>
        ))}
        {Array.from({ length: Math.max(room, 0) }, (_, i) => (
          <button key={`add-${i}`} type="button" className={`dashtile${i === 0 ? ' on' : ''}`} style={tileStyle} onClick={() => input.current?.click()}>
            <I n="camera" />
            {banner ? 'Add a banner photo' : 'Add'}
          </button>
        ))}
        {Array.from({ length: locked }, (_, i) => (
          <button key={`lock-${i}`} type="button" className="dashtile" style={tileStyle} onClick={onLocked}>
            <I n="lock" />
            <span className="pro">Pro</span>
          </button>
        ))}
      </div>
      {room > 0 && (
        <button type="button" className="lnk" style={{ minHeight: 32, alignSelf: 'flex-start' }} onClick={() => camera.current?.click()}>
          <I n="camera" size="s" />
          Take a photo
        </button>
      )}
      <input
        ref={camera}
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
        ref={input}
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
      {error && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </div>
  );
};
