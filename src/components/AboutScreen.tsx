import React from 'react';
import { About } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';
import { I } from './ui';

/** "About us" (artboard 2.8). Anything the owner leaves empty falls back to the merchant's own details, or is hidden. */
export const AboutScreen: React.FC<{ about: About }> = ({ about }) => {
  const phone = about.phone || merchant.contact.deskPhone;
  const address = about.address || merchant.contact.address;
  const digits = phone.replace(/[^0-9+]/g, '');
  const story = about.story || merchant.brand.description;

  const actions = [
    { label: 'Call', href: `tel:${digits}`, icon: 'phone' },
    ...(about.email ? [{ label: 'Email', href: `mailto:${about.email}`, icon: 'mail' }] : []),
    ...(address ? [{ label: 'Map', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, icon: 'pin' }] : []),
    ...(about.website ? [{ label: 'Website', href: about.website, icon: 'globe' }] : [])
  ];

  const details: Array<[string, string | undefined]> = [
    ['Owner', about.ownerName ? `${about.ownerName}${about.ownerRole ? `, ${about.ownerRole}` : ''}` : undefined],
    ['Phone', phone],
    ['Email', about.email],
    ['Hours', about.openingHours],
    ['Address', address],
    ['GST', about.gstin || undefined],
    ['Registration', merchant.legal.registrationLine]
  ];

  return (
    <div className="scroll no-tabs" style={{ gap: 14 }}>
      <div className="card col" style={{ gap: 6, alignItems: 'flex-start' }}>
        <div className="mark lg">
          <BrandMark className="w-12 h-12" textClassName="text-[36px]" />
        </div>
        <h2 style={{ fontSize: 24 }}>{merchant.brand.name}</h2>
        <p className="sub" style={{ whiteSpace: 'pre-line' }}>
          {story}
        </p>
      </div>

      <div className="card kvs">
        {details.map(([label, value]) =>
          value ? (
            <div key={label} className="kv">
              <span>{label}</span>
              <b style={{ whiteSpace: 'pre-line' }}>{value}</b>
            </div>
          ) : null
        )}
      </div>

      <a className="btn wa" href={`https://wa.me/${merchant.contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
        <I n="whats" />
        WhatsApp
      </a>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {actions.map((a) => (
          <a key={a.label} className="btn sm alt" href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
            <I n={a.icon} size="s" />
            {a.label}
          </a>
        ))}
      </div>
    </div>
  );
};
