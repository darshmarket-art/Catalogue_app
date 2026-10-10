import { t } from '../i18n';
import React, { useId } from 'react';

/** The Antarixs mark (from the Emergent atlas): a lambda "A" in sky-blue to purple, a yellow swoosh and a spark. The spark sits on the A's centre line below its apex; the swoosh starts at the A's bottom-left foot and runs toward the spark's centre. Shared with the share card in storeQrCard.ts. */
export const MARK_PATHS = {
  lambda: 'M50 8 L92 90 L75 90 L50 40 L25 90 L8 90 Z',
  swoosh: 'M37.5 60.2 Q22 70 8 91 Q26 82 43 67.6 Z',
  spark: 'M50 42 C51.6 51 54.4 53.8 63 55.5 C54.4 57.2 51.6 60 50 69 C48.4 60 45.6 57.2 37 55.5 C45.6 53.8 48.4 51 50 42 Z'
};
export const AX = { blue: '#7CC4FF', purple: '#6100F0', deep: '#2B0A7A', spark: '#F3E35A' };

/** `dark`: the lambda ends in lavender instead of deep indigo, so it stays visible on a near-black ground (the Orbit theme). */
export const AntarixsMark: React.FC<{ size?: number; dark?: boolean }> = ({ size = 28, dark }) => {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`l${id}`} x1="0.1" y1="0" x2="0.95" y2="1">
          <stop offset="0" stopColor={AX.blue} />
          <stop offset="0.55" stopColor={dark ? '#8a4dff' : AX.purple} />
          <stop offset="1" stopColor={dark ? '#c9b2ff' : AX.deep} />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={AX.spark} />
          <stop offset="1" stopColor="#FFF6A8" />
        </linearGradient>
      </defs>
      <path d={MARK_PATHS.lambda} fill={`url(#l${id})`} />
      <path d={MARK_PATHS.swoosh} fill={`url(#s${id})`} />
      <path d={MARK_PATHS.spark} fill={AX.spark} />
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
