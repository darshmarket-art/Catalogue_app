import React from 'react';

/**
 * Shared building blocks, so every screen looks and behaves the same.
 * They use theme tokens only (see @theme in index.css), so a merchant's colours and fonts apply everywhere.
 */

export const inputClass =
  'w-full h-[52px] rounded-2xl border-[1.5px] border-outline-variant bg-white px-4 font-sans text-base text-on-surface placeholder:text-outline/70 focus:outline-none focus:border-primary';

const btn = 'w-full h-14 rounded-2xl font-sans text-base font-extrabold flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed';
export const btnPrimary = `${btn} bg-secondary hover:bg-secondary-dark text-on-secondary`;
export const btnOutline = `${btn} bg-white border-2 border-primary text-primary`;
export const btnDanger = `${btn} bg-white border-[1.5px] border-error/40 text-error`;
export const btnWhatsApp = `${btn} bg-whatsapp text-on-whatsapp`;
export const btnLink = 'min-h-11 px-3 font-sans text-sm font-bold text-primary hover:underline';

export const PageTitle: React.FC<{ title: string; sub?: React.ReactNode }> = ({ title, sub }) => (
  <div className="px-5 pt-2 pb-4">
    <h1 className="font-serif text-[30px] leading-[1.12] text-primary">{title}</h1>
    {sub && <p className="font-sans text-[15px] leading-relaxed text-on-surface-variant mt-1.5">{sub}</p>}
  </div>
);

export const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="font-sans text-sm font-extrabold text-on-surface">
      {label}
    </label>
    {children}
    {hint && <span className="font-sans text-sm text-outline">{hint}</span>}
  </div>
);

const tones = {
  error: 'bg-error-container text-error',
  ok: 'bg-success-container text-success',
  info: 'bg-secondary-container text-on-secondary-container'
} as const;

export const Notice: React.FC<{ tone: keyof typeof tones; children: React.ReactNode }> = ({ tone, children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 font-sans text-[15px] font-semibold leading-snug ${tones[tone]}`}>
    {children}
  </div>
);

export const Segmented: React.FC<{ options: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void }> = ({ options, value, onChange }) => (
  <div className="flex bg-surface-container rounded-2xl p-1" role="tablist">
    {options.map((o) => (
      <button
        key={o.key}
        type="button"
        role="tab"
        aria-selected={value === o.key}
        onClick={() => onChange(o.key)}
        className={`flex-1 h-11 rounded-xl font-sans text-[15px] font-extrabold transition-colors ${value === o.key ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const Chip: React.FC<{ active?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex-none min-h-11 px-4 rounded-full border-[1.5px] font-sans text-sm font-extrabold whitespace-nowrap transition-colors ${
      active ? 'bg-primary border-primary text-on-primary' : 'bg-white border-outline-variant text-on-surface-variant'
    }`}
  >
    {children}
  </button>
);

/** Order status as a coloured word, from theme tokens. */
export const statusClass = (status: string) =>
  ({
    new: 'bg-primary-fixed text-primary',
    confirmed: 'bg-info-container text-info',
    dispatched: 'bg-success-container text-success',
    cancelled: 'bg-surface-container-high text-on-surface-variant'
  })[status] ?? 'bg-surface-container text-on-surface-variant';

export const StatusTag: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-block rounded-full px-3 py-1 font-sans text-[13px] font-extrabold capitalize ${statusClass(status)}`}>{status}</span>
);

/** The sheet that slides up from the bottom (menus, confirmations). */
export const Sheet: React.FC<{ label: string; onClose: () => void; children: React.ReactNode }> = ({ label, onClose, children }) => (
  <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
    <button type="button" aria-label="Close" className="absolute inset-0 bg-scrim/50" onClick={onClose} />
    <div className="relative w-full max-w-md bg-surface rounded-t-[28px] pt-2.5 pb-6 animate-fade-in max-h-[90vh] overflow-y-auto">
      <div className="w-10 h-1 rounded-full bg-outline-variant mx-auto mb-3" />
      {children}
    </div>
  </div>
);
