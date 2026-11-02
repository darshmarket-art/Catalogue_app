import React from 'react';
import type { Category, Product, Purity } from '../../types';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { api } from '../../api';
import { PhotoViewer } from '../../components/PhotoViewer';
import { CartSheet, soldPurities } from './CartSheet';
import { Icon, Ph, Pill, StockPill, fmtG } from './ui';
import { getLang, hn, pur, t, tl, ts } from '../../i18n';
import { SIZES_FULL, SIZES_THUMB } from '../../photoSrcSet';
import { useProductDetail, type ProductDetailProps as Behaviour } from './useProductDetail';

interface ProductDetailProps extends Behaviour {
  /** Purities the owner currently offers. */
  purities: Purity[];
  /** The store's collections: each one says which purities it is sold in. */
  categories: Category[];
  hearted: boolean;
  onToggleShortlist: (product: Product) => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
}

/** The rows under "Specifications": the design's weights, then whatever details this store records (merchant.productFields). */
export const specRows = (p: Product) => [
  { key: 'gross', label: t('Gross weight'), value: fmtG(p.grossWt), net: false },
  ...(p.stoneWt ? [{ key: 'stone', label: t('Stone / tare'), value: fmtG(p.stoneWt), net: false }] : []),
  { key: 'net', label: t('Net weight'), value: fmtG(p.netWt), net: true },
  ...merchant.productFields.filter((f) => p.extra?.[f.key] !== undefined).map((f) => ({ key: `x-${f.key}`, label: ts(f.label), value: `${p.extra?.[f.key]}${f.unit ? ` ${f.unit}` : ''}`, net: false }))
];

/**
 * A design's details (atlas Product detail): a full-bleed gallery with counter and dots, a rounded sheet over the photo, specifications,
 * quantity and a sticky bar. Same behaviour as the Gilded sheet: tap a photo to zoom, heart, add to order, owner edit, WhatsApp enquiry on Basic.
 */
