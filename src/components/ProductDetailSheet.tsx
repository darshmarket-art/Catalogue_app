import React, { useEffect, useRef, useState } from 'react';
import { Product } from '../types';
import { merchant } from '../merchant';

interface ProductDetailSheetProps {
  product: Product | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number) => void;
}

const row = 'flex items-center justify-between py-1.5 border-b border-surface-container text-xs font-sans';

export const ProductDetailSheet: React.FC<ProductDetailSheetProps> = ({ product, isAdmin, onClose, onEdit, onAddToOrder }) => {
  const [slide, setSlide] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlide(0);
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product?.id]);

  if (!product) return null;
  const details = merchant.productFields.filter((f) => product.extra?.[f.key] !== undefined);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={product.title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl animate-fade-in">
        <div className="relative bg-surface-container">
          <div
            ref={scroller}
            data-testid="product-gallery"
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
            onScroll={(e) => {
              const el = e.currentTarget;
              setSlide(Math.round(el.scrollLeft / el.clientWidth));
            }}
          >
            {product.images.map((src, i) => (
              <img key={src} src={src} alt={`${product.title} photo ${i + 1}`} className="w-full flex-shrink-0 snap-center aspect-square object-cover" referrerPolicy="no-referrer" />
            ))}
          </div>
          {product.images.length > 1 && (
            <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
              {product.images.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${slide === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[19px]">close</span>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <span className="font-mono text-[10px] text-outline">SKU: {product.sku}</span>
            <h2 className="font-serif text-[20px] font-bold text-on-surface leading-tight">{product.title}</h2>
            <span className="font-sans text-xs text-outline">{product.category}</span>
          </div>

          <div className="flex flex-col">
            <div className={row}>
              <span className="text-outline">Purity</span>
              <span className="font-mono font-bold">{product.purity}</span>
            </div>
            <div className={row}>
              <span className="text-outline">Gross weight</span>
              <span className="font-mono font-bold">{product.grossWt.toFixed(3)} g</span>
            </div>
            {product.stoneWt ? (
              <div className={row}>
                <span className="text-outline">Stone / tare</span>
                <span className="font-mono font-bold">{product.stoneWt.toFixed(3)} g</span>
              </div>
            ) : null}
            <div className={row}>
              <span className="text-outline">Net weight</span>
              <span className="font-mono font-bold text-primary">{product.netWt.toFixed(3)} g</span>
            </div>
            {product.huid && (
              <div className={row}>
                <span className="text-outline">HUID</span>
                <span className="font-mono font-bold">{product.huid}</span>
              </div>
            )}
            <div className={row}>
              <span className="text-outline">Availability</span>
              <span className="font-bold">{product.stockStatus}</span>
            </div>
            {details.map((f) => (
              <div key={f.key} className={row}>
                <span className="text-outline">{f.label}</span>
                <span className="font-bold">
                  {product.extra?.[f.key]}
                  {f.unit ? ` ${f.unit}` : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            {isAdmin ? (
              <button
                onClick={() => onEdit(product)}
                className="flex-1 py-3 rounded-lg bg-primary text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Edit or delete</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onAddToOrder(product, 1);
                  onClose();
                }}
                className="flex-1 py-3 rounded-lg bg-secondary hover:bg-secondary-dark text-white font-sans text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                <span>Add to Order</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
