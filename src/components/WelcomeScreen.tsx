import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';

interface WelcomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-4 py-8 max-w-md mx-auto text-center bg-surface">
      {/* Main Luxury Emblem & Brand Title */}
      <div className="flex flex-col items-center my-6 space-y-3">
        {/* Dark Obsidian Luxury Emblem Box */}
        <div className="relative w-28 h-28 rounded-2xl bg-on-surface border-2 border-primary-container/60 shadow-xl flex items-center justify-center p-3 group hover:border-primary-fixed-dim transition-all">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl"></div>
          <BrandMark className="w-16 h-16 z-10 drop-shadow-md group-hover:scale-105 transition-transform" textClassName="text-[44px]" />
        </div>

        <div className="flex flex-col items-center">
          <h1 className="font-serif text-[32px] md:text-[36px] font-bold tracking-tight text-on-surface leading-tight mt-1">{merchant.brand.name.toUpperCase()}</h1>
          <div className="flex items-center space-x-3 w-full justify-center my-1.5">
            <div className="h-px bg-primary-container/40 w-12"></div>
            <span className="font-mono text-[12px] font-bold tracking-widest text-primary uppercase">{merchant.brand.tagline.toUpperCase()}</span>
            <div className="h-px bg-primary-container/40 w-12"></div>
          </div>
          <p className="font-sans text-[13px] text-on-surface-variant max-w-xs leading-relaxed">
            {merchant.brand.description}
          </p>
        </div>
      </div>

      {/* Feature cards */}
      <div className="w-full flex flex-col space-y-2.5 my-2">
        {merchant.welcome.features.map((feature, i) => {
          const alt = i % 2 === 1;
          return (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-3 shadow-sm border border-outline-variant/40 flex items-center space-x-3 text-left"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  alt ? 'bg-secondary-container/40 text-secondary' : 'bg-surface-container text-primary'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{feature.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[13px] font-bold text-on-surface">{feature.title}</span>
                  {feature.badge && (
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        alt ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {feature.badge}
                    </span>
                  )}
                </div>
                <p className="font-sans text-xs text-outline truncate mt-0.5">{feature.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary CTA Buttons */}
      <div className="w-full flex flex-col space-y-2.5 mt-2">
        <button
          onClick={() => onNavigate(merchant.catalogueAccess === 'public' ? 'catalogue' : 'retailer-auth')}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary-fixed-dim to-primary-container text-on-surface font-sans font-bold text-[14px] flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[19px]">{merchant.catalogueAccess === 'public' ? 'lock_open' : 'lock'}</span>
          <span className="tracking-wide uppercase">ENTER WHOLESALE PORTAL</span>
          <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
        </button>

        <button
          onClick={() => onNavigate('retailer-auth')}
          className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-sans font-semibold text-[13px] flex items-center justify-center space-x-2 border border-outline-variant/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">storefront</span>
          <span>Register New Jewellery Store</span>
        </button>
      </div>

      {/* Compliance / Encrypted Ledger Badge */}
      <div className="mt-6 flex flex-col items-center space-y-1 text-outline">
        {merchant.welcome.footerLine && (
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="material-symbols-outlined text-[14px] text-emerald-700">shield</span>
            <span>{merchant.welcome.footerLine}</span>
          </div>
        )}
        {merchant.legal.registrationLine && (
          <p className="font-mono text-xs text-outline">{merchant.legal.registrationLine}</p>
        )}
      </div>
    </div>
  );
};
