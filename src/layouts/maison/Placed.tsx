import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ph, fmtG } from '../emergent/ui';
import { SIZES_THUMB } from '../../photoSrcSet';
import { t } from '../../i18n';
import { sector } from '../../sector';

const MS = 2700;
const THUMBS = 4;

/**
 * The confirmation itself: a hairline ring with a check, the order number, the words and the designs that were ordered. The booked page shows it
 * still; the order-placed moment shows the very same block, in the same place, drawing itself. Because both are one component in one box, the
 * moment hands over to the page without anything moving.
 */
export const PlacedBody: React.FC<{ poId: string; grams: number; images: Array<string | undefined>; line?: string; idTestId?: string }> = ({ poId, grams, images, line, idTestId }) => {
  const shown = images.slice(0, THUMBS);
  const more = images.length - shown.length;
  return (
    <div className="mx-pl-body">
      <svg className="mx-pl-mark" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="mx-pl-ring" cx="50" cy="50" r="46" pathLength="1" />
        <path className="mx-pl-tick" d="M31 52 L44 65 L69 37" pathLength="1" />
      </svg>
      <span className="mx-ey" data-testid={idTestId}>{t('Order {id}', { id: poId })}</span>
      <h1 className="mx-display">{t(sector.copy.orders.bookedBanner)}</h1>
      <p className="mx-lede">{t('{w} net.', { w: fmtG(grams) })} {line ?? t('We will confirm on WhatsApp shortly.')}</p>
      {shown.length > 0 && (
        <div className="mx-pl-row" aria-hidden="true">
          {shown.map((src, i) => (
            <span key={i} className="mx-pl-th" style={{ ['--i' as string]: i }}><Ph src={src} tone={i} className="mx-fill" sizes={SIZES_THUMB} alt="" /></span>
          ))}
          {more > 0 && <span className="mx-pl-th more" style={{ ['--i' as string]: shown.length }}>+{more}</span>}
        </div>
      )}
    </div>
  );
};

/**
 * The moment an order is placed: a full-screen page in Maison's deep colour, over the masthead. The ring draws, the check follows, the order
 * number and the words rise in, the ordered designs appear one by one, and the layer fades away onto the booked page, which holds the same block
 * in the same place (`children` are that page's buttons, kept here unseen so both boxes measure the same). Transform, opacity and two stroke
 * draws only. Tap, Enter or Escape skips it; with reduced motion it is a still confirmation, shown a little shorter. See the mx-pl rules.
 */
export const Placed: React.FC<{ poId: string; grams: number; images: Array<string | undefined>; line?: string; onDone: () => void; children?: React.ReactNode }> = ({ poId, grams, images, line, onDone, children }) => {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
    <div className="mx-pl" role="status" aria-live="polite" data-testid="order-placed-moment" onClick={onDone}>
      <div className="mx-booked">
        <PlacedBody poId={poId} grams={grams} images={images} line={line} idTestId="order-placed-id" />
        <div className="mx-pl-ghost" aria-hidden="true" inert>{children}</div>
      </div>
    </div>,
    document.querySelector('[data-layout="maison"]') ?? document.body
  );
};
