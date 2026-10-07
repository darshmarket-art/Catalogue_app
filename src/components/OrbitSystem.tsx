import React from 'react';
import { AntarixsMark } from './AntarixsBrand';

/** Small line icons for the planets (24px grid, stroke only). */
const PATHS: Record<string, string> = {
  grid: 'M4.5 3h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3zM15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3zM4.5 14h4A1.5 1.5 0 0 1 10 15.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14zM15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  qr: 'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 19h2v2h-2zM15 19h2M19 15v2',
  wa: 'M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12zM8.5 10l1.5 3 3 1.5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pdf: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 14h8M8 17h5',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 21a7 7 0 0 1 14 0M17 4.5a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6',
  img: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 17l-5-5-9 8',
  lang: 'M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M12 5c0 4-3 7-7 8M14 21l4-10 4 10M15.5 17h5',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z'
};
export type OrbitIcon = keyof typeof PATHS;

export interface OrbitPlanet {
  label: string;
  icon: OrbitIcon;
}
export interface OrbitRing {
  /** Which radius variable (set in orbit.css and shrunk on small screens). */
  radius: 'r1' | 'r2' | 'r3';
  /** Seconds for one turn. */
  speed: number;
  planets: OrbitPlanet[];
}

/** What Antarixs gives a store, one ring per group. */
export const FEATURE_RINGS: OrbitRing[] = [
  { radius: 'r1', speed: 20, planets: [{ label: 'Collections', icon: 'grid' }, { label: 'Orders', icon: 'bag' }, { label: 'Store QR', icon: 'qr' }] },
  { radius: 'r2', speed: 32, planets: [{ label: 'WhatsApp', icon: 'wa' }, { label: 'Insights', icon: 'chart' }, { label: 'PDF catalogue', icon: 'pdf' }] },
  { radius: 'r3', speed: 48, planets: [{ label: 'Buyers', icon: 'users' }, { label: 'Banners', icon: 'img' }, { label: 'English + Hindi', icon: 'lang' }] }
];

const DUST: Array<[string, OrbitRing['radius']]> = [['-4s', 'r1'], ['-11s', 'r2'], ['-19s', 'r3'], ['-7s', 'r1'], ['-15s', 'r2']];

/**
 * The Orbit theme's centrepiece: a core with rings of pills turning round it on a tilted plane.
 * Pure CSS motion (see orbit.css); each pill counter-rotates so its text always faces the viewer. Hover pauses the system and lights one pill.
 * `core` replaces the Antarixs mark (the sign-up page shows the store's initial).
 */
export const OrbitSystem: React.FC<{ rings?: OrbitRing[]; core?: React.ReactNode; label?: string; className?: string }> = ({
  rings = FEATURE_RINGS,
  core,
  label = 'Antarixs at the centre, with collections, orders, QR, WhatsApp, insights, PDF, buyers, banners and Hindi support orbiting it',
  className
}) => (
  <div className={`orb-sys${className ? ` ${className}` : ''}`} role="img" aria-label={label}>
    <div className="orb-plane">
      <div className="orb-sun">
        <span className="orb-aura" />
        <span className="orb-core">{core ?? <AntarixsMark size={40} dark />}</span>
        <span className="orb-dash d1" />
        <span className="orb-dash d2" />
      </div>
      {DUST.filter(([, r]) => rings.some((x) => x.radius === r)).map(([delay, r], i) => (
        <div key={i} className="orb-orbit" style={{ ['--r' as string]: `var(--${r})`, ['--d' as string]: '24s', animationDelay: delay }}>
          <i />
        </div>
      ))}
      {rings.map((ring, ri) => (
        <React.Fragment key={ring.radius}>
          <span className="orb-ring" style={{ width: `calc(2 * var(--${ring.radius}))`, height: `calc(2 * var(--${ring.radius}))` }} />
          {ring.planets.map((p, i) => {
            // Each ring starts at its own phase so the pills do not line up on one side.
            const delay = `${(-(ring.speed / ring.planets.length) * i - ring.speed * ri * 0.37).toFixed(2)}s`;
            return (
              <div key={p.label} className="orb-orbit" style={{ ['--r' as string]: `var(--${ring.radius})`, ['--d' as string]: `${ring.speed}s`, animationDelay: delay }}>
                <span className="orb-beam" />
                <div className="orb-card" style={{ animationDelay: delay }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={PATHS[p.icon]} />
                  </svg>
                  <span>{p.label}</span>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  </div>
);
