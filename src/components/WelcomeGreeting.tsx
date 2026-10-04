import React, { useEffect } from 'react';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';

interface WelcomeGreetingProps {
  /** The line shown big, e.g. "Welcome back, Ramesh". */
  title: string;
  subtitle: string;
  /** Called once the 2 s hold is over. */
  onDone: () => void;
}

/** The 2-second greeting after sign-in: the store's logo inside a pulsing ring, the welcome line rising in, and a bar filling up. */
export const WelcomeGreeting: React.FC<WelcomeGreetingProps> = ({ title, subtitle, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="em-page notabs" style={{ maxWidth: 480 }} data-testid="welcome-greeting">
      <div className="em-pad" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
        <div className="welcome-ring welcome-logo" style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--em-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BrandMark className="w-12 h-12" textClassName="text-[34px]" />
        </div>
        <div className="welcome-rise">
          <div className="em-ey">{merchant.brand.name}</div>
          <h1 className="em-ser" style={{ fontSize: 32, lineHeight: 1.2, marginTop: 8 }}>
            {title}
          </h1>
          <p className="em-mut" style={{ marginTop: 8, fontSize: 14 }}>
            {subtitle}
          </p>
        </div>
        <div style={{ width: 140, height: 3, borderRadius: 2, background: 'var(--em-tint)', overflow: 'hidden' }}>
          <div className="welcome-bar" style={{ height: '100%', background: 'var(--em-primary)' }} />
        </div>
      </div>
    </div>
  );
};
