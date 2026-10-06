import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { usePlan } from '../plan';
import { Icon } from '../layouts/emergent/ui';
import { useBackLayer } from '../backLayer';

/** One stop on the tour: which screen it needs, what to light up there, and what to say. */
interface Step {
  id: string;
  screen?: ActiveScreen;
  /** The element to light up; none for the welcome and finish cards. */
  target?: () => Element | null;
  /** Leave the step out when its element is not on screen (e.g. Browse all only exists with many collections). */
  optional?: boolean;
  icon: string;
  title: string;
  body: string;
}

const $ = (sel: string) => () => document.querySelector(sel);
const tab = (label: string) => () => [...document.querySelectorAll('nav[aria-label="Main"] button')].find((b) => b.textContent?.trim().startsWith(label)) ?? null;
const near = (sel: string, up: string) => () => document.querySelector(sel)?.closest(up) ?? document.querySelector(sel);

const steps = (orders: boolean, name: string): Step[] => [
  { id: 'hello', screen: 'categories', icon: 'star', title: `Welcome${name ? `, ${name}` : ''}`, body: `This is ${merchant.brand.name}'s private showroom. A one-minute tour shows you how to find designs, save favourites and ${orders ? 'place an order' : 'ask about a design'}.` },
  { id: 'search', screen: 'categories', target: near('[data-testid="home-search"]', '.em-srch'), icon: 'search', title: 'Search anything', body: 'Type a design name, SKU or collection. Press enter to search every design in the catalogue.' },
  { id: 'featured', screen: 'categories', target: $('[data-testid="home-collections"]'), icon: 'grid', title: 'Featured collections', body: 'The store picks these for you. Tap one to see all of its designs.' },
  { id: 'browse', screen: 'categories', target: $('[data-testid="browse-collections"]'), optional: true, icon: 'layers', title: 'Every collection, by type', body: 'Browse all collections grouped by tag: rings together, pendants together, and so on.' },
  { id: 'catalogue-tab', screen: 'categories', target: tab('Catalogue'), icon: 'grid', title: 'The Catalogue', body: 'Every design in one place. Let us open it.' },
  { id: 'picker', screen: 'catalogue', target: $('[data-testid="collection-picker"]'), icon: 'layers', title: 'Switch collection', body: 'The collection you are looking at is named here. Tap to pick another one.' },
  { id: 'filter', screen: 'catalogue', target: $('[data-testid="catalogue-filter-button"]'), icon: 'sliders', title: 'Filter and sort', body: 'Narrow by purity, weight range or availability, and sort lightest or heaviest first.' },
  { id: 'layout', screen: 'catalogue', target: $('[aria-label="Layout"]'), icon: 'dense', title: 'Your view', body: 'Large photos, a compact grid of three, or a quick list. The app remembers your choice.' },
  { id: 'card', screen: 'catalogue', target: near('[data-testid="product-card"]', '.em-cardwrap'), optional: true, icon: 'eye', title: 'Open a design', body: 'Tap the photo for details and every photo. On the design page, swipe left or right to move to the next design, and tap a photo to zoom.' },
  { id: 'heart', screen: 'catalogue', target: $('.em-heart'), optional: true, icon: 'heart', title: 'Shortlist with a heart', body: 'Tap the heart to save a design to your Shortlist and come back to it later.' },
  ...(orders
    ? [{ id: 'add', screen: 'catalogue' as const, target: $('[data-testid="card-add-to-cart"]'), optional: true, icon: 'bag', title: 'Add to cart', body: 'Choose how many pieces you want in each purity. The net weight adds up as you go.' }]
    : []),
  { id: 'shortlist-tab', screen: 'catalogue', target: tab('Shortlist'), icon: 'heart', title: 'Your Shortlist', body: 'Everything you hearted, in one list. Open any design again, or add them all to your order at once.' },
  ...(orders
    ? [{ id: 'orders-tab', screen: 'catalogue' as const, target: tab('Orders'), icon: 'package', title: 'Review and place your order', body: 'Check quantities, add a note for the store and tap Place order. We confirm on WhatsApp. Past orders shows each order’s status.' }]
    : []),
  { id: 'profile', screen: 'catalogue', target: $('[aria-label="Profile menu"]'), icon: 'user', title: 'Your profile', body: `Your details, past orders, About ${merchant.brand.name} and this tour again, whenever you want it.` },
  { id: 'done', screen: 'categories', icon: 'check', title: 'You are all set', body: 'Use your phone’s Back button to step back at any time. Happy browsing!' }
];

/** Where the lit-up box is, in the viewport. */
type Box = { top: number; left: number; width: number; height: number } | null;
const PAD = 8;

/**
 * A guided tour for new buyers: it walks through the real app, lighting up each control in turn and moving between screens on its own.
 * Opens after a new buyer's first sign-in and again from the profile menu. Back, Escape or Skip ends it.
 */
