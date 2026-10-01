import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';
import { sector } from '../sector';
import { Field, Notice, Sheet, inputClass, btnWhatsApp, btnLink } from './ui';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  totalNetWeight: number;
  items: Product[];
  defaultFirm?: string;
}

/** The slip a buyer sends to their own customer: designs, weights, and the net weight per purity. */
export const QuotationModal: React.FC<QuotationModalProps> = ({ isOpen, onClose, selectedCount, totalNetWeight, items, defaultFirm = '' }) => {
  const [clientFirm, setClientFirm] = useState(defaultFirm);
  const [clientCity, setClientCity] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  useEffect(() => {
    if (isOpen) setClientFirm((current) => current || defaultFirm);
  }, [isOpen, defaultFirm]);

  if (!isOpen) return null;

  const totalGrossWeight = items.reduce((sum, i) => sum + i.grossWt, 0);
  const byPurity = Object.entries(
    items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.purity]: (acc[i.purity] ?? 0) + i.netWt }), {})
  );

  const handleSendWhatsApp = () => {
    api.recordInquiry({ clientFirm, itemsCount: selectedCount, totalNetWeight: parseFloat(totalNetWeight.toFixed(3)) }).catch(() => {});
    const summary = sector.quotationMessage({ brandName: merchant.brand.name, clientFirm, clientCity, items, selectedCount, totalNetWeight });
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank');
    setSentNotice(true);
    setTimeout(() => {
      setSentNotice(false);
      onClose();
    }, 2000);
  };

  return (
    <Sheet label="Share with my customer" onClose={onClose}>
      <h2 className="font-serif text-[26px] text-primary px-5 leading-tight">Share with my customer</h2>
      <p className="font-sans text-[15px] text-on-surface-variant px-5 mt-1 mb-4">
        {items.length} {items.length === 1 ? 'design' : 'designs'} selected. This sends a slip your customer can read on WhatsApp.
      </p>

      <div className="px-5 flex flex-col gap-4">
        {sentNotice && <Notice tone="ok">Opened in WhatsApp.</Notice>}

        <Field label="Your firm name" htmlFor="q-firm">
          <input id="q-firm" className={inputClass} value={clientFirm} onChange={(e) => setClientFirm(e.target.value)} />
        </Field>
        <Field label="Market hub or city" htmlFor="q-city">
          <input id="q-city" className={inputClass} value={clientCity} onChange={(e) => setClientCity(e.target.value)} />
        </Field>

        <dl className="flex flex-col font-sans text-[15px] border-t border-outline-variant">
          <div className="flex justify-between py-3 border-b border-outline-variant">
            <dt className="text-on-surface-variant">Total net weight</dt>
            <dd className="font-extrabold text-primary">{totalNetWeight.toFixed(3)} g</dd>
          </div>
          <div className="flex justify-between py-3 border-b border-outline-variant">
            <dt className="text-on-surface-variant">Total gross weight</dt>
            <dd className="font-extrabold">{totalGrossWeight.toFixed(3)} g</dd>
          </div>
          {byPurity.map(([purity, grams]) => (
            <div key={purity} className="flex justify-between py-3 border-b border-outline-variant">
              <dt className="text-on-surface-variant">{purity} net</dt>
              <dd className="font-extrabold">{grams.toFixed(3)} g</dd>
            </div>
          ))}
        </dl>

        <button onClick={handleSendWhatsApp} className={btnWhatsApp} type="button">
          Send on WhatsApp
        </button>
        <button onClick={onClose} className={`${btnLink} self-center`} type="button">
          Cancel
        </button>
      </div>
    </Sheet>
  );
};
