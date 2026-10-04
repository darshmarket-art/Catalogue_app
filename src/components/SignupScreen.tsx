import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { setAuthToken } from '../api';
import '../layouts/emergent/emergent.css';
import { Field, I, Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
import { AntarixsMark, AntarixsWordmark, PoweredByAntarixs } from './AntarixsBrand';
import { shareStoreQr } from '../storeQrCard';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

async function call(path: string, body?: unknown) {
  const res = await fetch(`/api/v1/signup${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

type Step = 'name' | 'owner' | 'code' | 'done';
const STEP_NO: Record<Step, number> = { name: 1, owner: 2, code: 3, done: 3 };

/** The six code boxes of artboard 1.5, over one real input (so paste and one-time-code autofill work). */
const CodeBoxes: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative row" style={{ gap: 8 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`inp${focused && i === Math.min(value.length, 5) ? ' on' : ''}`} style={{ flex: 1, justifyContent: 'center', fontSize: 24, fontWeight: 800, padding: 0 }}>
          {value[i] ?? ' '}
        </div>
      ))}
      <input
        id="cd"
        aria-label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="absolute inset-0 w-full h-full opacity-0"
        autoFocus
      />
    </div>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-layout="emergent" className="min-h-screen bg-surface text-on-surface">
    {children}
  </div>
);

/** /signup: create a store (artboards 1.3 to 1.6). */
export const SignupScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('name');
  const [f, setF] = useState({ brandName: '', storeName: '', ownerName: '', phone: '', email: '', password: '', code: '' });
  const [qr, setQr] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [result, setResult] = useState<{ storeUrl: string; sessionToken: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (result) void QRCode.toDataURL(result.storeUrl, { margin: 1, width: 320 }).then(setQr).catch(() => {});
  }, [result]);

  const run = (fn: () => Promise<void>) => async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const checkName = run(async () => {
    const r = await call(`/check?name=${encodeURIComponent(f.storeName)}`);
    setSuggestions(r.suggestions);
    if (!r.available) throw new Error(r.reason);
    setStep('owner');
  });
  const sendCode = run(async () => {
    await call('/request-otp', { phone: f.phone });
    setStep('code');
  });
  const create = run(async () => {
    const r = await call('', f);
    // Same origin (localhost, run.app): the owner is signed in already. On [store].antarixs.com they sign in once.
    if (new URL(r.storeUrl).origin === window.location.origin) setAuthToken(r.sessionToken);
    setResult(r);
    setStep('done');
  });

  const back = () => {
    setErr(null);
    if (step === 'owner') setStep('name');
    else if (step === 'code') setStep('owner');
    else window.location.href = '/';
  };

  if (step === 'done' && result) {
    const sameOrigin = new URL(result.storeUrl).origin === window.location.origin;
    const host = result.storeUrl.replace(/^https?:\/\//, '');
    return (
      <Shell>
        <main className="scroll no-tabs" style={{ gap: 16, maxWidth: 480, margin: '0 auto', minHeight: '100dvh', alignItems: 'center', textAlign: 'center' }}>
          <span style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--em-ok)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
            <Icon n="check" size={26} />
          </span>
          <h1 className="em-ser" style={{ fontSize: 30, lineHeight: 1.2 }}>
            {f.brandName.trim() || 'Your store'} is live
          </h1>
          <p className="em-mut" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Your 14-day free trial has started. Share this QR or link with your buyers. They can browse and enquire instantly.
          </p>
          <div className="em-card" style={{ width: '100%', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <span className="em-ey">Scan to open</span>
            {qr && <img src={qr} alt={`QR code for ${f.brandName}`} style={{ width: 188, height: 188, borderRadius: 12, border: '1px solid var(--em-line)', padding: 10, background: '#fff' }} />}
            <span className="em-ser" style={{ fontSize: 20 }}>
              {f.brandName.trim() || 'Your store'}
            </span>
            <a href={result.storeUrl} style={{ color: 'var(--em-primary)', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>
              {host}
            </a>
            <PoweredByAntarixs />
          </div>
          <button type="button" className="btn wa" style={{ width: '100%' }} disabled={sharing} onClick={() => { setSharing(true); void shareStoreQr(f.brandName.trim() || host, result.storeUrl).finally(() => setSharing(false)); }}>
            <I n="whats" />
            {sharing ? 'Preparing…' : 'Share QR on WhatsApp'}
          </button>
          <button
            type="button"
            className="btn alt"
            style={{ width: '100%' }}
            onClick={() => {
              if (typeof navigator.share === 'function') void navigator.share({ title: f.brandName, url: result.storeUrl }).catch(() => {});
              else void navigator.clipboard?.writeText(result.storeUrl).then(() => setCopied(true));
            }}
          >
            <I n={copied ? 'check' : 'link'} />
            {copied ? 'Link copied' : 'Share link'}
          </button>
          <a className="btn" style={{ width: '100%' }} href={result.storeUrl}>
            Open my store
            <I n="chev" />
          </a>
          <p className="hint">{sameOrigin ? 'You are signed in as the owner on this device.' : 'On your store, sign in once with the email and password you just set.'}</p>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
    <main className="scroll no-tabs" style={{ gap: 16, maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>
      <div className="em-row em-sb" style={{ padding: '18px 0 10px' }}>
        <button type="button" className="ib" aria-label="Back" onClick={back}>
          <I n="back" />
        </button>
        <AntarixsWordmark />
        <span className="em-ey">Step {STEP_NO[step]} of 3</span>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.round((STEP_NO[step] / 3) * 100)}%` }} />
      </div>

      {step === 'name' && (
        <form onSubmit={checkName} className="col" style={{ gap: 16, flex: 1 }}>
          <div>
            <h1 className="em-ser" style={{ fontSize: 32 }}>Create your store</h1>
            <p className="em-mut" style={{ marginTop: 6, fontSize: 14 }}>
              Free for 14 days. No card needed.
            </p>
          </div>
          <Field label="Business name" htmlFor="brand">
            <input id="brand" className="inp" required minLength={2} value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value, storeName: slug(e.target.value) })} placeholder="e.g. Mahalakshmi Jewellers" />
          </Field>
          <div>
            <label className="lab" htmlFor="sn">
              Store address
            </label>
            <div className="inp" style={{ padding: 0 }}>
              <input
                id="sn"
                required
                value={f.storeName}
                onChange={(e) => setF({ ...f, storeName: slug(e.target.value) })}
                placeholder="your-name"
                style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 0, background: 'transparent', padding: '0 0 0 15px', font: 'inherit', color: 'inherit' }}
              />
              <span style={{ color: 'var(--mut)', paddingRight: 15 }}>.antarixs.com</span>
            </div>
            {suggestions.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setF({ ...f, storeName: s });
                      setErr(null);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'owner' && (
        <form onSubmit={sendCode} className="col" style={{ gap: 14, flex: 1 }}>
          <div>
            <h1 className="em-ser" style={{ fontSize: 32 }}>About you</h1>
            <p className="em-mut" style={{ marginTop: 6, fontSize: 14 }}>
              We verify your phone on WhatsApp.
            </p>
          </div>
          <Field label="Your name" htmlFor="on">
            <input id="on" className="inp" value={f.ownerName} onChange={set('ownerName')} autoComplete="name" />
          </Field>
          <Field label="Mobile number (WhatsApp)" htmlFor="ph">
            <input id="ph" type="tel" className="inp" required value={f.phone} onChange={set('phone')} autoComplete="tel" />
          </Field>
          <Field label="Email" htmlFor="em">
            <input id="em" type="email" className="inp" required value={f.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="pw" hint="At least 10 characters. You use it to sign in as the owner.">
            <input id="pw" type="password" className="inp" required minLength={10} value={f.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          {err && <Notice tone="error">{err}</Notice>}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy}>
            <I n="whats" />
            {busy ? 'Sending…' : 'Send code on WhatsApp'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={create} className="col" style={{ gap: 16, flex: 1 }}>
          <div>
            <h1 className="em-ser" style={{ fontSize: 32 }}>Enter the code</h1>
            <p className="em-mut" style={{ marginTop: 6, fontSize: 14 }}>
              Sent to {f.phone} on WhatsApp.
            </p>
          </div>
          <CodeBoxes value={f.code} onChange={(code) => setF({ ...f, code })} />
          <div className="row">
            <I n="clock" size="s" style={{ color: 'var(--mut)' }} />
            <p className="sub grow">Code expires in 5 minutes.</p>
            <button type="button" className="lnk" style={{ minHeight: 36 }} disabled={busy} onClick={() => sendCode()}>
              Resend
            </button>
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <span className="grow" />
          <button type="submit" className="btn" disabled={busy || f.code.length !== 6}>
            {busy ? 'Creating…' : 'Create my store'}
          </button>
          <p className="hint" style={{ textAlign: 'center' }}>
            Your 14-day Pro trial starts now.
          </p>
        </form>
      )}
    </main>
    </Shell>
  );
};
