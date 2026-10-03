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

/**
 * Screen ids are older than the names buyers see: the 'categories' screen is Home and the
 * 'catalogue' screen is the Catalogue tab (every design).
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate, orderCount, shortlistCount, isAdminLoggedIn }) => {
  const { flags } = usePlan();
  const adminScreens: ActiveScreen[] = ['admin-hub', 'admin-orders', 'admin-login', 'new-product', 'add-category', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-about'];

  const tabs: Array<{ screen: ActiveScreen; label: string; icon: string; active: boolean; badge?: number }> = [
    { screen: 'categories', label: 'Home', icon: 'home', active: currentScreen === 'categories' },
    { screen: 'catalogue', label: 'Catalogue', icon: 'grid_view', active: currentScreen === 'catalogue' },
    // Buyers only: designs they have hearted
    ...(isAdminLoggedIn ? [] : [{ screen: 'shortlist' as const, label: 'Shortlist', icon: 'favorite', active: currentScreen === 'shortlist', badge: shortlistCount }]),
    ...(flags.orders ? [{ screen: 'orders' as const, label: 'Orders', icon: 'receipt_long', active: currentScreen === 'orders', badge: orderCount }] : []),
    // Staff only
    ...(isAdminLoggedIn
      ? [{ screen: 'admin-hub' as const, label: 'Admin', icon: 'admin_panel_settings', active: adminScreens.includes(currentScreen) }]
      : [])
  ];

  return (
    <nav aria-label="Main" className="fixed bottom-0 w-full z-50 pb-safe bg-white border-t border-outline-variant">
      <div className="h-16 max-w-lg md:max-w-xl mx-auto px-1 flex items-center justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.screen}
            onClick={() => onNavigate(tab.screen)}
            aria-current={tab.active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[68px] h-14 rounded-2xl transition-colors ${
              tab.active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${tab.active ? 1 : 0}` }}>{tab.icon}</span>
              {tab.badge ? (
                <span className="absolute -top-1.5 -right-3 bg-primary-fixed-dim text-on-primary font-sans text-xs leading-tight px-1.5 py-0.5 rounded-full font-extrabold">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className={`text-xs font-sans mt-0.5 ${tab.active ? 'font-extrabold' : 'font-bold'}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
