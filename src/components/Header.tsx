import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { sector } from '../sector';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  isAdminLoggedIn: boolean;
  currentMerchant: { storeName: string; phone: string } | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  isAdminLoggedIn,
  currentMerchant,
  onLogout
}) => {
  const isSubScreen = ['new-product', 'add-category', 'admin-orders', 'admin-login', 'retailer-auth'].includes(currentScreen);
  const isAdminView = currentScreen === 'admin-hub' || currentScreen === 'new-product' || currentScreen === 'add-category' || currentScreen === 'admin-orders';

  const handleBack = () => {
    if (currentScreen === 'new-product' || currentScreen === 'add-category' || currentScreen === 'admin-orders') {
      onNavigate('admin-hub');
    } else if (currentScreen === 'admin-login' || currentScreen === 'retailer-auth') {
      onNavigate('welcome');
    } else {
      onNavigate('welcome');
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(28,28,26,0.05)] border-b border-outline-variant/40">
      <div className="h-16 md:h-18 px-4 max-w-5xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isSubScreen ? (
            <button
              aria-label="Go Back"
              onClick={handleBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('welcome')}
              className="flex items-center gap-2 text-left focus:outline-none group"
            >
              <img
                alt={`${merchant.brand.name} Emblem`}
                className="h-8 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
                src={merchant.brand.logoUrl}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-serif text-[17px] md:text-[19px] font-bold tracking-tight text-primary leading-tight truncate">{merchant.brand.name.toUpperCase()}</span>
                {isAdminView ? (
                  <span className="text-[9px] font-mono tracking-widest uppercase text-primary-container font-bold">
                    ADMIN CONSOLE • AUDITED
                  </span>
                ) : currentMerchant ? (
                  <span className="text-[10px] font-sans font-semibold text-secondary truncate">
                    {currentMerchant.storeName}
                  </span>
                ) : (
                  <span className="text-[10px] font-sans tracking-wide text-outline truncate hidden sm:inline">
                    {merchant.brand.tagline} • {sector.copy.tradingModel}
                  </span>
                )}
              </div>
            </button>
          )}

          {isSubScreen && (
            <div className="flex flex-col min-w-0 ml-1">
              <h1 className="font-serif text-[16px] md:text-[18px] font-bold text-on-surface leading-tight truncate">
                {currentScreen === 'new-product' && 'New Product Listing'}
                {currentScreen === 'add-category' && 'Add New Category'}
                {currentScreen === 'admin-orders' && 'Orders'}
                {currentScreen === 'admin-login' && 'Admin Console'}
                {currentScreen === 'retailer-auth' && 'B2B Retailer Gateway'}
              </h1>
            </div>
          )}
        </div>

        {/* Pure Gram Basis Ticker Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full border border-outline-variant/50 text-xs">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="font-mono font-semibold text-on-surface">{sector.copy.headerTicker.label}</span>
          <span className="text-primary font-mono font-bold text-[11px]">{sector.copy.headerTicker.badge}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Retailer Account or Logout */}
          {currentMerchant ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onNavigate('retailer-auth')}
                className="px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed text-xs font-sans font-bold flex items-center gap-1 border border-secondary/30"
                title="Account Settings"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span className="max-w-[90px] truncate hidden sm:inline">{currentMerchant.storeName}</span>
              </button>
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-full bg-surface-container-high text-outline hover:text-error flex items-center justify-center transition-colors"
                title="Log Out"
              >
                <span className="material-symbols-outlined text-[17px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('retailer-auth')}
              aria-label="Retailer Account"
              className="w-9 h-9 rounded-full bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary hover:bg-surface-container-highest active:scale-95 transition-all shadow-xs"
              title="Retailer Sign In / Registration"
            >
              <span className="material-symbols-outlined text-[20px]">account_circle</span>
            </button>
          )}

          {/* Admin Switch */}
          <button
            onClick={() => onNavigate(isAdminLoggedIn ? 'admin-hub' : 'admin-login')}
            aria-label="Admin Portal"
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-95 shadow-xs ${
              isAdminView
                ? 'bg-on-surface text-primary-fixed border-primary-container'
                : 'bg-surface-container-high text-secondary border-outline-variant/60 hover:bg-surface-container-highest'
            }`}
            title="Admin Console & Keymaster"
          >
            <span className="material-symbols-outlined text-[19px]">shield_person</span>
          </button>
        </div>
      </div>
    </header>
  );
};
