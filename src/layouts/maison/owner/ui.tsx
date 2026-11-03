import React from 'react';
import './maison-owner.css';

/*
 * Shared Maison owner primitives. Markup + classes only; the look is in maison-owner.css, scoped to [data-layout="maison"][data-role="owner"].
 * Use these in an owner screen's Maison branch (merchant.layout === 'maison'), or rely on the scoped skin that restyles the existing
 * em-* / platform classes. Classic never renders them.
 */
const cx = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

/** The screen title: small tracked eyebrow, large light serif title, optional right-hand slot, hairline underneath. */
export const PageHeader: React.FC<{ eyebrow?: React.ReactNode; title: string; right?: React.ReactNode; lead?: React.ReactNode }> = ({ eyebrow, title, right, lead }) => (
  <header className="mxo-ph">
    <div className="mxo-ph-t">
      {eyebrow && <div className="mx-ey">{eyebrow}</div>}
      <h1>{title}</h1>
      {lead && <p className="mxo-lead">{lead}</p>}
    </div>
    {right && <div className="mxo-ph-r">{right}</div>}
  </header>
);

/** A section label with a hairline above; `action` sits at the right (a text link). */
export const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({ children, action }) => (
  <div className="mxo-st"><h2 className="mx-ey">{children}</h2>{action}</div>
);

/** One line of a hairline list: lead (number or icon), title with a note, meta at the right. A button when `onClick` is given. */
export const Row: React.FC<{ title: React.ReactNode; note?: React.ReactNode; lead?: React.ReactNode; meta?: React.ReactNode; onClick?: () => void; testId?: string; hot?: boolean }> = ({ title, note, lead, meta, onClick, testId, hot }) => {
  const body = (
    <>
      {lead !== undefined && <span className={cx('mxo-row-l', hot && 'hot')}>{lead}</span>}
      <span className="mxo-row-m"><span className="mxo-row-t">{title}</span>{note && <span className="mxo-row-n">{note}</span>}</span>
      {meta !== undefined && <span className="mxo-row-r">{meta}</span>}
    </>
  );
  return onClick ? <button type="button" className="mxo-row" data-testid={testId} onClick={onClick}>{body}</button> : <div className="mxo-row" data-testid={testId}>{body}</div>;
};

/** A figure and its label: a large lining serif number over a tracked caption. */
export const Stat: React.FC<{ label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode }> = ({ label, value, note }) => (
  <div className="mxo-stat"><div className="mx-ey">{label}</div><div className="mxo-stat-v">{value}</div>{note && <div className="mxo-stat-n">{note}</div>}</div>
);

/** A labelled form field: tracked caption, underline input (any child input, select or textarea), optional hint. */
export const Field: React.FC<{ label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div className="mxo-field"><label className="mx-ey" htmlFor={htmlFor}>{label}</label>{children}{hint && <p className="mxo-hint">{hint}</p>}</div>
);

/** Primary (solid ink) or secondary (outline) square button. */
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }> = ({ variant = 'primary', className, type = 'button', ...p }) => (
  <button type={type} className={cx('mxo-btn', variant === 'secondary' && 'sec', className)} {...p} />
);

/** Nothing here yet: a serif line, one sentence, an optional action. */
export const Empty: React.FC<{ title: string; note?: React.ReactNode; action?: React.ReactNode }> = ({ title, note, action }) => (
  <div className="mxo-empty"><h2>{title}</h2>{note && <p>{note}</p>}{action}</div>
);
