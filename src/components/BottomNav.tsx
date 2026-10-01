import React from 'react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  orderCount: number;
  isAdminLoggedIn: boolean;
}

/**
 * Screen ids are older than the names buyers see: the 'categories' screen is the Catalogue (home) and the
 * 'catalogue' screen is Products.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentScreen, onNavigate, orderCount, isAdminLoggedIn }) => {
  const adminScreens: ActiveScreen[] = ['admin-hub', 'admin-orders', 'admin-login', 'new-product', 'add-category', 'admin-visitors', 'admin-buyers', 'admin-banners'];

  const tabs: Array<{ screen: ActiveScreen; label: string; icon: string; active: boolean; badge?: number }> = [
    { screen: 'categories', label: 'Catalogue', icon: 'grid_view', active: currentScreen === 'categories' },
    { screen: 'catalogue', label: 'Products', icon: 'diamond', active: currentScreen === 'catalogue' },
    { screen: 'orders', label: 'Orders', icon: 'receipt_long', active: currentScreen === 'orders', badge: orderCount },
    // Staff only
    ...(isAdminLoggedIn
      ? [{ screen: 'admin-hub' as const, label: 'Admin', icon: 'admin_panel_settings', active: adminScreens.includes(currentScreen) }]
      : [])
  ];

  return (
    <nav aria-label="Main" className="fixed bottom-0 w-full z-50 pb-safe bg-surface/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(28,28,26,0.06)] border-t border-outline-variant/30">
      <div className="h-16 max-w-lg md:max-w-xl mx-auto px-2 flex items-center justify-around">
        {tabs.map((tab) => (
          <button
            key={tab.screen}
            onClick={() => onNavigate(tab.screen)}
            aria-current={tab.active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center min-w-[64px] h-12 transition-all ${
              tab.active ? 'text-primary font-bold scale-105' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              {tab.badge ? (
                <span className="absolute -top-1.5 -right-2.5 bg-primary text-white font-mono text-[10px] leading-tight px-1.5 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                  {tab.badge}
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-sans font-semibold mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
