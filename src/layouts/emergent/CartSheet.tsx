import React, { useState } from 'react';
import type { Product, Purity } from '../../types';
import { Icon, Sheet, fmtG } from './ui';

interface CartSheetProps {
  product: Product;
  /** Purities the owner currently offers. */
  purities: Purity[];
  onClose: () => void;
  /** Called once per purity that has pieces, then the sheet closes. */
  onAdd: (product: Product, quantity: number, purity: string) => void;
}

/** "Add to cart": how many pieces of a design in each purity on offer. The design's own purity starts at 1. */
export const CartSheet: React.FC<CartSheetProps> = ({ product, purities, onClose, onAdd }) => {
  const [qtys, setQtys] = useState<Record<string, number>>({ [product.purity]: 1 });
  // Every purity on offer, plus the design's own if the owner has since switched it off.
  const offered = purities.filter((p) => p.enabled || p.key === product.purity);
  const options = offered.length ? offered : [{ key: product.purity, title: product.purity, enabled: true }];
  const totalPcs = options.reduce((n, o) => n + (qtys[o.key] ?? 0), 0);
  const setQty = (key: string, n: number) => setQtys((q) => ({ ...q, [key]: Math.max(0, Math.min(999, n)) }));
  const add = () => {
    options.forEach((o) => (qtys[o.key] ?? 0) > 0 && onAdd(product, qtys[o.key], o.key));
    onClose();
  };

  return (
    <Sheet label={`Add ${product.title} to cart`} onClose={onClose}>
      <div>
        <span className="em-ey">{product.sku}</span>
        <div className="em-ser" style={{ fontSize: 22, marginTop: 2 }}>
          {product.title}
        </div>
        <p className="em-mut" style={{ fontSize: 13, margin: '4px 0 0' }}>
          Choose how many pieces you want in each purity.
        </p>
      </div>

      <div data-testid="cart-purity-rows">
        {options.map((o, i) => {
          const n = qtys[o.key] ?? 0;
          return (
            <div key={o.key} className="em-row em-sb" style={{ gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--em-line)' : 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{o.title}</div>
                <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                  {n > 0 ? `${n} × ${fmtG(product.netWt)} = ${fmtG(product.netWt * n)} net` : `${fmtG(product.netWt)} net each`}
                </div>
              </div>
              <div className="em-qty">
                <button type="button" aria-label={`Decrease ${o.title}`} disabled={n === 0} onClick={() => setQty(o.key, n - 1)}>
                  <Icon n="minus" size={16} />
                </button>
                <em className="em-ser" aria-live="polite">
                  {n}
                </em>
                <button type="button" aria-label={`Increase ${o.title}`} onClick={() => setQty(o.key, n + 1)}>
                  <Icon n="plus" size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="em-row em-sb" style={{ borderTop: '1px solid var(--em-line)', paddingTop: 12 }}>
        <span className="em-ey">Total</span>
        <b>
          {totalPcs} {totalPcs === 1 ? 'piece' : 'pieces'} · {fmtG(product.netWt * totalPcs)} net
        </b>
      </div>

      <button type="button" className="em-btn" data-testid="cart-confirm" disabled={totalPcs === 0} onClick={add}>
        <Icon n="bag" />
        Add to cart
      </button>
    </Sheet>
  );
};
