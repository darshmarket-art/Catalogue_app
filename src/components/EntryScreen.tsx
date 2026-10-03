import React, { useState } from 'react';
import { LIMITS, TRIAL_DAYS } from '../../shared/limits';
import { SALES_EMAIL } from '../../shared/sales';
import { isValidStoreName } from '../../shared/storeName';
import { PageTitle, Field, Notice, inputClass, btnPrimary, btnOutline } from './ui';

const n = (v: number | null) => (v === null ? 'Unlimited' : String(v));
const rows: Array<[string, string, string]> = [
  ['Categories', n(LIMITS.basic.categories), n(LIMITS.pro.categories)],
  ['Photos', n(LIMITS.basic.photos), n(LIMITS.pro.photos)],
  ['Photos per design', n(LIMITS.basic.photosPerDesign), n(LIMITS.pro.photosPerDesign)],
  ['Buyers', n(LIMITS.basic.users), n(LIMITS.pro.users)],
  ['Orders, insights, PDF catalogue, staff roles', 'No', 'Yes']
];

/** Where "Sign in to your store" goes: [store].<platform domain>, or ?store= on localhost. */
export function storeUrl(store: string, loc: Pick<Location, 'protocol' | 'hostname' | 'host'> = window.location): string | null {
  const s = store.trim().toLowerCase().replace(/^https?:\/\//, '').split('.')[0];
  if (!isValidStoreName(s)) return null;
  if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') return `${loc.protocol}//${loc.host}/?store=${s}`;
  const base = loc.hostname.startsWith('app.') ? loc.hostname.slice(4) : 'antarixs.com';
  return `https://${s}.${base}`;
}

/** Antarixs entry page, shown on the platform host instead of a store. */
export const EntryScreen: React.FC = () => {
  const [signIn, setSignIn] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const u = storeUrl(name);
    if (u) window.location.href = u;
    else setErr('Enter your store address, for example sharma-jewellers.');
  };
  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col gap-5 px-5 py-10 bg-surface text-on-surface font-sans">
      <h1 className="font-serif text-4xl font-bold text-primary">Antarixs</h1>
      <PageTitle title="Your jewellery catalogue, online" sub="Create a store your buyers can browse and enquire on." />
      <a href="/signup" className={btnPrimary}>Create your store</a>
      {!signIn ? (
        <button type="button" className={btnOutline} onClick={() => setSignIn(true)}>Sign in to your store</button>
      ) : (
        <form onSubmit={go} className="flex flex-col gap-3">
          <Field label="Store address" htmlFor="store" hint="The name before .antarixs.com">
            <input id="store" className={inputClass} autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} />
          </Field>
          {err && <Notice tone="error">{err}</Notice>}
          <button className={btnPrimary}>Go to my store</button>
        </form>
      )}
      <section aria-label="Plans" className="rounded-2xl border border-outline-variant overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container"><tr><th className="text-left p-2" /><th className="p-2">Basic (free)</th><th className="p-2">Pro</th></tr></thead>
          <tbody>{rows.map(([k, b, p]) => <tr key={k} className="border-t border-outline-variant"><td className="p-2">{k}</td><td className="p-2 text-center">{b}</td><td className="p-2 text-center">{p}</td></tr>)}</tbody>
        </table>
        <p className="p-2 text-center font-bold">Pro is free for {TRIAL_DAYS} days. No card needed.</p>
      </section>
      <p className="text-center">Contact sales: <a className="font-bold underline" href={`mailto:${SALES_EMAIL}`}>{SALES_EMAIL}</a></p>
    </main>
  );
};
