import React from 'react';
import type { About } from '../types';
import { Icon } from './ui';

interface AboutScreenProps {
  about: About;
}

export const AboutScreen: React.FC<AboutScreenProps> = ({ about }) => {
  return (
    <div className="bt-page">
      <h2 className="bt-h2" style={{ padding: '0 20px', marginBottom: 20 }}>About Us</h2>

      <div className="bt-pad">
        <div className="bt-card bt-mb-4">
          <h3 className="bt-h3 bt-mb-2">Our Story</h3>
          <p className="bt-mut" style={{ lineHeight: 1.6 }}>
            {about.description || 'Bhakti Jewels is your trusted partner for wholesale jewellery. We specialize in BIS hallmarked gold and silver pieces, offering everything from traditional designs to contemporary styles.'}
          </p>
        </div>

        <div className="bt-card bt-mb-4">
          <h3 className="bt-h3 bt-mb-2">Why Choose Us</h3>
          <div className="bt-flex bt-flex-col bt-gap-3">
            {about.features?.map((f, i) => (
              <div key={i} className="bt-flex bt-gap-2">
                <Icon n="verified" style={{ color: 'var(--bt-accent)' }} size={20} />
                <span className="bt-sm">{f.title}</span>
              </div>
            )) || (
              <>
                <div className="bt-flex bt-gap-2">
                  <Icon n="verified" style={{ color: 'var(--bt-accent)' }} size={20} />
                  <span className="bt-sm">100% BIS Hallmarked Products</span>
                </div>
                <div className="bt-flex bt-gap-2">
                  <Icon n="scale" style={{ color: 'var(--bt-accent)' }} size={20} />
                  <span className="bt-sm">Pure Gram-Basis Trading</span>
                </div>
                <div className="bt-flex bt-gap-2">
                  <Icon n="local_shipping" style={{ color: 'var(--bt-accent)' }} size={20} />
                  <span className="bt-sm">Doorstep Armoured Vault Delivery</span>
                </div>
              </>
            )}
          </div>
        </div>

        {about.contact && (
          <div className="bt-card">
            <h3 className="bt-h3 bt-mb-2">Contact Information</h3>
            <div className="bt-flex bt-flex-col bt-gap-2 bt-mut">
              {about.contact.whatsapp && (
                <div className="bt-flex bt-gap-2">
                  <Icon n="wa" size={20} />
                  <span>{about.contact.whatsapp}</span>
                </div>
              )}
              {about.contact.deskPhone && (
                <div className="bt-flex bt-gap-2">
                  <Icon n="phone" size={20} />
                  <span>{about.contact.deskPhone}</span>
                </div>
              )}
              {about.contact.address && (
                <div className="bt-flex bt-gap-2">
                  <Icon n="pin" size={20} />
                  <span>{about.contact.address}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
