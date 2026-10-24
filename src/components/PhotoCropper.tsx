import React, { useEffect, useRef, useState } from 'react';
import { clampOffset, cropScale, sourceRect, type PhotoSpec } from '../../shared/photoSpecs';
import { I } from './ui';

/** Longest side of the working copy of the photo (the server keeps no more than this). */
const MAX_EDGE = 2400;

/**
 * Fixed-ratio crop: drag the photo and zoom until the frame shows what you want, then "Use photo". Saves a JPEG at the spec's size.
 * `round` (the store logo): a circular frame, the whole logo fits at the start and may be made smaller than the frame; saves a transparent PNG.
 */
export const PhotoCropper: React.FC<{ file: File; spec: PhotoSpec; onDone: (cropped: File) => void; onCancel: () => void; onSkip?: () => void; round?: boolean }> = ({ file, spec, onDone, onCancel, onSkip, round }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ ox: 0, oy: 0 });
  const [url, setUrl] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const CW = Math.min(320, window.innerWidth - 64);
  const CH = CW / spec.ratio;

  // Read as a data URL: the production CSP blocks blob: images, and this also survives React StrictMode's double mount.
  useEffect(() => {
    let alive = true;
    const i = new Image();
    i.onload = () => {
      setImg(i);
      // start centred; a logo starts fully inside its circle (with a little room), a photo covering its frame
      const cover = Math.max(CW / i.naturalWidth, CH / i.naturalHeight);
      const z = round ? (Math.min(CW / i.naturalWidth, CH / i.naturalHeight) / cover) * 0.8 : 1;
      setZoom(z);
      setOff({ ox: (CW - i.naturalWidth * cover * z) / 2, oy: (CH - i.naturalHeight * cover * z) / 2 });
    };
    const useUrl = (src: string) => {
      if (!alive) return;
      setUrl(src);
      i.src = src;
    };
    // Phone photos are 12 to 50 MP: showing the original would keep several full-size copies in memory and can make a phone browser
    // reload the page. Work on a copy shrunk to what the server keeps anyway (MAX_EDGE), and let the full-size decode go at once.
    const readOriginal = () => {
      const reader = new FileReader();
      reader.onload = () => useUrl(String(reader.result));
      reader.readAsDataURL(file);
    };
    createImageBitmap(file)
      .then((bmp) => {
        const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
        if (k === 1) {
          bmp.close();
          return readOriginal(); // already small enough: keep the original bytes, no extra re-save
        }
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * k));
        c.height = Math.max(1, Math.round(bmp.height * k));
        c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close();
        const src = c.toDataURL(round || file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
        c.width = c.height = 0;
        useUrl(src);
      })
      .catch(readOriginal);
    return () => {
      alive = false;
      i.onload = null;
    };
  }, []);

  const view = img ? { nw: img.naturalWidth, nh: img.naturalHeight, cw: CW, ch: CH, zoom, ...off } : null;
  const place = view ? (round ? { ox: view.ox, oy: view.oy } : clampOffset(view)) : { ox: 0, oy: 0 };
  const scale = view ? cropScale(view) : 1;

  const move = (e: React.PointerEvent) => {
    if (!drag.current || !view) return;
    const next = { ...view, ox: drag.current.ox + e.clientX - drag.current.x, oy: drag.current.oy + e.clientY - drag.current.y };
    setOff(round ? { ox: next.ox, oy: next.oy } : clampOffset(next));
  };

  const use = () => {
    if (!img || !view) return;
    if (round) {
      // what is inside the frame, scaled to the output; outside the logo stays transparent
      const k = spec.w / CW;
      const c = document.createElement('canvas');
      c.width = spec.w;
      c.height = spec.h;
      c.getContext('2d')!.drawImage(img, place.ox * k, place.oy * k, img.naturalWidth * scale * k, img.naturalHeight * scale * k);
      c.toBlob((b) => b && onDone(new File([b], 'logo.png', { type: 'image/png' })), 'image/png');
      return;
    }
    const { sx, sy, sw, sh } = sourceRect({ ...view, ...place });
    const c = document.createElement('canvas');
    c.width = spec.w;
    c.height = spec.h;
    c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, spec.w, spec.h);
    c.toBlob((b) => b && onDone(new File([b], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Fit the ${spec.label.toLowerCase()} photo`} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,10,16,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card col" style={{ gap: 12, padding: 16, maxWidth: 400, width: '100%', alignItems: 'center' }}>
        <b>Fit the {spec.label.toLowerCase()} photo</b>
        <p className="sub" style={{ fontSize: 13, textAlign: 'center' }}>
          {spec.tip}
        </p>
        <div
          data-testid="crop-frame"
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: place.ox, oy: place.oy };
          }}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          style={{ width: CW, height: CH, overflow: 'hidden', position: 'relative', borderRadius: round ? '50%' : 12, border: round ? '2px solid var(--em-gold, #c9a227)' : '1px solid var(--line)', touchAction: 'none', cursor: 'grab', background: round ? '#fff' : '#222' }}
        >
          {img && url && <img src={url} alt="" draggable={false} style={{ position: 'absolute', left: place.ox, top: place.oy, width: img.naturalWidth * scale, height: img.naturalHeight * scale, maxWidth: 'none', userSelect: 'none' }} />}
        </div>
        <label className="row" style={{ gap: 10, width: '100%' }}>
          <I n="minus" size="s" />
          <input aria-label="Zoom" type="range" min={round ? 0.2 : 1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          <I n="plus" size="s" />
        </label>
        <div className="row" style={{ gap: 8, width: '100%', flexWrap: 'wrap' }}>
          <button type="button" className="btn alt" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} disabled={!img} onClick={use}>
            {round ? 'Use logo' : 'Use photo'}
          </button>
        </div>
        {onSkip && (
          <button type="button" className="lnk" onClick={onSkip}>
            Skip, I know it fits
          </button>
        )}
      </div>
    </div>
  );
};
