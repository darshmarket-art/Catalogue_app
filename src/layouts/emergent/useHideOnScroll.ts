import { useEffect, useState } from 'react';

/**
 * True while the page is being scrolled down (past the first screenful), false as soon as it scrolls back up or is near the top.
 * The sticky title, search and filter blocks use it to slide away and give the designs the room, then return on the way up.
 */
export function useHideOnScroll(disabled = false): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (disabled) return void setHidden(false);
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - last;
        if (y < 80) setHidden(false);
        else if (delta > 8) setHidden(true);
        else if (delta < -8) setHidden(false);
        if (Math.abs(delta) > 8 || y < 80) last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [disabled]);
  return hidden;
}
