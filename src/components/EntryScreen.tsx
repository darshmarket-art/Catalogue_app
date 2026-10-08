import { LegalLinks } from './LegalLinks';
import React, { useEffect, useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import '../layouts/emergent/emergent.css';
import './orbit.css';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
import { AntarixsWordmark, PoweredByAntarixs } from './AntarixsBrand';
import { PlansCompare } from './PlansCompare';
import { OrbitSystem } from './OrbitSystem';

/** Where "Sign in to your store" goes: [store].<platform domain>, or ?store= on localhost. */
export function storeUrl(store: string, loc: Pick<Location, 'protocol' | 'hostname' | 'host'> = window.location): string | null {
  const s = store.trim().toLowerCase().replace(/^https?:\/\//, '').split('.')[0];
  if (!isValidStoreName(s)) return null;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `${loc.protocol}//${loc.host}/?store=${s}`;
  const base = loc.hostname.startsWith('app.') ? loc.hostname.slice(4) : 'antarixs.com';
  return `https://${s}.${base}`;
}

/** One way in: a role row (Orbit theme). */
const Role: React.FC<{ dashed?: boolean; icon: string; title: string; text: string; onClick?: () => void; href?: string }> = ({ dashed, icon, title, text, onClick, href }) => {
  const inner = (
    <>
      <span className="ico">
        <Icon n={icon} size={20} />
      </span>
      <span className="em-grow">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <span className="go">
        <Icon n="right" size={18} />
      </span>
    </>
  );
  const cls = `orb-role${dashed ? ' dashed' : ''}`;
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

const STEPS: Array<[string, string, string]> = [
  ['1', 'Name your store', 'Pick your business name and your own address. We check it is free as you type.'],
  ['2', 'Verify on WhatsApp', 'We send a 6-digit code to your WhatsApp number. It expires in 5 minutes.'],
  ['3', 'Share the link or QR', 'Buyers sign in with their WhatsApp number and browse. Orders reach you on WhatsApp.']
];

const SubTop: React.FC<{ onBack: () => void; title: string }> = ({ onBack, title }) => (
  <div className="em-row" style={{ gap: 12, padding: '18px 0 6px' }}>
    <button type="button" className="ib" aria-label="Back" onClick={onBack}>
      <Icon n="back" />
    </button>
    <span className="em-ser" style={{ fontSize: 20 }}>
      {title}
    </span>
  </div>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-layout="emergent" data-theme="orbit" className="min-h-screen bg-surface text-on-surface">
    {children}
  </div>
);

/** Antarixs welcome page (the Emergent atlas Welcome): buyer showroom, store admin, new merchant; plus Basic and Pro and the store address step. */
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
        <main className="orb-narrow">
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
        <main className="orb-narrow">
          <SubTop onBack={() => setView('home')} title={who === 'buyer' ? 'Login' : 'Store admin'} />
          <div>
            <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.15 }}>
              {who === 'buyer' ? 'Which showroom?' : 'Sign in to your store'}
            </h1>
            <p className="em-mut" style={{ marginTop: 6, fontSize: 14 }}>
              {who === 'buyer' ? 'Enter the store address you were sent. You sign in there with a WhatsApp code.' : 'The store administrator signs in with email and password on their store.'}
            </p>
          </div>
          <form onSubmit={go} className="col" style={{ gap: 16 }}>
            <div>
              <label className="lab" htmlFor="store">
                Store address
              </label>
              <div className="inp" style={{ padding: 0 }}>
                <input
                  id="store"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErr(null);
                  }}
                  placeholder="your-name"
                  style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', padding: '0 0 0 15px', font: 'inherit', color: 'inherit' }}
                />
                <span className="em-mut" style={{ paddingRight: 15 }}>
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
        <header style={{ position: 'relative' }}>
          <span className="orb-glow" style={{ width: 700, height: 700, right: -160, top: -40 }} />
          <div className="orb-wrap" style={{ position: 'relative' }}>
            <div className="orb-nav">
              <AntarixsWordmark dark />
              <nav className="links" aria-label="Main">
                <a className="hide-s" href="#how">
                  How it works
                </a>
                <button type="button" className="hide-s" onClick={() => setView('plans')}>
                  Basic &amp; Pro
                </button>
                <a className="hide-s" href="#experience">
                  Sign in
                </a>
                <a className="btn sm" href="/signup">
                  Create your store
                </a>
              </nav>
            </div>
            <div className="orb-hero">
              <div className="orb-copy">
                <span className="em-ey">Storefronts for jewellery wholesalers</span>
                <h1>Your jewellery, on an elegant canvas.</h1>
                <p>Upload designs, share one link, let dealers browse and enquire on WhatsApp.</p>
                <div className="orb-cta">
                  <a className="btn" href="/signup">
                    Create your store
                    <Icon n="right" size={18} />
                  </a>
                  <a className="btn alt" href="#experience">
                    Sign in to a store
                  </a>
                </div>
                <p className="hint" style={{ fontSize: 14 }}>
                  3 steps · WhatsApp verified · QR to share · {TRIAL_DAYS} days free
                </p>
              </div>
              <OrbitSystem />
            </div>
          </div>
        </header>

        <section id="how" className="orb-wrap orb-sec" aria-labelledby="orb-how">
          <span className="em-ey">How it works</span>
          <h2 id="orb-how">Three steps to a store your dealers can open</h2>
          <p className="em-mut" style={{ margin: '12px 0 0' }}>
            Free for {TRIAL_DAYS} days. No card needed.
          </p>
          <div className="orb-steps">
            {STEPS.map(([n, title, text]) => (
              <article key={n} className="orb-step">
                <span className="n">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="experience" className="orb-wrap orb-sec" aria-labelledby="orb-exp">
          <div className="orb-exp">
            <div>
              <span className="em-ey">Welcome</span>
              <h2 id="orb-exp">Choose your experience</h2>
              <p className="em-mut" style={{ margin: '12px 0 0' }}>
                Open a showroom as a buyer, or step behind the counter.
              </p>
            </div>
            <div className="orb-roles">
              <Role icon="bag" title="Login" text="Browse the full catalogue, shortlist, and track orders." onClick={() => pick('buyer')} />
              <Role icon="grid" title="Store admin" text="Dashboard, orders desk, add designs, manage buyers." onClick={() => pick('admin')} />
              <Role dashed icon="plus" title="New merchant? Create your store" text={`3 steps · WhatsApp verified · QR to share · ${TRIAL_DAYS} days free`} href="/signup" />
            </div>
          </div>
        </section>

        <div className="orb-wrap orb-foot">
          <button type="button" className="em-link" onClick={() => setView('plans')}>
            Compare Basic &amp; Pro
          </button>
          <PoweredByAntarixs />
          <LegalLinks platform />
        </div>
      </main>
    </Shell>
  );
};
