import { LegalLinks } from './LegalLinks';
import React, { useEffect, useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import '../layouts/emergent/emergent.css';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
import { AntarixsWordmark, PoweredByAntarixs } from './AntarixsBrand';
import { PlansCompare } from './PlansCompare';

/** Where "Sign in to your store" goes: [store].<platform domain>, or ?store= on localhost. */
export function storeUrl(store: string, loc: Pick<Location, 'protocol' | 'hostname' | 'host'> = window.location): string | null {
  const s = store.trim().toLowerCase().replace(/^https?:\/\//, '').split('.')[0];
  if (!isValidStoreName(s)) return null;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `${loc.protocol}//${loc.host}/?store=${s}`;
  const base = loc.hostname.startsWith('app.') ? loc.hostname.slice(4) : 'antarixs.com';
  return `https://${s}.${base}`;
}

const DEEP = 'linear-gradient(150deg, #4b1fc0 0%, #2B0A7A 100%)';

/** One way in, as on the Emergent welcome screen: a role card. */
const Role: React.FC<{ pri?: boolean; icon: string; title: string; text: string; onClick: () => void }> = ({ pri, icon, title, text, onClick }) => (
  <button type="button" className={`em-role${pri ? ' pri' : ''}`} onClick={onClick}>
    <span className="ico">
      <Icon n={icon} size={22} />
    </span>
    <span className="em-grow">
      <span className="em-ser">{title}</span>
      <small>{text}</small>
    </span>
    <Icon n="right" size={20} />
  </button>
);

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
  <div data-layout="emergent" className="min-h-screen bg-surface text-on-surface">
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
        <main className="scroll no-tabs" style={{ gap: 12, maxWidth: 480, margin: '0 auto' }}>
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
        <main className="scroll no-tabs" style={{ gap: 16, maxWidth: 480, margin: '0 auto' }}>
          <SubTop onBack={() => setView('home')} title={who === 'buyer' ? 'Login' : 'Store admin'} />
          <div>
            <div className="em-rule" style={{ width: 48 }} />
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
      <main className="em-welcome">
        <section className="em-hero lg" style={{ background: DEEP }}>
          <AntarixsWordmark dark caption="Store" />
          <div>
            <div className="em-ey" style={{ color: '#F3E35A' }}>
              Storefronts for jewellery wholesalers
            </div>
            <h1 className="em-ser" style={{ fontSize: 40, lineHeight: 1.12, marginTop: 10, color: '#f7f3ff', letterSpacing: '-0.5px' }}>
              Your jewellery, on an elegant canvas.
            </h1>
            <p style={{ fontSize: 14, opacity: 0.78, marginTop: 10, lineHeight: 1.55, maxWidth: 340 }}>Upload designs, share one link, let dealers browse and enquire on WhatsApp.</p>
          </div>
        </section>

        <div className="em-pad" style={{ paddingTop: 28 }}>
          <div className="em-rule" style={{ width: 56 }} />
          <h2 className="em-ser" style={{ fontSize: 28, lineHeight: 1.2 }}>
            Choose your experience
          </h2>
          <p className="em-mut" style={{ fontSize: 13, marginTop: 6 }}>
            Open a showroom as a buyer, or step behind the counter.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            <Role pri icon="bag" title="Login" text="Browse the full catalogue, shortlist, and track orders." onClick={() => pick('buyer')} />
            <Role icon="grid" title="Store admin" text="Dashboard, orders desk, add designs, manage buyers." onClick={() => pick('admin')} />
            <a href="/signup" className="em-row" style={{ gap: 12, padding: 16, borderRadius: 20, border: '1px dashed var(--em-gold)', color: 'inherit', textDecoration: 'none', marginTop: 4 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--em-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--em-primary)', flex: 'none' }}>
                <Icon n="plus" size={18} />
              </span>
              <span className="em-grow">
                <b style={{ color: 'var(--em-primary)', fontSize: 14 }}>New merchant? Create your store</b>
                <small className="em-mut" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                  3 steps · WhatsApp verified · QR to share · {TRIAL_DAYS} days free
                </small>
              </span>
              <Icon n="right" size={18} />
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 20 }}>
            <button type="button" className="em-link" onClick={() => setView('plans')}>
              Compare Basic &amp; Pro
            </button>
            <PoweredByAntarixs />
            <LegalLinks platform />
          </div>
        </div>
      </main>
    </Shell>
  );
};
