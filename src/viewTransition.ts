import { flushSync } from 'react-dom';

/**
 * Runs a screen change as a View Transition (the browser animates between the two states) where supported and motion is allowed;
 * otherwise it just runs. `source` is the element that grows into place: it is named `product-photo` for the length of the
 * transition, and the detail screen's first photo carries the same name (see ProductDetail), so the card photo flies to the hero.
 */
export function withTransition(update: () => void, source?: Element | null) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<unknown>; finished: Promise<unknown>; updateCallbackDone: Promise<unknown> } };
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  const el = source as HTMLElement | null | undefined;
  if (el) el.style.setProperty('view-transition-name', 'product-photo');
  const t = doc.startViewTransition(() => {
    // The old screen has been captured with the source named. It must not keep the name into the new screen: the tile stays in the page under
    // the design page, whose photo carries the same name, and two elements with one name make the browser skip the whole transition.
    el?.style.removeProperty('view-transition-name');
    flushSync(update);
    // The new screen's own fade-in (and the design page's) would run inside the transition's fade, so the page dipped twice and the old one
    // showed through for half a second: the transition is the only animation.
    document.querySelectorAll<HTMLElement>('[data-layout="maison"] main, [data-layout="maison"] .mx-pd').forEach((el) => el.style.setProperty('animation', 'none'));
  });
  // An aborted transition (tab switched mid-flight, hidden page) rejects these promises: that is fine, the update already ran.
  void t.ready.catch(() => {});
  void t.updateCallbackDone.catch(() => {});
  void t.finished.catch(() => {}).finally(() => el?.style.removeProperty('view-transition-name'));
}
