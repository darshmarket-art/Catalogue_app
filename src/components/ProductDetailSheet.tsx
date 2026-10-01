import React, { useEffect, useRef, useState } from 'react';
import { Product, Purity } from '../types';
import { merchant } from '../merchant';

interface ProductDetailSheetProps {
  product: Product | null;
  isAdmin: boolean;
  /** Purities the owner currently offers. */
  purities: Purity[];
  hearted: boolean;
  onToggleShortlist: (product: Product) => void;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
}

const row = 'flex items-center justify-between py-2 border-b border-surface-container text-sm font-sans';

export const ProductDetailSheet: React.FC<ProductDetailSheetProps> = ({
  product,
  isAdmin,
  purities,
  hearted,
  onToggleShortlist,
  onClose,
  onEdit,
  onAddToOrder
}) => {
  const [slide, setSlide] = useState(0);
  const [qty, setQty] = useState(1);
  const [purity, setPurity] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSlide(0);
    setQty(1);
    setPurity(product?.purity ?? '');
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product?.id]);

  if (!product) return null;
  const details = merchant.productFields.filter((f) => product.extra?.[f.key] !== undefined);
  // The offered purities, plus the design's own if the owner has since switched it off.
  const options = purities.filter((p) => p.enabled || p.key === product.purity);
  const askText = `Hello ${merchant.brand.name}, I'm interested in ${product.title} (${product.sku}), ${purity || product.purity}, net ${product.netWt.toFixed(2)} g.`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={product.title}>
      <button aria-label="Close" className="absolute inset-0 bg-scrim/50" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl animate-fade-in overflow-hidden">
        <div className="overflow-y-auto">
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
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {product.images.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${slide === i ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              aria-label="Close details"
              className="absolute top-2 left-2 w-11 h-11 rounded-full bg-white/95 text-on-surface flex items-center justify-center shadow-sm"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            {!isAdmin && (
              <button
                onClick={() => onToggleShortlist(product)}
                aria-pressed={hearted}
                aria-label={hearted ? 'Remove from shortlist' : 'Add to shortlist'}
                className={`absolute top-2 right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-sm ${hearted ? 'bg-primary text-white' : 'bg-white/95 text-primary'}`}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: `'FILL' ${hearted ? 1 : 0}` }}>
                  favorite
                </span>
              </button>
            )}
          </div>

          <div className="p-4 flex flex-col gap-3 -mt-5 relative bg-surface rounded-t-3xl">
            <div>
              <h2 className="font-serif text-[24px] text-primary leading-tight">{product.title}</h2>
              <span className="font-sans text-sm text-outline">
                {product.sku} · {product.category}
              </span>
            </div>

            <div className="flex flex-col">
              <div className={row}>
                <label htmlFor="purity-select" className="text-outline">
                  Purity
                </label>
                {isAdmin ? (
                  <span className="font-bold">{product.purity}</span>
                ) : (
                  <select
                    id="purity-select"
                    value={purity}
                    onChange={(e) => setPurity(e.target.value)}
                    className="bg-white border border-outline-variant rounded-xl px-3 py-2 font-bold text-on-surface focus:outline-none focus:border-primary"
                  >
                    {options.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className={row}>
                <span className="text-outline">Net weight</span>
                <span className="font-extrabold text-primary">{product.netWt.toFixed(3)} g</span>
              </div>
              <div className={row}>
                <span className="text-outline">Gross weight</span>
                <span className="font-bold">{product.grossWt.toFixed(3)} g</span>
              </div>
              {product.stoneWt ? (
                <div className={row}>
                  <span className="text-outline">Stone / tare</span>
                  <span className="font-bold">{product.stoneWt.toFixed(3)} g</span>
                </div>
              ) : null}
              {product.huid && (
                <div className={row}>
                  <span className="text-outline">HUID</span>
                  <span className="font-bold">{product.huid}</span>
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
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-white border-t border-outline-variant">
          {isAdmin ? (
            <button
              onClick={() => onEdit(product)}
              className="flex-1 h-12 rounded-2xl bg-primary text-white font-sans text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit or delete
            </button>
          ) : (
            <>
              <div className="flex items-center rounded-2xl border border-outline-variant">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className="w-10 h-12 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <span className="min-w-6 text-center font-extrabold" aria-live="polite">
                  {qty}
                </span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity" className="w-10 h-12 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
              <button
                onClick={() => {
                  onAddToOrder(product, qty, purity || undefined);
                  onClose();
                }}
                className="flex-1 h-12 rounded-2xl bg-secondary hover:bg-secondary-dark text-white font-sans text-sm font-bold active:scale-95 transition-all"
              >
                Add to order
              </button>
              <a
                href={`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ask about this design on WhatsApp"
                className="w-12 h-12 rounded-2xl bg-[#25D366] text-[#06361a] flex items-center justify-center flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[22px]">chat</span>
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
