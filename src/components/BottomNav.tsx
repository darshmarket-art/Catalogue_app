import React from 'react';
import { ActiveScreen } from '../types';

interface BottomNavProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  orderCount: number;
  isAdminLoggedIn: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentScreen,
  onNavigate,
  orderCount,
  isAdminLoggedIn
}) => {
  const isCatalogueActive = currentScreen === 'catalogue';
  const isCategoriesActive = currentScreen === 'categories';
  const isOrdersActive = currentScreen === 'orders';
  const isAdminActive = currentScreen === 'admin-hub' || currentScreen === 'admin-login' || currentScreen === 'new-product' || currentScreen === 'add-category';

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-[#fcf9f5]/95 backdrop-blur-xl shadow-[0_-2px_12px_rgba(28,28,26,0.06)] border-t border-[#d1c5b3]/30">
      <div className="h-16 max-w-lg mx-auto px-2 flex items-center justify-around">
        {/* Catalogue Tab */}
        <button
          onClick={() => onNavigate('catalogue')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all ${
            isCatalogueActive
              ? 'text-[#715509] font-bold scale-105'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">diamond</span>
          <span className="text-[11px] font-sans font-semibold mt-0.5">Catalogue</span>
        </button>

        {/* Categories Tab */}
        <button
          onClick={() => onNavigate('categories')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all ${
            isCategoriesActive
              ? 'text-[#715509] font-bold scale-105'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">grid_view</span>
          <span className="text-[11px] font-sans font-semibold mt-0.5">Categories</span>
        </button>

        {/* Orders Tab */}
        <button
          onClick={() => onNavigate('orders')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all relative ${
            isOrdersActive
              ? 'text-[#715509] font-bold scale-105'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <div className="relative">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            {orderCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-[#715509] text-white font-mono text-[10px] leading-tight px-1.5 py-0.5 rounded-full font-bold shadow-sm animate-pulse">
                {orderCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-sans font-semibold mt-0.5">Orders</span>
        </button>

        {/* Admin Tab */}
        <button
          onClick={() => onNavigate(isAdminLoggedIn ? 'admin-hub' : 'admin-login')}
          className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-all ${
            isAdminActive
              ? 'text-[#715509] font-bold scale-105'
              : 'text-[#4d4638] hover:text-[#1c1c1a]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
          <span className="text-[11px] font-sans font-semibold mt-0.5">Admin</span>
        </button>
      </div>
    </nav>
  );
};