export const BuyerTour: React.FC<{ buyerName: string; onNavigate: (screen: ActiveScreen) => void; onClose: () => void }> = ({ buyerName, onNavigate, onClose }) => {
  const orders = usePlan().flags.orders;
  const all = useRef(steps(orders, buyerName.split(' ')[0] ?? '')).current;
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<Box>(null);
  const [ready, setReady] = useState(false);
  const target = useRef<Element | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dir = useRef<1 | -1>(1);
  useBackLayer(true, onClose);
  const step = all[at];

  const measure = useCallback(() => {
    const el = target.current;
    if (!el || !el.isConnected) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, []);

  // Each step: go to its screen, wait for its element (designs load from the server), bring it into view, then light it up.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    target.current = null;
    if (step.screen) onNavigate(step.screen);
    if (!step.target) {
      setBox(null);
      setReady(true);
      return;
    }
    const started = Date.now();
    const look = () => {
      if (cancelled) return;
      const el = step.target!();
      if (el) {
        target.current = el;
        const r = el.getBoundingClientRect();
        const fixed = getComputedStyle(el).position === 'fixed' || !!el.closest('.em-tabs, .em-top');
        if (!fixed && (r.top < 90 || r.bottom > window.innerHeight - 260)) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        setTimeout(() => {
          if (cancelled) return;
          measure();
          setReady(true);
        }, fixed ? 60 : 380);
      } else if (Date.now() - started < 2500) setTimeout(look, 120);
      else if (step.optional) setAt((i) => Math.min(all.length - 1, Math.max(0, i + dir.current)));
      else {
        setBox(null);
        setReady(true);
      }
    };
    const t = setTimeout(look, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [at]);

  // Keep the light on the element while the page scrolls or the phone turns.
  useEffect(() => {
    let raf = 0;
    const again = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', again, true);
    window.addEventListener('resize', again);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', again, true);
      window.removeEventListener('resize', again);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (ready) nextRef.current?.focus({ preventScroll: true });
  }, [ready, at]);

  const go = (d: 1 | -1) => {
    dir.current = d;
    if (at + d >= all.length) return onClose();
    setAt(Math.max(0, at + d));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // The card sits under the lit-up element when there is room, otherwise above it; centred cards for welcome and finish.
  const centred = !box;
  const below = box ? box.top + box.height + 16 + 230 < window.innerHeight : true;
  const cardStyle: React.CSSProperties = centred ? {} : below ? { top: box!.top + box!.height + 14 } : { bottom: window.innerHeight - box!.top + 14 };
  const shown = all.length;
  const last = at === shown - 1;

  return (
    <div className="em-tour" role="dialog" aria-modal="true" aria-label={`App tour, step ${at + 1} of ${shown}`} data-testid="buyer-tour">
      {/* Catches every tap outside the card: the tour leads, the buyer follows. */}
      <div className={`em-tour-dim${centred ? ' full' : ''}`} />
      {box && <div className="em-tour-hole" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} aria-hidden="true" />}
      {ready && (
        <div key={step.id} className={`em-tour-card${centred ? ' centred' : below ? ' below' : ' above'}`} style={cardStyle} data-step={step.id}>
          {centred && (
            <div className={`em-tour-mark${last ? ' done' : ''}`} aria-hidden="true">
              <span>{last ? <Icon n="check" size={30} /> : merchant.brand.name.slice(0, 1)}</span>
              {last && Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />)}
            </div>
          )}
          <div className="em-row" style={{ gap: 10, alignItems: 'center' }}>
            {!centred && (
              <span className="em-tour-ic" aria-hidden="true">
                <Icon n={step.icon} size={16} />
              </span>
            )}
            <span className="em-ey" style={{ margin: 0 }}>
              {at === 0 ? 'Quick tour · 1 minute' : last ? 'Tour complete' : `Step ${at} of ${shown - 2}`}
            </span>
          </div>
          <h2 className="em-ser" aria-live="polite">{step.title}</h2>
          <p>{step.body}</p>
          <div className="em-tour-dots" aria-hidden="true">
            {all.map((s, i) => (
              <i key={s.id} className={i === at ? 'on' : i < at ? 'past' : ''} />
            ))}
          </div>
          <div className="em-row em-sb" style={{ marginTop: 14, gap: 10 }}>
            {last ? (
              <span />
            ) : (
              <button type="button" className="em-link" data-testid="tour-skip" onClick={onClose}>
                Skip tour
              </button>
            )}
            <span className="em-row" style={{ gap: 8 }}>
              {at > 0 && !last && (
                <button type="button" className="em-btn sec sm" data-testid="tour-back" onClick={() => go(-1)} aria-label="Previous step">
                  <Icon n="back" size={16} />
                </button>
              )}
              <button ref={nextRef} type="button" className="em-btn sm" data-testid="tour-next" onClick={() => go(1)}>
                {at === 0 ? 'Show me around' : last ? 'Start browsing' : 'Next'}
                {!last && <Icon n="right" size={16} />}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/** Whether this buyer has finished or skipped the tour on this device. */
const key = (phone: string) => `tour-done:${phone}`;
export const tourSeen = (phone: string) => {
  try {
    return localStorage.getItem(key(phone)) === '1';
  } catch {
    return false;
  }
};
export const markTourSeen = (phone: string) => {
  try {
    localStorage.setItem(key(phone), '1');
  } catch {
    // not remembered: the tour simply is not offered again this session
  }
};
