import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';
import { I } from './ui';

interface WelcomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

/** The store's first screen: the brand in a deep panel, what the merchant offers, and the way in. Same parts as the canvas's landing (1.1). */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  const isPublic = merchant.catalogueAccess === 'public';
  return (
    <div className="scroll no-tabs" style={{ gap: 16, paddingTop: 'calc(20px + var(--sat))', maxWidth: 480 }}>
      <section className="hero col" style={{ gap: 12, padding: '26px 20px 50px' }}>
        <div className="mark lg">
          <BrandMark className="w-12 h-12" textClassName="text-[36px]" />
        </div>
        <span className="eyebrow" style={{ marginTop: 6 }}>
          {merchant.brand.tagline}
        </span>
        <h1 style={{ fontSize: 38, lineHeight: 1.02 }}>{merchant.brand.name}</h1>
        <p className="sub" style={{ fontSize: 15.5, maxWidth: 280 }}>
          {merchant.brand.description}
        </p>
      </section>

      <div className="card col" style={{ gap: 10, padding: 16, margin: '-46px 14px 0', position: 'relative', zIndex: 2, boxShadow: 'var(--sh-2)' }}>
        <button type="button" className="btn" onClick={() => onNavigate(isPublic ? 'catalogue' : 'retailer-auth')}>
          {isPublic ? 'Browse the catalogue' : 'Enter the portal'}
          <I n="chev" />
        </button>
        {isPublic && (
          <button type="button" className="btn alt" onClick={() => onNavigate('retailer-auth')}>
            <I n="whats" />
            Sign in with WhatsApp
          </button>
        )}
      </div>

      {merchant.welcome.features.length > 0 && (
        <div className="card" style={{ padding: '2px 16px' }}>
          {merchant.welcome.features.map((f, i) => (
            <div key={f.title} className="row" style={{ padding: '12px 0', borderBottom: i < merchant.welcome.features.length - 1 ? '1px solid var(--line-s)' : 0 }}>
              <span className="tag gold" style={{ width: 36, height: 36, justifyContent: 'center', padding: 0, borderRadius: 11, flex: 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {f.icon}
                </span>
              </span>
              <div className="grow">
                <b>{f.title}</b>
                <p className="sub" style={{ fontSize: 13.5 }}>
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="col" style={{ alignItems: 'center', gap: 2, textAlign: 'center' }}>
        {merchant.welcome.footerLine && <span className="hint" style={{ margin: 0 }}>{merchant.welcome.footerLine}</span>}
        {merchant.legal.registrationLine && <span className="hint" style={{ margin: 0 }}>{merchant.legal.registrationLine}</span>}
      </div>
    </div>
  );
};
