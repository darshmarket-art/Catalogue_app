import React, { useEffect, useRef, useState } from 'react';

interface PhotoViewerProps {
  images: string[];
  /** Which photo to open on. */
  start?: number;
  title: string;
  onClose: () => void;
}

const MIN = 1;
const MAX = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Full-screen photo with zoom: pinch with two fingers, double-tap, scroll wheel or the + and - buttons.
 * When zoomed in, drag to look around. With several photos, the arrows (or arrow keys) move between them.
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({ images, start = 0, title, onClose }) => {
  const [index, setIndex] = useState(start);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

  const zoomTo = (scale: number) =>
    setView((v) => {
      const s = clamp(scale, MIN, MAX);
      return s === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale: s };
    });

  const go = (delta: number) => {
    setIndex((i) => (i + delta + images.length) % images.length);
    setView({ scale: 1, x: 0, y: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomTo(view.scale * 1.4);
      else if (e.key === '-') zoomTo(view.scale / 1.4);
      else if (e.key === 'ArrowRight' && images.length > 1) go(1);
      else if (e.key === 'ArrowLeft' && images.length > 1) go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.scale, images.length]);

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) pinch.current = dist();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const d = dist();
      const ratio = d / pinch.current;
      pinch.current = d;
      moved.current = true;
      setView((v) => {
        const s = clamp(v.scale * ratio, MIN, MAX);
        return s === 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale: s };
      });
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
      setView((v) => (v.scale > 1 ? { ...v, x: v.x + dx, y: v.y + dy } : v));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    // Two quick taps with no movement: zoom in, or back out
    if (!moved.current && pointers.current.size === 0) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { ...v, scale: 2.5 }));
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  const round = 'w-12 h-12 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[80] bg-scrim flex flex-col" role="dialog" aria-modal="true" aria-label={`${title}, photo ${index + 1} of ${images.length}`}>
      <div className="flex items-center justify-between px-3 pt-safe py-3">
        <span className="font-sans text-sm font-bold text-white/90 pl-2 truncate">
          {title}
          {images.length > 1 ? ` · ${index + 1} of ${images.length}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photo" className={round}>
          <span className="material-symbols-outlined text-[26px]">close</span>
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => zoomTo(view.scale * Math.exp(-e.deltaY * 0.002))}
      >
        <img
          src={images[index]}
          alt={`${title}, photo ${index + 1}`}
          draggable={false}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-full object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: pointers.current.size ? 'none' : 'transform 0.15s ease-out' }}
        />
      </div>

      <div className="flex items-center justify-center gap-3 px-3 pb-6 pt-3">
        {images.length > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={round}>
            <span className="material-symbols-outlined text-[26px]">chevron_left</span>
          </button>
        )}
        <button type="button" onClick={() => zoomTo(view.scale / 1.5)} disabled={view.scale <= MIN} aria-label="Zoom out" className={round}>
          <span className="material-symbols-outlined text-[26px]">remove</span>
        </button>
        <span className="min-w-14 text-center font-sans text-sm font-extrabold text-white" aria-live="polite">
          {Math.round(view.scale * 100)}%
        </span>
        <button type="button" onClick={() => zoomTo(view.scale * 1.5)} disabled={view.scale >= MAX} aria-label="Zoom in" className={round}>
          <span className="material-symbols-outlined text-[26px]">add</span>
        </button>
        {images.length > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className={round}>
            <span className="material-symbols-outlined text-[26px]">chevron_right</span>
          </button>
        )}
      </div>
    </div>
  );
};
