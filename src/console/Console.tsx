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
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const daysLeft = (s: string | null) => {
  if (!s) return '—';
  const d = Math.ceil((Date.parse(s) - Date.now()) / 86400000);
  return d > 0 ? `${d} ${d === 1 ? 'day' : 'days'}` : 'Ended';
};

const PlanTag = ({ s }: { s: Row }) =>
  s.plan === 'basic' ? <span className="tag mut">Basic</span> : <span className={s.plan === 'pro' && !s.trialEndsAt ? 'pro dark' : 'pro'}>{s.plan === 'founder' ? 'Founder' : s.trialEndsAt && s.effectivePlan === 'pro' && s.plan !== 'pro' ? 'Pro trial' : s.plan}</span>;
const StatusTag = ({ s }: { s: Row }) => <span className={s.status === 'active' ? 'tag ok' : 'tag bad'}>{s.status === 'active' ? 'Active' : 'Suspended'}</span>;

/** Antarixs console (artboard 5.2 the store list, 5.3 one store). */
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

  const stats: Array<[string, number]> = [
    ['Stores', rows.length],
    ['On a Pro trial', rows.filter((r) => r.trialEndsAt && r.plan !== 'pro' && Date.parse(r.trialEndsAt) > Date.now()).length],
    ['Paid Pro', rows.filter((r) => r.plan === 'pro').length],
    ['Suspended', rows.filter((r) => r.status !== 'active').length]
  ];

  return (
    <div className="console" style={{ minHeight: '100vh' }}>
      <header className="console-bar">
        <i aria-hidden="true" className="i l i-gem" />
        <span className="serif" style={{ fontSize: 22 }}>Antarixs console</span>
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {error && <p role="alert" className="note bad">{error}</p>}

        {open ? (
          <>
            <button type="button" className="lnk" style={{ alignSelf: 'flex-start', textDecoration: 'none' }} onClick={() => { setOpen(null); setPending(null); }}>
              <i aria-hidden="true" className="i s i-back" /> All stores
            </button>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <section aria-label="Store detail" className="card col" style={{ flex: '1 1 420px', gap: 12, padding: 20 }}>
                <div className="row"><h1 style={{ fontSize: 28 }} className="grow">{open.name}</h1><StatusTag s={open} /></div>
                <p className="sub">{open.subdomain}</p>
                <hr className="sep" />
                <div className="kv"><span>Owner</span><b>{open.owner?.email ?? open.owner?.phone ?? '—'}</b></div>
                <div className="kv"><span>Plan</span><b>{open.plan}{open.effectivePlan !== open.plan ? ` (acts as ${open.effectivePlan})` : ''}</b></div>
                <div className="kv"><span>Trial ends</span><b>{open.trialEndsAt ? `${day(open.trialEndsAt)} · ${daysLeft(open.trialEndsAt)}` : '—'}</b></div>
                <div className="kv"><span>Buyers</span><b>{open.buyers}</b></div>
                <div className="kv"><span>Photos</span><b>{open.photos}</b></div>
                <div className="kv"><span>Collections</span><b>{open.categories ?? '—'}</b></div>
                <div className="kv"><span>Own Android app</span><b>{open.ownApp ? 'Yes' : 'No'}</b></div>
                <div className="kv"><span>Created</span><b>{day(open.createdAt)}</b></div>
              </section>
              <section aria-label="Actions" className="card col" style={{ flex: '1 1 320px', gap: 12, padding: 20 }}>
                <h2 style={{ fontSize: 20 }}>Change store</h2>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {actions(open).map((a) => (
                    <button key={a.label} type="button" className={`btn sm ${pending?.label === a.label ? '' : 'soft'}`} onClick={() => setPending(a)}>{a.label}</button>
                  ))}
                </div>
                {pending ? (
                  <div role="alertdialog" className="note col" style={{ gap: 10 }}>
                    <p><b>{pending.label}</b> for {open.name}? {pending.warn}</p>
                    <div className="row">
                      <button type="button" className="btn sm" onClick={() => void run()}>Confirm</button>
                      <button type="button" className="btn sm alt" onClick={() => setPending(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="hint" style={{ margin: 0 }}>Every change is recorded below.</p>
                )}
              </section>
            </div>
            <section className="card col" style={{ gap: 8, padding: 20 }}>
              <h2 style={{ fontSize: 20 }}>Recent changes</h2>
              {open.audit?.map((a) => (
                <div key={a.id} className="kv"><span>{a.what} · by {a.who}</span><b>{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b></div>
              ))}
              {!open.audit?.length && <div className="sub" style={{ fontSize: 13 }}>None yet.</div>}
            </section>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {stats.map(([label, value]) => (
                <div key={label} className="card" style={{ flex: '1 1 160px' }}>
                  <span className="stat" style={{ fontSize: 30 }}>{value}</span>
                  <span className="sub" style={{ display: 'block', fontSize: 13 }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="inp-icon" style={{ flex: '1 1 280px' }}>
                <i aria-hidden="true" className="i i-search" />
                <input className="inp" placeholder="Search name or subdomain" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              </div>
              <select className="inp" style={{ flex: '0 0 170px' }} value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
                <option value="">All plans</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="founder">Founder</option>
              </select>
              <select className="inp" style={{ flex: '0 0 170px' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
                <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="t" style={{ minWidth: 860 }}>
                <thead>
                  <tr>{['Store', 'Plan', 'Status', 'Trial ends', 'Buyers', 'Photos', 'App'].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => void show(s.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <button type="button" onClick={(e) => { e.stopPropagation(); void show(s.id); }} style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
                          <b>{s.name}</b><br /><span className="sub" style={{ fontSize: 13 }}>{s.subdomain}</span>
                        </button>
                      </td>
                      <td><PlanTag s={s} /></td>
                      <td><StatusTag s={s} /></td>
                      <td>{daysLeft(s.trialEndsAt)}</td>
                      <td>{s.buyers}</td>
                      <td>{s.photos.toLocaleString('en-IN')}</td>
                      <td>{s.ownApp ? <span className="tag">Own app</span> : '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={7} className="sub" style={{ textAlign: 'center', padding: 24 }}>No stores match.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ margin: 0 }}>Sign-in is through Google (IAP) and limited to the admin list.</p>
          </>
        )}
      </main>
    </div>
  );
}
