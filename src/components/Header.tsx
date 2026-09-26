import React from 'react';
import { ActiveScreen } from '../types';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenGuide: () => void;
  isAdminLoggedIn: boolean;
  currentMerchant: { storeName: string; phone: string } | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenGuide,
  isAdminLoggedIn,
  currentMerchant,
  onLogout
}) => {
  const isSubScreen = ['new-product', 'add-category', 'admin-login', 'retailer-auth'].includes(currentScreen);
  const isAdminView = currentScreen === 'admin-hub' || currentScreen === 'new-product' || currentScreen === 'add-category';

  const handleBack = () => {
    if (currentScreen === 'new-product' || currentScreen === 'add-category') {
      onNavigate('admin-hub');
    } else if (currentScreen === 'admin-login') {
      onNavigate('catalogue');
    } else if (currentScreen === 'retailer-auth') {
      onNavigate('catalogue');
    } else {
      onNavigate('welcome');
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-[#fcf9f5]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(28,28,26,0.05)] border-b border-[#d1c5b3]/40">
      <div className="h-16 md:h-18 px-4 max-w-5xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isSubScreen ? (
            <button
              aria-label="Go Back"
              onClick={handleBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#4d4638] hover:text-[#1c1c1a] hover:bg-[#ebe8e4] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('welcome')}
              className="flex items-center gap-2 text-left focus:outline-none group"
            >
              <img
                alt="Bhakti Jewels Emblem"
                className="h-8 w-auto object-contain flex-shrink-0 group-hover:scale-105 transition-transform"
                src="https://lh3.googleusercontent.com/aida/AEtjO1VdGKDX2JJLvPQjLLA6lYX5K9TXr2ZztCAHkiZKCnWndAGu34Blgsa_33mjxJ8h2k1hUAJ9zIfaKO_nm0eyAhyQt8a-_HWBmr8RCBRlUp2RkTRqOFMFiEfz9qCZNvco4hciRATYoequNx184gY2_nXvcD1EbZRZ1HOoxRsu6lYEF-59C1beTq3p5SoWHDuhbE-CC-Qa21TeepZZrpI7RHAwwojW1Tb8-2bV-2oWodWSR7Ezmt98JOKYNQ"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-serif text-[17px] md:text-[19px] font-bold tracking-tight text-[#715509] leading-tight truncate">
                  BHAKTI JEWELS
                </span>
                {isAdminView ? (
                  <span className="text-[9px] font-mono tracking-widest uppercase text-[#8c6d23] font-bold">
                    ADMIN CONSOLE • AUDITED
                  </span>
                ) : currentMerchant ? (
                  <span className="text-[10px] font-sans font-semibold text-[#486458] truncate">
                    {currentMerchant.storeName}
                  </span>
                ) : (
                  <span className="text-[10px] font-sans tracking-wide text-[#7f7666] truncate hidden sm:inline">
                    Wholesale B2B • Pure Gram Basis
                  </span>
                )}
              </div>
            </button>
          )}

          {isSubScreen && (
            <div className="flex flex-col min-w-0 ml-1">
              <h1 className="font-serif text-[16px] md:text-[18px] font-bold text-[#1c1c1a] leading-tight truncate">
                {currentScreen === 'new-product' && 'New Product Listing'}
                {currentScreen === 'add-category' && 'Add New Category'}
                {currentScreen === 'admin-login' && 'Admin Console'}
                {currentScreen === 'retailer-auth' && 'B2B Retailer Gateway'}
              </h1>
            </div>
          )}
        </div>

        {/* Pure Gram Basis Ticker Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-[#f0edea] px-3 py-1 rounded-full border border-[#d1c5b3]/50 text-xs">
          <span className="w-2 h-2 rounded-full bg-[#486458]"></span>
          <span className="font-mono font-semibold text-[#1c1c1a]">Pure Gram Settlement</span>
          <span className="text-[#715509] font-mono font-bold text-[11px]">916 / 999.9 Purity</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1 text-[11px] font-semibold bg-[#e8c16f]/30 hover:bg-[#e8c16f]/50 text-[#715509] px-2.5 py-1.5 rounded-lg border border-[#8c6d23]/30 transition-all active:scale-95"
            title="Production Architecture & Admin Creation Guide"
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span className="hidden sm:inline">Production Guide</span>
          </button>

          {/* Retailer Account or Logout */}
          {currentMerchant ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onNavigate('retailer-auth')}
                className="px-2.5 py-1 rounded-full bg-[#c7e7d7] text-[#032017] text-xs font-sans font-bold flex items-center gap-1 border border-[#486458]/30"
                title="Account Settings"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span className="max-w-[90px] truncate hidden sm:inline">{currentMerchant.storeName}</span>
              </button>
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-full bg-[#ebe8e4] text-[#7f7666] hover:text-[#ba1a1a] flex items-center justify-center transition-colors"
                title="Log Out"
              >
                <span className="material-symbols-outlined text-[17px]">logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('retailer-auth')}
              aria-label="Retailer Account"
              className="w-9 h-9 rounded-full bg-[#ebe8e4] border border-[#d1c5b3]/60 flex items-center justify-center text-[#715509] hover:bg-[#e5e2de] active:scale-95 transition-all shadow-xs"
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
                ? 'bg-[#1c1c1a] text-[#ffdf9e] border-[#8c6d23]'
                : 'bg-[#ebe8e4] text-[#486458] border-[#d1c5b3]/60 hover:bg-[#e5e2de]'
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
