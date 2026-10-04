import React from 'react';
import { About } from '../types';
import { merchant } from '../merchant';
import { BrandMark } from './BrandMark';

/** "About us": who the owner is and how to reach the business. Anything the owner leaves empty falls back to the merchant's own details. */
export const AboutScreen: React.FC<{ about: About }> = ({ about }) => {
  const phone = about.phone || merchant.contact.deskPhone;
  const address = about.address || merchant.contact.address;
  const digits = phone.replace(/[^0-9+]/g, '');
  const story = about.story || merchant.brand.description;

  const actions = [
    { label: 'Call', href: `tel:${digits}`, icon: 'call' },
    { label: 'WhatsApp', href: `https://wa.me/${merchant.contact.whatsapp}`, icon: 'chat' },
    ...(about.email ? [{ label: 'Email', href: `mailto:${about.email}`, icon: 'mail' }] : []),
    ...(address ? [{ label: 'Map', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, icon: 'location_on' }] : []),
    ...(about.website ? [{ label: 'Website', href: about.website, icon: 'language' }] : [])
  ];

  const details: Array<[string, string | undefined]> = [
    ['Address', address],
    ['Phone', phone],
    ['Email', about.email],
    ['Opening hours', about.openingHours],
    ['GST number', about.gstin || undefined],
    ['Registration', merchant.legal.registrationLine]
  ];

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto pb-32">
      <div className="flex flex-col items-center text-center px-6 pt-4 pb-6">
        <div className="w-24 h-24 rounded-3xl bg-secondary-deep border border-tertiary-fixed-dim/45 shadow-md flex items-center justify-center">
          <BrandMark className="w-16 h-16" textClassName="text-[48px]" />
        </div>
        <h1 className="font-serif text-[30px] leading-tight text-primary mt-4">{merchant.brand.name}</h1>
        <p className="font-sans text-sm font-extrabold tracking-[0.16em] uppercase text-primary-fixed-dim mt-1">{merchant.brand.tagline}</p>
        {about.ownerName && (
          <p className="font-sans text-[15px] text-on-surface-variant mt-3">
            <strong className="text-on-surface">{about.ownerName}</strong>
            {about.ownerRole ? ` · ${about.ownerRole}` : ''}
          </p>
        )}
      </div>

      <p className="font-sans text-base leading-relaxed text-on-surface px-6 whitespace-pre-line">{story}</p>

      <div className="flex flex-wrap gap-2 px-6 mt-6">
        {actions.map((a) => (
          <a
            key={a.label}
            href={a.href}
            target={a.href.startsWith('http') ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="min-h-12 px-4 rounded-2xl border-[1.5px] border-outline-variant bg-white flex items-center gap-2 font-sans text-sm font-extrabold text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
            {a.label}
          </a>
        ))}
      </div>

      <dl className="mt-6 border-t border-outline-variant">
        {details.map(([label, value]) =>
          value ? (
            <div key={label} className="px-6 py-3.5 border-b border-surface-container">
              <dt className="font-sans text-sm text-on-surface-variant">{label}</dt>
              <dd className="font-sans text-[15.5px] font-bold text-on-surface mt-0.5 whitespace-pre-line">{value}</dd>
            </div>
          ) : null
        )}
      </dl>
    </div>
  );
};
