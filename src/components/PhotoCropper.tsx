import React, { useEffect, useRef, useState } from 'react';
import { clampOffset, cropScale, sourceRect, type PhotoSpec } from '../../shared/photoSpecs';
import { I } from './ui';

/** Fixed-ratio crop: drag the photo and zoom until the frame shows what you want, then "Use photo". Saves a JPEG at the spec's size. */
export const PhotoCropper: React.FC<{ file: File; spec: PhotoSpec; onDone: (cropped: File) => void; onCancel: () => void; onSkip?: () => void }> = ({ file, spec, onDone, onCancel, onSkip }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ ox: 0, oy: 0 });
  const [url] = useState(() => URL.createObjectURL(file));
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const CW = Math.min(320, window.innerWidth - 64);
  const CH = CW / spec.ratio;

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      // start centred
      const s = Math.max(CW / i.naturalWidth, CH / i.naturalHeight);
      setOff({ ox: (CW - i.naturalWidth * s) / 2, oy: (CH - i.naturalHeight * s) / 2 });
    };
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, []);

  const view = img ? { nw: img.naturalWidth, nh: img.naturalHeight, cw: CW, ch: CH, zoom, ...off } : null;
  const place = view ? clampOffset(view) : { ox: 0, oy: 0 };
  const scale = view ? cropScale(view) : 1;

  const move = (e: React.PointerEvent) => {
    if (!drag.current || !view) return;
    setOff(clampOffset({ ...view, ox: drag.current.ox + e.clientX - drag.current.x, oy: drag.current.oy + e.clientY - drag.current.y }));
  };

  const use = () => {
    if (!img || !view) return;
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
          style={{ width: CW, height: CH, overflow: 'hidden', position: 'relative', borderRadius: 12, border: '1px solid var(--line)', touchAction: 'none', cursor: 'grab', background: '#222' }}
        >
          {img && <img src={url} alt="" draggable={false} style={{ position: 'absolute', left: place.ox, top: place.oy, width: img.naturalWidth * scale, height: img.naturalHeight * scale, maxWidth: 'none', userSelect: 'none' }} />}
        </div>
        <label className="row" style={{ gap: 10, width: '100%' }}>
          <I n="minus" size="s" />
          <input aria-label="Zoom" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          <I n="plus" size="s" />
        </label>
        <div className="row" style={{ gap: 8, width: '100%', flexWrap: 'wrap' }}>
          <button type="button" className="btn alt" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} disabled={!img} onClick={use}>
            Use photo
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
