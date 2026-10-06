import React, { useMemo, useState } from 'react';
import { api } from '../../api';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { ProductDetail } from './ProductDetail';
import { Icon, Ph, Title, fmtG, stockTone, type KitProps } from './ui';
import { getLang, hn, pur, t, tn, ts, useLang } from '../../i18n';

/** Shortlist (atlas Shortlist): hearted designs as a divided list, with the total net weight and the order and WhatsApp actions in a bar at the foot. */
export const Shortlist: React.FC<KitProps<'Shortlist'>> = ({ products, shortlist, storeName, purities, categories, onAddToOrder, onRemove, onAddAllToOrder, onBrowse }) => {
  const canOrder = usePlan().flags.orders;
  useLang();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  // The design whose details are open. Kept as the design itself so un-hearting it inside the details does not close the page.
  const [open, setOpen] = useState<Product | null>(null);

  // Hearted designs that have since been removed from the catalogue simply do not show.
  const items = useMemo(() => shortlist.map((sku) => products.find((p) => p.sku === sku)).filter((p): p is Product => Boolean(p)), [products, shortlist]);
  const totalNet = parseFloat(items.reduce((sum, p) => sum + p.netWt, 0).toFixed(3));

  const sendOnWhatsApp = () => {
    void api.recordEnquiry({ kind: 'shortlist', count: items.length });
    const text = getLang() === 'hi'
      ? `*${ts(merchant.brand.name)} — शॉर्टलिस्ट*\n*स्टोर:* ${storeName}\n*डिज़ाइन:* ${items.length} · ${totalNet.toFixed(3)} ग्राम नेट\n\n` +
        items.map((p) => `• ${hn(p.title, p.titleHi)} (${p.sku}) · ${pur(p.purity)} · ${p.netWt.toFixed(2)} ग्राम`).join('\n') +
        '\n\nकृपया उपलब्धता बताइए।'
      :
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
          <Title eyebrow={t('Your favourites')} title={t('Shortlist')} />
        </div>
        <div className="em-empty" style={{ paddingTop: 32 }}>
          <span className="em-badge">
            <Icon n="heart" size={24} />
          </span>
          <h2 className="em-ser" style={{ fontSize: 24 }}>
            {t('Your shortlist is empty')}
          </h2>
          <p className="em-mut" style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            {t('Tap the heart on any design to keep it here. Then send the list on WhatsApp or add it all to your order.')}
          </p>
          <button type="button" className="em-btn" onClick={onBrowse}>
            {t('Browse designs')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="em-page dock1 em-split">
      <div className="em-pad em-body">
        <Title eyebrow={`${t('Your favourites')} · ${tn(items.length, '{n} design', '{n} designs')}`} title={t('Shortlist')} />
        <div style={{ marginTop: 6 }}>
          {items.map((p, i) => (
            <div key={p.sku} className="em-li">
              <button type="button" className="em-li-open" aria-label={t('View {name}', { name: hn(p.title, p.titleHi) })} data-testid="shortlist-open" onClick={() => setOpen(p)} style={{ display: 'flex', alignItems: 'center', gap: 'inherit', flex: 1, minWidth: 0, padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <Ph src={p.image} tone={i} className="em-thumb" />
              <div className="em-grow">
                <div className="em-ser">{hn(p.title, p.titleHi)}</div>
                <div className="em-wt" style={{ marginTop: 3 }}>
                  {fmtG(p.netWt)}
                </div>
              </div>
              </button>
              <button type="button" className="em-circ" style={{ border: 0, background: 'none' }} aria-label={t('Remove {name} from shortlist', { name: hn(p.title, p.titleHi) })} onClick={() => onRemove(p)}>
                <Icon n="heart" size={20} fill />
              </button>
            </div>
          ))}
        </div>
        <p className="em-hint" style={{ textAlign: 'center', marginTop: 12 }}>
          {t('Tap a heart on any design to save it here.')}
        </p>
      </div>

      <ProductDetail
        product={open}
        isAdmin={false}
        purities={purities}
        categories={categories}
        hearted={open ? shortlist.includes(open.sku) : false}
        onToggleShortlist={onRemove}
        onClose={() => setOpen(null)}
        onEdit={() => {}}
        onAddToOrder={onAddToOrder}
      />

      <div className="em-dock">
        <div className="em-dock-in" style={{ gap: 14 }}>
          <div className="em-grow">
            <div className="em-ey em-clip">
              {tn(items.length, '{n} design', '{n} designs')} · {t('1 pc each')}
            </div>
            <div className="em-ser tot">{t('{w} net', { w: fmtG(totalNet) })}</div>
          </div>
          {canOrder ? (
            <>
              <button type="button" className="em-circ" style={{ width: 46, height: 46, color: 'var(--em-wa)' }} onClick={sendOnWhatsApp} aria-label={t('Send shortlist on WhatsApp')}>
                <Icon n="wa" />
              </button>
              <button type="button" className="em-btn" data-testid="shortlist-order-all" onClick={addAll} disabled={adding} style={{ whiteSpace: 'nowrap' }}>
                <Icon n={added ? 'check' : 'bag'} />
                {t(adding ? 'Adding…' : added ? 'Added to order' : 'Order all')}
              </button>
            </>
          ) : (
            <button type="button" className="em-btn wa" onClick={sendOnWhatsApp}>
              <Icon n="wa" />
              {t('Enquire on WhatsApp')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
