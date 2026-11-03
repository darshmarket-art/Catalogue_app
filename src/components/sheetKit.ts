import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a sheet at the app root, outside the form it was opened from. A form screen is animated (it carries a transform), and a fixed element inside
 * a transformed parent is sized and placed against that parent, not the window: that is what made the old picker as tall as the whole form.
 * The root keeps the skin's [data-layout] scope, so Classic and Maison styles still apply.
 */
export const inRoot = (children: ReactNode) => createPortal(children, document.querySelector('[data-layout]') ?? document.body);


/**
 * What every render sheet needs: Escape closes it, the page behind does not scroll, and it knows how tall the fixed bottom tab bar is so the
 * sheet can end above it (the CSS reads --sheet-bar). Beside the owner side-nav (wide screens) or with no bar there is nothing to clear: 0.
 */
export function useSheet(onClose: () => void): CSSProperties {
  const close = useRef(onClose);
  close.current = onClose;
  const [vars, setVars] = useState<CSSProperties>({});
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    const measure = () => {
      const bar = document.querySelector<HTMLElement>('.em-tabs');
      const r = bar?.getBoundingClientRect();
      const h = bar && r && r.width > 0 && r.top > window.innerHeight / 2 && getComputedStyle(bar).display !== 'none' ? Math.max(0, Math.ceil(window.innerHeight - r.top)) : 0;
      setVars({ '--sheet-bar': `${h}px`, '--sheet-sab': h ? '0px' : 'var(--sab, 0px)' } as CSSProperties);
    };
    measure();
    window.addEventListener('keydown', key);
    window.addEventListener('resize', measure);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
      window.removeEventListener('resize', measure);
    };
  }, []);
  return vars;
}
