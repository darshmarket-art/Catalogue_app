import React from 'react';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { Icon, type KitProps } from './ui';

/** The store's first screen (atlas Welcome): the brand on a deep panel, then the way in as role-style cards, what the store offers, and the legal footer. */
export const Welcome: React.FC<KitProps<'Welcome'>> = ({ onNavigate }) => {
  const isPublic = merchant.catalogueAccess === 'public';
  return (
    <div className="em-welcome">
      <section className="em-hero lg">
        <span className="em-mark lg" style={{ alignSelf: 'flex-start' }}>
          <BrandMark className="w-8 h-8" textClassName="text-[26px]" />
        </span>
        <div>
          <div className="em-ey g">{merchant.brand.tagline}</div>
          <h1 className="em-ser" style={{ fontSize: 38, lineHeight: 1.12, marginTop: 10, color: 'var(--em-on-primary)', letterSpacing: '-0.5px' }}>
            {merchant.brand.name}
          </h1>
          <p style={{ fontSize: 14, opacity: 0.78, marginTop: 10, lineHeight: 1.55, maxWidth: 340 }}>{merchant.brand.description}</p>
        </div>
      </section>

      <div className="em-pad" style={{ paddingTop: 28 }}>
        <div className="em-rule" style={{ width: 56 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
          <button type="button" className="em-role pri" onClick={() => onNavigate(isPublic ? 'catalogue' : 'retailer-auth')}>
            <span className="ico">
              <Icon n="bag" size={22} />
            </span>
            <span className="em-grow">
              <span className="em-ser">{isPublic ? 'Browse the catalogue' : 'Enter the portal'}</span>
              <small>{isPublic ? 'Open to everyone, no sign-in needed.' : 'For registered buyers. Sign in with your WhatsApp number.'}</small>
            </span>
            <Icon n="right" size={20} />
          </button>
          {isPublic && (
            <button type="button" className="em-role" onClick={() => onNavigate('retailer-auth')}>
              <span className="ico">
                <Icon n="wa" size={22} />
              </span>
              <span className="em-grow">
                <span className="em-ser">Sign in with WhatsApp</span>
                <small>For buyers with an account.</small>
              </span>
              <Icon n="right" size={20} />
            </button>
          )}
        </div>

        {merchant.welcome.features.length > 0 && (
          <div className="em-card" style={{ padding: '2px 16px', marginTop: 22 }}>
            {merchant.welcome.features.map((f) => (
              <div key={f.title} className="em-feature">
                <span className="em-ico">
                  <span className="material-symbols-outlined">{f.icon}</span>
                </span>
                <div className="em-grow">
                  <b style={{ fontWeight: 600 }}>{f.title}</b>
                  <p className="em-mut" style={{ fontSize: 13, margin: '2px 0 0', lineHeight: 1.45 }}>
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {merchant.welcome.footerLine && <span className="em-hint">{merchant.welcome.footerLine}</span>}
          {merchant.legal.registrationLine && <span className="em-hint">{merchant.legal.registrationLine}</span>}
        </div>
      </div>
    </div>
  );
};
