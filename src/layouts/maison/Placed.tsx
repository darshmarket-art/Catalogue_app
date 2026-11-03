import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ph, fmtG } from '../emergent/ui';
import { SIZES_THUMB } from '../../photoSrcSet';
import { t } from '../../i18n';
import { sector } from '../../sector';

const MS = 2700;
const THUMBS = 4;

/**
 * The moment an order is placed: a full-screen page in Maison's colours. A hairline circle draws itself and a check follows, the order number and
 * a line fade in, then the order's designs glide into the Orders icon in the masthead and the page fades away onto the booked screen underneath.
 * Transform and opacity only (the circle and check are two stroke draws). Tap, Enter or Escape skips it; with reduced motion it is a still
 * confirmation with the same words, shown a little longer. See the mx-pl rules in maison.css.
 */
export const Placed: React.FC<{ poId: string; grams: number; images: Array<string | undefined>; onDone: () => void }> = ({ poId, grams, images, onDone }) => {
  const root = useRef<HTMLDivElement>(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Where each design flies to: the Orders icon in the masthead (phones and desktop both keep it there), measured once the thumbnails are laid out.
  useLayoutEffect(() => {
    const target = document.querySelector('.mx-top [data-tab="orders"]')?.getBoundingClientRect();
    const tx = target ? target.left + target.width / 2 : window.innerWidth - 60;
    const ty = target ? target.top + target.height / 2 : 30;
    root.current?.querySelectorAll<HTMLElement>('.mx-pl-th').forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${tx - (r.left + r.width / 2)}px`);
      el.style.setProperty('--dy', `${ty - (r.top + r.height / 2)}px`);
    });
  }, []);

  // Fetched before the designs appear, so they do not pop in mid-animation.
  useEffect(() => { images.slice(0, THUMBS).forEach((src) => { if (src) new Image().src = src; }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = window.setTimeout(onDone, reduce ? 2400 : MS);
    const k = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && onDone();
    window.addEventListener('keydown', k);
    return () => { window.clearTimeout(id); window.removeEventListener('keydown', k); };
  }, [onDone, reduce]);

  // Into the layout root, not the page: a page that is mid-animation would otherwise become the frame of this full-screen layer.
  return createPortal(
    <div ref={root} className="mx-pl" role="status" aria-live="polite" data-testid="order-placed-moment" onClick={onDone}>
      <svg className="mx-pl-mark" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="mx-pl-ring" cx="50" cy="50" r="46" pathLength="1" />
        <path className="mx-pl-tick" d="M31 52 L44 65 L69 37" pathLength="1" />
      </svg>
      <div className="mx-pl-txt">
        <span className="mx-ey" data-testid="order-placed-id">{t('Order {id}', { id: poId })}</span>
        <h1 className="mx-display">{t(sector.copy.orders.bookedBanner)}</h1>
        <p className="mx-lede">{t('{w} net.', { w: fmtG(grams) })} {t('We will confirm on WhatsApp shortly.')}</p>
      </div>
      <div className="mx-pl-row" aria-hidden="true">
        {images.slice(0, THUMBS).map((src, i) => (
          <span key={i} className="mx-pl-th" style={{ ['--i' as string]: i }}>
            <span className="mx-pl-in"><Ph src={src} tone={i} className="mx-fill" sizes={SIZES_THUMB} alt="" /></span>
          </span>
        ))}
      </div>
    </div>,
    document.querySelector('[data-layout="maison"]') ?? document.body
  );
};
