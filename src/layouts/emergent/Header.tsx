import React from 'react';
import type { ActiveScreen } from '../../types';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { ProfileMenu } from '../../components/ProfileMenu';
import { Icon, type KitProps } from './ui';

const ADMIN_SUB_SCREENS: ActiveScreen[] = ['new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-about', 'admin-plan'];
const TAB_SCREENS: ActiveScreen[] = ['categories', 'catalogue', 'shortlist', 'orders'];

const TITLES: Partial<Record<ActiveScreen, string>> = {
  catalogue: 'Catalogue',
  shortlist: 'Shortlist',
  orders: 'Orders',
  'admin-hub': 'Admin',
  'admin-orders': 'Orders desk',
  'admin-visitors': 'Buyer engagement',
  'admin-buyers': 'Buyers',
  'admin-banners': 'Home banners',
  'admin-purities': 'Purity options',
  'admin-about': 'About us',
  'admin-plan': 'Plan and usage',
  about: 'About us',
};

/**
 * Emergent's top bar. The four tab screens carry their own title blocks, so there it is only the brand and the profile button.
 * Everywhere else (admin, About, password, sign-in) it is the atlas's back button, a centred title and the page's aside.
 */
export const Header: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, isAdminLoggedIn, currentMerchant, onLogout, onOpenOrders, isEditing, eyebrow, aside }) => {
  // The owner's Orders tab is the Orders desk: a titled sub-page with a back button, as in the atlas.
  const adminOrders = currentScreen === 'orders' && isAdminLoggedIn;
  const isAdminSub = ADMIN_SUB_SCREENS.includes(currentScreen) || adminOrders;
  const isTab = TAB_SCREENS.includes(currentScreen) && !adminOrders;
  const isHome = currentScreen === 'categories';
  const isSub = isAdminSub || ['admin-login', 'retailer-auth', 'about'].includes(currentScreen);
  const overHero = currentScreen === 'about'; // the About hero runs under the bar
  const title =
    adminOrders ? 'Orders desk' : currentScreen === 'new-product' ? (isEditing ? 'Edit design' : 'New design') : currentScreen === 'add-category' ? (isEditing ? 'Edit collection' : 'New collection') : TITLES[currentScreen];
  const showTitle = Boolean(title) && !['admin-login', 'retailer-auth'].includes(currentScreen) && !overHero;
  const showProfile = (currentMerchant || isAdminLoggedIn) && (isTab || currentScreen === 'admin-hub');
  const showSignIn = isTab && !currentMerchant && !isAdminLoggedIn;
  const width = currentScreen === 'catalogue' ? 1100 : isHome ? 760 : 640;

  const handleBack = () => {
    if (isEditing && (currentScreen === 'new-product' || currentScreen === 'add-category')) {
      onNavigate(currentScreen === 'new-product' ? 'catalogue' : 'categories');
    } else if (isAdminSub) {
      onNavigate('admin-hub');
    } else if (currentScreen === 'about') {
      onNavigate('categories');
    } else {
      onNavigate('welcome');
    }
  };

  const profile = showProfile ? (
    <ProfileMenu
      buyer={currentMerchant}
      isAdmin={isAdminLoggedIn}
      onOpenOrders={onOpenOrders}
      onOpenAdminConsole={() => onNavigate('admin-hub')}
      onOpenAbout={() => onNavigate(isAdminLoggedIn ? 'admin-about' : 'about')}
      onLogout={onLogout}
    />
  ) : showSignIn ? (
    <button type="button" className="em-circ" aria-label="Sign in" onClick={() => onNavigate('retailer-auth')}>
      <Icon n="user" />
    </button>
  ) : null;

  return (
    <header className={`em-top${overHero ? ' clear' : ''}`}>
      {isTab ? (
        <div className="em-top-in" style={{ maxWidth: width }}>
          <button type="button" className="em-brand" aria-label={`${merchant.brand.name} home`} onClick={() => onNavigate('welcome')}>
            <span className="em-mark">
              <BrandMark className="w-6 h-6" textClassName="text-[18px]" />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="em-ser em-clip">{merchant.brand.name}</span>
              {isHome && <span className="em-ey em-clip">{merchant.brand.tagline}</span>}
            </span>
          </button>
          <span className="em-grow" />
          {profile}
        </div>
      ) : (
        <div className="em-top-in sub" style={{ maxWidth: width }}>
          <div className="em-top-l">
            {isSub && (
              <button type="button" className={`em-circ${overHero ? ' f' : ''}`} aria-label="Back" onClick={handleBack}>
                <Icon n="back" size={20} />
              </button>
            )}
          </div>
          <div className="em-top-c">
            {showTitle && (
              <>
                <span className="em-ey">{eyebrow ?? (isAdminSub ? 'Admin' : merchant.brand.name)}</span>
                <h1 className="em-ser">{title}</h1>
              </>
            )}
          </div>
          <div className="em-top-r">
            {!overHero && aside}
            {profile}
          </div>
        </div>
      )}
    </header>
  );
};
