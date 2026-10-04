import React from 'react';
import { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';
import { ProfileMenu, type ProfileUser } from './ProfileMenu';
import { I } from './ui';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  isAdminLoggedIn: boolean;
  currentMerchant: ProfileUser | null;
  onLogout: () => void;
  onOpenOrders: (tab: 'current' | 'past') => void;
  /** True while an existing product or category is being edited. */
  isEditing: boolean;
  /** Small line above the title (Admin: the period and refresh time). */
  eyebrow?: string;
  /** Tag at the right of the title, e.g. "142 designs" or the plan. */
  aside?: React.ReactNode;
}

const ADMIN_SUB_SCREENS: ActiveScreen[] = ['new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-about', 'admin-plan'];

const TITLES: Partial<Record<ActiveScreen, string>> = {
  catalogue: 'Catalogue',
  shortlist: 'Shortlist',
  orders: 'Orders',
  'admin-hub': 'Admin',
  'admin-orders': 'Orders',
  'admin-visitors': 'Buyer engagement',
  'admin-buyers': 'Buyers',
  'admin-banners': 'Home banners',
  'admin-purities': 'Purity options',
  'admin-about': 'About us',
  'admin-plan': 'Plan and usage',
  about: 'About us',
  'change-password': 'Password'
};

/** The canvas's top bar: brand on Home, the screen's title elsewhere, a back button on inner screens. */
export const Header: React.FC<HeaderProps> = ({ currentScreen, onNavigate, isAdminLoggedIn, currentMerchant, onLogout, onOpenOrders, isEditing, eyebrow, aside }) => {
  const isAdminSub = ADMIN_SUB_SCREENS.includes(currentScreen);
  const isSubScreen = isAdminSub || ['admin-login', 'retailer-auth', 'change-password', 'about'].includes(currentScreen);
  const isHome = currentScreen === 'categories';
  const title =
    currentScreen === 'new-product' ? (isEditing ? 'Edit design' : 'New design') : currentScreen === 'add-category' ? (isEditing ? 'Edit collection' : 'New collection') : TITLES[currentScreen];
  const showProfile = (currentMerchant || isAdminLoggedIn) && (isHome || currentScreen === 'admin-hub');

  const handleBack = () => {
    if (isEditing && (currentScreen === 'new-product' || currentScreen === 'add-category')) {
      onNavigate(currentScreen === 'new-product' ? 'catalogue' : 'categories');
    } else if (isAdminSub) {
      onNavigate('admin-hub');
    } else if (currentScreen === 'change-password' || currentScreen === 'about') {
      onNavigate('categories');
    } else {
      onNavigate('welcome');
    }
  };

  return (
    <header className="topbar">
      <div className="top">
        {isSubScreen && (
          <button type="button" className="ib" aria-label="Back" onClick={handleBack}>
            <I n="back" />
          </button>
        )}

        {isHome ? (
          <>
            <button type="button" className="mark" aria-label={`${merchant.brand.name} home`} onClick={() => onNavigate('welcome')} style={{ border: 0, padding: 0 }}>
              <BrandMark className="w-8 h-8" textClassName="text-[24px]" />
            </button>
            <div className="grow">
              <span className="eyebrow" style={{ fontSize: 10.5 }}>
                {merchant.brand.tagline}
              </span>
              <p className="serif" style={{ fontSize: 21, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {merchant.brand.name}
              </p>
            </div>
          </>
        ) : title && !['admin-login', 'retailer-auth'].includes(currentScreen) ? (
          eyebrow ? (
            <div className="grow">
              <span className="eyebrow">{eyebrow}</span>
              <h1 style={{ marginTop: 2 }}>{title}</h1>
            </div>
          ) : (
            <h1 style={title.length > 13 ? { fontSize: 24 } : undefined}>{title}</h1>
          )
        ) : (
          <span className="grow" />
        )}

        {aside}

        {showProfile ? (
          <ProfileMenu
            buyer={currentMerchant}
            isAdmin={isAdminLoggedIn}
            onOpenOrders={onOpenOrders}
            onOpenAdminConsole={() => onNavigate('admin-hub')}
            onChangePassword={() => onNavigate('change-password')}
            onOpenAbout={() => onNavigate(isAdminLoggedIn ? 'admin-about' : 'about')}
            onLogout={onLogout}
          />
        ) : (
          isHome &&
          !currentMerchant &&
          !isAdminLoggedIn && (
            <button type="button" className="ib" aria-label="Sign in" onClick={() => onNavigate('retailer-auth')}>
              <I n="user" />
            </button>
          )
        )}
      </div>
    </header>
  );
};
