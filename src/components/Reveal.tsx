import React, { useEffect, useRef, useState } from 'react';

/** Fades and lifts its children into view the first time they scroll on screen. Shows at once when motion is reduced or IntersectionObserver is missing. */
export const Reveal: React.FC<{ as?: 'div' | 'article' | 'section' | 'li'; delay?: number; className?: string; children: React.ReactNode }> = ({ as: Tag = 'div', delay = 0, className = '', children }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`ax-rv${seen ? ' in' : ''} ${className}`} style={{ ['--d' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
};
