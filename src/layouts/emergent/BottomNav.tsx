import React from 'react';
import { usePlan } from '../../plan';
import type { ActiveScreen } from '../../types';
import { Icon, type KitProps } from './ui';

const ADMIN_SCREENS: ActiveScreen[] = ['admin-hub', 'admin-login', 'new-product', 'add-category', 'admin-visitors', 'admin-enquiries', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-about', 'admin-plan'];

/**
 * Emergent's tab bar: Home, Catalogue, Shortlist, Orders, with a gold underline on the active tab and gold counts.
 * Same tabs and rules as the Gilded bar: buyers get Shortlist, staff get Admin instead, and Orders needs the plan's ordering flag.
 * Screen ids are older than the names buyers see: the 'categories' screen is Home and the 'catalogue' screen is the Catalogue tab.
 */
export const BottomNav: React.FC<KitProps<'BottomNav'>> = ({ currentScreen, onNavigate, orderCount, shortlistCount, isAdminLoggedIn }) => {
  const { flags } = usePlan();

  const tabs: Array<{ screen: ActiveScreen; label: string; icon: string; active: boolean; badge?: number }> = [
    { screen: 'categories', label: 'Home', icon: 'home', active: currentScreen === 'categories' },
    { screen: 'catalogue', label: 'Catalogue', icon: 'grid', active: currentScreen === 'catalogue' },
    ...(isAdminLoggedIn ? [] : [{ screen: 'shortlist' as const, label: 'Shortlist', icon: 'heart', active: currentScreen === 'shortlist', badge: shortlistCount }]),
    ...(flags.orders ? [{ screen: 'orders' as const, label: 'Orders', icon: 'package', active: currentScreen === 'orders' || currentScreen === 'admin-orders', badge: orderCount }] : []),
    ...(isAdminLoggedIn ? [{ screen: 'admin-hub' as const, label: 'Admin', icon: 'shield', active: ADMIN_SCREENS.includes(currentScreen) }] : [])
  ];

  return (
    <div className="em-tabs">
      <nav aria-label="Main">
        {tabs.map((tab) => (
          <button key={tab.screen} type="button" onClick={() => onNavigate(tab.screen)} aria-current={tab.active ? 'page' : undefined} className={`em-tab${tab.active ? ' on' : ''}`}>
            <span>
              <Icon n={tab.icon} size={tab.active ? 22 : 20} />
              {tab.badge ? <b className="em-bd">{tab.badge > 99 ? '99+' : tab.badge}</b> : null}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
