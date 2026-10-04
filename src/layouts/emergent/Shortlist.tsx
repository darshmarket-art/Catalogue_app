import React, { useMemo, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { Icon, Ph, Title, fmtG, stockTone, type KitProps } from './ui';

/** Shortlist (atlas Shortlist): hearted designs as a divided list, with the total net weight and the order and WhatsApp actions in a bar at the foot. */
export const Shortlist: React.FC<KitProps<'Shortlist'>> = ({ products, shortlist, storeName, onRemove, onAddAllToOrder, onBrowse }) => {
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
      <div className="em-page">
        <div className="em-pad">
          <Title eyebrow="Your favourites" title="Shortlist" />
        </div>
        <div className="em-empty" style={{ paddingTop: 32 }}>
          <span className="em-badge">
            <Icon n="heart" size={24} />
          </span>
          <h2 className="em-ser" style={{ fontSize: 24 }}>
            Your shortlist is empty
          </h2>
          <p className="em-mut" style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Tap the heart on any design to keep it here. Then send the list on WhatsApp or add it all to your order.
          </p>
          <button type="button" className="em-btn" onClick={onBrowse}>
            Browse designs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="em-page dock1">
      <div className="em-pad">
        <Title eyebrow={`Your favourites · ${items.length} ${items.length === 1 ? 'design' : 'designs'}`} title="Shortlist" />
        <div style={{ marginTop: 6 }}>
          {items.map((p, i) => (
            <div key={p.sku} className="em-li">
              <Ph src={p.image} tone={i} className="em-thumb" />
              <div className="em-grow">
                <div className="em-ser">{p.title}</div>
                <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                  {p.sku} · {p.purity.split(' ')[0]} · {fmtG(p.netWt)}
                </div>
                <div className="em-row" style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: stockTone(p.stockStatus) === 'conf' ? 'var(--em-ok)' : 'var(--em-mut)' }}>
                  <i className="em-dot" style={stockTone(p.stockStatus) === 'conf' ? undefined : { background: 'var(--em-warn)' }} />
                  {p.stockStatus}
                </div>
              </div>
              <button type="button" className="em-circ" style={{ border: 0, background: 'none' }} aria-label={`Remove ${p.title} from shortlist`} onClick={() => onRemove(p)}>
                <Icon n="heart" size={20} fill />
              </button>
            </div>
          ))}
        </div>
        <p className="em-hint" style={{ textAlign: 'center', marginTop: 12 }}>
          Tap a heart on any design to save it here.
        </p>
      </div>

      <div className="em-dock">
        <div className="em-dock-in" style={{ gap: 14 }}>
          <div className="em-grow">
            <div className="em-ey em-clip">
              {items.length} {items.length === 1 ? 'design' : 'designs'} · 1 pc each
            </div>
            <div className="em-ser tot">{fmtG(totalNet)} net</div>
          </div>
          {canOrder ? (
            <>
              <button type="button" className="em-circ" style={{ width: 46, height: 46, color: 'var(--em-wa)' }} onClick={sendOnWhatsApp} aria-label="Send shortlist on WhatsApp">
                <Icon n="wa" />
              </button>
              <button type="button" className="em-btn" onClick={addAll} disabled={adding} style={{ whiteSpace: 'nowrap' }}>
                <Icon n={added ? 'check' : 'bag'} />
                {adding ? 'Adding…' : added ? 'Added to order' : 'Order all'}
              </button>
            </>
          ) : (
            <button type="button" className="em-btn wa" onClick={sendOnWhatsApp}>
              <Icon n="wa" />
              Enquire on WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
