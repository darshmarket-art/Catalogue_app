import React from 'react';
import type { ActiveScreen } from '../types';
import { Icon } from './ui';

interface HeaderProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  parentScreen?: ActiveScreen | null;
  isAdminLoggedIn: boolean;
  currentMerchant: { name?: string } | null;
  onLogout: () => void;
  onOpenOrders: (tab: 'current' | 'past') => void;
  isEditing: boolean;
  eyebrow?: string;
  aside?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  isAdminLoggedIn,
  currentMerchant,
}) => {
  const isTab = ['categories', 'catalogue', 'shortlist', 'orders'].includes(currentScreen);

  const handleBrandClick = () => {
    onNavigate(isAdminLoggedIn ? 'admin-hub' : 'welcome');
  };

  return (
    <header className="bt-top">
      <div className="bt-top-in">
        <button type="button" className="bt-brand" onClick={handleBrandClick}>
          <span className="bt-mark">BJ</span>
          <span>Bhakti Jewels</span>
        </button>

        {isTab && (
          <div className="bt-actions">
            <button type="button" className="bt-btn" aria-label="Search" onClick={() => onNavigate('catalogue')}>
              <Icon name="search" />
            </button>
            <button type="button" className="bt-btn" aria-label="Notifications">
              <Icon name="bell" />
            </button>
            {currentMerchant ? (
              <button type="button" className="bt-btn" onClick={() => onNavigate('about')}>
                <Icon name="user" />
              </button>
            ) : (
              <button type="button" className="bt-btn" onClick={() => onNavigate('retailer-auth')}>
                <Icon name="user" />
              </button>
            )}
          </div>
        )}
      </div>

      {!isTab && (
        <div className="bt-pad" style={{ marginTop: 8 }}>
          <h2 className="bt-h2">{currentScreen === 'catalogue' ? 'Catalogue' : currentScreen === 'shortlist' ? 'Shortlist' : currentScreen === 'orders' ? 'Orders' : currentScreen === 'about' ? 'About' : ''}</h2>
        </div>
      )}
    </header>
  );
};
