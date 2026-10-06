import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActiveScreen } from '../types';
import { merchant } from '../merchant';
import { usePlan } from '../plan';
import { Icon } from '../layouts/emergent/ui';
import { useBackLayer } from '../backLayer';
import { setLang, t, useLang } from '../i18n';

/** A design the tour borrows to show shortlisting and ordering; removed again when the tour ends. */
export interface TourSample {
  /** The design's name (chosen when first needed, once the catalogue has loaded). */
  title: () => string | null;
  /** Hearts the design (only if it was not already hearted); returns false when there was nothing to do. */
  heart: () => boolean;
  unheart: () => void;
  /** Puts one piece in the cart as a draft line (never sent to the store); returns the line id. */
  addToCart: () => Promise<string | null>;
  removeFromCart: (lineId: string) => Promise<void>;
}

/** One stop on the tour: which screen it needs, what to light up there, and what to say. */
interface Step {
  id: string;
  screen?: ActiveScreen;
  /** The element to light up; none for the welcome and finish cards. */
  target?: () => Element | null;
  /** Leave the step out when its element is not on screen (e.g. Browse all only exists with many collections). */
  optional?: boolean;
  /** Something the tour does itself before lighting up this step (heart the sample, add it to the cart, remove it). */
  enter?: () => Promise<void> | void;
  icon: string;
  /** English text, translated when shown (so the tour follows the buyer's language, even if they switch mid-tour). */
  title: string;
  body: string;
  /** Values for {placeholders} in title and body, worked out when shown. */
  vars?: () => Record<string, string>;
  /** The welcome card asks English or Hindi first. */
  pickLang?: boolean;
}

const $ = (sel: string) => () => document.querySelector(sel);
const tab = (screen: string) => () => document.querySelector(`nav[aria-label="Main"] button[data-tab="${screen}"]`);
const near = (sel: string, up: string) => () => document.querySelector(sel)?.closest(up) ?? document.querySelector(sel);
/** The sample's line in the order (found by its name), or null. */
const lineOf = (title: string | null) => (title ? [...document.querySelectorAll('.em-li')].find((li) => li.querySelector('.em-ser')?.textContent?.trim() === title) ?? null : null);
const removeBtn = (title: string | null) => lineOf(title)?.querySelector('[data-testid="order-line-remove"]') ?? null;

/** Where the lit-up window is, in the viewport. A zero-size box in the middle means "no element": the window closes to a point. */
type Box = { top: number; left: number; width: number; height: number; r: number };
const PAD = 8;
const centre = (): Box => ({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, r: 40 });
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A guided tour for new buyers: it walks through the real app, lighting up each control in turn and moving between screens on its own.
 * It hearts a sample design and puts it in the cart to show shortlisting and ordering, then removes both: nothing is ever sent to the store.
 * Opens after a new buyer's first sign-in and again from the profile menu. Back, Escape or Skip ends it.
 */
