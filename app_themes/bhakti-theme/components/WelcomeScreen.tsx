import React from 'react';
import { Icon } from './ui';

interface WelcomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="bt-page">
      {/* Hero Section */}
      <div className="bt-hero">
        <div className="bt-hero-content">
          <div className="bt-ey bt-mb-2">Wholesale B2B</div>
          <h2 className="bt-h2">Bhakti Jewels</h2>
          <p>Exclusive wholesale B2B platform for certified bullion dealers and fine jewellery retailers.</p>
        </div>
        <div className="bt-hero-dots">
          <span className="bt-hero-dot on" />
          <span className="bt-hero-dot" />
          <span className="bt-hero-dot" />
        </div>
      </div>

      {/* Features */}
      <div className="bt-grid bt-mb-4">
        <div className="bt-card">
          <div className="bt-card-image">
            <Icon name="verified" />
          </div>
          <div className="bt-card-content">
            <h3 className="bt-card-title">100% BIS Hallmarked</h3>
            <p className="bt-card-weight">Assayed purity guaranteed with individual HUID laser inscriptions</p>
          </div>
        </div>
        <div className="bt-card">
          <div className="bt-card-image">
            <Icon name="scale" />
          </div>
          <div className="bt-card-content">
            <h3 className="bt-card-title">Pure Gram-Basis Trading</h3>
            <p className="bt-card-weight">Zero fiat rate slippage. Settle in fine gold weight (physical bullion or GML)</p>
          </div>
        </div>
        <div className="bt-card">
          <div className="bt-card-image">
            <Icon name="local_shipping" />
          </div>
          <div className="bt-card-content">
            <h3 className="bt-card-title">Doorstep Armoured Vault</h3>
            <p className="bt-card-weight">Insured transit via Sequel & BVC Logistics partners with OTP handover</p>
          </div>
        </div>
      </div>

      {/* Sign In Button */}
      <div className="bt-pad" style={{ marginTop: 20 }}>
        <button type="button" className="bt-btn" onClick={() => onNavigate('retailer-auth')} style={{ width: '100%', height: 54, borderRadius: 16, fontWeight: 700, fontSize: 16 }}>
          Enter the Portal
        </button>
      </div>
    </div>
  );
};
