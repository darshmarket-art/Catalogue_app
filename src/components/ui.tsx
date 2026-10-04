import React from 'react';

/**
 * Shared building blocks, so every screen reads like its artboard on the design canvas.
 * They use the "Gilded" component classes (src/gilded.css), which take their colours from the theme tokens,
 * so a merchant's colours and fonts apply everywhere.
 */

export const inputClass = 'inp';
export const btnPrimary = 'btn';
export const btnOutline = 'btn alt';
export const btnDanger = 'btn alt danger';
export const btnWhatsApp = 'btn wa';
export const btnLink = 'lnk';

/** A stroke icon from the canvas set: <I n="heart" />, size "s" (18px) or "l" (30px). */
export const I: React.FC<{ n: string; size?: 's' | 'l'; className?: string; style?: React.CSSProperties }> = ({ n, size, className = '', style }) => (
  <i aria-hidden="true" className={`i i-${n}${size ? ` ${size}` : ''} ${className}`} style={style} />
);

/** A photo frame: the image when there is one, otherwise the canvas's lit-metal placeholder (tone a to d). */
export const Photo: React.FC<{ src?: string; tone?: number; className?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ src, tone = 0, className = '', style, children }) => (
  <div className={`photo ${['', 'b', 'c', 'd'][tone % 4]} ${className}`} style={style}>
    {src && <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />}
    {children}
  </div>
);

/** Heading and lead line at the top of a screen's body (the title itself sits in the top bar). */
export const PageTitle: React.FC<{ title?: string; sub?: React.ReactNode; size?: number }> = ({ title, sub, size = 32 }) => (
  <div>
    {title && <h1 style={{ fontSize: size, lineHeight: 1.05 }}>{title}</h1>}
    {sub && <p className="sub" style={{ marginTop: title ? 6 : 0 }}>{sub}</p>}
  </div>
);

export const Field: React.FC<{ label: React.ReactNode; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div>
    <label htmlFor={htmlFor} className="lab">
      {label}
    </label>
    {children}
    {hint && <p className="hint">{hint}</p>}
  </div>
);

const tones = { error: 'note bad', ok: 'note ok', info: 'note', warn: 'note warn' } as const;

export const Notice: React.FC<{ tone: keyof typeof tones; children: React.ReactNode }> = ({ tone, children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={tones[tone]}>
    {children}
  </div>
);

/** One choice from a few, as a row of chips. */
export const Segmented: React.FC<{ options: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void }> = ({ options, value, onChange }) => (
  <div className="chips" role="tablist">
    {options.map((o) => (
      <button key={o.key} type="button" role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)} className={`chip${value === o.key ? ' on' : ''}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`chip${active ? ' on' : ''}`}>
    {children}
  </button>
);

/** Order status as a coloured tag. */
export const statusClass = (status: string) =>
  ({
    new: 'tag warn',
    confirmed: 'tag ok',
    dispatched: 'tag',
    cancelled: 'tag bad'
  })[status] ?? 'tag mut';

export const StatusTag: React.FC<{ status: string }> = ({ status }) => (
  <span className={statusClass(status)} style={{ textTransform: 'capitalize' }}>
    {status}
  </span>
);

/** Availability as a coloured tag: ready stock green, made to order grey, anything else amber. */
export const StockTag: React.FC<{ status: string }> = ({ status }) => (
  <span className={/ready|stock/i.test(status) ? 'tag ok' : /order/i.test(status) ? 'tag mut' : 'tag warn'}>{status}</span>
);

/** On/off switch drawn as the canvas's .sw. */
export const Switch: React.FC<{ on: boolean; onChange: () => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`sw${on ? '' : ' off'}`} />
);

/** The sheet that slides up from the bottom (menus, confirmations). */
export const Sheet: React.FC<{ label: string; onClose: () => void; children: React.ReactNode }> = ({ label, onClose, children }) => (
  <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={label}>
    <button type="button" aria-label="Close" className="scrim" onClick={onClose} />
    <div className="sheet">
      <div className="grab" />
      {children}
    </div>
  </div>
);

/** A short message at the top of the screen. */
export const Toast: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="status" className="toast">
    {children}
  </div>
);
