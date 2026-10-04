import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { setAuthToken } from '../api';
import { Field, I, Notice } from './ui';

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

/** /signup: create a store (artboards 1.3 to 1.6). */
export const SignupScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('name');
  const [f, setF] = useState({ brandName: '', storeName: '', ownerName: '', phone: '', email: '', password: '', code: '', brandColor: '' });
  const [qr, setQr] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    const r = await call('', { ...f, brandColor: f.brandColor || undefined });
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
    return (
      <main className="scroll no-tabs" style={{ gap: 16, paddingTop: 'calc(28px + var(--sat))', maxWidth: 480, minHeight: '100dvh' }}>
        <section className="hero col" style={{ gap: 10, padding: '24px 20px 50px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--gold-grad)', color: '#2a1a05', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <I n="check" />
          </div>
          <span className="eyebrow" style={{ marginTop: 6 }}>
            Store created
          </span>
          <h1 style={{ fontSize: 36, lineHeight: 1.04 }}>Your store is ready</h1>
          <p className="sub" style={{ maxWidth: 260 }}>
            Your 14-day free trial has started. Share this link with your buyers.
          </p>
        </section>
        <div className="card row" style={{ margin: '-46px 14px 0', position: 'relative', zIndex: 2, boxShadow: 'var(--sh-2)' }}>
          <I n="link" style={{ color: 'var(--gold)' }} />
          <a href={result.storeUrl} className="grow" style={{ wordBreak: 'break-all', fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
            {result.storeUrl.replace(/^https?:\/\//, '')}
          </a>
          <button
            type="button"
            className="ib"
            aria-label={copied ? 'Copied' : 'Copy link'}
            style={{ width: 40, height: 40 }}
            onClick={() => void navigator.clipboard?.writeText(result.storeUrl).then(() => setCopied(true))}
          >
            <I n={copied ? 'check' : 'copy'} size="s" />
          </button>
        </div>
        {qr && (
          <div className="card row" style={{ gap: 16, padding: 16 }}>
            <img src={qr} alt="QR code for your store link" style={{ width: 104, height: 104, borderRadius: 12, border: '6px solid var(--card)', outline: '1px solid var(--line)', flex: 'none' }} />
            <div className="col" style={{ gap: 6, alignItems: 'flex-start' }}>
              <b>Scan to open</b>
              <p className="sub" style={{ fontSize: 13.5 }}>
                Print it for the counter or send it on WhatsApp.
              </p>
              <a className="lnk" style={{ minHeight: 32 }} href={qr} download="store-qr.png">
                <I n="download" size="s" />
                Save QR
              </a>
            </div>
          </div>
        )}
        <a className="btn wa" href={`https://wa.me/?text=${encodeURIComponent(`${f.brandName}: browse our catalogue at ${result.storeUrl}`)}`} target="_blank" rel="noreferrer">
          <I n="whats" />
          Share on WhatsApp
        </a>
        <button
          type="button"
          className="btn alt"
          onClick={() => {
            // Phones open the share sheet; elsewhere the link is copied.
            if (typeof navigator.share === 'function') void navigator.share({ title: f.brandName, url: result.storeUrl }).catch(() => {});
            else void navigator.clipboard?.writeText(result.storeUrl).then(() => setCopied(true));
          }}
        >
          <I n="link" />
          Share link
        </button>
        <span className="grow" />
        <a className="btn" href={result.storeUrl}>
          Open admin
          <I n="chev" />
        </a>
        <p className="hint" style={{ textAlign: 'center' }}>
          {sameOrigin ? 'You are signed in as the owner on this device.' : 'On your store, sign in once with the email and password you just set.'}
        </p>
      </main>
    );
  }

  return (
    <main className="scroll no-tabs" style={{ gap: 16, paddingTop: 'var(--sat)', maxWidth: 480, minHeight: '100dvh' }}>
      <div className="top" style={{ padding: '18px 0 10px', minHeight: 0 }}>
        <button type="button" className="ib" aria-label="Back" onClick={back}>
          <I n="back" />
        </button>
        <span className="grow" />
        <span className="sub">
          <b>Step {STEP_NO[step]} of 3</b>
        </span>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.round((STEP_NO[step] / 3) * 100)}%` }} />
      </div>

      {step === 'name' && (
        <form onSubmit={checkName} className="col" style={{ gap: 16, flex: 1 }}>
          <div>
            <h1 style={{ fontSize: 32 }}>Create your store</h1>
            <p className="sub" style={{ marginTop: 6 }}>
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
          <div>
            <label className="lab" htmlFor="bc">
              Brand colour (optional)
            </label>
            <div className="row">
              <input id="bc" type="color" value={f.brandColor || '#4a1835'} onChange={set('brandColor')} style={{ width: 52, height: 52, borderRadius: 14, border: '1.5px solid var(--line)', padding: 3, background: 'var(--card)', flex: 'none', cursor: 'pointer' }} />
              <p className="sub">Tints your store. You can change it later.</p>
            </div>
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
            <h1 style={{ fontSize: 32 }}>About you</h1>
            <p className="sub" style={{ marginTop: 6 }}>
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
            <h1 style={{ fontSize: 32 }}>Enter the code</h1>
            <p className="sub" style={{ marginTop: 6 }}>
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
  );
};
