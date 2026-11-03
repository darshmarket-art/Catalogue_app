import React from 'react';
import type { Category, Product, Purity } from '../../types';
import { merchant } from '../../merchant';
import { sector } from '../../sector';
import { api } from '../../api';
import { PhotoViewer } from '../../components/PhotoViewer';
import { Icon, Ph, StockPill, fmtG } from '../emergent/ui';
import { specRows } from '../emergent/ProductDetail';
import { useProductDetail, type ProductDetailProps as Behaviour } from '../emergent/useProductDetail';
import { CartSheet } from './CartSheet';
import { fmtG2 } from './ui';
import { useDesktop } from '../emergent/useDesktop';
import { getLang, hn, pur, t, tl, ts } from '../../i18n';
import { SIZES_FULL, SIZES_THUMB } from '../../photoSrcSet';

interface Props extends Behaviour {
  purities: Purity[];
  categories: Category[];
  hearted: boolean;
  onToggleShortlist: (product: Product) => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
}

/**
 * Maison's design page: a page under the masthead, not a sheet. Desktop: breadcrumb, a thumbnail rail, one large photo on a soft ground and a
 * narrow info column that stays in view while the page scrolls. Phones: a full-width gallery with dots, the details, and the actions
 * anchored in a bar at the bottom. Behaviour (swipe between designs, zoom, Back, view tracking) comes from useProductDetail.
 */
