import { usePlan } from '../plan';
import React from 'react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  orderCount: number;
  shortlistCount: number;
  isAdminLoggedIn: boolean;
}

const ADMIN_SCREENS: ActiveScreen[] = ['admin-hub', 'admin-login', 'new-product', 'add-category', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-about', 'admin-plan'];

/**
 * The canvas's floating tab bar. Screen ids are older than the names buyers see: the 'categories' screen is Home
 * and the 'catalogue' screen is the Catalogue tab (every design).
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate, orderCount, shortlistCount, isAdminLoggedIn }) => {
  const { flags } = usePlan();

  const tabs: Array<{ screen: ActiveScreen; label: string; icon: string; active: boolean; badge?: number }> = [
    { screen: 'categories', label: 'Home', icon: 'home', active: currentScreen === 'categories' },
    { screen: 'catalogue', label: 'Catalogue', icon: 'grid', active: currentScreen === 'catalogue' },
    // Buyers only: designs they have hearted
    ...(isAdminLoggedIn ? [] : [{ screen: 'shortlist' as const, label: 'Shortlist', icon: 'heart', active: currentScreen === 'shortlist', badge: shortlistCount }]),
    ...(flags.orders ? [{ screen: 'orders' as const, label: 'Orders', icon: 'receipt', active: currentScreen === 'orders' || currentScreen === 'admin-orders', badge: orderCount }] : []),
    // Staff only
    ...(isAdminLoggedIn ? [{ screen: 'admin-hub' as const, label: 'Admin', icon: 'shield', active: ADMIN_SCREENS.includes(currentScreen) }] : [])
  ];

  return (
    <div className="tabwrap">
      <nav className="tabbar" aria-label="Main">
        {tabs.map((tab) => (
          <button key={tab.screen} type="button" onClick={() => onNavigate(tab.screen)} aria-current={tab.active ? 'page' : undefined} className={`tab${tab.active ? ' on' : ''}`}>
            <span style={{ position: 'relative' }}>
              <i aria-hidden="true" className={`i i-${tab.icon}`} />
              {tab.badge ? <span className="badge">{tab.badge}</span> : null}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
