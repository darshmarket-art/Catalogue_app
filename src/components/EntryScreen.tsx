import { LegalLinks } from './LegalLinks';
import React, { useEffect, useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import '../layouts/emergent/emergent.css';
import './platform.css';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
import { AntarixsMark, PlatformWord } from './AntarixsBrand';
import { PlansCompare } from './PlansCompare';

/** Where "Sign in to your store" goes: [store].<platform domain>, or ?store= on localhost. */
export function storeUrl(store: string, loc: Pick<Location, 'protocol' | 'hostname' | 'host'> = window.location): string | null {
  const s = store.trim().toLowerCase().replace(/^https?:\/\//, '').split('.')[0];
  if (!isValidStoreName(s)) return null;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `${loc.protocol}//${loc.host}/?store=${s}`;
  const base = loc.hostname.startsWith('app.') ? loc.hostname.slice(4) : 'antarixs.com';
  return `https://${s}.${base}`;
}

const Arrow: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg className="ax-i" style={{ width: size, height: size }} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const PILLARS: Array<{ title: string; text: string; icon: string }> = [
  { title: 'Catalogue', text: 'Collections, designs and net weights, shared with one link or QR.', icon: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z' },
  { title: 'ERP system', text: 'Orders, stock status and buyers kept together in one tidy desk.', icon: 'M12 3 3 7.5 12 12l9-4.5L12 3zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5' },
  { title: 'WhatsApp lighthouse', text: 'Every enquiry and order lands on WhatsApp, so no lead goes dark.', icon: 'M9 21h6M10 21l1-12h2l1 12M9 9h6l-1-4h-4zM12 2v1.5M3 6l3.5 1.5M21 6l-3.5 1.5' },
  { title: 'Lead insights', text: 'See who browses, what they shortlist and who is ready to order.', icon: 'M3 4h18l-7 8v6l-4 2v-8z' }
];
const EXTRAS = ['Orders desk', 'Live visitors', 'Store QR', 'Buyer engagement', 'PDF catalogue', 'English + Hindi'];
const BUYER_CARDS: Array<{ img: string; alt: string; title: string; note: string }> = [
  { img: '/platform/chokers.jpg', alt: 'Rani Haar Lakshmi', title: 'Bridal Chokers & Haar', note: '342 designs · weights shown first' },
  { img: '/platform/temple.jpg', alt: 'Kasu Mala Temple', title: 'Antique Temple Jewellery', note: 'Shortlist and order in grams' },
  { img: '/platform/polki.jpg', alt: 'Polki Bridal Set', title: 'Jadau & Polki', note: 'Orders arrive on WhatsApp' }
];
const STEPS: Array<[string, string, string]> = [
  ['1', 'Name your store', 'Pick your business name and your own address. We check it is free as you type.'],
  ['2', 'Verify on WhatsApp', 'We send a 6-digit code to your WhatsApp number. It expires in 5 minutes.'],
  ['3', 'Share the link or QR', 'Buyers sign in with their WhatsApp number and browse. Orders reach you on WhatsApp.']
];

/** One way in: a role row. */
const Role: React.FC<{ dashed?: boolean; icon: string; title: string; text: string; onClick?: () => void; href?: string }> = ({ dashed, icon, title, text, onClick, href }) => {
  const inner = (
    <>
      <span className="ax-ic">
        <Icon n={icon} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <span style={{ color: 'var(--mut)', display: 'flex' }}>
        <Icon n="right" size={18} />
      </span>
    </>
  );
  const cls = `ax-opt${dashed ? ' dashed' : ''}`;
  return href ? (
    <a className={cls} href={href}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
};

const SubTop: React.FC<{ onBack: () => void; title: string }> = ({ onBack, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 0 6px' }}>
    <button type="button" className="ib" aria-label="Back" onClick={onBack}>
      <Icon n="back" />
    </button>
    <span style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{title}</span>
  </div>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-layout="emergent" className="ax">
    {children}
  </div>
);

/** Antarixs welcome page: hero, the four pillars, what buyers see, how it works, ways in (buyer, store admin, new merchant), plans. */
export const EntryScreen: React.FC = () => {
  const [view, setView] = useState<'home' | 'plans' | 'store'>('home');
  const [who, setWho] = useState<'buyer' | 'admin'>('buyer');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    document.title = 'Antarixs · Storefronts for jewellery wholesalers';
  }, []);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const u = storeUrl(name);
    if (u) window.location.replace(u);
    else setErr('Enter your store address, for example sharma-jewellers.');
  };
  const pick = (w: 'buyer' | 'admin') => {
    setWho(w);
    setErr(null);
    setView('store');
  };

  if (view === 'plans') {
    return (
      <Shell>
        <main className="ax-narrow" style={{ gap: 14 }}>
          <SubTop onBack={() => setView('home')} title="Basic and Pro" />
          <PlansCompare />
          <a className="btn" href="/signup">
            Start free trial
          </a>
        </main>
      </Shell>
    );
  }

  if (view === 'store') {
    return (
      <Shell>
        <main className="ax-narrow">
          <SubTop onBack={() => setView('home')} title={who === 'buyer' ? 'Login' : 'Store admin'} />
          <div>
            <h1 style={{ fontSize: 38, lineHeight: 1.1 }}>{who === 'buyer' ? 'Which showroom?' : 'Sign in to your store'}</h1>
            <p className="ax-mut" style={{ marginTop: 10, fontSize: 15 }}>
              {who === 'buyer' ? 'Enter the store address you were sent. You sign in there with a WhatsApp code.' : 'The store administrator signs in with email and password on their store.'}
            </p>
          </div>
          <form onSubmit={go} className="col" style={{ gap: 16 }}>
            <div>
              <label className="lab" htmlFor="store">
                Store address
              </label>
              <div className="inp" style={{ paddingRight: 14 }}>
                <input
                  id="store"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErr(null);
                  }}
                  placeholder="your-name"
                  style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}
                />
                <span className="ax-mut" style={{ fontSize: 14 }}>
                  .antarixs.com
                </span>
              </div>
            </div>
            {err && <Notice tone="error">{err}</Notice>}
            <button type="submit" className="btn">
              {who === 'buyer' ? 'Open the showroom' : 'Go to my store'}
            </button>
          </form>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main>
        <header className="ax-hero">
          <div className="ax-wrap ax-herogrid">
            <div className="ax-nav">
              <PlatformWord />
              <nav className="links" aria-label="Main">
                <a href="#how">How it works</a>
                <button type="button" onClick={() => setView('plans')}>
                  Basic &amp; Pro
                </button>
                <a href="#experience">Sign in</a>
                <a className="ax-btn sm" href="/signup">
                  Create your store
                </a>
              </nav>
            </div>

            <div className="ax-copy">
              <span className="ax-ey">Storefronts for jewellery wholesalers</span>
              <h1 className="ax-h1">
                Your jewellery,
                <br />
                on an elegant
                <br />
                canvas.
              </h1>
              <p className="lead">Upload designs, share one link, let dealers browse and enquire on WhatsApp.</p>
              <div className="ax-cta">
                <a className="ax-btn" href="/signup">
                  Create your store
                  <Arrow />
                </a>
                <a className="ax-btn line" href="#experience">
                  Sign in to a store
                </a>
              </div>
              <p className="ax-hint hint-line" style={{ fontSize: 14 }}>
                3 steps · WhatsApp verified · QR to share · {TRIAL_DAYS} days free
              </p>
            </div>

            <div className="ax-ph">
              <div className="ax-photo img">
                <img src="/platform/hero.jpg" alt="Royal Kundan Choker, 22K 916" />
                <span className="fade" />
              </div>
              <div className="ax-card card-order">
                <span className="ax-ey" style={{ fontSize: 10 }}>
                  New order
                </span>
                <b style={{ display: 'block', fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 20, marginTop: 4 }}>PO-SHARMA-0142</b>
                <span className="ax-mut" style={{ fontSize: 13 }}>
                  7 pieces · 276.2 g net
                </span>
                <div style={{ marginTop: 10 }}>
                  <span className="ax-pill ok">Confirmed on WhatsApp</span>
                </div>
              </div>
              <div className="ax-card card-store">
                <AntarixsMark size={22} />
                <span>
                  sharma-jewellers<span className="ax-mut" style={{ fontWeight: 500 }}>.antarixs.com</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="ax-wrap ax-sec" aria-labelledby="ax-pillars">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px 40px' }}>
            <div style={{ maxWidth: 620 }}>
              <span className="ax-ey">The platform</span>
              <h2 className="ax-h2" id="ax-pillars" style={{ fontSize: 'clamp(32px, 3.6vw, 52px)', marginTop: 12 }}>
                Everything a wholesale jewellery house runs on.
              </h2>
            </div>
            <p className="ax-mut" style={{ margin: 0, maxWidth: 360, fontSize: 16 }}>
              One quiet system for showing designs, taking orders and knowing your buyers.
            </p>
          </div>
          <div className="ax-pillars">
            {PILLARS.map((p) => (
              <article key={p.title} className="ax-card ax-pillar">
                <span className="ax-ic">
                  <svg className="ax-i" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={p.icon} />
                  </svg>
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
            {EXTRAS.map((x) => (
              <span key={x} className="ax-chip" style={{ cursor: 'default' }}>
                {x}
              </span>
            ))}
          </div>
        </section>

        <section className="ax-wrap ax-sec" aria-labelledby="ax-buyers">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
            <h2 className="ax-h2" id="ax-buyers" style={{ fontSize: 'clamp(28px, 3.2vw, 46px)' }}>
              What your buyers see
            </h2>
            <a className="ax-link" href="/signup">
              Create your store
              <Arrow size={17} />
            </a>
          </div>
          <div className="ax-buyers">
            {BUYER_CARDS.map((c) => (
              <article key={c.title} className="ax-card ax-buyer">
                <div className="ax-photo">
                  <img src={c.img} alt={c.alt} loading="lazy" />
                </div>
                <div style={{ padding: '16px 14px 12px' }}>
                  <h3 className="ax-h3" style={{ fontSize: 22 }}>
                    {c.title}
                  </h3>
                  <p className="ax-hint" style={{ marginTop: 4 }}>
                    {c.note}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="ax-wrap ax-sec" aria-labelledby="ax-how">
          <div className="ax-card ax-howcard">
            <span className="ax-ey">How it works</span>
            <h2 className="ax-h2" id="ax-how" style={{ fontSize: 'clamp(30px, 3.4vw, 48px)', marginTop: 12, maxWidth: 640 }}>
              Three steps to a store your dealers can open.
            </h2>
            <div className="ax-steps">
              {STEPS.map(([n, title, text]) => (
                <div key={n}>
                  <span className="n">{n}</span>
                  <h3 className="ax-h3" style={{ fontSize: 24, marginTop: 14 }}>
                    {title}
                  </h3>
                  <p className="ax-mut" style={{ margin: '8px 0 0', fontSize: 15 }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="experience" className="ax-wrap ax-sec" aria-labelledby="ax-exp">
          <div className="ax-exp">
            <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
              <span className="ax-ey">Welcome</span>
              <h2 className="ax-h2" id="ax-exp" style={{ fontSize: 'clamp(32px, 3.4vw, 48px)', marginTop: 12 }}>
                Choose your experience.
              </h2>
              <p className="ax-mut" style={{ margin: '14px 0 0', fontSize: 16 }}>
                Open a showroom as a buyer, or step behind the counter.
              </p>
            </div>
            <div style={{ flex: '1 1 460px', minWidth: 0, maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Role icon="bag" title="Login" text="Browse the full catalogue, shortlist, and track orders." onClick={() => pick('buyer')} />
              <Role icon="grid" title="Store admin" text="Dashboard, orders desk, add designs, manage buyers." onClick={() => pick('admin')} />
              <Role dashed icon="plus" title="New merchant? Create your store" text={`3 steps · WhatsApp verified · QR to share · ${TRIAL_DAYS} days free`} href="/signup" />
            </div>
          </div>
        </section>

        <section className="ax-wrap ax-sec" aria-labelledby="ax-plans">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ maxWidth: 560 }}>
              <span className="ax-ey">Basic &amp; Pro</span>
              <h2 className="ax-h2" id="ax-plans" style={{ fontSize: 'clamp(30px, 3.2vw, 46px)', marginTop: 12 }}>
                Start with the full Pro trial.
              </h2>
            </div>
            <button type="button" className="ax-link" onClick={() => setView('plans')}>
              Compare Basic &amp; Pro
              <Arrow size={17} />
            </button>
          </div>
          <div className="ax-plansgrid">
            <article className="ax-card" style={{ padding: 32 }}>
              <span className="ax-pill">Basic</span>
              <h3 className="ax-h3" style={{ fontSize: 30, marginTop: 16 }}>
                A clean catalogue
              </h3>
              <p className="ax-mut" style={{ margin: '10px 0 0', fontSize: 15 }}>
                5 collections, 200 photos, 50 buyers. Home banners and purity options.
              </p>
            </article>
            <article className="ax-card" style={{ padding: 32, background: 'var(--dark)', borderColor: 'var(--dark)', color: '#fff' }}>
              <span className="ax-pill" style={{ background: 'var(--spark)', color: '#2a2200' }}>
                Pro · {TRIAL_DAYS} days free
              </span>
              <h3 className="ax-h3" style={{ fontSize: 30, marginTop: 16 }}>
                Orders, insights and more
              </h3>
              <p style={{ margin: '10px 0 0', fontSize: 15, color: 'rgb(255 255 255 / 0.8)' }}>Unlimited collections and buyers. Ordering, WhatsApp alerts, insights, PDF catalogue.</p>
            </article>
          </div>
        </section>

        <section className="ax-wrap ax-sec">
          <div className="ax-ctapanel">
            <div style={{ maxWidth: 600, position: 'relative' }}>
              <h2 className="ax-h2" style={{ fontSize: 'clamp(32px, 4vw, 58px)', color: '#fff' }}>
                Your store, live in three steps.
              </h2>
              <p style={{ margin: '14px 0 0', fontSize: 17, color: 'rgb(255 255 255 / 0.78)' }}>Free for {TRIAL_DAYS} days. No card needed.</p>
            </div>
            <a className="ax-btn" href="/signup" style={{ position: 'relative' }}>
              Create your store
            </a>
            <span style={{ position: 'absolute', right: -60, bottom: -120, opacity: 0.12, display: 'flex' }} aria-hidden="true">
              <AntarixsMark size={360} />
            </span>
          </div>
        </section>
      </main>

      <footer className="ax-foot">
        <div className="ax-wrap" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px 28px', paddingBlock: 30 }}>
          <PlatformWord caption="" size={26} />
          <span>Storefronts for jewellery wholesalers</span>
          <LegalLinks platform />
        </div>
      </footer>
    </Shell>
  );
};
