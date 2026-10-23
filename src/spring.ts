/*
 * Motion physics shared by gesture-driven UI (sheets, the photo viewer). Follows Apple's "Designing Fluid Interfaces":
 * springs start from the current on-screen value, inherit the finger's velocity, and can be stopped (interrupted) at any frame.
 */

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stops a running spring where it is (the caller keeps the last value it was given). */
export type Stop = () => void;

/**
 * A critically damped spring (damping 1.0: no overshoot) from `from` to `to`, starting at `velocity` units/s.
 * `response` is Apple's response in seconds (lower = snappier); there is no fixed duration.
 * onUpdate(value, velocity) runs every frame; with reduced motion the value jumps to `to` at once.
 */
export function spring(
  from: number,
  to: number,
  velocity: number,
  onUpdate: (value: number, velocity: number) => void,
  { response = 0.4, onDone }: { response?: number; onDone?: () => void } = {}
): Stop {
  if (reducedMotion() || from === to && Math.abs(velocity) < 1) {
    onUpdate(to, 0);
    onDone?.();
    return () => {};
  }
  const w = (2 * Math.PI) / response;
  const a = from - to;
  const b = velocity + w * a;
  const t0 = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = (now - t0) / 1000;
    const e = Math.exp(-w * t);
    const x = (a + b * t) * e;
    const v = (b - w * (a + b * t)) * e;
    if (Math.abs(x) < 0.5 && Math.abs(v) < 10) {
      onUpdate(to, 0);
      onDone?.();
      return;
    }
    onUpdate(to + x, v);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/** Where a flick would come to rest (Apple's projection; 0.998 = normal scroll deceleration). */
export const project = (velocity: number, decelerationRate = 0.998) => ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);

/** Soft boundary: the further past the edge, the less the element follows. */
export const rubberband = (overshoot: number, dimension: number, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Velocity of a pointer from its last ~100 ms of positions (px/s). */
export class VelocityTracker {
  private samples: Array<{ t: number; x: number; y: number }> = [];
  add(x: number, y: number, t = performance.now()) {
    this.samples.push({ t, x, y });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }
  reset() {
    this.samples = [];
  }
  velocity(): { vx: number; vy: number } {
    const s = this.samples;
    if (s.length < 2) return { vx: 0, vy: 0 };
    const first = s[0];
    const last = s[s.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return { vx: 0, vy: 0 };
    return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
  }
}
