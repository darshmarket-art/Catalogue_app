import { LegalLinks } from './LegalLinks';
import React, { useEffect, useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import '../layouts/emergent/emergent.css';
import './platform.css';
import { Icon } from '../layouts/emergent/ui';
import { PlatformWord } from './AntarixsBrand';
import { Reveal } from './Reveal';
import { HowItWorks } from './HowItWorks';
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
  const [view, setView] = useState<'home' | 'plans' | 'how'>('home');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    document.title = 'Antarixs · Storefronts for jewellery wholesalers';
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

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

  if (view === 'how') {
    return (
      <Shell>
        <div className="ax-wrap">
          <div className="ax-nav">
            <PlatformWord caption="Jewellers Solution" size={44} />
            <button type="button" className="ax-link" style={{ marginLeft: 'auto' }} onClick={() => setView('home')}>
              Back
            </button>
          </div>
        </div>
        <main>
          <HowItWorks />
          <div className="ax-wrap" style={{ paddingBlock: '24px 100px' }}>
            <a className="ax-btn" href="/signup">
              Create your store
              <Arrow />
            </a>
          </div>
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
            <PlatformWord caption="Jewellers Solution" size={44} />
            <button type="button" className="ax-menubtn" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="ax-menu" onClick={() => setMenu(!menu)}>
              <svg className="ax-i" viewBox="0 0 24 24" aria-hidden="true">
                {menu ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
            {menu && (
              <div id="ax-menu" className="ax-menu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setView('how'); }}>
                  How it works
                </button>
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
            </div>
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
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} as="article" delay={i * 140} className="ax-pillar">
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={p.icon} pathLength={1} />
                </svg>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </Reveal>
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
