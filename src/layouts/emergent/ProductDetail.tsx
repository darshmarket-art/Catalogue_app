import React, { useEffect, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Category, Product, Purity } from '../../types';
import { merchant } from '../../merchant';
import { api } from '../../api';
import { PhotoViewer } from '../../components/PhotoViewer';
import { CartSheet, soldPurities } from './CartSheet';
import { Icon, Ph, Pill, StockPill, fmtG } from './ui';
import { useBackLayer } from '../../backLayer';

interface ProductDetailProps {
  product: Product | null;
  isAdmin: boolean;
  /** Purities the owner currently offers. */
  purities: Purity[];
  /** The store's collections: each one says which purities it is sold in. */
  categories: Category[];
  hearted: boolean;
  onToggleShortlist: (product: Product) => void;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
  /** Where this design sits in the list the buyer came from, and a way to step to the previous (-1) or next (1) one. */
  position?: { index: number; total: number };
  onStep?: (dir: -1 | 1) => void;
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
export const ProductDetail: React.FC<ProductDetailProps> = ({ product, isAdmin, purities, categories, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder, position, onStep }) => {
  const canOrder = usePlan().flags.orders;
  useBackLayer(Boolean(product), onClose); // Back closes the design
  const [slide, setSlide] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zooming = useRef(false);
  zooming.current = zoomFrom !== null;
  const cartRef = useRef(false);
  cartRef.current = cartOpen;
  const pageRef = useRef<HTMLDivElement>(null);
  const swiped = useRef(false);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const posRef = useRef(position);
  posRef.current = position;
  const canStep = (dir: -1 | 1) => Boolean(position && onStep && position.index + dir >= 0 && position.index + dir < position.total);
  const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /** Fade through: the design fades out, the next one fades in from a slightly smaller size (opacity and transform only). */
  const step = (dir: -1 | 1) => {
    const pos = posRef.current;
    if (!pos || !stepRef.current || pos.index + dir < 0 || pos.index + dir >= pos.total) return;
    const el = pageRef.current;
    swiped.current = true;
    if (!el || calm()) {
      stepRef.current(dir);
      return;
    }
    el.classList.add('em-ft-out');
    setTimeout(() => {
      // em-ft-out stays on until the next design is in place (removed in the effect below), so there is no flash of the old one.
      stepRef.current?.(dir);
    }, 110);
  };

  // After the page shows the next design: back to the top, then fade it in.
  useEffect(() => {
    const el = pageRef.current;
    if (!el || !swiped.current) return;
    swiped.current = false;
    el.scrollTop = 0;
    el.classList.remove('em-ft-out');
    if (calm()) return;
    el.classList.add('em-ft-in');
    const t = setTimeout(() => el.classList.remove('em-ft-in'), 260);
    return () => clearTimeout(t);
  }, [product?.id]);

  // Touch swipe: a mostly-sideways drag that starts outside a multi-photo gallery (the gallery keeps its own swipe).
  useEffect(() => {
    const el = pageRef.current;
    if (!el || !product) return;
    let sx = 0, sy = 0, dx = 0, mode: 'none' | 'wait' | 'h' | 'v' = 'none';
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || zooming.current || cartRef.current) return;
      if ((e.target as HTMLElement).closest('[data-testid="product-gallery"]') && (product.images.length > 1)) return;
      sx = e.clientX;
      sy = e.clientY;
      dx = 0;
      mode = 'wait';
    };
    const move = (e: PointerEvent) => {
      if (mode === 'none' || mode === 'v') return;
      dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (mode === 'wait') {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) mode = 'v';
        else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) mode = 'h';
        return;
      }
      // The design on screen stays exactly as it is while the finger moves; the next one fades through on release.
    };
    const up = () => {
      const was = mode;
      mode = 'none';
      if (was !== 'h') return;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [product?.id]);

  useEffect(() => {
    setSlide(0);
    setCartOpen(false);
    if (!product) return;
    // Escape closes the page, unless the photo viewer is on top (it closes itself).
    const onKey = (e: KeyboardEvent) => {
      if (zooming.current) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !cartRef.current && !(e.target instanceof HTMLInputElement)) {
        step(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (e.key !== 'Escape') return;
      if (cartRef.current) setCartOpen(false);
      else onClose();
    };
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
  // Purities are plain text here: the ones this design's collection is sold in. The buyer picks quantities per purity in Add to cart.
  const sold = soldPurities(product, purities, categories);
  const askText = `Hello ${merchant.brand.name}, I'm interested in ${product.title} (${product.sku}), ${product.purity}, net ${product.netWt.toFixed(2)} g.`;
  const waHref = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`;
  // Tapping a WhatsApp button tells the owner's Enquiries inbox (the chat opens either way).
  const noteEnquiry = () => {
    if (!isAdmin) void api.recordEnquiry({ kind: 'design', sku: product.sku, title: product.title, purity: product.purity });
  };
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="em-pd-wrap" role="dialog" aria-modal="true" aria-label={product.title}>
      {zoomFrom !== null && <PhotoViewer images={slides} start={zoomFrom} title={product.title} onClose={() => setZoomFrom(null)} />}
      <button type="button" aria-label="Close" tabIndex={-1} className="em-scrim" onClick={onClose} />
      <div className="em-pd">
        <div ref={pageRef} className="em-pd-scroll em-pd-swipe">
          <div className="em-hero-g">
            <div ref={scroller} data-testid="product-gallery" className="em-gal" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
              {slides.map((src, i) => (
                <button key={`${i}-${src}`} type="button" onClick={() => src && setZoomFrom(i)} aria-label={`Zoom photo ${i + 1} of ${product.title}`}>
                  <Ph src={src} tone={i} style={i === 0 ? { viewTransitionName: 'product-photo' } as React.CSSProperties : undefined} />
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
            {position && position.total > 1 && (
              <div className="em-pd-nav" data-testid="design-position">
                <button type="button" data-testid="design-prev" disabled={!canStep(-1)} onClick={() => step(-1)} aria-label="Previous design">
                  <Icon n="back" size={14} />
                  Previous
                </button>
                <span aria-live="polite">
                  Design {position.index + 1} of {position.total}
                </span>
                <button type="button" data-testid="design-next" disabled={!canStep(1)} onClick={() => step(1)} aria-label="Next design">
                  Next
                  <Icon n="next" size={14} />
                </button>
              </div>
            )}
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
              <StockPill status={product.stockStatus} />
              {product.huid && <Pill tone="gold">HUID {product.huid}</Pill>}
            </div>

            {product.description && (
              <p className="em-mut" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5 }} data-testid="product-description">
                {product.description}
              </p>
            )}

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
                onClick={() => setCartOpen(true)}
              >
                <Icon n="bag" />
                Add to cart
              </button>
              <a className="em-btn wa" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry} aria-label="Ask about this design on WhatsApp">
                <Icon n="wa" />
                Ask
              </a>
            </div>
          ) : (
            <>
              <a className="em-btn wa" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry}>
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

      {cartOpen && (
        <CartSheet
          product={product}
          purities={purities}
          categories={categories}
          onClose={() => setCartOpen(false)}
          onAdd={(p, qty, pur) => {
            onAddToOrder(p, qty, pur);
            onClose();
          }}
        />
      )}
    </div>
  );
};