export const BuyerTour: React.FC<{ buyerName: string; sample: TourSample | null; onNavigate: (screen: ActiveScreen) => void; onClose: () => void }> = ({ buyerName, sample, onNavigate, onClose }) => {
  const orders = usePlan().flags.orders;
  const lang = useLang();
  // What the tour changed, so it can be undone however the tour ends.
  const made = useRef<{ hearted: boolean; line: string | null }>({ hearted: false, line: null });
  const undo = useCallback(async () => {
    if (!sample) return;
    if (made.current.hearted) sample.unheart();
    if (made.current.line) await sample.removeFromCart(made.current.line);
    made.current = { hearted: false, line: null };
  }, [sample]);
  const finish = useCallback(() => {
    void undo();
    onClose();
  }, [undo, onClose]);

  const all = useRef<Step[]>(
    (() => {
      const first = buyerName.split(' ')[0] ?? '';
      const s = sample;
      const list: Step[] = [
        { id: 'hello', screen: 'categories', icon: 'star', pickLang: true, title: first ? 'Welcome, {name}' : 'Welcome', body: 'This is your private showroom at {brand}. A short tour shows you how to find designs, save favourites and {action}. First, choose your language.', vars: () => ({ name: first, brand: merchant.brand.name, action: t(orders ? 'place an order' : 'ask about a design') }) },
        { id: 'lang', screen: 'categories', target: $('[data-testid="lang-toggle"]'), optional: true, icon: 'globe', title: 'English or हिन्दी', body: 'Switch the app between English and Hindi here, any time. Your choice is remembered on this phone.' },
        { id: 'search', screen: 'categories', target: near('[data-testid="home-search"]', '.em-srch'), icon: 'search', title: 'Search anything', body: 'Type a design name, SKU or collection. Press enter to search every design in the catalogue.' },
        { id: 'featured', screen: 'categories', target: $('[data-testid="home-collections"]'), icon: 'grid', title: 'Featured collections', body: 'The store picks these for you. Tap one to see all of its designs.' },
        { id: 'browse', screen: 'categories', target: $('[data-testid="browse-collections"]'), optional: true, icon: 'layers', title: 'Every collection, by type', body: 'Browse all collections grouped by type: rings together, pendants together, and so on.' },
        { id: 'catalogue-tab', screen: 'categories', target: tab('catalogue'), icon: 'grid', title: 'The Catalogue', body: 'Every design in one place. Let us open it.' },
        { id: 'picker', screen: 'catalogue', target: $('[data-testid="collection-picker"]'), icon: 'layers', title: 'Switch collection', body: 'The collection you are looking at is named here. Tap to pick another one.' },
        { id: 'filter', screen: 'catalogue', target: $('[data-testid="catalogue-filter-button"]'), icon: 'sliders', title: 'Filter and sort', body: 'Narrow by purity, weight range or availability, and sort lightest or heaviest first.' },
        { id: 'layout', screen: 'catalogue', target: $('[data-testid="layout-switch"]'), icon: 'dense', title: 'Your view', body: 'Large photos, a compact grid of three, or a quick list. The app remembers your choice.' },
        { id: 'card', screen: 'catalogue', target: near('[data-testid="product-card"]', '.em-cardwrap'), optional: true, icon: 'eye', title: 'Open a design', body: 'Tap the photo for details and every photo. On the design page, swipe left or right for the next design, and tap a photo to zoom.' },
        { id: 'heart', screen: 'catalogue', target: () => document.querySelector('.em-heart.on') ?? document.querySelector('.em-heart'), optional: true, icon: 'heart', title: 'Shortlist with a heart', body: 'Tap the heart to save a design for later. We have hearted one for you, so you can see where it goes.', enter: () => { if (s && s.heart()) made.current.hearted = true; } },
        { id: 'shortlist-tab', screen: 'catalogue', target: tab('shortlist'), icon: 'heart', title: 'Your Shortlist tab', body: 'Everything you heart is kept here. Let us open it.' },
        { id: 'shortlist-list', screen: 'shortlist', target: near('[data-testid="shortlist-open"]', '.em-li'), optional: true, icon: 'heart', title: 'Saved designs, with weights', body: 'Each saved design shows its net weight. Tap it to open the design again, or tap the heart to remove it.' },
        ...(orders
          ? [{ id: 'shortlist-order', screen: 'shortlist' as const, target: $('[data-testid="shortlist-order-all"]'), optional: true, icon: 'bag', title: 'Order the whole list', body: 'Order all adds one piece of every saved design to your order. The green button sends the list to the store on WhatsApp.' }]
          : []),
        ...(orders
          ? [
              { id: 'add', screen: 'catalogue' as const, target: $('[data-testid="card-add-to-cart"]'), optional: true, icon: 'bag', title: 'Add to cart', body: 'Choose how many pieces you want in each purity. The net weight adds up as you go. We are adding a sample piece for you now.', enter: async () => { if (s && !made.current.line) made.current.line = await s.addToCart(); } },
              { id: 'orders-tab', screen: 'catalogue' as const, target: tab('orders'), icon: 'package', title: 'The Orders tab', body: 'Your order waits here until you place it. Let us open it.' },
              { id: 'orders-line', screen: 'orders' as const, target: () => lineOf(s?.title() ?? null) ?? document.querySelector('.em-li'), optional: true, icon: 'package', title: 'This is a sample order', body: 'We put one piece of a design in your order as a sample. Change pieces with + and −. The total net weight is at the bottom.' },
              { id: 'orders-note', screen: 'orders' as const, target: $('[data-testid="order-note-input"]'), optional: true, icon: 'edit', title: 'A note for the store', body: 'Add a delivery date, finish or size change. The store sees it with your order.' },
              { id: 'orders-place', screen: 'orders' as const, target: $('[data-testid="place-order"]'), optional: true, icon: 'check', title: 'Place order', body: 'When you are ready, tap Place order. The store confirms on WhatsApp. We will not place this sample.' },
              { id: 'orders-remove', screen: 'orders' as const, target: () => removeBtn(s?.title() ?? null) ?? document.querySelector('[data-testid="order-line-remove"]'), optional: true, icon: 'x', title: 'Remove the sample', body: 'Tap × to take a line out of your order. Tap Next and we will remove the sample for you.' },
              { id: 'orders-past', screen: 'orders' as const, target: $('[data-testid="orders-tab-past"]'), icon: 'clock', title: 'Past orders', body: 'Sample removed. Every order you place appears under Past orders with its status: new, confirmed or dispatched. A new order can still be cancelled with two taps.', enter: async () => { if (s && made.current.line) { await s.removeFromCart(made.current.line); made.current.line = null; } } }
            ]
          : [{ id: 'orders-skip', screen: 'catalogue' as const, target: $('.em-heart'), optional: true, icon: 'chat', title: 'Ask on WhatsApp', body: 'Open a design and tap Enquire on WhatsApp to ask the store about price and availability.' }]),
        { id: 'profile', screen: orders ? 'orders' : 'catalogue', target: $('[aria-label="Profile menu"]'), icon: 'user', title: 'Your profile', body: 'Your details, past orders, About {brand} and this tour again, whenever you want it.', vars: () => ({ brand: merchant.brand.name }), enter: () => { if (s && made.current.hearted) { s.unheart(); made.current.hearted = false; } } },
        { id: 'done', screen: 'categories', icon: 'check', title: 'You are all set', body: 'The sample is gone and nothing was sent to the store. Use your phone’s Back button to step back at any time. Happy browsing!' }
      ];
      return list;
    })()
  ).current;

  const [at, setAt] = useState(0);
  // The card stays on screen between steps; only its words cross-fade while it flows to its new place.
  const [shown, setShown] = useState(0);
  const [placing, setPlacing] = useState(true);
  // Whether the step being shown lights up an element (otherwise the card sits in the middle).
  const [aimed, setAimed] = useState(false);
  const target = useRef<Element | null>(null);
  const aimedRef = useRef(false);
  const radius = useRef(28);
  const holeRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dir = useRef<1 | -1>(1);
  useBackLayer(true, finish);
  const step = all[shown];
  const vars = step.vars?.();

  /*
   * One animation loop for the whole tour. Every frame it reads where the lit-up element really is and moves the window and the card a
   * little way towards it on a spring that starts from rest and settles without overshoot, so it flows like water. Because it chases a live position rather than restarting a
   * CSS transition, the motion stays continuous while the page scrolls, a new screen slides in, or designs load.
   */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let cur: Box | null = null;
    let curY: number | null = null;
    let vY = 0;
    let vel = { top: 0, left: 0, width: 0, height: 0, r: 0 };
    let want: Box = centre();
    const still = reduced();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = target.current;
      if (aimedRef.current && el && el.isConnected) {
        const r = el.getBoundingClientRect();
        if (r.width || r.height) want = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, r: radius.current };
      } else if (!aimedRef.current) want = centre();
      // while the next screen is still arriving the window waits where it is, instead of darting to the middle and back.
      // A critically damped spring: it starts from rest, gathers speed and settles without overshoot (about 0.6 s).
      if (still || !cur) {
        cur = { ...want };
        vel = { top: 0, left: 0, width: 0, height: 0, r: 0 };
      } else {
        const K = 70, D = 2 * Math.sqrt(K);
        for (const key of ['top', 'left', 'width', 'height', 'r'] as const) {
          vel[key] += ((want[key] - cur[key]) * K - vel[key] * D) * dt;
          cur[key] += vel[key] * dt;
        }
      }
      const hole = holeRef.current;
      if (hole) {
        hole.style.transform = `translate3d(${cur.left}px, ${cur.top}px, 0)`;
        hole.style.width = `${Math.max(0, cur.width)}px`;
        hole.style.height = `${Math.max(0, cur.height)}px`;
        hole.style.borderRadius = `${cur.r}px`;
      }
      const card = cardRef.current;
      if (card) {
        const h = card.offsetHeight;
        const vh = window.innerHeight;
        const centred = want.width === 0;
        const wantY = centred ? (vh - h) / 2 : want.top + want.height + 14 + h < vh - 8 ? want.top + want.height + 14 : Math.max(8, want.top - 14 - h);
        if (curY === null || still) curY = wantY;
        else {
          vY += ((wantY - curY) * 70 - vY * 2 * Math.sqrt(70)) * dt;
          curY += vY * dt;
        }
        card.style.transform = `translate3d(0, ${curY}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Each step: do its action, go to its screen, wait for its element (designs load from the server), bring it into view, then light it up.
  useEffect(() => {
    let cancelled = false;
    const s = all[at];
    setPlacing(true);
    (async () => {
      if (s.enter) await s.enter();
      if (cancelled) return;
      if (s.screen) onNavigate(s.screen);
      const centreOn = () => {
        target.current = null;
        aimedRef.current = false;
        setAimed(false);
        setShown(at);
        setPlacing(false);
      };
      if (!s.target) return centreOn();
      const started = Date.now();
      const look = () => {
        if (cancelled) return;
        const el = s.target!();
        if (el) {
          const r = el.getBoundingClientRect();
          const fixed = !!el.closest('.em-tabs, .em-top, .em-dock, .em-sheet') || getComputedStyle(el).position === 'fixed';
          if (!fixed && (r.top < 90 || r.bottom > window.innerHeight - 280)) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
          radius.current = Math.min((parseFloat(getComputedStyle(el).borderRadius) || 14) + PAD, 28);
          target.current = el;
          aimedRef.current = true;
          setAimed(true);
          setShown(at);
          setPlacing(false);
        } else if (Date.now() - started < 2500) setTimeout(look, 80);
        else if (s.optional) setAt((i) => Math.min(all.length - 1, Math.max(0, i + dir.current)));
        else centreOn();
      };
      // give a new screen a moment to arrive before measuring it
      setTimeout(look, s.screen && s.screen !== all[Math.max(0, at - dir.current)]?.screen ? 220 : 40);
    })();
    return () => {
      cancelled = true;
    };
  }, [at]);

  useLayoutEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [shown]);

  const go = (d: 1 | -1) => {
    if (placing) return;
    dir.current = d;
    if (at + d >= all.length) return finish();
    setAt(Math.max(0, at + d));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const centred = !aimed;
  const last = shown === all.length - 1;


  return (
    <div className="em-tour" role="dialog" aria-modal="true" aria-label={t('App tour, step {n} of {total}', { n: shown + 1, total: all.length })} data-testid="buyer-tour">
      {/* Catches every tap outside the card: the tour leads, the buyer follows. */}
      <div className="em-tour-dim" />
      <div ref={holeRef} className="em-tour-hole" aria-hidden="true" />
      <div ref={cardRef} className={`em-tour-card${centred ? ' centred' : ''}`} data-step={step.id}>
        <div key={step.id} className="em-tour-body">
          {centred && (
            <div className={`em-tour-mark${last ? ' done' : ''}`} aria-hidden="true">
              <span>{last ? <Icon n="check" size={30} /> : merchant.brand.name.slice(0, 1)}</span>
              {last && Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />)}
            </div>
          )}
          <div className="em-row em-tour-head">
            {!centred && (
              <span className="em-tour-ic" aria-hidden="true">
                <Icon n={step.icon} size={16} />
              </span>
            )}
            <span className="em-ey" style={{ margin: 0 }}>
              {shown === 0 ? t('Quick tour · 2 minutes') : last ? t('Tour complete') : t('Step {n} of {total}', { n: shown, total: all.length - 2 })}
            </span>
          </div>
          <h2 className="em-ser" aria-live="polite">{t(step.title, vars)}</h2>
          <p>{t(step.body, vars)}</p>
          {step.pickLang && (
            <div className="em-tour-lang" role="group" aria-label="Language / भाषा" data-testid="tour-lang">
              <button type="button" lang="en" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} data-testid="tour-lang-en" onClick={() => setLang('en')}>English</button>
              <button type="button" lang="hi" className={lang === 'hi' ? 'on' : ''} aria-pressed={lang === 'hi'} data-testid="tour-lang-hi" onClick={() => setLang('hi')}>हिन्दी</button>
            </div>
          )}
        </div>
        <div className="em-tour-dots" aria-hidden="true">
          <i style={{ transform: `translateX(${shown * 11}px)` }} />
          {all.map((s) => (
            <b key={s.id} />
          ))}
        </div>
        <div className="em-row em-sb" style={{ marginTop: 14, gap: 10 }}>
          {last ? (
            <span />
          ) : (
            <button type="button" className="em-link" data-testid="tour-skip" onClick={finish}>
              {t('Skip tour')}
            </button>
          )}
          <span className="em-row" style={{ gap: 8 }}>
            {shown > 0 && !last && (
              <button type="button" className="em-btn sec sm" data-testid="tour-back" onClick={() => go(-1)} aria-label={t('Previous step')}>
                <Icon n="back" size={16} />
              </button>
            )}
            <button ref={nextRef} type="button" className="em-btn sm" data-testid="tour-next" onClick={() => go(1)} aria-busy={placing}>
              {t(shown === 0 ? 'Show me around' : last ? 'Start browsing' : 'Next')}
              {!last && <Icon n="right" size={16} />}
            </button>
          </span>
        </div>
      </div>
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
