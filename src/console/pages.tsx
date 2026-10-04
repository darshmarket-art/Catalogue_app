import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Bell, Search } from 'lucide-react';
import {
  NOT_CONNECTED, ago, bytes, day, daysLeft, delta, isOnline, layoutName, num, planActions, short, stamp, storeActions, trialDays, useApi,
  type Action, type ApiState, type AuditRow, type FeedItem, type Row, type Summary
} from './api';

export interface PageProps { stores: ApiState<Row[]>; summary: ApiState<Summary>; v: number; ask: (s: Row, a: Action) => void }

/* ---------- small shared pieces ---------- */
const Load = ({ s }: { s: ApiState<unknown> }) =>
  s.error ? <p role="alert" className="cn-note">{s.error}</p> : s.loading && !s.data ? <p className="mut" role="status">Loading…</p> : null;

const Card = ({ eyebrow, title, link, children }: { eyebrow: string; title: string; link?: ReactNode; children: ReactNode }) => (
  <section className="cn-card" aria-label={title}>
    <div className="cn-ch"><div><div className="ey">{eyebrow}</div><h2 className="ser">{title}</h2></div>{link}</div>
    {children}
  </section>
);

const SearchBox = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
  <div className="cn-search">
    <Search size={16} aria-hidden="true" />
    <input className="cn-inp" type="search" placeholder={label} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const PlanTag = ({ s }: { s: Row }) => {
  const t = trialDays(s);
  return s.plan === 'founder' ? <span className="tag plum">Founder</span>
    : s.plan === 'pro' ? <span className="tag info">Pro</span>
    : t ? <span className="tag gold">Pro trial · {t}d</span>
    : <span className="tag">Basic</span>;
};
const StatusTag = ({ s }: { s: Row }) => <span className={s.status === 'active' ? 'tag ok' : 'tag bad'}>{s.status === 'active' ? 'Active' : 'Suspended'}</span>;
const ownerOf = (s: Pick<Row, 'owner'>) => s.owner?.email ?? s.owner?.phone ?? '—';
const storeLink = (s: { id: string; name: string; subdomain?: string }) => (
  <>
    <a className="cn-store" href={`#/stores/${s.id}`}>{s.name}</a>
    {s.subdomain && <small>{s.subdomain}</small>}
  </>
);

/** A count against the plan's cap, with a bar when there is a cap (amber from 90%). */
const Usage = ({ n, cap }: { n: number; cap: number | null }) => (
  <>
    {num(n)}
    {cap !== null && <small>of {num(cap)}</small>}
    {cap !== null && <div className="cn-b" aria-hidden="true"><i style={{ width: `${Math.min(100, (n / cap) * 100)}%`, ...(n / cap >= 0.9 ? { background: 'var(--warn)' } : {}) }} /></div>}
  </>
);
const Seen = ({ at }: { at: string | null }) => (isOnline(at) ? <><i className="dot on" aria-hidden="true" />Online</> : <>{ago(at)}</>);

const NotConnected = ({ note }: { note: string }) => (
  <>
    <div className="ser cn-nc">{NOT_CONNECTED}</div>
    <small>{note}</small>
  </>
);

