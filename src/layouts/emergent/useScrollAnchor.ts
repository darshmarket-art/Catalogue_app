import { useEffect } from 'react';

/**
 * After a rotation or unfold the grid re-flows (2 columns to 4, taller or shorter cards) while the browser keeps the scroll in pixels, so the
 * designs the buyer was looking at slide off screen. This remembers the first card under the top bar while they scroll and, when the width
 * changes, puts that card back at the height it had. (apple-design layout.md: "People expect your experience to remain familiar when they rotate".)
 */
export function useScrollAnchor() {
  useEffect(() => {
    let anchor: { el: Element; top: number } | null = null;
    let width = window.innerWidth;
    let frozenUntil = 0;
    const barBottom = () => document.querySelector('.em-top')?.getBoundingClientRect().bottom ?? 0;
    const mark = () => {
      if (Date.now() < frozenUntil) return; // scroll events caused by the resize itself must not move the anchor
      const bar = barBottom();
      for (const el of document.querySelectorAll('.em-cardwrap')) {
        const r = el.getBoundingClientRect();
        if (r.bottom > bar + 1) return void (anchor = { el, top: r.top });
      }
    };
    const restore = () => {
      if (!anchor?.el.isConnected) return;
      const dy = anchor.el.getBoundingClientRect().top - anchor.top;
      if (Math.abs(dy) > 1) window.scrollBy(0, dy);
    };
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      frozenUntil = Date.now() + 500;
      // the layout settles in two steps (CSS now, then React's media-query state), so restore after each
      requestAnimationFrame(restore);
      setTimeout(restore, 120);
      setTimeout(restore, 400);
    };
    window.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', mark);
      window.removeEventListener('resize', onResize);
    };
  }, []);
}
