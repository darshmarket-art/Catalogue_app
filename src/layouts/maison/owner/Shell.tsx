import React from 'react';
import type { ActiveScreen } from '../../../types';
import { merchant } from '../../../merchant';
import { BrandMark } from '../../../components/BrandMark';
import { usePlan } from '../../../plan';
import { Icon, type KitProps } from '../../emergent/ui';
import { t, ts, useLang } from '../../../i18n';
import './maison-owner.css';

// The owner's Maison chrome. Below 1024px: a minimal top bar (wordmark, or back + title on sub-pages) and a bottom bar of four words.
// From 1024px: a left sidebar (wordmark, the four sections in light serif, View as a buyer) and a slim top bar that holds the page context.
// The tab ids, data-tab attributes and badges are the same as Emergent's, so the screens and tests behind them do not change.

/** Screens an owner sees that are buyer pages (View as a buyer): the bar says so and goes back to Store. */
const PREVIEW: ActiveScreen[] = ['categories', 'about', 'shortlist'];
const TAB_SCREENS: ActiveScreen[] = ['admin-hub', 'orders', 'catalogue', 'admin-buyers', 'admin-store'];
const STORE_CHILDREN: ActiveScreen[] = ['admin-about', 'admin-plan', 'admin-alerts', 'admin-messages', 'admin-insights', 'admin-requests', 'admin-password'];
const TITLES: Partial<Record<ActiveScreen, string>> = {
  'admin-hub': 'Today',
  orders: 'Orders',
  'admin-orders': 'Orders desk',
  catalogue: 'Catalogue',
  'admin-buyers': 'Buyers',
  'admin-store': 'Store',
  'admin-about': 'About us',
  'admin-plan': 'Plan and usage',
  'admin-alerts': 'WA Lighthouse',
  'admin-messages': 'Message log',
  'admin-insights': 'Insights',
  'admin-requests': 'Client requests',
  'admin-password': 'Change password'
};

export const OwnerHeader: React.FC<KitProps<'Header'>> = ({ currentScreen, onNavigate, parentScreen, isEditing, eyebrow, aside }) => {
  useLang();
  const preview = PREVIEW.includes(currentScreen);
  const isTab = TAB_SCREENS.includes(currentScreen);
  const title =
    currentScreen === 'new-product' ? (isEditing ? 'Edit design' : 'New design') : currentScreen === 'add-category' ? (isEditing ? 'Edit collection' : 'New collection') : preview ? 'Viewing as a buyer' : TITLES[currentScreen];
  const back = () => onNavigate(parentScreen ?? (preview ? 'admin-store' : STORE_CHILDREN.includes(currentScreen) ? 'admin-store' : 'admin-hub'));
  const word = ts(merchant.brand.name);

  return (
    <header className="mxo-top" data-testid="owner-top">
      <div className="mxo-bar">
        <div className="l">
          {!isTab && (
            <button type="button" className="mx-ib" aria-label={t('Back')} onClick={back}>
              <Icon n="back" size={22} />
            </button>
          )}
        </div>
        <div className="c">
          {isTab ? (
            <>
              <button type="button" className="mx-word mxo-wordm" aria-label={`${merchant.brand.name} home`} onClick={() => onNavigate('admin-hub')}>
                <BrandMark className="mx-logo" textClassName="text-[18px]" />
                <span>{word}</span>
              </button>
              <div className="mxo-t">
                <span className="mx-ey">{eyebrow ?? word}</span>
              </div>
            </>
          ) : (
            <>
              <span className="mx-ey">{preview ? word : eyebrow ?? 'Admin'}</span>
              <h1 className="em-ser">{title && t(title)}</h1>
            </>
          )}
        </div>
        <div className="r">
          {!isTab && aside}
          {isTab && (
            <button type="button" className="mxo-link" data-testid="admin-menu" aria-label={t('Store settings')} onClick={() => onNavigate('admin-store')}>
              <span className="mxo-menu-l">{t('Store')}</span>
              <Icon n="menu" size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export const OwnerNav: React.FC<KitProps<'BottomNav'>> = ({ currentScreen, onNavigate, adminBadges }) => {
  const { flags } = usePlan();
  useLang();
  const tabs: Array<{ screen: ActiveScreen; label: string; active: boolean; badge?: number }> = [
    { screen: 'admin-hub', label: 'Today', active: currentScreen === 'admin-hub' },
    // Orders stays on every plan (on Basic it explains itself), so the bar never changes under people.
    { screen: 'orders', label: 'Orders', active: currentScreen === 'orders' || currentScreen === 'admin-orders', badge: flags.orders ? adminBadges?.orders : undefined },
    { screen: 'catalogue', label: 'Catalogue', active: currentScreen === 'catalogue' },
    { screen: 'admin-buyers', label: 'Buyers', active: currentScreen === 'admin-buyers', badge: adminBadges?.buyers }
  ];
  return (
    <div className={`em-tabs mxo-tabs${TAB_SCREENS.includes(currentScreen) ? '' : ' sub'}`}>
      <button type="button" className="mxo-brand" aria-label={`${merchant.brand.name} home`} onClick={() => onNavigate('admin-hub')}>
        <BrandMark className="mx-logo" textClassName="text-[18px]" />
        <span>{ts(merchant.brand.name)}</span>
      </button>
      <nav aria-label="Main">
        {tabs.map((tab) => (
          <button key={tab.screen} type="button" data-tab={tab.screen} onClick={() => onNavigate(tab.screen)} aria-current={tab.active ? 'page' : undefined} className={`em-tab${tab.active ? ' on' : ''}`}>
            <i className="em-tab-l">{t(tab.label)}</i>
            {tab.badge ? <b key={tab.badge} className="mxo-n">{tab.badge > 99 ? '99+' : tab.badge}</b> : null}
          </button>
        ))}
      </nav>
      <div className="mxo-side-f">
        <button type="button" onClick={() => onNavigate('categories')}>{t('View as a buyer')}</button>
      </div>
    </div>
  );
};
