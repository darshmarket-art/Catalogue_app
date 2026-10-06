import React from 'react';
import type { ActiveScreen } from '../../types';
import { merchant } from '../../merchant';
import { BrandMark } from '../../components/BrandMark';
import { ProfileMenu } from '../../components/ProfileMenu';
import { Icon, type KitProps } from './ui';
import { LangToggle } from '../../components/LangToggle';
import { t, ts, useLang } from '../../i18n';

// The owner's four tabs (plus Store, and the buyer pages they preview) carry the brand and profile bar; everything else is a sub-page with a back button.
const ADMIN_TAB_SCREENS: ActiveScreen[] = ['admin-hub', 'orders', 'catalogue', 'admin-buyers', 'admin-store', 'categories'];
const ADMIN_SUB_SCREENS: ActiveScreen[] = ['new-product', 'add-category', 'admin-about', 'admin-plan', 'admin-alerts', 'admin-messages', 'admin-insights', 'admin-password'];
/** Sub-pages opened from Store go back to Store. */
const STORE_CHILDREN: ActiveScreen[] = ['admin-about', 'admin-plan', 'admin-alerts', 'admin-messages', 'admin-insights', 'admin-password'];
const TAB_SCREENS: ActiveScreen[] = ['categories', 'catalogue', 'shortlist', 'orders'];

const TITLES: Partial<Record<ActiveScreen, string>> = {
  catalogue: 'Catalogue',
  shortlist: 'Shortlist',
  orders: 'Orders',
  'admin-hub': 'Admin',
  'admin-orders': 'Orders desk',
  'admin-visitors': 'Buyer engagement',
  'admin-enquiries': 'WhatsApp enquiries',
  'admin-buyers': 'Buyers',
  'admin-banners': 'Home banners',
  'admin-purities': 'Purity options',
  'admin-about': 'About us',
  'admin-plan': 'Plan and usage',
  'admin-alerts': 'Alerts and WhatsApp',
  'admin-messages': 'Message log',
  'admin-insights': 'Insights',
  'admin-password': 'Change password',
  about: 'About us',
};

/**
 * Emergent's top bar. The four tab screens carry their own title blocks, so there it is only the brand and the profile button.
 * Everywhere else (admin, About, password, sign-in) it is the atlas's back button, a centred title and the page's aside.
 */
export const Header: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, parentScreen, isAdminLoggedIn, currentMerchant, onLogout, onOpenOrders, isEditing, eyebrow, aside }) => {
  useLang();
  const isAdminSub = isAdminLoggedIn && ADMIN_SUB_SCREENS.includes(currentScreen);
  const isTab = isAdminLoggedIn ? ADMIN_TAB_SCREENS.includes(currentScreen) : TAB_SCREENS.includes(currentScreen);
  const isHome = currentScreen === 'categories';
  const isSub = isAdminSub || ['admin-login', 'retailer-auth', 'about'].includes(currentScreen);
  const overHero = currentScreen === 'about'; // the About hero runs under the bar
  const title =
    currentScreen === 'new-product' ? (isEditing ? 'Edit design' : 'New design') : currentScreen === 'add-category' ? (isEditing ? 'Edit collection' : 'New collection') : currentScreen === 'about' ? t('About {name}', { name: ts(merchant.brand.name) }) : isAdminLoggedIn ? TITLES[currentScreen] : TITLES[currentScreen] && t(TITLES[currentScreen] as string);
  const showTitle = Boolean(title) && !['admin-login', 'retailer-auth'].includes(currentScreen) && !overHero;
  const showProfile = (currentMerchant || isAdminLoggedIn) && (isTab || currentScreen === 'admin-hub');
  const showSignIn = isTab && !currentMerchant && !isAdminLoggedIn;
  const width = currentScreen === 'catalogue' ? 1100 : isHome ? 760 : 640;

  const handleBack = () => {
    if (parentScreen) {
      onNavigate(parentScreen);
    } else if (isAdminSub && STORE_CHILDREN.includes(currentScreen)) {
      onNavigate('admin-store');
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
      onOpenAdminConsole={() => onNavigate('admin-store')}
      onOpenAbout={() => onNavigate(isAdminLoggedIn ? 'admin-about' : 'about')}
      onLogout={onLogout}
      onNavigate={onNavigate}
    />
  ) : showSignIn ? (
    <button type="button" className="em-circ" aria-label={t('Sign in')} onClick={() => onNavigate('retailer-auth')}>
      <Icon n="user" />
    </button>
  ) : null;

  return (
    <header className={`em-top${overHero ? ' clear' : ''}`}>
      {isTab ? (
        <div className="em-top-in" style={{ maxWidth: width }}>
          <button type="button" className="em-brand" aria-label={isAdminLoggedIn ? `${merchant.brand.name} home` : ts(merchant.brand.name)} onClick={() => onNavigate(isAdminLoggedIn ? 'admin-hub' : 'welcome')}>
            <span className="em-mark">
              <BrandMark className="w-6 h-6" textClassName="text-[18px]" />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="em-ser em-clip">{isAdminLoggedIn ? merchant.brand.name : ts(merchant.brand.name)}</span>
              {isHome && <span className="em-ey em-clip">{isAdminLoggedIn ? merchant.brand.tagline : ts(merchant.brand.tagline)}</span>}
            </span>
          </button>
          <span className="em-grow" />
          {!isAdminLoggedIn && <LangToggle />}
          {profile}
        </div>
      ) : (
        <div className="em-top-in sub" style={{ maxWidth: width }}>
          <div className="em-top-l">
            {isSub && (
              <button type="button" className={`em-circ${overHero ? ' f' : ''}`} aria-label={t('Back')} onClick={handleBack}>
                <Icon n="back" size={20} />
              </button>
            )}
          </div>
          <div className="em-top-c">
            {showTitle && (
              <>
                <span className="em-ey">{eyebrow ?? (isAdminSub ? 'Admin' : isAdminLoggedIn ? merchant.brand.name : ts(merchant.brand.name))}</span>
                <h1 className="em-ser">{title}</h1>
              </>
            )}
          </div>
          <div className="em-top-r">
            {!overHero && aside}
            {!isAdminLoggedIn && !isAdminSub && currentScreen !== 'admin-login' && <LangToggle onDark={overHero} />}
            {profile}
          </div>
        </div>
      )}
    </header>
  );
};
