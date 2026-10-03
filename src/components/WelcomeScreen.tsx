import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';

interface WelcomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

/** The first screen: the brand on a deep theme colour, what the merchant offers in a line each, and two clear choices. */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  const isPublic = merchant.catalogueAccess === 'public';
  return (
    <div className="min-h-screen flex flex-col items-center justify-end text-center px-6 pt-16 pb-8 text-white bg-gradient-to-b from-brown-dark via-brown-darker to-brown-darkest">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-24 h-24 rounded-3xl bg-on-surface border-2 border-primary-fixed-dim/60 flex items-center justify-center mb-6">
          <BrandMark className="w-16 h-16" textClassName="text-[48px]" />
        </div>
        <h1 className="font-serif text-[34px] leading-[1.1] tracking-[0.08em]">{merchant.brand.name.toUpperCase()}</h1>
        <span className="font-sans text-sm font-extrabold tracking-[0.2em] uppercase text-primary-fixed-dim mt-2">{merchant.brand.tagline}</span>
        <p className="font-sans text-base leading-relaxed text-white/80 mt-4 max-w-[28ch]">{merchant.brand.description}</p>

        <ul className="mt-6 flex flex-col gap-2 text-left w-full">
          {merchant.welcome.features.map((f) => (
            <li key={f.title} className="flex items-start gap-3 font-sans text-[15px] text-white/90">
              <span className="material-symbols-outlined text-[20px] text-primary-fixed-dim mt-0.5">{f.icon}</span>
              <span>
                <strong className="font-extrabold">{f.title}</strong>
                <span className="block text-white/70 text-sm leading-snug">{f.description}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="w-full flex flex-col gap-3 mt-8">
          <button
            onClick={() => onNavigate(isPublic ? 'catalogue' : 'retailer-auth')}
            className="w-full h-14 rounded-2xl bg-white text-primary font-sans text-base font-extrabold active:scale-[0.99] transition-all"
          >
            {isPublic ? 'Browse the catalogue' : 'Enter the portal'}
          </button>
          {isPublic && (
          <button
            onClick={() => onNavigate('retailer-auth')}
            className="w-full h-14 rounded-2xl border-2 border-white/70 text-white font-sans text-base font-extrabold active:scale-[0.99] transition-all"
          >
            Sign in with WhatsApp
          </button>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center gap-1 text-white/70 font-sans text-sm">
          {merchant.welcome.footerLine && <span>{merchant.welcome.footerLine}</span>}
          {merchant.legal.registrationLine && <span>{merchant.legal.registrationLine}</span>}
        </div>
      </div>
    </div>
  );
};
