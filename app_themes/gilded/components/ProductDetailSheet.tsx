import { usePlan } from '../plan';
import React, { useEffect, useRef, useState } from 'react';
import { Product, Purity } from '../types';
import { merchant } from '../merchant';
import { PhotoViewer } from './PhotoViewer';
import { I, Photo, StockTag } from './ui';

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

/** A design's details (artboard 2.4, Pro; 2.5, Basic: enquire on WhatsApp instead of ordering). */
export const ProductDetailSheet: React.FC<ProductDetailSheetProps> = ({ product, isAdmin, purities, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder }) => {
  const canOrder = usePlan().flags.orders;
  const [slide, setSlide] = useState(0);
  const [qty, setQty] = useState(1);
  const [purity, setPurity] = useState('');
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
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
  const waHref = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`;
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={product.title}>
      {zoomFrom !== null && <PhotoViewer images={product.images} start={zoomFrom} title={product.title} onClose={() => setZoomFrom(null)} />}
      <button type="button" aria-label="Close" className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="grab" />

        <div className="relative">
          <div
            ref={scroller}
            data-testid="product-gallery"
            className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ borderRadius: 20 }}
            onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          >
            {product.images.map((src, i) => (
              <button key={src} type="button" onClick={() => setZoomFrom(i)} aria-label={`Zoom photo ${i + 1} of ${product.title}`} className="min-w-full snap-center p-0 border-0 bg-transparent" style={{ cursor: 'zoom-in' }}>
                <Photo src={src} style={{ height: 230, borderRadius: 0 }} />
              </button>
            ))}
          </div>
          {product.images.length > 1 && (
            <span className="tag" style={{ position: 'absolute', right: 12, top: 12, background: 'var(--card)', zIndex: 2 }}>
              {slide + 1} of {product.images.length}
            </span>
          )}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => onToggleShortlist(product)}
              aria-pressed={hearted}
              aria-label={hearted ? 'Remove from shortlist' : 'Add to shortlist'}
              className="ib"
              style={{ position: 'absolute', left: 12, top: 12, width: 40, height: 40, zIndex: 2 }}
            >
              <I n="heart" size="s" style={hearted ? { background: 'var(--bad)' } : undefined} />
            </button>
          )}
        </div>

        {product.images.length > 1 && (
          <div className="row" style={{ gap: 8 }}>
            {product.images.map((src, i) => (
              <button key={src} type="button" aria-label={`Photo ${i + 1}`} onClick={() => goTo(i)} className="p-0 border-0 bg-transparent">
                <Photo src={src} style={{ width: 56, height: 56, borderRadius: 12, outline: slide === i ? '2px solid var(--plum)' : undefined }} />
              </button>
            ))}
            <span className="grow" />
            <span className="pro">{product.images.length} photos · Pro</span>
          </div>
        )}

        <div>
          <h2 style={{ fontSize: 24 }}>{product.title}</h2>
          <p className="sub">
            {product.sku} · {product.category}
          </p>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {!isAdmin && options.length > 1 ? (
            options.map((p) => (
              <button key={p.key} type="button" className={`chip${purity === p.key ? ' on' : ''}`} style={{ height: 34 }} onClick={() => setPurity(p.key)} aria-pressed={purity === p.key}>
                {p.title}
              </button>
            ))
          ) : (
            <span className="tag">{product.purity.replace(' ', ' · ')}</span>
          )}
          <StockTag status={product.stockStatus} />
          {product.huid && <span className="tag mut">HUID {product.huid}</span>}
        </div>

        <div className="card kvs" style={{ padding: '4px 14px' }}>
          <div className="kv" style={{ padding: '9px 0' }}>
            <span>Gross weight</span>
            <b>{product.grossWt.toFixed(3)} g</b>
          </div>
          {product.stoneWt ? (
            <div className="kv" style={{ padding: '9px 0' }}>
              <span>Stone / tare</span>
              <b>{product.stoneWt.toFixed(3)} g</b>
            </div>
          ) : null}
          <div className="kv" style={{ padding: '9px 0' }}>
            <span>Net weight</span>
            <b>{product.netWt.toFixed(3)} g</b>
          </div>
          {details.map((f) => (
            <div key={f.key} className="kv" style={{ padding: '9px 0' }}>
              <span>{f.label}</span>
              <b>
                {product.extra?.[f.key]}
                {f.unit ? ` ${f.unit}` : ''}
              </b>
            </div>
          ))}
        </div>

        {isAdmin ? (
          <button type="button" className="btn" onClick={() => onEdit(product)}>
            <I n="edit" />
            Edit or delete
          </button>
        ) : canOrder ? (
          <>
            <div className="row">
              <span className="lab grow" style={{ margin: 0 }}>
                Quantity
              </span>
              <button type="button" className="ib" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <I n="minus" />
              </button>
              <b style={{ minWidth: 28, textAlign: 'center', fontSize: 18 }} aria-live="polite">
                {qty}
              </b>
              <button type="button" className="ib" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>
                <I n="plus" />
              </button>
            </div>
            <div className="row">
              <button
                type="button"
                className="btn"
                style={{ flex: 1.4 }}
                onClick={() => {
                  onAddToOrder(product, qty, purity || undefined);
                  onClose();
                }}
              >
                <I n="receipt" />
                Add to order
              </button>
              <a className="btn alt" style={{ flex: 1 }} href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Ask about this design on WhatsApp">
                <I n="whats" />
                Ask
              </a>
            </div>
          </>
        ) : (
          <>
            <a className="btn wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <I n="whats" />
              Enquire on WhatsApp
            </a>
            <p className="hint" style={{ textAlign: 'center', margin: 0 }}>
              Ask about price and availability on WhatsApp.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
