import React, { useMemo, useState } from 'react';
import { Product } from '../types';
import { merchant } from '../merchant';

interface ShortlistScreenProps {
  products: Product[];
  /** SKUs the buyer has hearted. */
  shortlist: string[];
  storeName: string;
  onRemove: (product: Product) => void;
  /** Adds one piece of each design to the current order. */
  onAddAllToOrder: (items: Product[]) => Promise<void>;
  /** Opens the requisition slip the buyer can share with their own customer. */
  onShareWithCustomer: (items: Product[], totalNetWeight: number) => void;
  onBrowse: () => void;
}

export const ShortlistScreen: React.FC<ShortlistScreenProps> = ({ products, shortlist, storeName, onRemove, onAddAllToOrder, onShareWithCustomer, onBrowse }) => {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  // Hearted designs that have since been removed from the catalogue simply do not show.
  const items = useMemo(() => shortlist.map((sku) => products.find((p) => p.sku === sku)).filter((p): p is Product => Boolean(p)), [products, shortlist]);
  const totalNet = parseFloat(items.reduce((sum, p) => sum + p.netWt, 0).toFixed(3));

  const sendOnWhatsApp = () => {
    const text =
      `*${merchant.brand.name.toUpperCase()} SHORTLIST*\n*From:* ${storeName}\n*Designs:* ${items.length} · ${totalNet.toFixed(3)} g net\n\n` +
      items.map((p) => `• ${p.title} (${p.sku}) · ${p.purity} · ${p.netWt.toFixed(2)} g`).join('\n') +
      '\n\nPlease share availability.';
    window.open(`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const addAll = async () => {
    setAdding(true);
    await onAddAllToOrder(items);
    setAdding(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-3 px-6 pt-20 max-w-sm mx-auto">
        <span className="material-symbols-outlined text-[44px] text-primary-fixed-dim">favorite</span>
        <h2 className="font-serif text-[24px] text-primary">Your shortlist is empty</h2>
        <p className="font-sans text-sm text-on-surface-variant">Tap the heart on any design to keep it here. You can then send the list to us on WhatsApp or add it all to your order.</p>
        <button onClick={onBrowse} className="mt-2 px-6 h-12 rounded-2xl bg-secondary text-white font-sans text-sm font-bold">
          Browse designs
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto pb-72">
      <div className="px-4 pt-2 pb-3">
        <h2 className="font-serif text-[26px] text-primary leading-tight">Shortlist</h2>
        <p className="font-sans text-sm text-on-surface-variant">
          {items.length} {items.length === 1 ? 'design' : 'designs'} · {totalNet.toFixed(2)} g net
        </p>
      </div>

      <ul className="flex flex-col bg-white border-y border-outline-variant">
        {items.map((p) => (
          <li key={p.sku} className="grid grid-cols-[64px_1fr_44px] items-center gap-3 px-4 py-3 border-b border-surface-container last:border-b-0">
            <img src={p.image} alt="" className="w-16 h-16 rounded-2xl object-cover bg-surface-container" referrerPolicy="no-referrer" />
            <div className="min-w-0">
              <p className="font-sans text-[15px] font-bold text-on-surface truncate">{p.title}</p>
              <p className="font-sans text-sm text-on-surface-variant">
                {p.purity} · Net {p.netWt.toFixed(2)} g
              </p>
              <p className="font-sans text-xs text-outline">{p.sku}</p>
            </div>
            <button onClick={() => onRemove(p)} aria-label={`Remove ${p.title} from shortlist`} className="w-11 h-11 flex items-center justify-center text-outline hover:text-error">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Send panel: sits above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-16 z-40 px-3 pb-2">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-[0_-6px_24px_rgba(91,33,66,0.14)] border border-outline-variant p-4 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-[22px] text-primary">{totalNet.toFixed(2)} g net</span>
            <span className="font-sans text-sm font-bold text-on-surface-variant">
              {items.length} {items.length === 1 ? 'design' : 'designs'}
            </span>
          </div>
          <button onClick={sendOnWhatsApp} className="w-full h-12 rounded-2xl bg-[#25D366] text-[#06361a] font-sans text-sm font-extrabold flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Send shortlist on WhatsApp
          </button>
          <button
            onClick={addAll}
            disabled={adding}
            className="w-full h-12 rounded-2xl border-2 border-primary text-primary font-sans text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[20px]">{added ? 'check' : 'add_shopping_cart'}</span>
            {adding ? 'Adding…' : added ? 'Added to your order' : 'Add all to order'}
          </button>
          <button onClick={() => onShareWithCustomer(items, totalNet)} className="self-center text-sm font-bold text-primary hover:underline min-h-11 px-3">
            Share with my customer
          </button>
        </div>
      </div>
    </div>
  );
};
