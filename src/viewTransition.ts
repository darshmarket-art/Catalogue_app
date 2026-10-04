import { flushSync } from 'react-dom';

/**
 * Runs a screen change as a View Transition (the browser animates between the two states) where supported and motion is allowed;
 * otherwise it just runs. `source` is the element that grows into place: it is named `product-photo` for the length of the
 * transition, and the detail screen's first photo carries the same name (see ProductDetail), so the card photo flies to the hero.
 */
export function withTransition(update: () => void, source?: Element | null) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<unknown> } };
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  const el = source as HTMLElement | null | undefined;
  if (el) el.style.setProperty('view-transition-name', 'product-photo');
  const t = doc.startViewTransition(() => flushSync(update));
  void t.finished.finally(() => el?.style.removeProperty('view-transition-name'));
}
