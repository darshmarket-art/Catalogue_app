import React, { useEffect, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product, Purity } from '../../types';
import { merchant } from '../../merchant';
import { PhotoViewer } from '../../components/PhotoViewer';
import { Icon, Ph, Pill, StockPill, fmtG } from './ui';

interface ProductDetailProps {
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

/** The rows under "Specifications": the design's weights, then whatever details this store records (merchant.productFields). */
const specRows = (p: Product) => [
  { key: 'gross', label: 'Gross weight', value: fmtG(p.grossWt), net: false },
  ...(p.stoneWt ? [{ key: 'stone', label: 'Stone / tare', value: fmtG(p.stoneWt), net: false }] : []),
  { key: 'net', label: 'Net weight', value: fmtG(p.netWt), net: true },
  ...merchant.productFields.filter((f) => p.extra?.[f.key] !== undefined).map((f) => ({ key: `x-${f.key}`, label: f.label, value: `${p.extra?.[f.key]}${f.unit ? ` ${f.unit}` : ''}`, net: false }))
];

/**
 * A design's details (atlas Product detail): a full-bleed gallery with counter and dots, a rounded sheet over the photo, specifications,
 * quantity and a sticky bar. Same behaviour as the Gilded sheet: tap a photo to zoom, heart, add to order, owner edit, WhatsApp enquiry on Basic.
 */
export const ProductDetail: React.FC<ProductDetailProps> = ({ product, isAdmin, purities, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder }) => {
  const canOrder = usePlan().flags.orders;
  const [slide, setSlide] = useState(0);
  const [qty, setQty] = useState(1);
  const [purity, setPurity] = useState('');
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zooming = useRef(false);
  zooming.current = zoomFrom !== null;

  useEffect(() => {
    setSlide(0);
    setQty(1);
    setPurity(product?.purity ?? '');
    if (!product) return;
    // Escape closes the page, unless the photo viewer is on top (it closes itself).
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !zooming.current && onClose();
    window.addEventListener('keydown', onKey);
    // The page behind stays put while this one is open, and focus comes back to the card afterwards.
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [product?.id]);

  if (!product) return null;
  const slides = product.images.length ? product.images : [product.image ?? ''];
  // The offered purities, plus the design's own if the owner has since switched it off.
  const options = purities.filter((p) => p.enabled || p.key === product.purity);
  const chosen = purity || product.purity;
  const askText = `Hello ${merchant.brand.name}, I'm interested in ${product.title} (${product.sku}), ${chosen}, net ${product.netWt.toFixed(2)} g.`;
  const waHref = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`;
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="em-pd-wrap" role="dialog" aria-modal="true" aria-label={product.title}>
      {zoomFrom !== null && <PhotoViewer images={slides} start={zoomFrom} title={product.title} onClose={() => setZoomFrom(null)} />}
      <button type="button" aria-label="Close" tabIndex={-1} className="em-scrim" onClick={onClose} />
      <div className="em-pd">
        <div className="em-pd-scroll">
          <div className="em-hero-g">
            <div ref={scroller} data-testid="product-gallery" className="em-gal" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
              {slides.map((src, i) => (
                <button key={`${i}-${src}`} type="button" onClick={() => src && setZoomFrom(i)} aria-label={`Zoom photo ${i + 1} of ${product.title}`}>
                  <Ph src={src} tone={i} />
                </button>
              ))}
            </div>
            <div className="em-pd-top">
              <button ref={closeRef} type="button" className="em-circ f" aria-label="Close" onClick={onClose}>
                <Icon n="back" size={20} />
              </button>
              {!isAdmin && (
                <button type="button" className="em-circ f" onClick={() => onToggleShortlist(product)} aria-pressed={hearted} aria-label={hearted ? 'Remove from shortlist' : 'Add to shortlist'}>
                  <Icon n="heart" fill={hearted} />
                </button>
              )}
            </div>
            {slides.length > 1 && (
              <>
                <span className="em-pd-count">
                  {slide + 1} / {slides.length}
                </span>
                <div className="em-pd-dots">
                  {slides.map((src, i) => (
                    <button key={`${i}-${src}`} type="button" aria-label={`Photo ${i + 1}`} aria-current={slide === i ? 'true' : undefined} className={slide === i ? 'on' : ''} onClick={() => goTo(i)} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="em-pd-sheet">
            <div className="em-row em-sb" style={{ gap: 12 }}>
              <span className="em-ey em-clip">
                {product.category} · {product.sku}
              </span>
              <span className="em-mut" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                Tap a photo to zoom
              </span>
            </div>
            <h2 className="em-ser em-h2">{product.title}</h2>

            <div className="em-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {!isAdmin && options.length > 1 ? (
                options.map((p) => (
                  <button key={p.key} type="button" className={`em-chip${chosen === p.key ? ' on' : ''}`} aria-pressed={chosen === p.key} onClick={() => setPurity(p.key)}>
                    {p.title}
                  </button>
                ))
              ) : (
                <Pill tone="plum">{product.purity.replace(' ', ' · ')}</Pill>
              )}
              <StockPill status={product.stockStatus} />
              {product.huid && <Pill tone="gold">HUID {product.huid}</Pill>}
            </div>

            <div className="em-rule" style={{ width: 48, marginTop: 16 }} />
            <div className="em-ey">Specifications</div>
            <div style={{ marginTop: 10 }}>
              {specRows(product).map((r) => (
                <div key={r.key} className={`em-spec${r.net ? ' net' : ''}`}>
                  <span>{r.label}</span>
                  <b>{r.value}</b>
                </div>
              ))}
            </div>

            {!isAdmin && canOrder && (
              <div className="em-row em-sb" style={{ marginTop: 20 }}>
                <div>
                  <div className="em-ey">Quantity</div>
                  <div className="em-mut" style={{ fontSize: 11, marginTop: 2 }}>
                    Total: {fmtG(product.netWt * qty)} net
                  </div>
                </div>
                <div className="em-qty">
                  <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <Icon n="minus" size={16} />
                  </button>
                  <em className="em-ser" aria-live="polite">
                    {qty}
                  </em>
                  <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => q + 1)}>
                    <Icon n="plus" size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="em-pd-bar">
          {isAdmin ? (
            <button type="button" className="em-btn" onClick={() => onEdit(product)}>
              <Icon n="edit" />
              Edit or delete
            </button>
          ) : canOrder ? (
            <div className="em-row">
              <button
                type="button"
                className="em-btn fl"
                onClick={() => {
                  onAddToOrder(product, qty, purity || undefined);
                  onClose();
                }}
              >
                <Icon n="bag" />
                Add to order
              </button>
              <a className="em-btn wa" href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Ask about this design on WhatsApp">
                <Icon n="wa" />
                Ask
              </a>
            </div>
          ) : (
            <>
              <a className="em-btn wa" href={waHref} target="_blank" rel="noopener noreferrer">
                <Icon n="wa" />
                Enquire on WhatsApp
              </a>
              <p className="em-hint" style={{ textAlign: 'center', margin: 0 }}>
                Ask about price and availability on WhatsApp.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
