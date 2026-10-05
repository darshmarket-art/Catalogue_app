import React, { useEffect, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product, Purity } from '../../types';
import { merchant } from '../../merchant';
import { PhotoViewer } from '../../components/PhotoViewer';
import { Icon, Ph, Pill, Sheet, StockPill, fmtG } from './ui';

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
  // The Add to cart sheet: pieces wanted per purity (the design's own purity starts at 1).
  const [cartOpen, setCartOpen] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [purity, setPurity] = useState('');
  const [zoomFrom, setZoomFrom] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const zooming = useRef(false);
  zooming.current = zoomFrom !== null;
  const cartRef = useRef(false);
  cartRef.current = cartOpen;

  useEffect(() => {
    setSlide(0);
    setCartOpen(false);
    setQtys(product ? { [product.purity]: 1 } : {});
    setPurity(product?.purity ?? '');
    if (!product) return;
    // Escape closes the page, unless the photo viewer is on top (it closes itself).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || zooming.current) return;
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
  // The offered purities, plus the design's own if the owner has since switched it off.
  const options = purities.filter((p) => p.enabled || p.key === product.purity);
  const chosen = purity || product.purity;
  // What the cart sheet lists: every purity on offer, or just the design's own while the list is empty.
  const cartOptions = options.length ? options : [{ key: product.purity, title: product.purity, enabled: true }];
  const totalPcs = cartOptions.reduce((n, o) => n + (qtys[o.key] ?? 0), 0);
  const setQty = (key: string, n: number) => setQtys((q) => ({ ...q, [key]: Math.max(0, Math.min(999, n)) }));
  const addToCart = () => {
    cartOptions.forEach((o) => (qtys[o.key] ?? 0) > 0 && onAddToOrder(product, qtys[o.key], o.key));
    setCartOpen(false);
    onClose();
  };
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
            {!isAdmin && canOrder && (
              <button type="button" className="em-btn" style={{ width: '100%', marginBottom: 16 }} data-testid="pd-add-to-cart" onClick={() => setCartOpen(true)}>
                <Icon n="bag" />
                Add to cart
              </button>
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

      {cartOpen && (
        <Sheet label={`Add ${product.title} to cart`} onClose={() => setCartOpen(false)}>
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
            {cartOptions.map((o, i) => {
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

          <button type="button" className="em-btn" data-testid="cart-confirm" disabled={totalPcs === 0} onClick={addToCart}>
            <Icon n="bag" />
            Add to cart
          </button>
        </Sheet>
      )}
    </div>
  );
};
