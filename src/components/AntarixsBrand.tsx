import { t } from '../i18n';
import React, { useId } from 'react';
import { MARK_COLORS, MARK_PATHS, SWOOSH_GRADIENT, markGradient } from '../../shared/antarixsMark';

/** The Antarixs mark lives in shared/antarixsMark.ts (also used by the server's favicon and the app-icon build); re-exported for the canvas renderers. */
export { MARK_PATHS };
export const AX = { blue: '#7CC4FF', purple: '#6100F0', deep: '#2B0A7A', spark: MARK_COLORS.spark };

/** The mark: a lambda "A" from sky-blue to purple, the spark on its centre line, and the yellow line from its bottom-left foot toward the spark. `dark`: the A ends in lavender, so it stays visible on a near-black ground (the Orbit theme). */
export const AntarixsMark: React.FC<{ size?: number; dark?: boolean }> = ({ size = 28, dark }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const g = markGradient(dark);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`l${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={g.y1} x2="0" y2={g.y2}>
          {g.stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`s${id}`} gradientUnits="userSpaceOnUse" x1={SWOOSH_GRADIENT.x1} y1={SWOOSH_GRADIENT.y1} x2={SWOOSH_GRADIENT.x2} y2={SWOOSH_GRADIENT.y2}>
          {SWOOSH_GRADIENT.stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
      </defs>
      <path d={MARK_PATHS.lambda} fill={`url(#l${id})`} />
      <path d={MARK_PATHS.swoosh} fill={`url(#s${id})`} />
      <path d={MARK_PATHS.spark} fill={MARK_COLORS.spark} />
    </svg>
  );
};

/** Mark on a rounded tile plus the word, for the top of platform pages. `dark` = on a deep panel. */
export const AntarixsWordmark: React.FC<{ dark?: boolean; caption?: string }> = ({ dark, caption }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
    <span style={{ width: 38, height: 38, borderRadius: 11, background: dark ? 'rgba(255,255,255,0.1)' : AX.deep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AntarixsMark size={26} dark={dark} />
    </span>
    <span>
      <span className="em-ser" style={{ display: 'block', fontSize: 20, lineHeight: 1.1, color: dark ? '#f7f3ff' : 'var(--em-ink)' }}>
        Antarixs
      </span>
      {caption && <span className="em-ey" style={{ display: 'block', color: dark ? 'rgba(247,243,255,0.7)' : undefined, letterSpacing: '0.15em' }}>{caption}</span>}
    </span>
  </span>
);

export const PoweredByAntarixs: React.FC = () => (
  <span style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, border: '1px solid var(--em-line)', background: 'var(--em-tint)' }}>
    <span className="em-mut" style={{ fontSize: 10, letterSpacing: '0.04em' }}>{t('Powered by')}</span>
    <AntarixsMark size={16} />
    <span className="em-ser" style={{ fontSize: 13 }}>Antarixs</span>
  </span>
);

/** The platform pages' wordmark: the mark, then the name in spaced serif capitals with a small caption (the cream theme). */
export const PlatformWord: React.FC<{ caption?: string; size?: number; href?: string }> = ({ caption = 'Store', size = 34, href = '/welcome-antarixs' }) => (
  <a className="ax-word" href={href} aria-label="Antarixs home">
    <AntarixsMark size={size} />
    <span>
      Antarixs
      {caption && <small>{caption}</small>}
    </span>
  </a>
);
