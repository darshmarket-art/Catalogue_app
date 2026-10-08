import React from 'react';
import type { ActiveScreen } from '../types';
import { Icon } from './ui';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  orderCount: number;
  shortlistCount: number;
  isAdminLoggedIn: boolean;
  adminBadges?: { orders: number; buyers: number };
}

const BUYER_TABS: Array<{ screen: ActiveScreen; label: string; icon: string }> = [
  { screen: 'categories', label: 'Home', icon: 'home' },
  { screen: 'catalogue', label: 'Catalogue', icon: 'grid' },
  { screen: 'shortlist', label: 'Shortlist', icon: 'heart' },
  { screen: 'orders', label: 'Orders', icon: 'package' },
];

const ADMIN_TABS: Array<{ screen: ActiveScreen; label: string; icon: string }> = [
  { screen: 'admin-hub', label: 'Today', icon: 'home' },
  { screen: 'catalogue', label: 'Catalogue', icon: 'grid' },
  { screen: 'admin-buyers', label: 'Buyers', icon: 'users' },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  orderCount,
  shortlistCount,
  isAdminLoggedIn,
  adminBadges,
}) => {
  const tabs = isAdminLoggedIn ? ADMIN_TABS : BUYER_TABS;

  return (
    <nav className="bt-nav" aria-label="Main">
      {tabs.map((tab) => {
        const active = currentScreen === tab.screen || (tab.screen === 'orders' && currentScreen === 'admin-orders');
        const badge = tab.screen === 'admin-buyers' ? adminBadges?.buyers : tab.screen === 'orders' && isAdminLoggedIn ? adminBadges?.orders : tab.screen === 'shortlist' ? shortlistCount : tab.screen === 'orders' ? orderCount : undefined;

        return (
          <button
            key={tab.screen}
            type="button"
            className={`bt-tab${active ? ' bt-active' : ''}`}
            onClick={() => onNavigate(tab.screen)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon n={tab.icon} size={24} />
            <span>{tab.label}</span>
            {badge ? <span className="bt-tab-badge">{badge > 99 ? '99+' : badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
};
