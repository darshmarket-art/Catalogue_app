import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { BrandMark } from './BrandMark';
import { ProfileMenu, type ProfileUser } from './ProfileMenu';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  isAdminLoggedIn: boolean;
  currentMerchant: ProfileUser | null;
  onLogout: () => void;
  onOpenOrders: (tab: 'current' | 'past') => void;
  /** True while an existing product or category is being edited. */
  isEditing: boolean;
}

const ADMIN_SUB_SCREENS: ActiveScreen[] = ['new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers', 'admin-banners'];

export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate, isAdminLoggedIn, currentMerchant, onLogout, onOpenOrders, isEditing }) => {
  const isAdminSub = ADMIN_SUB_SCREENS.includes(currentScreen);
  const isSubScreen = isAdminSub || ['admin-login', 'retailer-auth', 'change-password'].includes(currentScreen);
  const isAdminView = currentScreen === 'admin-hub' || isAdminSub;

  const handleBack = () => {
    if (isEditing && (currentScreen === 'new-product' || currentScreen === 'add-category')) {
      onNavigate(currentScreen === 'new-product' ? 'catalogue' : 'categories');
    } else if (isAdminSub) {
      onNavigate('admin-hub');
    } else if (currentScreen === 'change-password') {
      onNavigate('categories');
    } else {
      onNavigate('welcome');
    }
  };

  // One brand block on every screen; only the small gold line under the name changes with the screen.
  const subtitle =
    currentScreen === 'new-product'
      ? isEditing
        ? 'Edit Product'
        : 'New Product Listing'
      : currentScreen === 'add-category'
        ? isEditing
          ? 'Edit Category'
          : 'Add New Category'
        : currentScreen === 'admin-orders'
          ? 'Orders'
          : currentScreen === 'admin-visitors'
            ? 'Visitor Engagement'
            : currentScreen === 'admin-buyers'
              ? 'Buyers'
              : currentScreen === 'admin-banners'
                ? 'Home banners'
              : currentScreen === 'change-password'
                ? 'Account'
                : currentScreen === 'admin-login'
                  ? 'Admin Console'
                  : currentScreen === 'retailer-auth'
                    ? 'Sign in'
                    : isAdminView
                      ? 'Admin Console'
                      : currentMerchant
                        ? currentMerchant.storeName
                        : merchant.brand.tagline;

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(28,28,26,0.05)] border-b border-outline-variant/40">
      <div className="h-16 md:h-18 px-3 max-w-5xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Left: back, or the trading-model tag on wide screens */}
        <div className="flex items-center justify-start min-w-0">
          {isSubScreen ? (
            <button
              aria-label="Go Back"
              onClick={handleBack}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          ) : (
            <div className="hidden lg:flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full border border-outline-variant/50 text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="font-mono font-semibold text-on-surface">{sector.copy.headerTicker.label}</span>
              <span className="text-primary font-mono font-bold text-[11px]">{sector.copy.headerTicker.badge}</span>
            </div>
          )}
        </div>

        {/* Centre: medallion, brand name, gold context line */}
        <button onClick={() => onNavigate('welcome')} className="flex flex-col items-center text-center focus:outline-none group min-w-0 max-w-[52vw]">
          <span className="w-7 h-7 rounded-full bg-on-surface border border-primary-container/60 shadow-sm flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
            <BrandMark className="w-5 h-5" textClassName="text-[13px]" />
          </span>
          <span className="font-serif text-[15px] md:text-[17px] font-bold tracking-tight text-primary leading-tight mt-0.5 truncate max-w-full">
            {merchant.brand.name.toUpperCase()}
          </span>
          <span className="text-[9px] font-mono tracking-widest uppercase text-primary-container font-bold leading-tight truncate max-w-full">
            {subtitle}
          </span>
        </button>

        {/* Right: one profile menu for buyers and staff; a sign-in button for visitors */}
        <div className="flex items-center justify-end">
          {currentMerchant || isAdminLoggedIn ? (
            <ProfileMenu
              buyer={currentMerchant}
              isAdmin={isAdminLoggedIn}
              onOpenOrders={onOpenOrders}
              onOpenAdminConsole={() => onNavigate('admin-hub')}
              onChangePassword={() => onNavigate('change-password')}
              onLogout={onLogout}
            />
          ) : (
            <button
              onClick={() => onNavigate('retailer-auth')}
              aria-label="Sign in"
              className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant/60 flex items-center justify-center text-primary hover:bg-surface-container-highest active:scale-95 transition-all shadow-xs"
              title="Sign in or register"
            >
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
