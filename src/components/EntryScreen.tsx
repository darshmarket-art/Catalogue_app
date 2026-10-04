import React, { useState } from 'react';
import { TRIAL_DAYS } from '../../shared/limits';
import { isValidStoreName } from '../../shared/storeName';
import { I, Notice } from './ui';
import { PlansCompare } from './PlansCompare';

/** Where "Sign in to your store" goes: [store].<platform domain>, or ?store= on localhost. */
export function storeUrl(store: string, loc: Pick<Location, 'protocol' | 'hostname' | 'host'> = window.location): string | null {
  const s = store.trim().toLowerCase().replace(/^https?:\/\//, '').split('.')[0];
  if (!isValidStoreName(s)) return null;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `${loc.protocol}//${loc.host}/?store=${s}`;
  const base = loc.hostname.startsWith('app.') ? loc.hostname.slice(4) : 'antarixs.com';
  return `https://${s}.${base}`;
}

const Top: React.FC<{ onBack?: () => void; right?: React.ReactNode }> = ({ onBack, right }) => (
  <div className="top" style={{ padding: '18px 0 10px', minHeight: 0 }}>
    {onBack ? (
      <button type="button" className="ib" aria-label="Back" onClick={onBack}>
        <I n="back" />
      </button>
    ) : (
      <>
        <div className="mark" style={{ width: 36, height: 36, borderRadius: 11 }}>
          <I n="gem" size="s" />
        </div>
        <span className="serif" style={{ fontSize: 22, color: 'var(--plum)' }}>
          Antarixs
        </span>
      </>
    )}
    <span className="grow" />
    {right}
  </div>
);

/** Antarixs entry page (artboard 1.1), with Basic and Pro (1.2) and store sign-in (1.7) on the platform host. */
export const EntryScreen: React.FC = () => {
  const [view, setView] = useState<'home' | 'plans' | 'signin'>('home');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const u = storeUrl(name);
    if (u) window.location.href = u;
    else setErr('Enter your store address, for example sharma-jewellers.');
  };

  if (view === 'plans') {
    return (
      <main className="scroll no-tabs" style={{ gap: 12, paddingTop: 'var(--sat)', maxWidth: 480 }}>
        <Top onBack={() => setView('home')} right={<h1 style={{ fontSize: 26, flex: 'none' }}>Basic and Pro</h1>} />
        <PlansCompare />
        <a className="btn" href="/signup">
          Start free trial
        </a>
      </main>
    );
  }

  if (view === 'signin') {
    return (
      <main className="scroll no-tabs" style={{ gap: 16, paddingTop: 'var(--sat)', maxWidth: 480 }}>
        <Top onBack={() => setView('home')} />
        <div>
          <h1 style={{ fontSize: 32, lineHeight: 1.05 }}>Sign in to your store</h1>
          <p className="sub" style={{ marginTop: 6 }}>
            Owners and staff sign in with email and password on their store.
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
              <span style={{ color: 'var(--mut)', paddingRight: 15 }}>.antarixs.com</span>
            </div>
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <button type="submit" className="btn">
            Go to my store
          </button>
        </form>
        <div className="note">
          <b>Staff accounts</b> <span className="pro" style={{ marginLeft: 4 }}>Pro</span>
          <br />
          Owners can add staff who help run the catalogue. On Basic, only the owner signs in.
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Buyers do not use this page. They sign in with a WhatsApp code on the store.
        </p>
      </main>
    );
  }

  return (
    <main className="scroll no-tabs" style={{ gap: 16, paddingTop: 'var(--sat)', maxWidth: 480 }}>
      <Top
        right={
          <button type="button" className="lnk" onClick={() => setView('signin')}>
            Sign in
          </button>
        }
      />
      <section className="hero col" style={{ gap: 12, padding: '24px 20px 50px' }}>
        <span className="eyebrow">Free for {TRIAL_DAYS} days · no card</span>
        <h1 style={{ fontSize: 40, lineHeight: 1.02 }}>Your jewellery catalogue, online.</h1>
        <p className="sub" style={{ fontSize: 15.5, maxWidth: 270 }}>
          Upload designs, share one link, and let buyers browse and enquire on WhatsApp. Ready in about two minutes.
        </p>
      </section>
      <div className="card" style={{ padding: '14px 16px', margin: '-46px 14px 0', position: 'relative', zIndex: 2, boxShadow: 'var(--sh-2)' }}>
        <span className="lab">Your store address</span>
        <div className="inp ph-t" style={{ height: 46 }}>
          <span>your-name</span>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>.antarixs.com</span>
        </div>
      </div>
      <a className="btn" href="/signup">
        Create your store
        <I n="chev" />
      </a>
      <button type="button" className="btn alt" onClick={() => setView('signin')}>
        Go to my store
      </button>
      <div className="card" style={{ padding: '2px 16px' }}>
        {[
          { icon: 'image', tone: 'gold', title: 'Photo catalogue', text: 'Collections, weights, purity and availability.' },
          { icon: 'whats', tone: 'ok', title: 'WhatsApp sign-in and enquiries', text: 'Buyers log in with a code on WhatsApp.' },
          { icon: 'qr', tone: '', title: 'One link, one QR', text: 'Share your store with every buyer.' }
        ].map((f, i) => (
          <div key={f.title} className="row" style={{ padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--line-s)' : 0 }}>
            <span className={`tag ${f.tone}`} style={{ width: 36, height: 36, justifyContent: 'center', padding: 0, borderRadius: 11, flex: 'none' }}>
              <I n={f.icon} size="s" />
            </span>
            <div className="grow">
              <b>{f.title}</b>
              <p className="sub" style={{ fontSize: 13.5 }}>
                {f.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="lnk" style={{ alignSelf: 'center' }} onClick={() => setView('plans')}>
        Compare Basic and Pro
      </button>
    </main>
  );
};
