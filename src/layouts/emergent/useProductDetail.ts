import { useEffect, useRef, useState } from 'react';
import { usePlan } from '../../plan';
import type { Product } from '../../types';
import { trackProductView } from '../../api';
import { useBackLayer } from '../../backLayer';
import { useLang } from '../../i18n';

export interface ProductDetailProps {
  product: Product | null;
  isAdmin: boolean;
  onClose: () => void;
  /** True while the layout shows the design in a pane beside the list (tablet width, Emergent). It is not modal then. */
  pane?: boolean;
  /** Where this design sits in the list the buyer came from, and a way to step to the previous (-1) or next (1) one.
   *  `total` is how many are loaded (the step bound); `of` is the full count shown to the buyer, when more are still to load. */
  position?: { index: number; total: number; of?: number };
  onStep?: (dir: -1 | 1) => void;
}

/**
 * A design page's behaviour, shared by every layout: Back and Escape close it, left/right and swipes step to the neighbouring design with a
 * fade-through (the page element gets em-ft-out / em-ft-in), the photo viewer, the add-to-cart sheet, view tracking and the scroll lock.
 */
export function useProductDetail({ product, isAdmin, onClose, pane = false, position, onStep }: ProductDetailProps) {
  const canOrder = usePlan().flags.orders;
  useLang();
  useBackLayer(Boolean(product), onClose); // Back closes the design
  // A view is one buyer opening a design's details (once per design per visit; swiping on to the next design counts that one).
  useEffect(() => {
    if (product && !isAdmin) trackProductView(product.sku);
  }, [product?.sku]);
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
    const timer = setTimeout(() => el.classList.remove('em-ft-in'), 260);
    return () => clearTimeout(timer);
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
    // Focus comes back to the card afterwards.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [product?.id]);

  // The page behind stays put while this one is open as an overlay. In the tablet pane the list stays live, and a window that is resized
  // from one to the other (a foldable, a rotation) takes or drops the lock without closing the design or moving it.
  useEffect(() => {
    if (!product || pane) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [Boolean(product), pane]);


  return { canOrder, slide, setSlide, cartOpen, setCartOpen, zoomFrom, setZoomFrom, scroller, closeRef, pageRef, canStep, step };
}
