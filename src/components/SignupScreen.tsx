import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { setAuthToken } from '../api';
import { merchant } from '../merchant';
import { PageTitle, Field, Notice, inputClass, btnPrimary, btnOutline, btnLink } from './ui';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

async function call(path: string, body?: unknown) {
  const res = await fetch(`/api/v1/signup${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json;
}

type Step = 'name' | 'owner' | 'code' | 'done';

/** /signup: create a store in four steps. Uses the core app theme. */
export const SignupScreen: React.FC = () => {
  const [step, setStep] = useState<Step>('name');
  const [f, setF] = useState({ brandName: '', storeName: '', ownerName: '', phone: '', email: '', password: '', code: '', brandColor: '' });
  const [qr, setQr] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ storeUrl: string; sessionToken: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (result) void QRCode.toDataURL(result.storeUrl, { margin: 1, width: 320 }).then(setQr).catch(() => {});
  }, [result]);

  const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <main className="min-h-screen bg-surface max-w-md mx-auto pb-10 pt-6">
      <p className="px-5 font-sans text-sm font-extrabold text-secondary">{merchant.brand.name === 'Bhakti Jewels' ? 'Antarixs' : merchant.brand.name}</p>
      {step === 'name' && (
        <form onSubmit={checkName} className="flex flex-col gap-4 px-5">
          <PageTitle title="Create your store" sub="Free for 14 days. No card needed." />
          <Field label="Business name" htmlFor="brand">
            <input id="brand" className={inputClass} required minLength={2} value={f.brandName} onChange={(e) => setF({ ...f, brandName: e.target.value, storeName: slug(e.target.value) })} />
          </Field>
          <Field label="Store address" htmlFor="sn" hint={`${f.storeName || 'your-name'}.antarixs.com`}>
            <input id="sn" className={inputClass} required value={f.storeName} onChange={(e) => setF({ ...f, storeName: slug(e.target.value) })} />
          </Field>
          <Field label="Brand colour (optional)" htmlFor="bc" hint="Tints your store; you can change it later.">
            <input id="bc" type="color" className="h-12 w-full rounded-xl border border-outline-variant bg-white p-1" value={f.brandColor || '#4a1835'} onChange={set('brandColor')} />
          </Field>
          {err && <Notice tone="error">{err}</Notice>}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" className={btnLink} onClick={() => { setF({ ...f, storeName: s }); setErr(null); }}>{s}</button>
              ))}
            </div>
          )}
          <button className={btnPrimary} disabled={busy}>Continue</button>
        </form>
      )}
      {step === 'owner' && (
        <form onSubmit={sendCode} className="flex flex-col gap-4 px-5">
          <PageTitle title="About you" sub="We verify your phone on WhatsApp." />
          <Field label="Your name" htmlFor="on"><input id="on" className={inputClass} value={f.ownerName} onChange={set('ownerName')} /></Field>
          <Field label="Mobile number (WhatsApp)" htmlFor="ph"><input id="ph" type="tel" className={inputClass} required value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Email" htmlFor="em"><input id="em" type="email" className={inputClass} required value={f.email} onChange={set('email')} /></Field>
          <Field label="Password" htmlFor="pw" hint="At least 10 characters."><input id="pw" type="password" className={inputClass} required minLength={10} value={f.password} onChange={set('password')} /></Field>
          {err && <Notice tone="error">{err}</Notice>}
          <button className={btnPrimary} disabled={busy}>Send code</button>
          <button type="button" className={btnLink} onClick={() => { setErr(null); setStep('name'); }}>Back</button>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={create} className="flex flex-col gap-4 px-5">
          <PageTitle title="Enter the code" sub={`Sent to ${f.phone} on WhatsApp.`} />
          <Field label="6-digit code" htmlFor="cd"><input id="cd" inputMode="numeric" maxLength={6} className={inputClass} required value={f.code} onChange={set('code')} /></Field>
          {err && <Notice tone="error">{err}</Notice>}
          <button className={btnPrimary} disabled={busy}>Create my store</button>
          <button type="button" className={btnLink} onClick={() => { setErr(null); setStep('owner'); }}>Back</button>
        </form>
      )}
      {step === 'done' && result && (
        <div className="flex flex-col gap-4 px-5">
          <PageTitle title="Your store is ready" sub="Your 14-day free trial has started. Share this link with your buyers." />
          <Notice tone="ok"><a href={result.storeUrl} className="underline break-all">{result.storeUrl}</a></Notice>
          {qr && <img src={qr} alt="QR code for your store link" className="h-40 w-40 self-center rounded-2xl bg-white p-2" />}
          <a href={result.storeUrl} className={btnPrimary}>Open admin</a>
          {new URL(result.storeUrl).origin !== window.location.origin && <p className="text-sm text-outline">On your store, sign in once with the email and password you just set (staff sign-in).</p>}
          <button className={btnOutline} onClick={() => void navigator.clipboard?.writeText(result.storeUrl)}>Copy link</button>
        </div>
      )}
    </main>
  );
};
