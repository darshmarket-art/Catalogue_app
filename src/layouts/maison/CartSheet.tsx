import React, { useState } from 'react';
import type { Category, Product, Purity } from '../../types';
import { Icon, Ph, fmtG } from '../emergent/ui';
import { soldPurities } from '../emergent/CartSheet';
import { Drawer } from './ui';
import { hn, pur, t, tn, useLang } from '../../i18n';
import { SIZES_THUMB } from '../../photoSrcSet';

interface Props {
  product: Product;
  purities: Purity[];
  categories: Category[];
  onClose: () => void;
  /** Called once per purity that has pieces, then the drawer closes. */
  onAdd: (product: Product, quantity: number, purity: string) => void;
}

/** Maison's Add to cart: a drawer with the photo, a quantity line per purity on offer and the total. Same rules as Emergent's sheet. */
export const CartSheet: React.FC<Props> = ({ product, purities, categories, onClose, onAdd }) => {
  useLang();
  const [qtys, setQtys] = useState<Record<string, number>>({ [product.purity]: 1 });
  const options = soldPurities(product, purities, categories);
  const totalPcs = options.reduce((n, o) => n + (qtys[o.key] ?? 0), 0);
  const setQty = (key: string, n: number) => setQtys((q) => ({ ...q, [key]: Math.max(0, Math.min(999, n)) }));
  const add = () => {
    options.forEach((o) => (qtys[o.key] ?? 0) > 0 && onAdd(product, qtys[o.key], o.key));
    onClose();
  };
  const name = hn(product.title, product.titleHi);
  return (
    <Drawer label={t('Add {name} to cart', { name })} onClose={onClose}>
      <div className="mx-cs-top">
        <span className="mx-cs-ph"><Ph src={product.image} className="mx-fill" sizes={SIZES_THUMB} /></span>
        <div>
          <span className="mx-ey">{t('Add to cart')}</span>
          <h2 className="mx-h2 sm">{name}</h2>
          <p className="mx-note">{product.sku} · {t('{w} net each', { w: fmtG(product.netWt) })}</p>
        </div>
      </div>
      <p className="mx-note">{t('Choose how many pieces you want in each purity.')}</p>
      <div data-testid="cart-purity-rows" className="mx-rows">
        {options.map((o) => {
          const n = qtys[o.key] ?? 0;
          return (
            <div key={o.key} className="mx-row">
              <div>
                <b>{pur(o.title)}</b>
                <span className="mx-note">{n > 0 ? t('{n} × {w} = {total} net', { n, w: fmtG(product.netWt), total: fmtG(product.netWt * n) }) : t('{w} net each', { w: fmtG(product.netWt) })}</span>
              </div>
              <div className="mx-qty">
                <button type="button" aria-label={t('Decrease {name}', { name: pur(o.title) })} disabled={n === 0} onClick={() => setQty(o.key, n - 1)}><Icon n="minus" size={14} /></button>
                <em aria-live="polite">{n}</em>
                <button type="button" aria-label={t('Increase {name}', { name: pur(o.title) })} onClick={() => setQty(o.key, n + 1)}><Icon n="plus" size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-sum">
        <span className="mx-ey">{t('Total')}</span>
        <b>{tn(totalPcs, '{n} piece', '{n} pieces')} · {t('{w} net', { w: fmtG(product.netWt * totalPcs) })}</b>
      </div>
      <button type="button" className="mx-btn" data-testid="cart-confirm" disabled={totalPcs === 0} onClick={add}>{t('Add to cart')}</button>
    </Drawer>
  );
};
