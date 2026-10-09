import { LegalLinks } from './LegalLinks';
import React, { useEffect, useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import '../layouts/emergent/emergent.css';
import './platform.css';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
import { PlatformWord } from './AntarixsBrand';
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
const STEPS: Array<[string, string, string]> = [
  ['1', 'Name your store', 'Pick your business name and your own address. We check it is free as you type.'],
  ['2', 'Verify on WhatsApp', 'We send a 6-digit code to your WhatsApp number. It expires in 5 minutes.'],
  ['3', 'Share the link or QR', 'Buyers sign in with their WhatsApp number and browse. Orders reach you on WhatsApp.']
];

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
  const [menu, setMenu] = useState(false);
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
          <SubTop onBack={() => setView('home')} title="Sign in" />
          <div className="ax-seg" role="group" aria-label="Sign in as">
            <button type="button" className={who === 'buyer' ? 'ax-btn sm' : 'ax-btn sm line'} aria-pressed={who === 'buyer'} onClick={() => setWho('buyer')}>
              Buyer
            </button>
            <button type="button" className={who === 'admin' ? 'ax-btn sm' : 'ax-btn sm line'} aria-pressed={who === 'admin'} onClick={() => setWho('admin')}>
              Store admin
            </button>
          </div>
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
          <div className="ax-photo ax-banner" aria-hidden="false">
            <img src="/platform/banner.jpg" alt="Peacock earrings in gold with kundan, enamel and a ruby drop, on brown velvet" fetchPriority="high" />
          </div>
          <div className="ax-wrap ax-hero-in">
          <div className="ax-nav">
            <PlatformWord />
            <button type="button" className="ax-menubtn" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="ax-menu" onClick={() => setMenu(!menu)}>
              <svg className="ax-i" viewBox="0 0 24 24" aria-hidden="true">
                {menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
            {menu && (
              <div id="ax-menu" className="ax-menu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setView('plans'); }}>
                  Pricing · Basic &amp; Pro
                </button>
                <div className="sep" />
                <a role="menuitem" href="/terms">
                  Terms &amp; conditions
                </a>
                <a role="menuitem" href="/privacy">
                  Privacy policy
                </a>
              </div>
            )}
          </div>

          <div className="ax-copy">
            <span className="ax-ey">Storefronts for jewellery wholesalers</span>
            <h1>
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
              <button type="button" className="ax-btn line" onClick={() => pick('buyer')}>
                Sign in
              </button>
            </div>
            <p className="ax-hint" style={{ fontSize: 14 }}>
              3 steps · WhatsApp verified · QR to share · {TRIAL_DAYS} days free
            </p>
          </div>

          </div>
        </header>

        <section className="ax-wrap ax-sec" aria-labelledby="ax-pillars">
          <div style={{ maxWidth: 640 }}>
            <span className="ax-ey">The platform</span>
            <h2 className="ax-h2" id="ax-pillars" style={{ fontSize: 'clamp(32px, 3.6vw, 50px)', marginTop: 14 }}>
              Everything a wholesale jewellery house runs on.
            </h2>
          </div>
          <div className="ax-cols ax-pillars">
            {PILLARS.map((p) => (
              <article key={p.title} className="ax-pillar">
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="ax-wrap ax-sec" aria-labelledby="ax-how">
          <span className="ax-ey">How it works</span>
          <h2 className="ax-h2" id="ax-how" style={{ fontSize: 'clamp(30px, 3.4vw, 48px)', marginTop: 14, maxWidth: 640 }}>
            Three steps to a store your dealers can open.
          </h2>
          <div className="ax-cols ax-steps">
            {STEPS.map(([n, title, text]) => (
              <div key={n} className="ax-step">
                <span className="n">0{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ax-wrap ax-sec" aria-labelledby="ax-plans">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ maxWidth: 560 }}>
              <span className="ax-ey">Basic &amp; Pro</span>
              <h2 className="ax-h2" id="ax-plans" style={{ fontSize: 'clamp(30px, 3.2vw, 46px)', marginTop: 14 }}>
                Start with the full Pro trial.
              </h2>
            </div>
            <button type="button" className="ax-link" onClick={() => setView('plans')}>
              Compare plans
              <Arrow size={17} />
            </button>
          </div>
          <div className="ax-cols ax-plans">
            <article className="ax-plan">
              <span className="ax-ey">Basic</span>
              <h3>A clean catalogue</h3>
              <p>5 collections, 200 photos, 50 buyers. Home banners and purity options.</p>
            </article>
            <article className="ax-plan">
              <span className="ax-ey">Pro · {TRIAL_DAYS} days free</span>
              <h3>Orders, insights and more</h3>
              <p>Unlimited collections and buyers. Ordering, WhatsApp alerts, insights, PDF catalogue.</p>
            </article>
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
