import React from 'react';
import { merchant } from '../merchant';
import { t } from '../i18n';
import { Icon } from '../layouts/emergent/ui';

/**
 * The Orders tab on a plan without ordering (Basic, or a lapsed trial). The tab stays put, so the tab bar never changes under
 * people; this explains why it is empty and offers the way forward: Pro for the owner, WhatsApp for buyers.
 */
export const OrdersUnavailable: React.FC<{ admin: boolean; onSeePlans: () => void }> = ({ admin, onSeePlans }) => (
  <div className="em-page">
    <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, paddingTop: 48 }}>
      <span className="em-circ" style={{ width: 64, height: 64, background: 'var(--em-tint)' }}>
        <Icon n="package" size={28} />
      </span>
      <h2 className="em-ser" style={{ fontSize: 24 }}>{admin ? 'Orders are part of Pro' : t('Order on WhatsApp')}</h2>
      <p className="em-mut" style={{ maxWidth: 340, lineHeight: 1.5 }}>
        {admin
          ? 'On Basic, buyers enquire about designs on WhatsApp. Pro adds an order basket, the orders desk and order alerts.'
          : t('This store takes orders on WhatsApp. Shortlist the designs you like and send them, or message the store.')}
      </p>
      {admin ? (
        <button type="button" className="em-btn" style={{ minWidth: 220 }} onClick={onSeePlans}>
          See Pro
        </button>
      ) : (
        <a className="em-btn wa" style={{ minWidth: 220 }} href={`https://wa.me/${merchant.contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
          <Icon n="wa" size={18} />
          {t('Message on WhatsApp')}
        </a>
      )}
    </div>
  </div>
);
