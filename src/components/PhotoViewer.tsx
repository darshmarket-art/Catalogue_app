import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useBackLayer } from '../backLayer';
import { project, rubberband, spring, VelocityTracker, type Stop } from '../spring';

interface PhotoViewerProps {
  images: string[];
  /** Which photo to open on. */
  start?: number;
  title: string;
  onClose: () => void;
}

type View = { x: number; y: number; s: number };

const MIN = 1;
const MAX = 5;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Keeps v within ±max; the part beyond still follows, with rubber-band resistance. */
const band = (v: number, max: number, dim: number) => {
  const c = clamp(v, -max, max);
  return c + rubberband(v - c, dim);
};

/**
 * Full-screen photo with zoom: pinch with two fingers, double-tap, scroll wheel or the + and - buttons.
 * When zoomed in, drag or flick to look around. At normal size, swipe sideways between photos, or drag down to close.
 * Gestures move the photo directly (no re-render per frame), and every animation is a spring that starts from what is on
 * screen, so a new touch can always catch the photo mid-flight.
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({ images, start = 0, title, onClose }) => {
  useBackLayer(true, onClose); // Back closes the photo
  const [index, setIndex] = useState(start);
  const [scale, setScale] = useState(1); // only for the % label and the +/- buttons
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const topBar = useRef<HTMLDivElement>(null);
  const bottomBar = useRef<HTMLDivElement>(null);
  const t = useRef<View>({ x: 0, y: 0, s: 1 }); // the photo as it is on screen right now
  const goal = useRef<View | null>(null); // where a zoom animation is heading, so quick + + presses add up
  const stops = useRef<Stop[]>([]);
  const gen = useRef(0);
  const closing = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; x: number; y: number } | null>(null);
  const drag = useRef({ x: 0, y: 0, tx: 0, ty: 0, axis: '' as '' | 'x' | 'y' | 'pan' });
  const tracker = useRef(new VelocityTracker());
  const lastTap = useRef(0);
  const moved = useRef(false);

  const size = () => ({
    W: box.current?.clientWidth || window.innerWidth,
    H: box.current?.clientHeight || window.innerHeight,
    w: img.current?.offsetWidth || 0,
    h: img.current?.offsetHeight || 0,
  });
  /** How far a photo zoomed to s can move before its edge comes into view. */
  const bounds = (s: number) => {
    const { W, H, w, h } = size();
    return { mx: Math.max(0, (w * s - W) / 2), my: Math.max(0, (h * s - H) / 2) };
  };
  const center = () => {
    const r = box.current!.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };

  const fade = (o: number) => {
    for (const el of [backdrop.current, topBar.current, bottomBar.current]) if (el) el.style.opacity = String(o);
  };
  const render = () => {
    const el = img.current;
    const frame = box.current;
    if (!el || !frame) return;
    const H = frame.clientHeight; // read before writing, so the browser doesn't have to recalculate mid-frame
    const { x, y, s } = t.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    // Zoomed in: clip to the frame. Otherwise clip only the sides, so a photo dragged down can pass over the controls.
    const overflow = s > 1 ? 'clip' : 'clip visible';
    if (frame.style.overflow !== overflow) frame.style.overflow = overflow;
    // Dragging down at normal size dims the backdrop and controls: 1 → 0.3 by 40% of the height.
    if (!closing.current) fade(s > 1 ? 1 : 1 - 0.7 * clamp(y / (0.4 * H), 0, 1));
  };

  const stopAll = () => {
    gen.current++;
    // Deferred a moment: a spring stopped from inside its own update has not yet asked for its next frame.
    stops.current.forEach((stop) => queueMicrotask(stop));
    stops.current = [];
    goal.current = null;
  };
  /** A spring that goes quiet the moment anything newer starts (a touch, a button), so motion is always interruptible. */
  const run = (from: number, to: number, v: number, set: (value: number, velocity: number) => void, response = 0.4, done?: () => void) => {
    const id = gen.current;
    stops.current.push(
      spring(from, to, v, (value, vel) => id === gen.current && set(value, vel), { response, onDone: () => id === gen.current && done?.() })
    );
  };

  /** Springs zoom and position together from wherever the photo is now. */
  const animateTo = (to: View, response = 0.4) => {
    stopAll();
    setScale(to.s);
    const from = { ...t.current };
    if (from.s === to.s && from.x === to.x && from.y === to.y) return;
    goal.current = to;
    // One spring on progress (0-1000, so its pixel-sized rest threshold is fine-grained) keeps the zoom point steady.
    run(0, 1000, 0, (p) => {
      const k = p / 1000;
      Object.assign(t.current, { s: from.s * (1 - k) + to.s * k, x: from.x * (1 - k) + to.x * k, y: from.y * (1 - k) + to.y * k });
      render();
    }, response, () => (goal.current = null));
  };
  const cur = () => goal.current ?? t.current;
  /** Zooms to s, keeping the point (fx, fy) — measured from the frame's centre — where it is, then stays inside the edges. */
  const zoomTo = (s: number, fx = 0, fy = 0, response?: number) => {
    const from = cur();
    const to = clamp(s, MIN, MAX);
    const r = to / from.s;
    const { mx, my } = bounds(to);
    animateTo({ s: to, x: clamp(fx - r * (fx - from.x), -mx, mx), y: clamp(fy - r * (fy - from.y), -my, my) }, response);
  };

  /**
   * Brings the photo to rest: glides on with the finger's speed (Apple's projection) and stops at the edge if thrown past it.
   * At normal size the edges are the centre, so this springs it home; a zoom just off normal snaps back to normal.
   */
  const settle = (vx = 0, vy = 0) => {
    const p = t.current;
    if (p.s !== 1 && p.s < 1.05) return zoomTo(1);
    const { mx, my } = bounds(p.s);
    // A slower spring for the glide: a far target with a 0.4 response would speed up before it slows.
    run(p.x, clamp(p.x + project(vx), -mx, mx), vx, (x) => { p.x = x; render(); }, 0.6);
    run(p.y, clamp(p.y + project(vy), -my, my), vy, (y) => { p.y = y; render(); }, 0.6);
  };

  /** Shows another photo; it slides in from the side it comes from, keeping the speed of the swipe that sent it. */
  const swap = (delta: number, v = 0) => {
    stopAll();
    flushSync(() => {
      setIndex((i) => (i + delta + images.length) % images.length);
      setScale(1);
    });
    Object.assign(t.current, { x: delta * size().W, y: 0, s: 1 }); // parked out of view until it has loaded
    render();
    const id = gen.current;
    (img.current?.decode() ?? Promise.resolve())
      .catch(() => {})
      .then(() => {
        if (id !== gen.current) return;
        const { W, w } = size();
        t.current.x = (delta * (W + w)) / 2; // just past the edge
        run(t.current.x, 0, v, (x) => { t.current.x = x; render(); });
      });
  };

  /** Lets the photo fall off the bottom at the speed it was flung while the backdrop fades out, then closes. */
  const close = (v: number) => {
    stopAll();
    closing.current = true;
    const from = t.current.y;
    const o = Number(backdrop.current?.style.opacity || 1);
    const exit = from + window.innerHeight - (img.current?.getBoundingClientRect().top ?? 0); // its top reaches the screen's bottom
    // Aimed past the exit so it leaves at speed instead of easing to a stop on the edge.
    run(from, exit + 0.2 * window.innerHeight, v, (y) => {
      t.current.y = y;
      render();
      fade(o * clamp(1 - (y - from) / (exit - from), 0, 1));
      if (y >= exit) {
        stopAll();
        onClose();
      }
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomTo(cur().s * 1.4);
      else if (e.key === '-') zoomTo(cur().s / 1.4);
      else if (e.key === 'ArrowRight' && images.length > 1) swap(1);
      else if (e.key === 'ArrowLeft' && images.length > 1) swap(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  useEffect(() => () => stopAll(), []); // no springs left running after the viewer closes

  /** Distance between the first two fingers and their midpoint (from the frame's centre). */
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    const { cx, cy } = center();
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2 - cx, y: (a.y + b.y) / 2 - cy };
  };
  /** Starts a one-finger drag from where the photo is now. */
  const grab = (x: number, y: number, axis: '' | 'pan') => {
    drag.current = { x, y, tx: t.current.x, ty: t.current.y, axis };
    tracker.current.reset();
    tracker.current.add(x, y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopAll(); // catch the photo wherever it is
    closing.current = false;
    if (pointers.current.size === 1) {
      moved.current = false;
      // Swipe and drag-to-close only at normal size; otherwise one finger looks around.
      grab(e.clientX, e.clientY, t.current.s === 1 ? '' : 'pan');
    } else if (pointers.current.size === 2) {
      pinch.current = two();
      moved.current = true; // a pinch is never a tap
      tracker.current.reset();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = t.current;
    if (pointers.current.size >= 2) {
      const was = pinch.current;
      if (!was) return;
      // Pinch: zoom about the point between the fingers and follow them as they move together, both 1:1.
      const now = two();
      const s = clamp((p.s * now.d) / was.d, 0.5, MAX);
      const r = s / p.s;
      Object.assign(p, { s, x: now.x - r * (was.x - p.x), y: now.y - r * (was.y - p.y) });
      pinch.current = now;
      render();
      setScale(s);
      return;
    }
    const g = drag.current;
    tracker.current.add(e.clientX, e.clientY);
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) > 10) moved.current = true;
    if (!g.axis) {
      if (!moved.current) return;
      // The direction is decided once, after 10px; the photo moves from here on so it doesn't jump.
      Object.assign(g, { axis: Math.abs(dx) > Math.abs(dy) ? 'x' : 'y', x: e.clientX, y: e.clientY });
      return;
    }
    const { W, H } = size();
    if (g.axis === 'pan') {
      const { mx, my } = bounds(p.s);
      p.x = band(g.tx + dx, mx, W);
      p.y = band(g.ty + dy, my, H);
    } else if (g.axis === 'x') {
      p.x = images.length > 1 ? g.tx + dx : rubberband(g.tx + dx, W); // one photo: nowhere to go, so it resists
    } else {
      const y = g.ty + dy;
      p.y = y > 0 ? y : rubberband(y, H); // only down closes, so up resists
    }
    render();
  };

  const cancelled = useRef(false);
  const onPointerCancel = (e: React.PointerEvent) => {
    cancelled.current = true;
    onPointerUp(e);
    cancelled.current = false;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const left = [...pointers.current.values()];
    if (left.length >= 2) {
      pinch.current = two();
      return;
    }
    pinch.current = null;
    if (left.length === 1) {
      // One finger lifted from a pinch: the other can look around, but never swipes or closes.
      grab(left[0].x, left[0].y, 'pan');
      return;
    }
    const p = t.current;
    if (cancelled.current) {
      // The browser or the system took the touch away: never change photo or close, just come to rest.
      lastTap.current = 0;
      return settle();
    }
    if (!moved.current) {
      // Two quick taps with no movement: zoom in on that spot, or back out. A single tap only settles a caught photo.
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        const { cx, cy } = center();
        zoomTo(p.s > 1 ? 1 : 2.5, e.clientX - cx, e.clientY - cy);
      } else {
        lastTap.current = now;
        settle();
      }
      return;
    }
    lastTap.current = 0;
    tracker.current.add(e.clientX, e.clientY); // a finger that stopped before lifting has no speed
    const { vx, vy } = tracker.current.velocity();
    const g = drag.current;
    const { W, H, w } = size();
    const dx = p.x - g.tx;
    const projected = dx + project(vx);
    // Far enough (counting where the flick would carry it), or a quick flick in the drag's direction: next photo.
    if (g.axis === 'x' && images.length > 1 && (Math.abs(projected) > 0.35 * W || (Math.abs(vx) > 500 && vx * dx > 0))) {
      const delta = projected < 0 ? 1 : -1;
      const exit = (W + w) / 2; // the photo is fully out of view
      run(p.x, -delta * (exit + 0.2 * W), vx, (x, v) => {
        p.x = x;
        render();
        if (-delta * x >= exit) swap(delta, v);
      });
    } else if (g.axis === 'y' && (p.y + project(vy) > 0.25 * H || vy > 600)) close(vy);
    else settle(g.axis === 'y' ? 0 : vx, g.axis === 'x' ? 0 : vy);
  };

  const round = 'w-12 h-12 rounded-full bg-white/95 text-primary flex items-center justify-center shadow-md active:scale-95 disabled:opacity-40';

  return (
    <div className="em-viewer fixed inset-0 z-[80] flex flex-col" role="dialog" aria-modal="true" aria-label={`${title}, photo ${index + 1} of ${images.length}`}>
      {/* The dark backdrop is its own layer so it can fade while the photo is dragged down */}
      <div ref={backdrop} className="absolute inset-0 -z-10 bg-scrim" />
      <div ref={topBar} className="flex items-center justify-between px-3 pt-safe py-3">
        <span className="font-sans text-sm font-bold text-white/90 pl-2 truncate">
          {title}
          {images.length > 1 ? ` · ${index + 1} of ${images.length}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photo" className={round}>
          <span className="material-symbols-outlined text-[26px]">close</span>
        </button>
      </div>

      <div
        ref={box}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center select-none"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={(e) => {
          const { cx, cy } = center();
          zoomTo(cur().s * Math.exp(-e.deltaY * 0.002), e.clientX - cx, e.clientY - cy, 0.25);
        }}
      >
        <img
          ref={img}
          src={images[index]}
          alt={`${title}, photo ${index + 1}`}
          draggable={false}
          decoding="async"
          referrerPolicy="no-referrer"
          className="max-w-full max-h-full object-contain"
        />
      </div>

      <div ref={bottomBar} className="flex items-center justify-center gap-3 px-3 pb-6 pt-3">
        {images.length > 1 && (
          <button type="button" onClick={() => swap(-1)} aria-label="Previous photo" className={round}>
            <span className="material-symbols-outlined text-[26px]">chevron_left</span>
          </button>
        )}
        <button type="button" onClick={() => zoomTo(cur().s / 1.5)} disabled={scale <= MIN} aria-label="Zoom out" className={round}>
          <span className="material-symbols-outlined text-[26px]">remove</span>
        </button>
        <span className="min-w-14 text-center font-sans text-sm font-extrabold text-white" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => zoomTo(cur().s * 1.5)} disabled={scale >= MAX} aria-label="Zoom in" className={round}>
          <span className="material-symbols-outlined text-[26px]">add</span>
        </button>
        {images.length > 1 && (
          <button type="button" onClick={() => swap(1)} aria-label="Next photo" className={round}>
            <span className="material-symbols-outlined text-[26px]">chevron_right</span>
          </button>
        )}
      </div>
    </div>
  );
};
