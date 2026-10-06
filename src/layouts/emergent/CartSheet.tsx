import React, { useState } from 'react';
import type { Category, Product, Purity } from '../../types';
import { Icon, Sheet, fmtG } from './ui';
import { hn, pur, t, tn, useLang } from '../../i18n';

/**
 * The purities a design is sold in: the ones its collection is set up with (Edit collection > Purities sold here), or every purity
 * the owner offers when the collection names none. The design's own purity is always included.
 */
export function soldPurities(product: Product, purities: Purity[], categories: Category[]): Purity[] {
  const keys = categories.find((c) => c.name === product.category)?.eligibleKarats ?? [];
  const sold = purities.filter((p) => (keys.length ? keys.includes(p.key) : p.enabled) || p.key === product.purity);
  return sold.length ? sold : [{ key: product.purity, title: product.purity, enabled: true }];
}

interface CartSheetProps {
  product: Product;
  /** Purities the owner currently offers. */
  purities: Purity[];
  categories: Category[];
  onClose: () => void;
  /** Called once per purity that has pieces, then the sheet closes. */
  onAdd: (product: Product, quantity: number, purity: string) => void;
}

/** "Add to cart": how many pieces of a design in each purity on offer. The design's own purity starts at 1. */
export const CartSheet: React.FC<CartSheetProps> = ({ product, purities, categories, onClose, onAdd }) => {
  useLang();
  const [qtys, setQtys] = useState<Record<string, number>>({ [product.purity]: 1 });
  const options = soldPurities(product, purities, categories);
  const totalPcs = options.reduce((n, o) => n + (qtys[o.key] ?? 0), 0);
  const setQty = (key: string, n: number) => setQtys((q) => ({ ...q, [key]: Math.max(0, Math.min(999, n)) }));
  const add = () => {
    options.forEach((o) => (qtys[o.key] ?? 0) > 0 && onAdd(product, qtys[o.key], o.key));
    onClose();
  };

  return (
    <Sheet label={t('Add {name} to cart', { name: hn(product.title, product.titleHi) })} onClose={onClose}>
      <div className="em-row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="em-grow" style={{ minWidth: 0 }}>
          <div className="em-ser" style={{ fontSize: 22 }}>
            {hn(product.title, product.titleHi)}
          </div>
          <p className="em-mut" style={{ fontSize: 13, margin: '4px 0 0' }}>
            {t('Choose how many pieces you want in each purity.')}
          </p>
        </div>
        <button type="button" className="em-circ" data-testid="cart-sheet-close" aria-label={t('Close')} onClick={onClose} style={{ flex: 'none' }}>
          <Icon n="x" size={18} />
        </button>
      </div>

      <div data-testid="cart-purity-rows">
        {options.map((o, i) => {
          const n = qtys[o.key] ?? 0;
          return (
            <div key={o.key} className="em-row em-sb" style={{ gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--em-line)' : 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{pur(o.title)}</div>
                <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                  {n > 0 ? t('{n} × {w} = {total} net', { n, w: fmtG(product.netWt), total: fmtG(product.netWt * n) }) : t('{w} net each', { w: fmtG(product.netWt) })}
                </div>
              </div>
              <div className="em-qty">
                <button type="button" aria-label={t('Decrease {name}', { name: pur(o.title) })} disabled={n === 0} onClick={() => setQty(o.key, n - 1)}>
                  <Icon n="minus" size={16} />
                </button>
                <em className="em-ser" aria-live="polite">
                  {n}
                </em>
                <button type="button" aria-label={t('Increase {name}', { name: pur(o.title) })} onClick={() => setQty(o.key, n + 1)}>
                  <Icon n="plus" size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="em-row em-sb" style={{ borderTop: '1px solid var(--em-line)', paddingTop: 12 }}>
        <span className="em-ey">{t('Total')}</span>
        <b>
          {tn(totalPcs, '{n} piece', '{n} pieces')} · {t('{w} net', { w: fmtG(product.netWt * totalPcs) })}
        </b>
      </div>

      <button type="button" className="em-btn" data-testid="cart-confirm" disabled={totalPcs === 0} onClick={add}>
        <Icon n="bag" />
        {t('Add to cart')}
      </button>
    </Sheet>
  );
};
