import { useCallback, useEffect, useState } from 'react';

interface Row {
  id: string; name: string; subdomain: string; plan: string; effectivePlan: string; trialEndsAt: string | null;
  status: string; ownApp: boolean; createdAt: string; buyers: number; photos: number; categories?: number;
  owner?: { email?: string; phone?: string } | null;
  audit?: { id: string; at: string; who: string; what: string }[];
}
interface Action { label: string; path: string; body: object; warn: string }

const API = '/api/v1/console';
const call = async (path: string, body?: object) => {
  const res = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message ?? `Request failed (${res.status})`);
  return j.data;
};
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '-');

export default function Console() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<Row | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setRows(await call(`/stores?${new URLSearchParams({ q, plan, status })}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, plan, status]);
  useEffect(() => { void load(); }, [load]);

  const show = async (id: string) => {
    try { setOpen(await call(`/stores/${id}`)); } catch (e) { setError((e as Error).message); }
  };
  const run = async () => {
    if (!open || !pending) return;
    try {
      await call(`/stores/${open.id}${pending.path}`, pending.body);
      setPending(null);
      await Promise.all([show(open.id), load()]);
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  };

  const actions = (s: Row): Action[] => [
    { label: 'Set Basic', path: '/plan', body: { plan: 'basic' }, warn: 'Pro features lock after any trial ends.' },
    { label: 'Set Pro', path: '/plan', body: { plan: 'pro' }, warn: 'The store gets all Pro features.' },
    { label: 'Extend trial 14 days', path: '/trial', body: { days: 14 }, warn: 'Adds 14 days of Pro.' },
    s.status === 'active'
      ? { label: 'Suspend', path: '/suspend', body: {}, warn: 'The store and its app stop working for everyone.' }
      : { label: 'Unsuspend', path: '/unsuspend', body: {}, warn: 'The store comes back online.' },
    { label: s.ownApp ? 'Unmark own app' : 'Mark own app', path: '/own-app', body: { ownApp: !s.ownApp }, warn: 'Own-app stores get Pro features.' }
  ];

  const field = 'rounded-lg border border-surface-dim bg-surface-container-lowest px-3 py-2 text-sm';
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="font-serif text-3xl text-primary">Antarixs console</h1>
      <div className="my-4 flex flex-wrap gap-2">
        <input className={field} placeholder="Search name or subdomain" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className={field} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
          <option value="">All plans</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="founder">Founder</option>
        </select>
        <select className={field} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-primary-fixed p-3 text-sm text-primary">{error}</p>}
      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-low text-xs uppercase text-primary">
            <tr>{['Store', 'Plan', 'Trial ends', 'Status', 'Buyers', 'Photos', 'Created'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} onClick={() => void show(s.id)} className="cursor-pointer border-t border-surface-dim hover:bg-surface-container-low">
                <td className="p-3"><b>{s.name}</b><div className="text-xs opacity-70">{s.subdomain}</div></td>
                <td className="p-3">{s.plan}{s.effectivePlan !== s.plan && <span className="opacity-70"> (acts as {s.effectivePlan})</span>}</td>
                <td className="p-3">{day(s.trialEndsAt)}</td>
                <td className="p-3">{s.status}</td>
                <td className="p-3">{s.buyers}</td>
                <td className="p-3">{s.photos}</td>
                <td className="p-3">{day(s.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center opacity-70">No stores match.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <aside className="fixed inset-y-0 right-0 z-10 w-full max-w-md overflow-y-auto bg-surface-container-lowest p-5 shadow-2xl" aria-label="Store detail">
          <button className="float-right text-sm text-primary" onClick={() => { setOpen(null); setPending(null); }}>Close</button>
          <h2 className="font-serif text-2xl text-primary">{open.name}</h2>
          <p className="text-sm opacity-70">{open.subdomain} - {open.status}</p>
          <dl className="my-4 grid grid-cols-2 gap-2 text-sm">
            <dt>Plan</dt><dd>{open.plan} (acts as {open.effectivePlan})</dd>
            <dt>Trial ends</dt><dd>{day(open.trialEndsAt)}</dd>
            <dt>Own app</dt><dd>{open.ownApp ? 'Yes' : 'No'}</dd>
            <dt>Buyers / photos / categories</dt><dd>{open.buyers} / {open.photos} / {open.categories}</dd>
            <dt>Owner</dt><dd>{open.owner?.email ?? open.owner?.phone ?? '-'}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            {actions(open).map((a) => <button key={a.label} className="rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container" onClick={() => setPending(a)}>{a.label}</button>)}
          </div>
          {pending && (
            <div role="alertdialog" className="mt-4 rounded-lg border border-primary p-3 text-sm">
              <p><b>{pending.label}</b> for {open.name}? {pending.warn}</p>
              <button className="mr-2 mt-2 rounded-lg bg-primary px-3 py-2 text-on-primary" onClick={() => void run()}>Confirm</button>
              <button className="mt-2 rounded-lg px-3 py-2" onClick={() => setPending(null)}>Cancel</button>
            </div>
          )}
          <h3 className="mb-1 mt-6 font-bold">Recent changes</h3>
          <ul className="space-y-1 text-xs">
            {open.audit?.map((a) => <li key={a.id}>{new Date(a.at).toLocaleString()} - {a.who}: {a.what}</li>)}
            {!open.audit?.length && <li className="opacity-70">None yet.</li>}
          </ul>
        </aside>
      )}
    </main>
  );
}
