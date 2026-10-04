import React from 'react';
import type { LayoutKit } from '../gilded';

/** The props of a Gilded screen are the contract: an Emergent screen takes exactly the same. */
export type KitProps<K extends keyof LayoutKit> = React.ComponentProps<LayoutKit[K]>;

// Stroke icons from the Emergent atlas (24px grid, 2px stroke); they take the text colour.
const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  package: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  right: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  back: <polyline points="15 18 9 12 15 6" />,
  next: <polyline points="9 18 15 12 9 6" />,
  bag: <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  wa: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>,
  down: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  edit: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  more: <><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
};

export const Icon: React.FC<{ n: string; size?: number; fill?: boolean; className?: string }> = ({ n, size = 18, fill, className = '' }) => (
  <svg className={`em-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {PATHS[n]}
  </svg>
);

/** A photo frame: the image, or a tinted placeholder from the store's own gold. A span, so it can sit inside a button. */
export const Ph: React.FC<{ src?: string; tone?: number; className?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ src, tone = 0, className = '', style, children }) => (
  <span className={`em-ph t${tone % 4} ${className}`} style={style}>
    {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />}
    {children}
  </span>
);

export const Pill: React.FC<{ tone?: string; small?: boolean; children: React.ReactNode }> = ({ tone = '', small, children }) => <span className={`em-pill ${tone}${small ? ' s' : ''}`}>{children}</span>;

/** Availability: ready stock green, made to order blue, anything else amber (the Gilded StockTag rule, in the atlas's colours). */
export const stockTone = (status: string) => (/ready|stock/i.test(status) ? 'conf' : /order/i.test(status) ? 'disp' : 'new');
export const StockPill: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => (
  <Pill tone={stockTone(status)} small={small}>
    {status}
  </Pill>
);

export const OrderStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <Pill tone={{ new: 'new', confirmed: 'conf', dispatched: 'disp', cancelled: 'canc' }[status] ?? ''}>{status}</Pill>
);

/** Eyebrow, serif title and the gold hairline under it. */
export const Title: React.FC<{ eyebrow: React.ReactNode; title: string; right?: React.ReactNode; size?: 'h1' | 'h2' }> = ({ eyebrow, title, right, size = 'h1' }) => (
  <div className="em-row em-sb" style={{ alignItems: 'flex-end', gap: 12 }}>
    <div className="em-grow">
      <div className="em-ey em-clip">{eyebrow}</div>
      {size === 'h1' ? <h1 className="em-ser em-h1">{title}</h1> : <h2 className="em-ser em-h2">{title}</h2>}
      <div className="em-rule" />
    </div>
    {right}
  </div>
);

/** A short message at the top of the screen. */
export const Toast: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="status" className="em-toast">
    <Icon n="check" size={16} />
    {children}
  </div>
);

/** The sheet that slides up from the bottom (menus). */
export const Sheet: React.FC<{ label: string; onClose: () => void; children: React.ReactNode }> = ({ label, onClose, children }) => (
  <div className="em-sheet-wrap" role="dialog" aria-modal="true" aria-label={label}>
    <button type="button" aria-label="Close" className="em-scrim" onClick={onClose} />
    <div className="em-sheet">
      <div className="grab" />
      {children}
    </div>
  </div>
);

/** Weights are shown to the milligram, as in every other screen. */
export const fmtG = (n: number) => `${n.toFixed(3)} g`;