function StoreTable({ rows, full, empty = 'No stores match.' }: { rows: Row[]; full?: boolean; empty?: string }) {
  const heads = ['Store', 'Owner', 'Plan', ...(full ? ['Layout', 'Status'] : []), 'Buyers', 'Photos', 'Seen'];
  return (
    <div className="cn-tw">
      <table className="cn-t">
        <caption className="sr-only">Stores</caption>
        <thead><tr>{heads.map((h) => <th key={h} scope="col" className={h === 'Buyers' || h === 'Photos' ? 'n' : undefined}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{storeLink(s)}</td>
              <td>{ownerOf(s)}</td>
              <td><PlanTag s={s} />{s.ownApp && <> <span className="tag">Own app</span></>}</td>
              {full && <td>{layoutName(s.layout)}{s.effectiveLayout !== s.layout && <small>showing {layoutName(s.effectiveLayout)}</small>}</td>}
              {full && <td><StatusTag s={s} /></td>}
              <td className="n"><Usage n={s.buyers} cap={s.limits.buyers} /></td>
              <td className="n"><Usage n={s.photos} cap={s.limits.photos} /></td>
              <td><Seen at={s.lastActiveAt} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={heads.length} className="empty">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Feed({ items }: { items: FeedItem[] }) {
  if (!items.length) return <p className="mut">Nothing has happened yet.</p>;
  return (
    <ul className="cn-feed">
      {items.map((i) => (
        <li key={i.id}>
          <i className={`dot ${i.kind}`} aria-hidden="true" />
          <div><b>{i.title}</b><small>{[i.storeName, i.detail].filter(Boolean).join(' · ')}</small></div>
          <time dateTime={i.at} title={stamp(i.at)}>{short(i.at)}</time>
        </li>
      ))}
    </ul>
  );
}

/* ---------- chart: two lines, each on its own scale (orders left, visits right) ---------- */
function Chart({ series }: { series: Summary['series'] }) {
  const W = 560, H = 176, L = 36, R = 36, T = 12, B = 24;
  const maxO = Math.max(1, ...series.map((d) => d.orders));
  const maxV = Math.max(1, ...series.map((d) => d.visits));
  const x = (i: number) => L + (i * (W - L - R)) / (series.length - 1);
  const y = (n: number, max: number) => T + (H - T - B) * (1 - n / max);
  const pts = (f: (d: Summary['series'][number]) => number, max: number) => series.map((d, i) => `${x(i).toFixed(1)},${y(f(d), max).toFixed(1)}`).join(' ');
  const label = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const totalO = series.reduce((t, d) => t + d.orders, 0), totalV = series.reduce((t, d) => t + d.visits, 0);
  const step = (W - L - R) / (series.length - 1);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="cn-chart" role="img" aria-label={`Line chart, last 14 days: ${totalO} orders and ${totalV} visits. Orders use the left scale and visits the right scale.`}>
        <g stroke="#e6ddd0" strokeWidth="1">{[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} />)}</g>
        <g fontSize="10" fontFamily="Inter, sans-serif">
          <g fill="#5c1f3a" textAnchor="end"><text x={L - 6} y={T + 4}>{num(maxO)}</text><text x={L - 6} y={H - B + 4}>0</text></g>
          <g fill="#7a5f1d"><text x={W - R + 6} y={T + 4}>{num(maxV)}</text><text x={W - R + 6} y={H - B + 4}>0</text></g>
          <g fill="#6a625c"><text x={L} y={H - 6}>{label(series[0].day)}</text><text x={x(7)} y={H - 6} textAnchor="middle">{label(series[7].day)}</text><text x={W - R} y={H - 6} textAnchor="end">{label(series[13].day)}</text></g>
        </g>
        <polygon points={`${L},${H - B} ${pts((d) => d.visits, maxV)} ${W - R},${H - B}`} fill="rgba(201,169,97,.2)" />
        <polyline points={pts((d) => d.visits, maxV)} fill="none" stroke="#c9a961" strokeWidth="2.4" strokeLinejoin="round" />
        <polyline points={pts((d) => d.orders, maxO)} fill="none" stroke="#5c1f3a" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx={x(13)} cy={y(series[13].visits, maxV)} r="4" fill="#c9a961" /><circle cx={x(13)} cy={y(series[13].orders, maxO)} r="4" fill="#5c1f3a" />
        {series.map((d, i) => (
          <rect key={d.day} x={x(i) - step / 2} y={T} width={step} height={H - T - B} fill="transparent"><title>{`${label(d.day)}: ${d.orders} orders, ${d.visits} visits`}</title></rect>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Orders and visits per day, last 14 days</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Visits</th></tr></thead>
        <tbody>{series.map((d) => <tr key={d.day}><td>{label(d.day)}</td><td>{d.orders}</td><td>{d.visits}</td></tr>)}</tbody>
      </table>
    </>
  );
}

function PlanMixCard({ s }: { s: Summary }) {
  const mix: Array<[string, number, string]> = [['Basic', s.planMix.basic, '#5c1f3a'], ['Pro trial', s.planMix.proTrial, '#c9a961'], ['Paid Pro', s.planMix.paidPro, '#1d425e'], ['Founder', s.planMix.founder, '#275940']];
  const t = s.trialsEndingSoon;
  return (
    <Card eyebrow="Plan mix" title={`${s.stores.total} ${s.stores.total === 1 ? 'store' : 'stores'}`}>
      <div className="cn-mix">
        <div className="cn-seg" aria-hidden="true">{mix.filter(([, n]) => n > 0).map(([l, n, c]) => <i key={l} style={{ width: `${(n / s.stores.total) * 100}%`, background: c }} />)}</div>
        <ul>{mix.map(([l, n, c]) => <li key={l}><i style={{ background: c }} aria-hidden="true" />{l}<b>{n}</b></li>)}</ul>
        {t.count > 0 ? (
          <div className="cn-warn">
            <Bell size={17} aria-hidden="true" />
            <div>
              <b>{t.count} {t.count === 1 ? 'trial ends' : 'trials end'} within {t.windowDays} days</b>
              <small>{t.stores.slice(0, 3).map((x) => `${x.name} (${x.daysLeft}d)`).join(', ')}{t.count > 3 ? ` and ${t.count - 3} more` : ''}. They move to Basic unless upgraded. <a href="#/plans">Plans and trials</a></small>
            </div>
          </div>
        ) : <small>No trials end in the next {t.windowDays} days.</small>}
      </div>
    </Card>
  );
}

function CloudCards({ s, full }: { s: Summary; full?: boolean }) {
  const c = s.cloud;
  return (
    <div className={`cn-grid ${full ? 'g4' : 'g3'}`}>
      <Card eyebrow="Storage" title={c.storageBytes === null ? 'Photos' : bytes(c.storageBytes)}>{c.storageBytes === null ? <NotConnected note={c.note} /> : <small>Used in the photo bucket</small>}</Card>
      <Card eyebrow="Firestore" title="Reads">{c.firestoreReads === null ? <NotConnected note={c.note} /> : <small>{num(c.firestoreReads)} reads today</small>}</Card>
      <Card eyebrow="Subdomains" title={`${c.subdomainsActive} active`}>
        <div className="cn-b big" aria-hidden="true"><i style={{ width: '100%', background: 'var(--ok)' }} /></div>
        {c.certificates === null ? <small>Certificates: {NOT_CONNECTED}. {c.note}</small> : <small>{c.certificates}</small>}
      </Card>
      {full && <Card eyebrow="Cost" title="This month">{c.costInr === null ? <NotConnected note={c.note} /> : <small>₹{num(c.costInr)}</small>}</Card>}
    </div>
  );
}

/* ---------- pages ---------- */
export function Overview({ stores, summary, v }: PageProps) {
  const feed = useApi<FeedItem[]>('/activity?limit=8', v);
  const s = summary.data;
  const recent = useMemo(
    () => [...(stores.data ?? [])].sort((a, b) => (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '') || b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [stores.data]
  );
  if (!s) return <Load s={summary} />;
  const kpis: Array<[string, string, string, boolean?]> = [
    ['Stores', num(s.stores.total), s.stores.newThisWeek ? `+${s.stores.newThisWeek} this week` : 'None new this week'],
    ['Buyers', num(s.buyers.total), s.buyers.newThisWeek ? `+${s.buyers.newThisWeek} this week` : 'None new this week'],
    ['Orders this week', num(s.orders.week), delta(s.orders.week, s.orders.prevWeek)],
    ['Visits this week', num(s.visits.week), delta(s.visits.week, s.visits.prevWeek)]
  ];
  return (
    <>
      <div className="cn-kpis">
        {kpis.map(([l, n, d]) => <div key={l} className="cn-k"><div className="ey">{l}</div><div className="ser">{n}</div><b className={d.startsWith('+') ? 'up' : undefined}>{d}</b></div>)}
        <div className="cn-k dk"><div className="ey">Online now</div><div className="ser">{num(s.online.visitors)}</div><b>{s.online.visitors ? `across ${s.online.stores} ${s.online.stores === 1 ? 'store' : 'stores'}` : 'Nobody in the last 5 minutes'}</b></div>
      </div>
      <div className="cn-grid">
        <Card eyebrow="Last 14 days" title="Orders and visits" link={<div className="cn-lg"><i style={{ background: '#5c1f3a' }} />Orders<i style={{ background: '#c9a961' }} />Visits</div>}>
          <Chart series={s.series} />
        </Card>
        <PlanMixCard s={s} />
      </div>
      <div className="cn-grid">
        <Card eyebrow="Stores" title="Recently active" link={<a className="cn-link" href="#/stores">View all →</a>}>
          <Load s={stores} />
          <StoreTable rows={recent} />
        </Card>
        <Card eyebrow="Across the cloud" title="Live activity" link={<a className="cn-link" href="#/activity">See all →</a>}>
          <Load s={feed} />
          {feed.data && <Feed items={feed.data} />}
        </Card>
      </div>
      <CloudCards s={s} />
    </>
  );
}

export function StoresPage({ stores }: PageProps) {
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (stores.data ?? [])
    .filter((s) => (!needle || [s.name, s.subdomain, s.owner?.email, s.owner?.phone].some((t) => t?.toLowerCase().includes(needle))) && (!plan || s.plan === plan || s.effectivePlan === plan) && (!status || s.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="cn-bar">
        <SearchBox value={q} onChange={setQ} label="Search store, subdomain or owner" />
        <select className="cn-inp" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan">
          <option value="">All plans</option><option value="basic">Basic</option><option value="pro">Pro</option><option value="founder">Founder</option>
        </select>
        <select className="cn-inp" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>
      <Load s={stores} />
      <div className="cn-card" style={{ padding: 8 }}><StoreTable rows={rows} full /></div>
      <small>Sign-in is through Google (IAP) and limited to the admin list. Every change is confirmed first and recorded in the audit log.</small>
    </>
  );
}

export function StoreDetail({ id, v, ask }: PageProps & { id: string }) {
  const api = useApi<Row>(`/stores/${id}`, v);
  const s = api.data?.id === id ? api.data : null;
  const back = <a className="cn-back" href="#/stores"><ArrowLeft size={16} aria-hidden="true" /> All stores</a>;
  if (!s) return <>{back}<Load s={api} /></>;
  const actions = storeActions(s);
  return (
    <>
      {back}
      <Load s={api} />
      <div className="cn-two">
        <section aria-label="Store detail" className="cn-card">
          <div className="cn-row" style={{ justifyContent: 'space-between' }}><h2 className="ser" style={{ fontSize: 26 }}>{s.name}</h2><StatusTag s={s} /></div>
          <small>{s.subdomain}</small>
          <div style={{ marginTop: 10 }}>
            <div className="cn-kv"><span>Owner</span><b>{s.owner?.email ?? '—'}{s.owner?.phone ? ` · ${s.owner.phone}` : ''}</b></div>
            <div className="cn-kv"><span>Plan</span><b>{s.plan}{s.effectivePlan !== s.plan ? ` (acts as ${s.effectivePlan})` : ''}</b></div>
            <div className="cn-kv"><span>Trial ends</span><b>{s.trialEndsAt ? `${day(s.trialEndsAt)} · ${daysLeft(s.trialEndsAt)}` : '—'}</b></div>
            <div className="cn-kv"><span>Layout</span><b>{layoutName(s.layout)}{s.effectiveLayout !== s.layout ? ` (showing ${layoutName(s.effectiveLayout)})` : ''}</b></div>
            <div className="cn-kv"><span>Buyers</span><b>{num(s.buyers)}{s.limits.buyers !== null ? ` of ${num(s.limits.buyers)}` : ''}</b></div>
            <div className="cn-kv"><span>Photos</span><b>{num(s.photos)}{s.limits.photos !== null ? ` of ${num(s.limits.photos)}` : ''}</b></div>
            <div className="cn-kv"><span>Collections</span><b>{s.categories ?? '—'}</b></div>
            <div className="cn-kv"><span>Own Android app</span><b>{s.ownApp ? 'Yes' : 'No'}</b></div>
            <div className="cn-kv"><span>Last active</span><b>{s.lastActiveAt ? ago(s.lastActiveAt) : 'No visits yet'}</b></div>
            <div className="cn-kv"><span>Created</span><b>{day(s.createdAt)}</b></div>
          </div>
        </section>
        <section aria-label="Actions" className="cn-card cn-stack">
          <h2 className="ser" style={{ fontSize: 20 }}>Change store</h2>
          <div className="cn-row">{actions.map((a) => <button key={a.label} type="button" className="cn-btn sm soft" onClick={() => ask(s, a)}>{a.label}</button>)}</div>
          <small>You confirm each change first, and every change is recorded below. Staff can set any layout whatever the plan.</small>
        </section>
      </div>
      <section aria-label="Recent changes" className="cn-card">
        <h2 className="ser" style={{ fontSize: 20, marginBottom: 6 }}>Recent changes</h2>
        {s.audit?.map((a) => <div key={a.id} className="cn-kv"><span>{a.what} · by {a.who}</span><b>{stamp(a.at)}</b></div>)}
        {!s.audit?.length && <small>None yet.</small>}
      </section>
    </>
  );
}

export function OwnersPage({ v }: PageProps) {
  const api = useApi<Array<{ id: string; name: string; subdomain: string; status: string; owner: Row['owner']; admins: Array<{ name: string | null; email: string | null; phone: string | null; role: string | null }> }>>('/owners', v);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = (api.data ?? []).filter((o) => !needle || JSON.stringify([o.name, o.subdomain, o.owner, o.admins]).toLowerCase().includes(needle));
  return (
    <>
      <div className="cn-bar"><SearchBox value={q} onChange={setQ} label="Search store, owner, email or phone" /></div>
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Store owners and staff</caption>
            <thead><tr>{['Store', 'Status', 'Owner email', 'Owner phone', 'Staff accounts'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>{storeLink(o)}</td>
                  <td><span className={o.status === 'active' ? 'tag ok' : 'tag bad'}>{o.status === 'active' ? 'Active' : 'Suspended'}</span></td>
                  <td>{o.owner?.email ?? '—'}</td>
                  <td>{o.owner?.phone ?? '—'}</td>
                  <td className="wrap">{o.admins.length ? o.admins.map((a, i) => <small key={i} style={{ color: 'var(--fg)' }}>{a.name ?? 'Unnamed'} · {a.role ?? 'staff'}{a.email ? ` · ${a.email}` : ''}{a.phone ? ` · ${a.phone}` : ''}</small>) : '—'}</td>
                </tr>
              ))}
              {api.data && rows.length === 0 && <tr><td colSpan={5} className="empty">No owners match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function BuyersPage({ v }: PageProps) {
  const api = useApi<{ total: number; rows: Array<{ storeId: string; storeName: string; firmName: string; phone: string | null; verified: boolean; lastSeen: string | null; createdAt: string | null }> }>('/buyers', v);
  const [q, setQ] = useState('');
  const [store, setStore] = useState('');
  const needle = q.trim().toLowerCase();
  const all = api.data?.rows ?? [];
  const stores = [...new Map(all.map((b) => [b.storeId, b.storeName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rows = all.filter((b) => (!store || b.storeId === store) && (!needle || b.firmName.toLowerCase().includes(needle) || b.storeName.toLowerCase().includes(needle)));
  return (
    <>
      <div className="cn-bar">
        <SearchBox value={q} onChange={setQ} label="Search firm or store" />
        <select className="cn-inp" value={store} onChange={(e) => setStore(e.target.value)} aria-label="Store">
          <option value="">All stores</option>{stores.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Buyers across all stores</caption>
            <thead><tr>{['Store', 'Firm', 'Phone', 'Verified', 'Last seen'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((b, i) => (
                <tr key={`${b.storeId}-${i}`}>
                  <td>{storeLink({ id: b.storeId, name: b.storeName })}</td>
                  <td>{b.firmName || '—'}</td>
                  <td>{b.phone ?? '—'}</td>
                  <td><span className={b.verified ? 'tag ok' : 'tag'}>{b.verified ? 'Verified' : 'Not verified'}</span></td>
                  <td>{ago(b.lastSeen)}</td>
                </tr>
              ))}
              {api.data && rows.length === 0 && <tr><td colSpan={5} className="empty">No buyers match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {api.data && <small>Showing {rows.length} of {num(api.data.total)} buyers. Phone numbers are masked: staff see the country code and a few digits only, and never a password or address.</small>}
    </>
  );
}

const STATUS_TAG: Record<string, string> = { new: 'warn', confirmed: 'ok', dispatched: 'info', cancelled: 'plum' };

export function OrdersPage({ v }: PageProps) {
  const api = useApi<{ total: number; rows: Array<{ storeId: string; storeName: string; poId: string; status: string; totalNetGrams: number; itemCount: number; timestamp: string }> }>('/orders', v);
  const [status, setStatus] = useState('');
  const rows = (api.data?.rows ?? []).filter((o) => !status || o.status === status);
  return (
    <>
      <div className="cn-bar">
        <select className="cn-inp" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Order status">
          <option value="">Any status</option>{Object.keys(STATUS_TAG).map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Recent purchase orders across all stores</caption>
            <thead><tr><th scope="col">PO</th><th scope="col">Store</th><th scope="col">Status</th><th scope="col" className="n">Net weight</th><th scope="col">Placed</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={`${o.storeId}-${o.poId}`}>
                  <td><b>{o.poId}</b></td>
                  <td>{storeLink({ id: o.storeId, name: o.storeName })}</td>
                  <td><span className={`tag ${STATUS_TAG[o.status] ?? ''}`}>{o.status}</span></td>
                  <td className="n">{o.totalNetGrams.toFixed(3)} g</td>
                  <td>{stamp(o.timestamp)}</td>
                </tr>
              ))}
              {api.data && rows.length === 0 && <tr><td colSpan={5} className="empty">No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <small>The newest orders from every store (up to 50 per store, 200 in all). Buyer names and numbers stay inside each store.</small>
    </>
  );
}

export function PlansPage({ stores, summary, ask }: PageProps) {
  const s = summary.data;
  const rows = [...(stores.data ?? [])].sort((a, b) => {
    const ta = trialDays(a), tb = trialDays(b);
    return ta !== null && tb !== null ? a.trialEndsAt!.localeCompare(b.trialEndsAt!) : ta !== null ? -1 : tb !== null ? 1 : a.name.localeCompare(b.name);
  });
  return (
    <>
      <Load s={summary} />
      {s && <div className="cn-grid"><PlanMixCard s={s} /><Card eyebrow="Trials" title="Ending soon">{s.trialsEndingSoon.count ? <ul className="cn-feed">{s.trialsEndingSoon.stores.map((t) => <li key={t.id}><div><b>{storeLink(t)}</b><small>Ends {day(t.trialEndsAt)}</small></div><time>{t.daysLeft} {t.daysLeft === 1 ? 'day' : 'days'}</time></li>)}</ul> : <p className="mut">No trials end in the next {s.trialsEndingSoon.windowDays} days.</p>}</Card></div>}
      <Load s={stores} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Plans and trials by store, active trials first</caption>
            <thead><tr>{['Store', 'Owner', 'Plan', 'Trial ends', 'Days left', 'Change'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = trialDays(r);
                return (
                  <tr key={r.id}>
                    <td>{storeLink(r)}</td>
                    <td>{ownerOf(r)}</td>
                    <td><PlanTag s={r} /></td>
                    <td>{day(r.trialEndsAt)}</td>
                    <td>{t === null ? (r.trialEndsAt ? 'Ended' : '—') : <span className={t <= 3 ? 'tag warn' : undefined}>{daysLeft(r.trialEndsAt)}</span>}</td>
                    <td>{r.plan === 'founder' ? <small>Fixed</small> : <div className="cn-row">{planActions(r).map((a) => <button key={a.label} type="button" className="cn-btn sm soft" onClick={() => ask(r, a)}>{a.label}</button>)}</div>}</td>
                  </tr>
                );
              })}
              {stores.data && rows.length === 0 && <tr><td colSpan={6} className="empty">No stores yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const KINDS: Record<string, string> = { order: 'Orders', store: 'New stores', trial: 'Trials', console: 'Console changes', owner: 'Owner actions' };

export function ActivityPage({ v }: PageProps) {
  const api = useApi<FeedItem[]>('/activity?limit=100', v);
  const [kind, setKind] = useState('');
  const items = (api.data ?? []).filter((i) => !kind || i.kind === kind);
  return (
    <>
      <div className="cn-bar">
        <select className="cn-inp" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of activity">
          <option value="">Everything</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <Load s={api} />
      <div className="cn-card">{api.data && <Feed items={items} />}</div>
      <small>Orders, new stores, trials, console changes and what owners change in their stores. Buyer sign-ins are left out, and numbers in the text are masked.</small>
    </>
  );
}

export function StoragePage({ stores, summary }: PageProps) {
  const rows = [...(stores.data ?? [])].sort((a, b) => b.photos - a.photos);
  return (
    <>
      <Load s={summary} />
      {summary.data && <CloudCards s={summary.data} full />}
      <Load s={stores} />
      <Card eyebrow="From the catalogue data" title="Photos in use by store">
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Photos in use by store against each plan's cap</caption>
            <thead><tr><th scope="col">Store</th><th scope="col">Plan</th><th scope="col" className="n">Photos</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.id}><td>{storeLink(r)}</td><td><PlanTag s={r} /></td><td className="n"><Usage n={r.photos} cap={r.limits.photos} /></td></tr>)}
              {stores.data && rows.length === 0 && <tr><td colSpan={3} className="empty">No stores yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <small>Counts designs, collections and banners that use a photo. Uploaded files nobody uses are not counted, and bytes used appear once Cloud Monitoring is connected.</small>
      </Card>
    </>
  );
}

export function AuditPage({ v }: PageProps) {
  const api = useApi<AuditRow[]>('/audit', v);
  return (
    <>
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Console changes, newest first</caption>
            <thead><tr>{['When', 'Store', 'Change', 'By'].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {(api.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{stamp(a.at)}</td>
                  <td>{a.storeId ? <a className="cn-store" href={`#/stores/${a.storeId}`}>{a.storeId}</a> : '—'}</td>
                  <td>{a.what}</td>
                  <td>{a.who}</td>
                </tr>
              ))}
              {api.data && api.data.length === 0 && <tr><td colSpan={4} className="empty">No changes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <small>The latest 100 changes made from this console.</small>
    </>
  );
}
