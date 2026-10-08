import React from 'react';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';
import { Icon } from '../layouts/emergent/ui';

/** A full Basic store (50 buyers) greets a new buyer like a courteous host, not an error page. No code was sent. */
export const CatalogueFullScreen: React.FC<{ name: string; phone: string; onBack: () => void }> = ({ name, phone, onBack }) => {
  const text = `Hi, I'd like access to your catalogue — ${name || 'a buyer'}, +91 ${phone}`;
  const href = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(text)}`;
  return (
    <div className="em-page notabs" style={{ maxWidth: 480 }} data-testid="catalogue-full-screen">
      <div className="em-pad step-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <BrandMark className="w-12 h-12" textClassName="text-[34px]" />
        <div>
          <div className="em-ey">{merchant.brand.name}</div>
          <div className="em-rule" style={{ width: 48 }} />
          <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.15 }}>
            The showroom is full right now
          </h1>
          <p className="em-mut" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }} data-testid="catalogue-full-message">
            {merchant.brand.name} has reached the number of buyers it can host at the moment, so no code was sent to +91 {phone}. Ask the owner for a place; they are usually quick to make room.
          </p>
        </div>
        <a className="btn wa" href={href} target="_blank" rel="noopener noreferrer" data-testid="catalogue-full-whatsapp">
          <Icon n="wa" />
          Message the owner on WhatsApp
        </a>
        <button type="button" className="em-link" style={{ alignSelf: 'center' }} onClick={onBack} data-testid="catalogue-full-signin">
          Already a buyer? Sign in
        </button>
      </div>
    </div>
  );
};