export const ProductDetail: React.FC<ProductDetailProps> = ({ product, isAdmin, purities, categories, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder, pane = false, position, onStep }) => {
  const { canOrder, slide, setSlide, cartOpen, setCartOpen, zoomFrom, setZoomFrom, scroller, closeRef, pageRef, canStep, step } = useProductDetail({ product, isAdmin, onClose, pane, position, onStep });
  if (!product) return null;
  const slides = product.images.length ? product.images : [product.image ?? ''];
  // Purities are plain text here: the ones this design's collection is sold in. The buyer picks quantities per purity in Add to cart.
  const sold = soldPurities(product, purities, categories);
  const name = hn(product.title, product.titleHi);
  const askText =
    getLang() === 'hi'
      ? `नमस्ते ${ts(merchant.brand.name)}, मुझे ${name} (${product.sku}), ${pur(product.purity)}, नेट ${product.netWt.toFixed(2)} ग्राम के बारे में जानना है।`
      : `Hello ${merchant.brand.name}, I'm interested in ${product.title} (${product.sku}), ${product.purity}, net ${product.netWt.toFixed(2)} g.`;
  const catHi = categories.find((c) => c.name === product.category)?.nameHi;
  const description = hn(product.description, product.descriptionHi);
  const waHref = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`;
  // Tapping a WhatsApp button tells the owner's Enquiries inbox (the chat opens either way).
  const noteEnquiry = () => {
    if (!isAdmin) void api.recordEnquiry({ kind: 'design', sku: product.sku, title: product.title, purity: product.purity });
  };
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });

  return (
    <div className="em-pd-wrap" role={pane ? 'region' : 'dialog'} aria-modal={pane ? undefined : true} aria-label={name}>
      {zoomFrom !== null && <PhotoViewer images={slides} start={zoomFrom} title={name} onClose={() => setZoomFrom(null)} />}
      <button type="button" aria-label={t('Close')} tabIndex={-1} className="em-scrim" onClick={onClose} />
      <div className="em-pd">
        <div ref={pageRef} className="em-pd-scroll em-pd-swipe">
          <div className="em-hero-g">
            <div ref={scroller} data-testid="product-gallery" className="em-gal" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
              {slides.map((src, i) => (
                <button key={`${i}-${src}`} type="button" onClick={() => src && setZoomFrom(i)} aria-label={t('Zoom photo {n} of {name}', { n: i + 1, name })}>
                  <Ph src={src} tone={i} sizes={SIZES_FULL} priority={i === 0} alt={slides.length > 1 ? `${name}, ${t('Photo {n}', { n: i + 1 })}` : name} style={i === 0 ? { viewTransitionName: 'product-photo' } as React.CSSProperties : undefined} />
                </button>
              ))}
            </div>
            <div className="em-pd-top">
              <button ref={closeRef} type="button" className="em-circ f" aria-label={t('Close')} onClick={onClose}>
                <Icon n="back" size={20} />
              </button>
              {!isAdmin && (
                <button type="button" className="em-circ f em-mb" onClick={() => onToggleShortlist(product)} aria-pressed={hearted} aria-label={t(hearted ? 'Remove from shortlist' : 'Add to shortlist')}>
                  <Icon n="heart" fill={hearted} />
                </button>
              )}
            </div>
            {slides.length > 1 && (
              <div className="em-dk fx em-pd-thumbs" role="group" aria-label={t('Photos')}>
                {slides.map((src, i) => (
                  <button key={`th-${i}-${src}`} type="button" className={slide === i ? 'on' : ''} aria-label={t('Photo {n}', { n: i + 1 })} aria-current={slide === i ? 'true' : undefined} onClick={() => goTo(i)}>
                    <Ph src={src} tone={i} className="em-fill" sizes={SIZES_THUMB} />
                  </button>
                ))}
              </div>
            )}
            {slides.length > 1 && (
              <>
                <span className="em-pd-count">
                  {slide + 1} / {slides.length}
                </span>
                <div className="em-pd-dots">
                  {slides.map((src, i) => (
                    <button key={`${i}-${src}`} type="button" aria-label={t('Photo {n}', { n: i + 1 })} aria-current={slide === i ? 'true' : undefined} className={slide === i ? 'on' : ''} onClick={() => goTo(i)} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="em-pd-sheet">
            {position && position.total > 1 && (
              <div className="em-pd-nav" data-testid="design-position">
                <button type="button" data-testid="design-prev" disabled={!canStep(-1)} onClick={() => step(-1)} aria-label={t('Previous design')}>
                  <Icon n="back" size={14} />
                  {t('Previous')}
                </button>
                <span aria-live="polite">
                  {t('Design {n} of {total}', { n: position.index + 1, total: position.of ?? position.total })}
                </span>
                <button type="button" data-testid="design-next" disabled={!canStep(1)} onClick={() => step(1)} aria-label={t('Next design')}>
                  {t('Next')}
                  <Icon n="next" size={14} />
                </button>
              </div>
            )}
            <div className="em-row em-sb em-pd-meta" style={{ gap: 12 }}>
              <span className="em-ey em-clip">
                {hn(product.category, catHi)} · {product.sku}
              </span>
              <span className="em-mut" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {t('Tap a photo to zoom')}
              </span>
            </div>
            <h2 className="em-ser em-h2">{name}</h2>

            <div className="em-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <StockPill status={product.stockStatus} />
              {product.huid && <Pill tone="gold">HUID {product.huid}</Pill>}
            </div>

            {description && (
              <p className="em-mut" style={{ marginTop: 14, fontSize: '0.875rem', lineHeight: 1.5 }} data-testid="product-description">
                {description}
              </p>
            )}

            <div className="em-dk fx em-netcall">
              <b className="em-ser">{fmtG(product.netWt)}</b>
              <span>{t('Net weight')}</span>
            </div>
            <div className="em-rule" style={{ width: 48, marginTop: 16 }} />
            <div className="em-ey">{t('Specifications')}</div>
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
            <>
            <div className="em-row">
              <button
                type="button"
                className="em-btn fl"
                onClick={() => setCartOpen(true)}
              >
                <Icon n="bag" />
                {t('Add to cart')}
              </button>
              {!isAdmin && (
                <button type="button" className="em-btn sec em-dk fx em-pd-heart" onClick={() => onToggleShortlist(product)} aria-pressed={hearted}>
                  <Icon n="heart" fill={hearted} />
                  {t(hearted ? 'Shortlisted' : 'Shortlist')}
                </button>
              )}
              <a className="em-btn wa em-pd-ask" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry} aria-label={t('Ask about this design on WhatsApp')}>
                <Icon n="wa" />
                <span className="em-mb">{t('Ask')}</span>
                <span className="em-dk">{t('Ask about this design on WhatsApp')}</span>
              </a>
            </div>
            <p className="em-dk fx em-hint em-pd-guar">
              <Icon n="shield" size={16} />
              {tl(merchant.orders.guaranteeLine) || t(sector.copy.orders.guaranteeFallback)}
            </p>
            </>
          ) : (
            <>
              <a className="em-btn wa" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry}>
                <Icon n="wa" />
                {t('Enquire on WhatsApp')}
              </a>
              <p className="em-hint" style={{ textAlign: 'center', margin: 0 }}>
                {t('Ask about price and availability on WhatsApp.')}
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
