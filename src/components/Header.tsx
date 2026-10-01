import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
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

const ADMIN_SUB_SCREENS: ActiveScreen[] = ['new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities'];

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
                : currentScreen === 'admin-purities'
                ? 'Purity options'
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
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/95 backdrop-blur-xl border-b border-outline-variant/60">
      <div className="h-[72px] px-3 max-w-5xl mx-auto grid grid-cols-[44px_1fr_44px] items-center gap-2">
        {/* Left: back on inner screens, otherwise the logo */}
        <div className="flex items-center justify-start">
          {isSubScreen ? (
            <button
              aria-label="Go Back"
              onClick={handleBack}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-primary hover:bg-surface-container-high active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          ) : (
            <button
              aria-label={`${merchant.brand.name} home`}
              onClick={() => onNavigate('welcome')}
              className="w-11 h-11 rounded-xl bg-on-surface border border-primary-fixed-dim/60 flex items-center justify-center overflow-hidden"
            >
              <BrandMark className="w-8 h-8" textClassName="text-[24px]" />
            </button>
          )}
        </div>

        {/* Centre: company name with room to breathe, and a short line that changes with the screen */}
        <div className="flex flex-col items-center text-center min-w-0">
          <span className="font-serif text-[20px] md:text-[22px] tracking-[0.06em] text-primary leading-tight truncate max-w-full">
            {merchant.brand.name.toUpperCase()}
          </span>
          <span className="text-xs font-extrabold tracking-[0.16em] uppercase text-primary-fixed-dim leading-tight mt-0.5 truncate max-w-full">
            {subtitle}
          </span>
        </div>

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
              className="w-11 h-11 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary hover:bg-surface-container-highest active:scale-95 transition-all"
              title="Sign in or register"
            >
              <span className="material-symbols-outlined text-[24px]">account_circle</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
