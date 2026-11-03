import React, { useMemo, useState } from 'react';
import { api } from '../../api';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { merchant } from '../../merchant';
import { Icon, fmtG, type KitProps } from '../emergent/ui';
import { withTransition } from '../../viewTransition';
import { Tile } from './ui';
import { ProductDetail } from './ProductDetail';
import { CartSheet } from './CartSheet';
import { getLang, hn, pur, t, tn, ts, useLang } from '../../i18n';

/**
 * Maison's Shortlist: the hearted designs as the same square tiles as the catalogue, with one summary bar (designs, net total, Order all,
 * Send on WhatsApp). The bar sits under the title on desktop and is anchored at the bottom on phones.
 */
export const Shortlist: React.FC<KitProps<'Shortlist'>> = ({ products, shortlist, storeName, purities, categories, onAddToOrder, onRemove, onClear, onAddAllToOrder, onBrowse }) => {
  const canOrder = usePlan().flags.orders;
  useLang();
  const [adding, setAdding] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false); // two taps, so one stray tap does not wipe the list
  const [open, setOpen] = useState<Product | null>(null);
  const [cartFor, setCartFor] = useState<Product | null>(null);

  const items = useMemo(() => shortlist.map((sku) => products.find((p) => p.sku === sku)).filter((p): p is Product => Boolean(p)), [products, shortlist]);
  const totalNet = parseFloat(items.reduce((sum, p) => sum + p.netWt, 0).toFixed(3));

  const sendOnWhatsApp = () => {
    void api.recordEnquiry({ kind: 'shortlist', count: items.length });
    const text = getLang() === 'hi'
      ? `*${ts(merchant.brand.name)} — शॉर्टलिस्ट*\n*स्टोर:* ${storeName}\n*डिज़ाइन:* ${items.length} · ${totalNet.toFixed(3)} ग्राम नेट\n\n` +
        items.map((p) => `• ${hn(p.title, p.titleHi)} (${p.sku}) · ${pur(p.purity)} · ${p.netWt.toFixed(2)} ग्राम`).join('\n') +
        '\n\nकृपया उपलब्धता बताइए।'
      : `*${merchant.brand.name.toUpperCase()} SHORTLIST*\n*From:* ${storeName}\n*Designs:* ${items.length} · ${totalNet.toFixed(3)} g net\n\n` +
        items.map((p) => `• ${p.title} (${p.sku}) · ${p.purity} · ${p.netWt.toFixed(2)} g`).join('\n') +
        '\n\nPlease share availability.';
    window.open(`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const addAll = async () => {
    setAdding(true);
    // The lines go into the order, then the list empties and the Orders tab opens as ONE transition (App.handleAddAllToOrder).
    await onAddAllToOrder(items, true);
    setAdding(false);
  };

  if (items.length === 0) {
    return (
      <div className="mx-page">
        <header className="mx-cat-head">
          <h1 className="mx-h2">{t('Shortlist')}</h1>
          <span className="mx-ey">{t('Your favourites')}</span>
        </header>
        <div className="mx-empty">
          <p className="mx-lede">{t('Your shortlist is empty')}</p>
          <p className="mx-note">{t('Tap the heart on any design to keep it here. Then send the list on WhatsApp or add it all to your order.')}</p>
          <button type="button" className="mx-btn" onClick={onBrowse}>{t('Browse designs')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-page mx-wish">
      <header className="mx-cat-head">
        <h1 className="mx-h2">{t('Shortlist')}</h1>
        <span className="mx-ey">{t('Your favourites')} · {tn(items.length, '{n} design', '{n} designs')}</span>
        <button type="button" className="mx-cta mx-clear" data-testid="shortlist-clear" onClick={() => (confirmClear ? onClear() : setConfirmClear(true))} onBlur={() => setConfirmClear(false)}>
          {t(confirmClear ? 'Tap again to clear' : 'Clear all')}
        </button>
      </header>

      <div className="mx-cat-body">
        <div className="mx-pgrid large">
          {items.map((p, i) => (
            <Tile
              key={p.sku}
              prod={p}
              index={i}
              hearted
              testId="shortlist-item"
              hitTestId="shortlist-open"
              heartLabel={t('Remove {name} from shortlist', { name: hn(p.title, p.titleHi) })}
              onOpen={(photo) => withTransition(() => setOpen(p), photo)}
              onHeart={() => onRemove(p)}
              onAdd={canOrder ? () => setCartFor(p) : undefined}
            />
          ))}
        </div>
        <p className="mx-note mx-center-note">{t('Tap a heart on any design to save it here.')}</p>
      </div>

      <div className="mx-bagbar">
        <dl className="mx-bag-sum">
          <div><dt className="mx-ey">{t('Designs')}</dt><dd>{items.length}</dd></div>
          <div><dt className="mx-ey">{t('Pieces (1 pc each)')}</dt><dd>{items.length}</dd></div>
          <div><dt className="mx-ey">{t('Net total')}</dt><dd>{t('{w} net', { w: fmtG(totalNet) })}</dd></div>
        </dl>
        <div className="mx-bag-act">
          {canOrder ? (
            <>
              <button type="button" className="mx-btn" data-testid="shortlist-order-all" onClick={addAll} disabled={adding}>
                {t(adding ? 'Adding…' : 'Order all')}
              </button>
              <button type="button" className="mx-btn sec" onClick={sendOnWhatsApp} aria-label={t('Send shortlist on WhatsApp')}>
                <Icon n="wa" size={16} />
                <span>{t('Send shortlist on WhatsApp')}</span>
              </button>
            </>
          ) : (
            <button type="button" className="mx-btn" onClick={sendOnWhatsApp}>
              <Icon n="wa" size={16} />
              <span>{t('Enquire on WhatsApp')}</span>
            </button>
          )}
        </div>
      </div>

      <ProductDetail
        product={open}
        isAdmin={false}
        purities={purities}
        categories={categories}
        hearted={open ? shortlist.includes(open.sku) : false}
        onToggleShortlist={onRemove}
        onClose={() => withTransition(() => setOpen(null))}
        onEdit={() => {}}
        onAddToOrder={onAddToOrder}
      />

      {cartFor && <CartSheet product={cartFor} purities={purities} categories={categories} onClose={() => setCartFor(null)} onAdd={(p, qty, pu) => onAddToOrder(p, qty, pu)} />}
    </div>
  );
};
