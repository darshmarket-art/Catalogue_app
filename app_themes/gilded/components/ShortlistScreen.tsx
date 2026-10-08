import { usePlan } from '../plan';
import React, { useMemo, useState } from 'react';
import { Product } from '../types';
import { merchant } from '../merchant';
import { I, Photo } from './ui';

interface ShortlistScreenProps {
  products: Product[];
  /** SKUs the buyer has hearted. */
  shortlist: string[];
  storeName: string;
  onRemove: (product: Product) => void;
  /** Adds one piece of each design to the current order. */
  onAddAllToOrder: (items: Product[]) => Promise<void>;
  onBrowse: () => void;
}

/** Shortlist (artboard 2.6): hearted designs, sent on WhatsApp or added to the order in one go. */
export const ShortlistScreen: React.FC<ShortlistScreenProps> = ({ products, shortlist, storeName, onRemove, onAddAllToOrder, onBrowse }) => {
  const canOrder = usePlan().flags.orders;
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
      <div className="scroll" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48, gap: 10 }}>
        <span className="tag gold" style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', padding: 0 }}>
          <I n="heart" />
        </span>
        <h2 style={{ fontSize: 24 }}>Your shortlist is empty</h2>
        <p className="sub" style={{ maxWidth: 300 }}>
          Tap the heart on any design to keep it here. Then send the list on WhatsApp or add it all to your order.
        </p>
        <button type="button" className="btn" style={{ maxWidth: 260, marginTop: 6 }} onClick={onBrowse}>
          Browse designs
        </button>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ gap: 12, paddingBottom: canOrder ? 'calc(300px + var(--sab))' : 'calc(240px + var(--sab))' }}>
      {items.map((p, i) => (
        <div key={p.sku} className="card row" style={{ padding: 10 }}>
          <Photo src={p.image} tone={i} style={{ width: 76, height: 76, flex: 'none' }} />
          <div className="grow">
            <b>{p.title}</b>
            <p className="sub" style={{ fontSize: 13 }}>
              {p.sku} · {p.purity.split(' ')[0]} · {p.netWt.toFixed(3)} g
            </p>
          </div>
          <button type="button" className="ib" aria-label={`Remove ${p.title} from shortlist`} onClick={() => onRemove(p)}>
            <I n="heart" style={{ background: 'var(--bad)' }} />
          </button>
        </div>
      ))}
      <p className="hint" style={{ textAlign: 'center' }}>
        Tap a heart on any design to save it here.
      </p>

      <div className="dock">
        <div className="card col" style={{ gap: 10, padding: 14, boxShadow: 'var(--sh-2)' }}>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span className="stat grow" style={{ fontSize: 24 }}>
              {totalNet.toFixed(3)} g net
            </span>
            <span className="sub" style={{ fontWeight: 700 }}>
              {items.length} {items.length === 1 ? 'design' : 'designs'}
            </span>
          </div>
          <button type="button" className="btn wa" onClick={sendOnWhatsApp}>
            <I n="whats" />
            {canOrder ? 'Send shortlist on WhatsApp' : 'Enquire on WhatsApp'}
          </button>
          {canOrder && (
            <button type="button" className="btn alt" onClick={addAll} disabled={adding}>
              <I n={added ? 'check' : 'receipt'} />
              {adding ? 'Adding…' : added ? 'Added to your order' : 'Add all to order'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