export const ProductDetail: React.FC<Props> = ({ product, isAdmin, purities, categories, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder, position, onStep }) => {
  const desk = useDesktop();
  const { canOrder, slide, setSlide, cartOpen, setCartOpen, zoomFrom, setZoomFrom, scroller, closeRef, pageRef, canStep, step } = useProductDetail({ product, isAdmin, onClose, position, onStep });
  if (!product) return null;
  const slides = product.images.length ? product.images : [product.image ?? ''];
  const name = hn(product.title, product.titleHi);
  const col = categories.find((c) => c.name === product.category);
  const catHi = col?.nameHi;
  const category = hn(product.category, catHi);
  const description = hn(product.description, product.descriptionHi);
  const askText =
    getLang() === 'hi'
      ? `नमस्ते ${ts(merchant.brand.name)}, मुझे ${name} (${product.sku}), ${pur(product.purity)}, नेट ${product.netWt.toFixed(2)} ग्राम के बारे में जानना है।`
      : `Hello ${merchant.brand.name}, I'm interested in ${product.title} (${product.sku}), ${product.purity}, net ${product.netWt.toFixed(2)} g.`;
  const waHref = `https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(askText)}`;
  const noteEnquiry = () => {
    if (!isAdmin) void api.recordEnquiry({ kind: 'design', sku: product.sku, title: product.title, purity: product.purity });
  };
  const goTo = (i: number) => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' });
  const guarantee = tl(merchant.orders.guaranteeLine) || t(sector.copy.orders.guaranteeFallback);

  return (
    <div className="mx-pd" role="dialog" aria-modal="true" aria-label={name}>
      {zoomFrom !== null && <PhotoViewer images={slides} start={zoomFrom} title={name} onClose={() => setZoomFrom(null)} />}
      <div ref={pageRef} className="mx-pd-scroll em-pd-swipe">
        <nav className="mx-crumbs" aria-label="Breadcrumb">
          <button ref={closeRef} type="button" className="mx-back" aria-label={t('Close')} onClick={onClose}>
            <Icon n="back" size={16} />
            <span>{t('Catalogue')}</span>
          </button>
          <span className="mx-crumb-d" aria-hidden="true">/</span>
          <span className="mx-crumb-d">{category}</span>
          <span className="mx-crumb-d" aria-hidden="true">/</span>
          <span className="mx-crumb-d" aria-current="page">{name}</span>
        </nav>

        <div className="mx-pd-grid">
          <div className="mx-pd-media">
            {slides.length > 1 && (
              <div className="mx-rail" role="group" aria-label={t('Photos')}>
                {slides.map((src, i) => (
                  <button key={`th-${i}-${src}`} type="button" className={slide === i ? 'on' : ''} aria-label={t('Photo {n}', { n: i + 1 })} aria-current={slide === i ? 'true' : undefined} onClick={() => goTo(i)}>
                    <Ph src={src} tone={i} className="mx-fill" sizes={SIZES_THUMB} />
                  </button>
                ))}
              </div>
            )}
            <div className="mx-stage">
              <div ref={scroller} data-testid="product-gallery" className="mx-gal" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                {slides.map((src, i) => (
                  <button key={`${i}-${src}`} type="button" onClick={() => src && setZoomFrom(i)} aria-label={t('Zoom photo {n} of {name}', { n: i + 1, name })}>
                    <Ph src={src} tone={i} sizes={SIZES_FULL} priority={i === 0} alt={slides.length > 1 ? `${name}, ${t('Photo {n}', { n: i + 1 })}` : name} style={i === 0 ? ({ viewTransitionName: 'product-photo' } as React.CSSProperties) : undefined} />
                  </button>
                ))}
              </div>
              {!isAdmin && (
                <button type="button" className={`mx-heart big${hearted ? ' on' : ''}`} onClick={() => onToggleShortlist(product)} aria-pressed={hearted} aria-label={t(hearted ? 'Remove from shortlist' : 'Add to shortlist')}>
                  <Icon n="heart" size={20} fill={hearted} />
                </button>
              )}
              {slides.length > 1 && (
                <div className="mx-dots">
                  {slides.map((src, i) => (
                    <button key={`${i}-${src}`} type="button" aria-label={t('Photo {n}', { n: i + 1 })} aria-current={slide === i ? 'true' : undefined} className={slide === i ? 'on' : ''} onClick={() => goTo(i)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mx-pd-info">
            {position && position.total > 1 && (
              <div className="mx-pd-nav" data-testid="design-position">
                <button type="button" data-testid="design-prev" disabled={!canStep(-1)} onClick={() => step(-1)} aria-label={t('Previous design')}>
                  <Icon n="back" size={14} />
                  {t('Previous')}
                </button>
                <span aria-live="polite">{t('Design {n} of {total}', { n: position.index + 1, total: position.of ?? position.total })}</span>
                <button type="button" data-testid="design-next" disabled={!canStep(1)} onClick={() => step(1)} aria-label={t('Next design')}>
                  {t('Next')}
                  <Icon n="next" size={14} />
                </button>
              </div>
            )}
            {desk ? <span className="mx-ey">{category} · {product.sku}</span> : <span className="mx-ey" data-testid="mx-pd-eyebrow">{col?.tag ? `${ts(col.tag)} / ${category}` : category}</span>}
            <h1 className="mx-pd-title">{name}</h1>
            <div className="mx-tags">
              <StockPill status={product.stockStatus} />
              {product.huid && <span className="mx-tag">HUID {product.huid}</span>}
            </div>
            <p className="mx-pd-net"><b>{(isAdmin || desk ? fmtG : fmtG2)(product.netWt)}</b> <span className="mx-ey">{t('Net weight')}</span></p>
            {description && <p className="mx-pd-desc" data-testid="product-description">{description}</p>}
            <details className="mx-acc" open>
              <summary>{t('Specifications')}</summary>
              <dl>
                {!desk && <><div><dt>{t('SKU')}</dt><dd>{product.sku}</dd></div><div><dt>{t('Purity')}</dt><dd>{pur(product.purity)}</dd></div></>}
                {specRows(product).map((r) => (
                  <div key={r.key}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                ))}
              </dl>
            </details>
            <p className="mx-note mx-guar"><Icon n="shield" size={14} />{guarantee}</p>
            <span className="mx-ey mx-zoomhint">{t('Tap a photo to zoom')}</span>
          </div>
        </div>
      </div>

      <div className="mx-pd-bar">
        {isAdmin ? (
          <button type="button" className="mx-btn" onClick={() => onEdit(product)}>Edit or delete</button>
        ) : canOrder ? (
          <>
            <button type="button" className="mx-btn" onClick={() => setCartOpen(true)}>{t('Add to cart')}</button>
            <button type="button" className="mx-btn sec mx-pd-heart" onClick={() => onToggleShortlist(product)} aria-pressed={hearted}>
              <Icon n="heart" size={16} fill={hearted} />
              <span>{t(hearted ? 'Shortlisted' : 'Shortlist')}</span>
            </button>
            <a className="mx-btn sec mx-pd-ask" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry} aria-label={t('Ask about this design on WhatsApp')}>
              <Icon n="wa" size={16} />
              <span>{t('Enquire on WhatsApp')}</span>
            </a>
          </>
        ) : (
          <a className="mx-btn" href={waHref} target="_blank" rel="noopener noreferrer" onClick={noteEnquiry}>{t('Enquire on WhatsApp')}</a>
        )}
      </div>

      {cartOpen && (
        <CartSheet
          product={product}
          purities={purities}
          categories={categories}
          onClose={() => setCartOpen(false)}
          onAdd={(p, qty, pu) => {
            onAddToOrder(p, qty, pu);
            onClose();
          }}
        />
      )}
    </div>
  );
};
