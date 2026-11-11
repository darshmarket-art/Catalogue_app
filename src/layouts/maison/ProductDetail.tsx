import React, { useEffect, useState } from 'react';
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
import { SIZES_FULL, SIZES_THUMB, SIZES_GRID } from '../../photoSrcSet';
import { openService, pieceOf } from '../../services';
import { RESERVE_HOURS } from '../../../shared/requests';

interface Props extends Behaviour {
  purities: Purity[];
  categories: Category[];
  hearted: boolean;
  onToggleShortlist: (product: Product) => void;
  onEdit: (product: Product) => void;
  onAddToOrder: (product: Product, quantity: number, purity?: string) => void;
}

/** "Complete the set": the pieces the owner paired with this one. Tapping one opens it. */
const Pairs: React.FC<{ skus: string[] }> = ({ skus }) => {
  const [items, setItems] = useState<Product[]>([]);
  const key = skus.join(',');
  useEffect(() => {
    let live = true;
    setItems([]);
    if (skus.length) api.getProductsBySku(skus).then((list) => live && setItems(skus.map((s) => list.find((p) => p.sku === s)).filter((p): p is Product => Boolean(p)))).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (items.length === 0) return null;
  return (
    <section className="mx-pairs" data-testid="piece-pairs">
      <span className="mx-ey">{t('Complete the set')}</span>
      <h2 className="mx-pairs-h">{t('Pairs well with')}</h2>
      <div className="mx-pairs-row">
        {items.map((p, i) => (
          <button key={p.sku} type="button" className="mx-pair" data-testid="pair-open" onClick={() => window.dispatchEvent(new CustomEvent('ax-open-design', { detail: p.sku }))}>
            <span className="mx-pair-im"><Ph src={p.image} tone={i} className="mx-fill" sizes={SIZES_GRID} alt="" /></span>
            <span className="mx-pt">{hn(p.title, p.titleHi)}</span>
            <span className="mx-ey">{fmtG2(p.netWt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

/**
 * Maison's design page: a page under the masthead, not a sheet. Desktop: breadcrumb, a thumbnail rail, one large photo on a soft ground and a
 * narrow info column that stays in view while the page scrolls. Phones: a full-width gallery with dots, the details, and the actions
 * anchored in a bar at the bottom. Behaviour (swipe between designs, zoom, Back, view tracking) comes from useProductDetail.
 */
export const ProductDetail: React.FC<Props> = ({ product, isAdmin, purities, categories, hearted, onToggleShortlist, onClose, onEdit, onAddToOrder, position, onStep }) => {
  const desk = useDesktop();
  const { canOrder, slide, setSlide, cartOpen, setCartOpen, zoomFrom, setZoomFrom, scroller, closeRef, pageRef, canStep, step } = useProductDetail({ product, isAdmin, onClose, position, onStep });
  const [certOpen, setCertOpen] = useState(false);
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
  // Desktop stacks the photos down the left and the page scrolls them (details stay put beside them); phones swipe them sideways.
  const goTo = (i: number) => {
    const g = scroller.current, page = pageRef.current;
    if (!g) return;
    if (!desk || !page) return void g.scrollTo({ left: i * g.clientWidth, behavior: 'smooth' });
    const el = g.children[i] as HTMLElement | undefined;
    if (el) page.scrollTo({ top: page.scrollTop + el.getBoundingClientRect().top - page.getBoundingClientRect().top, behavior: 'smooth' });
  };
  const trackStack = (e: React.UIEvent<HTMLDivElement>) => {
    const g = scroller.current;
    if (!desk || !g || g.children.length < 2) return;
    const top = e.currentTarget.getBoundingClientRect().top;
    let best = 0;
    Array.from(g.children).forEach((c, i) => { if (c.getBoundingClientRect().top - top <= c.clientHeight / 2) best = i; });
    setSlide(best);
  };
  const guarantee = tl(merchant.orders.guaranteeLine) || t(sector.copy.orders.guaranteeFallback);

  return (
    <div className="mx-pd" role="dialog" aria-modal="true" aria-label={name}>
      {zoomFrom !== null && <PhotoViewer images={slides} start={zoomFrom} title={name} onClose={() => setZoomFrom(null)} />}
      {certOpen && product.certificate && <PhotoViewer images={[product.certificate]} start={0} title={t('Certificate')} onClose={() => setCertOpen(false)} />}
      <div ref={pageRef} className="mx-pd-scroll em-pd-swipe" onScroll={trackStack}>
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
              <div ref={scroller} data-testid="product-gallery" className="mx-gal" onScroll={(e) => !desk && setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
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
            {product.story && (
              <details className="mx-acc" data-testid="piece-story">
                <summary>{t('The story of the piece')}</summary>
                <p className="mx-pd-desc" style={{ whiteSpace: 'pre-line' }}>{product.story}</p>
              </details>
            )}
            {product.certificate && (
              <details className="mx-acc" data-testid="piece-certificate">
                <summary>{t('Certificate')}</summary>
                <button type="button" className="mx-cert" onClick={() => setCertOpen(true)} aria-label={t('Open the certificate')}>
                  <img src={product.certificate} alt="" loading="lazy" />
                  <span className="mx-cta">{t('Open the certificate')}</span>
                </button>
              </details>
            )}
            {!isAdmin && (
              <div className="mx-services" data-testid="piece-services">
                <button type="button" data-testid="svc-viewing" onClick={() => openService({ kind: 'viewing', pieces: [pieceOf(product)] })}><Icon n="clock" size={16} /><span>{t('Book a private viewing')}</span><Icon n="next" size={14} /></button>
                <button type="button" data-testid="svc-reserve" onClick={() => openService({ kind: 'reserve', piece: pieceOf(product) })}><Icon n="lock" size={16} /><span>{t('Reserve for {n} hours', { n: RESERVE_HOURS })}</span><Icon n="next" size={14} /></button>
                <button type="button" data-testid="svc-hint" onClick={() => openService({ kind: 'share', pieces: [pieceOf(product)], hint: true })}><Icon n="share" size={16} /><span>{t('Drop a hint')}</span><Icon n="next" size={14} /></button>
                <button type="button" data-testid="svc-sizes" onClick={() => openService({ kind: 'sizes' })}><Icon n="grid" size={16} /><span>{t('Size guide')}</span><Icon n="next" size={14} /></button>
                <button type="button" data-testid="svc-care" onClick={() => openService({ kind: 'care' })}><Icon n="shield" size={16} /><span>{t('Care and service')}</span><Icon n="next" size={14} /></button>
              </div>
            )}
            <p className="mx-note mx-guar"><Icon n="shield" size={14} />{guarantee}</p>
            <span className="mx-ey mx-zoomhint">{t('Tap a photo to zoom')}</span>
          </div>
        </div>
        {product.pairs?.length ? <Pairs skus={product.pairs} /> : null}
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
