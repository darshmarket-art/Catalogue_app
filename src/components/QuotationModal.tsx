import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  totalNetWeight: number;
  items: Product[];
  defaultFirm?: string;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  totalNetWeight,
  items,
  defaultFirm = ''
}) => {
  const [clientFirm, setClientFirm] = useState(defaultFirm);
  const [clientCity, setClientCity] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  useEffect(() => {
    if (isOpen) setClientFirm((current) => current || defaultFirm);
  }, [isOpen, defaultFirm]);

  if (!isOpen) return null;

  // Breakdown by Karat standard
  const weight22k = items
    .filter(i => i.purity.includes('22K'))
    .reduce((sum, i) => sum + i.netWt, 0);

  const weight24k = items
    .filter(i => i.purity.includes('24K'))
    .reduce((sum, i) => sum + i.netWt, 0);

  const totalGrossWeight = items.reduce((sum, i) => sum + i.grossWt, 0);

  const handleSendWhatsApp = () => {
    // Record functional inquiry telemetry
    api.recordInquiry({
      clientFirm,
      itemsCount: selectedCount,
      totalNetWeight: parseFloat(totalNetWeight.toFixed(3))
    }).catch(() => {});

    const summary = `*${merchant.brand.name.toUpperCase()} — WHOLESALE GRAM-BASIS REQUISITION*\n` +
      `*Client:* ${clientFirm}${clientCity ? ` (${clientCity})` : ''}\n` +
      `*Settlement Basis:* Pure Net Gold Weight (No Fiat Price Lock)\n` +
      `*Total Items:* ${selectedCount} Pieces\n` +
      `*Total Net Gold:* ${totalNetWeight.toFixed(3)}g Net\n` +
      `  • 22K (916) Net Wt: ${weight22k.toFixed(3)}g\n` +
      `  • 24K (999.9) Pure Wt: ${weight24k.toFixed(3)}g\n` +
      `  • Total Gross Weight: ${totalGrossWeight.toFixed(3)}g\n\n` +
      `*Itemized SKU Manifest:*\n` +
      items.map(it => `• ${it.title} (${it.sku}) — Net: ${it.netWt}g [${it.purity}]`).join('\n') +
      `\n\n*Settlement Terms:* Physical 999.9 Bullion Bar Handover or Bullion Banking Gold Metal Loan Credit.\n` +
      `_Generated via ${merchant.brand.name} B2B Members Terminal_`;

    const encoded = encodeURIComponent(summary);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    setSentNotice(true);
    setTimeout(() => {
      setSentNotice(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-primary-container/40">
        {/* Header */}
        <div className="bg-on-surface text-white p-4 flex items-center justify-between border-b border-primary-container/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-fixed-dim text-[22px]">scale</span>
            <div>
              <h3 className="font-serif text-[16px] font-bold text-primary-fixed">
                Wholesale Gram-Basis Requisition Sheet
              </h3>
              <p className="text-[10px] font-sans text-white/70">
                Pure fine gold weight settlement proforma • No fiat price lock
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto max-h-[70vh] space-y-3.5 text-xs text-on-surface">
          {sentNotice && (
            <div className="bg-secondary-container text-on-secondary-fixed p-2.5 rounded-lg font-sans border border-secondary flex items-center gap-1.5 animate-fade-in">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Transmitted to WhatsApp as Official Gram Settlement Manifest!</span>
            </div>
          )}

          {/* Client Details */}
          <div className="bg-surface-container-low p-3 rounded-xl border border-outline-variant/40 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-outline font-semibold block">Retailer Firm Name</label>
              <input
                className="w-full bg-white px-2 py-1.5 rounded text-xs border border-outline-variant/40 mt-0.5 font-semibold text-on-surface"
                value={clientFirm}
                onChange={(e) => setClientFirm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-outline font-semibold block">Market Hub / City</label>
              <input
                className="w-full bg-white px-2 py-1.5 rounded text-xs border border-outline-variant/40 mt-0.5 font-semibold text-on-surface"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
              />
            </div>
          </div>

          {/* Summary Weights (Pure Gram Basis) */}
          <div className="bg-white p-3 rounded-xl border border-outline-variant/50 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-surface-container">
              <span className="text-[11px] font-sans font-bold text-primary uppercase tracking-wider">
                Gram-Basis Weight Manifest
              </span>
              <span className="font-mono text-[10px] text-on-secondary-fixed bg-secondary-fixed px-2 py-0.5 rounded font-bold">
                100% PURE GRAM SETTLEMENT
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[9px] uppercase text-outline block">Selected Items</span>
                <span className="font-mono text-sm font-bold text-on-surface">{selectedCount} Pcs</span>
              </div>
              <div className="bg-primary-fixed/30 p-2 rounded-lg border border-primary-fixed-dim/60">
                <span className="text-[9px] uppercase text-primary block">Total Net Gold Wt</span>
                <span className="font-mono text-base font-bold text-primary">{totalNetWeight.toFixed(3)}g</span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg">
                <span className="text-[9px] uppercase text-outline block">Total Gross Wt</span>
                <span className="font-mono text-sm font-bold text-on-surface">{totalGrossWeight.toFixed(3)}g</span>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-container space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-outline">22K (916) Pure Gold Settlement Wt:</span>
                <span className="font-bold text-on-surface">{weight22k.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">24K (999.9) Refinery Fine Bar Wt:</span>
                <span className="font-bold text-on-surface">{weight24k.toFixed(3)} g</span>
              </div>
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-surface-container">
                <span className="text-primary">Total Fine Weight to Deposit:</span>
                <span className="text-primary">{totalNetWeight.toFixed(3)} g Fine</span>
              </div>
            </div>
          </div>

          {/* Itemized List Preview */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-outline uppercase font-bold tracking-wider">
              Selected Itemized Manifest ({items.length} SKUs)
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-2 bg-surface-container-low rounded-lg flex items-center justify-between text-[11px] border border-outline-variant/30"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-7 h-7 rounded object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <span className="font-bold text-on-surface block leading-tight">{item.title}</span>
                      <span className="font-mono text-[9px] text-outline">{item.sku}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-primary">{item.netWt.toFixed(2)}g Net</span>
                    <span className="font-mono text-[9px] block text-outline">{item.purity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="p-3 bg-surface-container border-t border-outline-variant/40 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 bg-white text-on-surface-variant text-xs font-semibold rounded-lg border border-outline-variant"
          >
            Cancel
          </button>

          <button
            onClick={handleSendWhatsApp}
            className="flex-1 py-2.5 px-3 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            <span>Send WhatsApp Gram Requisition Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
