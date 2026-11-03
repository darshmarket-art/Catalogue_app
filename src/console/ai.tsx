import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { STYLE_IDS, STYLE_INFO, type StyleId } from '../../shared/aiStyles';
import { NOT_CONNECTED, ago, call, num, stamp, useApi } from './api';

/* ---------- types (what server/routes/consoleAi.ts returns) ---------- */
interface Win { calls: number; ok: number; failed: number; blocked: number; successRate: number | null }
interface Overview {
  generatedAt: string; timezone: string; enabled: boolean; killSwitch: boolean; model: string;
  windows: { today: Win; week: Win; month: Win };
  credits: { sold: number; granted: number; spent: number; refunded: number };
  money: { revenue: number; costInr: number; margin: number; estimated: boolean };
  daily: Array<{ day: string; ok: number; failed: number; blocked: number; spend: number; costInr: number }>;
  byStyle: Array<{ style: string; calls: number; spend: number }>;
  topStores: Array<{ storeId: string; name: string; calls: number; spend: number }>;
  billing: { connected: boolean; note: string };
}
interface StoreAi {
  id: string; name: string; subdomain: string; balance: number; aiFree: boolean; aiEnabled: boolean; monthlyCap: number | null; priceOverride: Record<string, number>;
  engaged: boolean; rendersMonth: number; spendMonth: number; lastUsedAt: number | null; lastTopupAt: number | null; status: 'ok' | 'low' | 'zero' | 'free' | 'off'; blockedWeek: number;
}
interface UsageRow { id: string; ts: number; storeId: string; store: string; style: string; model: string; outcome: string; costUsd: number; price: number; balanceAfter: number; kept: boolean | null }
interface Cfg { config: { prices: Record<string, number>; modelCostUsd: Record<string, number>; usdInr: number; lowBalance: number; killSwitch: boolean; updatedAt?: string; updatedBy?: string }; model: string; serverEnabled: boolean; maxCredits: number }

const isAlert = (s: StoreAi) => (s.engaged && (s.status === 'low' || s.status === 'zero')) || s.blockedWeek > 0;
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;
const rs2 = (n: number) => `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);
const styleName = (s: string) => STYLE_INFO[s as StyleId]?.name ?? s;
const OUTCOME: Record<string, [string, string]> = {
  ok: ['Done', 'tag ok'], provider_failed: ['Failed, refunded', 'tag bad'], pending: ['In progress', 'tag'], blocked_credits: ['No credits', 'tag warn'], blocked_cap: ['Monthly cap', 'tag warn'], blocked_disabled: ['AI off', 'tag']
};
const STATUS: Record<StoreAi['status'], [string, string]> = { ok: ['Active', 'tag ok'], low: ['Low balance', 'tag warn'], zero: ['No credits', 'tag bad'], free: ['Free (exempt)', 'tag plum'], off: ['AI off', 'tag'] };
const PLUM = '#5c1f3a', GOLD = '#c9a961';
const dlabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const Box = ({ eyebrow, title, link, children }: { eyebrow: string; title: string; link?: ReactNode; children: ReactNode }) => (
  <section className="cn-card" aria-label={title}>
    <div className="cn-ch"><div><div className="ey">{eyebrow}</div><h2 className="ser">{title}</h2></div>{link}</div>
    {children}
  </section>
);
const Load = ({ s }: { s: { error: string; loading: boolean; data: unknown } }) =>
  s.error ? <p role="alert" className="cn-note">{s.error}</p> : s.loading && !s.data ? <p className="mut" role="status">Loading…</p> : null;

/* ---------- charts (SVG; each has a text table for screen readers) ---------- */
function DailyCalls({ daily }: { daily: Overview['daily'] }) {
  const W = 560, H = 176, L = 30, R = 8, T = 10, B = 24;
  const max = Math.max(1, ...daily.map((d) => d.ok + d.failed));
  const step = (W - L - R) / daily.length, bw = Math.max(3, step - 4);
  const y = (n: number) => T + (H - T - B) * (1 - n / max);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="cn-chart" role="img" aria-label={`Stacked bars, daily render calls, last 30 days: ${daily.reduce((t, d) => t + d.ok, 0)} done and ${daily.reduce((t, d) => t + d.failed, 0)} failed.`}>
        <g stroke="#e6ddd0">{[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} />)}</g>
        <g fontSize="12" fill="#6a625c" fontFamily="Inter, sans-serif"><text x={L - 5} y={T + 4} textAnchor="end">{max}</text><text x={L - 5} y={H - B + 4} textAnchor="end">0</text>
          <text x={L} y={H - 6}>{dlabel(daily[0].day)}</text><text x={W - R} y={H - 6} textAnchor="end">{dlabel(daily[daily.length - 1].day)}</text></g>
        {daily.map((d, i) => {
          const x = L + i * step + (step - bw) / 2;
          return (
            <g key={d.day}>
              {d.ok > 0 && <rect x={x} y={y(d.ok)} width={bw} height={y(0) - y(d.ok)} fill={PLUM} rx="2" />}
              {d.failed > 0 && <rect x={x} y={y(d.ok + d.failed)} width={bw} height={y(d.ok) - y(d.ok + d.failed) - (d.ok ? 2 : 0)} fill={GOLD} rx="2" />}
              <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent"><title>{`${dlabel(d.day)}: ${d.ok} done, ${d.failed} failed, ${d.blocked} blocked`}</title></rect>
            </g>
          );
        })}
      </svg>
      <div className="sr-only"><table><caption>Render calls per day</caption><thead><tr><th scope="col">Day</th><th scope="col">Done</th><th scope="col">Failed</th><th scope="col">Blocked</th></tr></thead>
        <tbody>{daily.map((d) => <tr key={d.day}><td>{dlabel(d.day)}</td><td>{d.ok}</td><td>{d.failed}</td><td>{d.blocked}</td></tr>)}</tbody></table></div>
    </>
  );
}

/** Credits spent (Rs 1 each) and estimated provider cost, both in rupees on ONE axis. */
function DailyMoney({ daily }: { daily: Overview['daily'] }) {
  const W = 560, H = 176, L = 44, R = 12, T = 10, B = 24;
  const max = Math.max(1, ...daily.map((d) => Math.max(d.spend, d.costInr)));
  const x = (i: number) => L + (i * (W - L - R)) / (daily.length - 1);
  const y = (n: number) => T + (H - T - B) * (1 - n / max);
  const line = (f: (d: Overview['daily'][number]) => number) => daily.map((d, i) => `${x(i).toFixed(1)},${y(f(d)).toFixed(1)}`).join(' ');
  const last = daily.length - 1;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="cn-chart" role="img" aria-label="Line chart, last 30 days: revenue in credits and estimated provider cost, both in rupees.">
        <g stroke="#e6ddd0">{[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} />)}</g>
        <g fontSize="14" fill="#6a625c" fontFamily="Inter, sans-serif"><text x={L - 5} y={T + 4} textAnchor="end">{rs(max)}</text><text x={L - 5} y={H - B + 4} textAnchor="end">0</text>
          <text x={L} y={H - 6}>{dlabel(daily[0].day)}</text><text x={W - R} y={H - 6} textAnchor="end">{dlabel(daily[last].day)}</text></g>
        <polyline points={line((d) => d.costInr)} fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinejoin="round" />
        <polyline points={line((d) => d.spend)} fill="none" stroke={PLUM} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx={x(last)} cy={y(daily[last].costInr)} r="4" fill={GOLD} stroke="#fff" strokeWidth="2" /><circle cx={x(last)} cy={y(daily[last].spend)} r="4" fill={PLUM} stroke="#fff" strokeWidth="2" />
        {daily.map((d, i) => <rect key={d.day} x={x(i) - (W - L - R) / daily.length / 2} y={T} width={(W - L - R) / daily.length} height={H - T - B} fill="transparent"><title>{`${dlabel(d.day)}: revenue ${rs(d.spend)}, est. cost ${rs2(d.costInr)}`}</title></rect>)}
      </svg>
      <div className="sr-only"><table><caption>Revenue and estimated cost per day</caption><thead><tr><th scope="col">Day</th><th scope="col">Revenue</th><th scope="col">Estimated cost</th></tr></thead>
        <tbody>{daily.map((d) => <tr key={d.day}><td>{dlabel(d.day)}</td><td>{d.spend}</td><td>{d.costInr}</td></tr>)}</tbody></table></div>
    </>
  );
}

/** Horizontal bars: one hue, value printed at the end of each bar. */
function HBars({ rows, unit, label }: { rows: Array<{ k: string; name: string; v: number; sub?: string }>; unit: string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  const RH = 28, W = 560, L = 150, R = 56;
  return (
    <svg viewBox={`0 0 ${W} ${rows.length * RH + 4}`} className="cn-chart" role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${r.v}`).join(', ')}`}>
      {rows.map((r, i) => (
        <g key={r.k} fontSize="12" fontFamily="Inter, sans-serif">
          <text x={L - 8} y={i * RH + 18} textAnchor="end" fill="#1a1a1a">{r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name}</text>
          <rect x={L} y={i * RH + 6} width={Math.max(3, ((W - L - R) * r.v) / max)} height="16" rx="4" fill={PLUM}><title>{`${r.name}: ${r.v} ${unit}${r.sub ? `, ${r.sub}` : ''}`}</title></rect>
          <text x={L + Math.max(3, ((W - L - R) * r.v) / max) + 6} y={i * RH + 18} fill="#6a625c">{num(r.v)}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- action dialog (amount + note), a native <dialog> like the console's confirm ---------- */
type Act = { kind: 'topup' | 'adjust' | 'refund' | 'settings'; store: StoreAi };
function ActionDialog({ act, onClose, onDone }: { act: Act | null; onClose: () => void; onDone: (msg: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState({ amount: '', note: '', free: false, renderId: '', aiFree: false, aiEnabled: true, cap: '', price: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (act && !d.open) {
      setErr('');
      setF({ amount: '', note: '', free: false, renderId: '', aiFree: act.store.aiFree, aiEnabled: act.store.aiEnabled, cap: act.store.monthlyCap === null ? '' : String(act.store.monthlyCap), price: act.store.priceOverride.all !== undefined ? String(act.store.priceOverride.all) : '' });
      d.showModal();
    }
    if (!act && d.open) d.close();
  }, [act]);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!act) return;
    setBusy(true);
    setErr('');
    try {
      const base = `/ai/stores/${act.store.id}`;
      const amount = Number(f.amount);
      if (act.kind === 'settings') {
        const price = f.price.trim();
        const priceOverride = price === '' ? {} : { all: Number(price) };
        await call(`${base}/settings`, { aiFree: f.aiFree, aiEnabled: f.aiEnabled, monthlyCap: f.cap.trim() === '' ? null : Number(f.cap), priceOverride });
        onDone(`Settings saved for ${act.store.name}.`);
      } else {
        const body = act.kind === 'topup' ? { amount, note: f.note, free: f.free } : act.kind === 'refund' ? { amount, note: f.note, ...(f.renderId.trim() ? { renderId: f.renderId.trim() } : {}) } : { amount, note: f.note };
        const r = await call<{ balance: number }>(`${base}/${act.kind}`, body);
        onDone(`${act.kind === 'topup' ? 'Top-up' : act.kind === 'refund' ? 'Refund' : 'Adjustment'} done for ${act.store.name}. New balance ${rs(r.balance)}.`);
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const title = !act ? '' : { topup: 'Top up credits', adjust: 'Adjust balance', refund: 'Refund credits', settings: 'AI settings' }[act.kind];
  return (
    <dialog ref={ref} className="cn-dlg" aria-labelledby="ai-dlg-t" onClose={onClose} onCancel={(e) => busy && e.preventDefault()}>
      {act && (
        <form className="cn-stack" onSubmit={(e) => void submit(e)}>
          <h2 id="ai-dlg-t" className="ser">{title}</h2>
          <p>For <b>{act.store.name}</b>{act.kind !== 'settings' && <> · balance {rs(act.store.balance)}</>}. Recorded in the audit log.</p>
          {act.kind !== 'settings' ? (
            <>
              <label className="cn-fld">Amount in credits (Rs 1 each){act.kind === 'adjust' && ' - negative to remove'}
                <input className="cn-inp" type="number" step="1" required inputMode="numeric" min={act.kind === 'adjust' ? -100000 : 1} max={100000} value={f.amount} onChange={(e) => set('amount', e.target.value)} data-testid="ai-amount" />
              </label>
              <label className="cn-fld">Note (payment reference, reason)
                <input className="cn-inp" required maxLength={200} value={f.note} onChange={(e) => set('note', e.target.value)} data-testid="ai-note" />
              </label>
              {act.kind === 'topup' && <label className="cn-chk"><input type="checkbox" checked={f.free} onChange={(e) => set('free', e.target.checked)} /> Free grant (not counted as sold)</label>}
              {act.kind === 'refund' && <label className="cn-fld">Render id (optional, caps the refund at what it charged)<input className="cn-inp" value={f.renderId} onChange={(e) => set('renderId', e.target.value)} /></label>}
            </>
          ) : (
            <>
              <label className="cn-chk"><input type="checkbox" checked={f.aiEnabled} onChange={(e) => set('aiEnabled', e.target.checked)} /> AI render on for this store</label>
              <label className="cn-chk"><input type="checkbox" checked={f.aiFree} onChange={(e) => set('aiFree', e.target.checked)} /> Exempt from charges (cost still logged)</label>
              <label className="cn-fld">Price override for every style, credits (blank = use the price table)
                <input className="cn-inp" type="number" min={0} max={100000} step="1" value={f.price} onChange={(e) => set('price', e.target.value)} />
              </label>
              <label className="cn-fld">Monthly render cap (blank = platform default)
                <input className="cn-inp" type="number" min={0} max={100000} step="1" value={f.cap} onChange={(e) => set('cap', e.target.value)} />
              </label>
            </>
          )}
          {err && <p role="alert" className="cn-note">{err}</p>}
          <div className="cn-row">
            <button type="submit" className="cn-btn" disabled={busy}>{busy ? 'Working…' : 'Confirm'}</button>
            <button type="button" className="cn-btn ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/* ---------- sections ---------- */
function OverviewTab({ v }: { v: number }) {
  const api = useApi<Overview>('/ai/overview', v);
  const o = api.data;
  if (!o) return <Load s={api} />;
  const none = o.windows.month.calls + o.windows.month.blocked === 0;
  const k = (label: string, w: Win) => (
    <div className="cn-k"><div className="ey">{label}</div><div className="ser">{num(w.calls)}</div><b>{w.calls ? `${pct(w.successRate)} succeeded · ${w.failed} failed` : w.blocked ? `${w.blocked} blocked` : 'No renders'}</b></div>
  );
  return (
    <>
      {(o.killSwitch || !o.enabled) && <p className="cn-note" role="status">{!o.enabled ? 'AI render is switched off on the server (AI_RENDER_ENABLED).' : 'The AI kill switch is on: no store can start a render.'}</p>}
      <div className="cn-kpis">
        {k('Render calls today', o.windows.today)}{k('Last 7 days', o.windows.week)}{k('Last 30 days', o.windows.month)}
        <div className="cn-k dk"><div className="ey">Margin, 30 days</div><div className="ser">{rs(o.money.margin)}</div><b>{rs(o.money.revenue)} revenue − {rs(o.money.costInr)} est. cost</b></div>
      </div>
      <div className="cn-kpis">
        <div className="cn-k"><div className="ey">Credits sold</div><div className="ser">{num(o.credits.sold)}</div><b>{o.credits.granted ? `+ ${num(o.credits.granted)} granted free` : 'None granted free'}</b></div>
        <div className="cn-k"><div className="ey">Credits spent</div><div className="ser">{num(o.credits.spent)}</div><b>{num(o.credits.refunded)} refunded</b></div>
        <div className="cn-k"><div className="ey">Provider cost</div><div className="ser">{rs(o.money.costInr)}</div><b>Estimated · model {o.model}</b></div>
        <div className="cn-k"><div className="ey">Google billing</div><div className="ser cn-nc">{o.billing.connected ? 'Connected' : NOT_CONNECTED}</div><b>{o.billing.note}</b></div>
      </div>
      {none ? <p className="cn-card mut">No AI renders in the last 30 days yet. Charts fill in as stores use AI render. Days are UTC.</p> : (
        <>
          <div className="cn-grid">
            <Box eyebrow="Last 30 days · UTC" title="Render calls per day" link={<div className="cn-lg"><i style={{ background: PLUM }} />Done<i style={{ background: GOLD }} />Failed (refunded)</div>}><DailyCalls daily={o.daily} /></Box>
            <Box eyebrow="Last 30 days" title="Revenue vs estimated cost" link={<div className="cn-lg"><i style={{ background: PLUM }} />Revenue<i style={{ background: GOLD }} />Est. cost</div>}><DailyMoney daily={o.daily} /></Box>
          </div>
          <div className="cn-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Box eyebrow="Calls" title="By style"><HBars label="Calls by style" unit="calls" rows={o.byStyle.map((s) => ({ k: s.style, name: styleName(s.style), v: s.calls, sub: `${s.spend} credits` }))} /></Box>
            <Box eyebrow="Calls" title="Top 10 stores"><HBars label="Calls by store" unit="calls" rows={o.topStores.map((s) => ({ k: s.storeId, name: s.name, v: s.calls, sub: `${s.spend} credits` }))} /></Box>
          </div>
        </>
      )}
      <small>Cost is estimated from the editable per-model table (Prices tab) at the USD to INR rate you set; it is not read from Cloud Billing here (see the Billing section for actuals). A failed call is counted as cost and its credits are returned.</small>
    </>
  );
}

function StoresTab({ v, act, filter }: { v: number; act: (a: Act) => void; filter?: boolean }) {
  const api = useApi<{ defaultCap: number; rows: StoreAi[] }>('/ai/stores', v);
  const [q, setQ] = useState('');
  const rows = (api.data?.rows ?? []).filter((s) => (!filter || isAlert(s)) && (!q || `${s.name} ${s.subdomain}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      {!filter && <div className="cn-bar"><div className="cn-search"><input className="cn-inp" type="search" placeholder="Search store" aria-label="Search store" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 16 }} /></div></div>}
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">AI credits by store</caption>
            <thead><tr>{['Store', 'Status', 'Balance', 'Renders this month', 'Spend this month', 'Last used', 'Actions'].map((h) => <th key={h} scope="col" className={['Balance', 'Renders this month', 'Spend this month'].includes(h) ? 'n' : undefined}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} data-testid={`ai-row-${s.id}`}>
                  <td><a className="cn-store" href={`#/stores/${s.id}`}>{s.name}</a><small>{s.subdomain}</small></td>
                  <td><span className={STATUS[s.status][1]}>{STATUS[s.status][0]}</span></td>
                  <td className="n">{s.aiFree ? '—' : rs(s.balance)}{s.blockedWeek > 0 && <small>{s.blockedWeek} blocked this week</small>}</td>
                  <td className="n">{num(s.rendersMonth)}{s.monthlyCap !== null && <small>cap {s.monthlyCap}</small>}</td>
                  <td className="n">{rs(s.spendMonth)}</td>
                  <td>{s.lastUsedAt ? ago(new Date(s.lastUsedAt).toISOString()) : 'Never'}</td>
                  <td><div className="cn-row" style={{ flexWrap: 'nowrap' }}>
                    <button type="button" className="cn-btn sm" onClick={() => act({ kind: 'topup', store: s })}>Top up</button>
                    <button type="button" className="cn-btn sm soft" onClick={() => act({ kind: 'adjust', store: s })}>Adjust</button>
                    <button type="button" className="cn-btn sm soft" onClick={() => act({ kind: 'refund', store: s })}>Refund</button>
                    <button type="button" className="cn-btn sm soft" onClick={() => act({ kind: 'settings', store: s })}>Price, cap, AI on/off</button>
                  </div></td>
                </tr>
              ))}
              {api.data && rows.length === 0 && <tr><td colSpan={7} className="empty">{filter ? 'No store has a low or empty balance.' : 'No stores match.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function UsageTab({ stores }: { stores: StoreAi[] }) {
  const [f, setF] = useState({ store: '', style: '', outcome: '', from: '', to: '' });
  const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const api = useApi<UsageRow[]>(`/ai/usage?${qs}`);
  const set = (k: string) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <div className="cn-bar">
        <select className="cn-inp" aria-label="Store" value={f.store} onChange={set('store')}><option value="">All stores</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="cn-inp" aria-label="Style" value={f.style} onChange={set('style')}><option value="">All styles</option>{STYLE_IDS.map((s) => <option key={s} value={s}>{styleName(s)}</option>)}</select>
        <select className="cn-inp" aria-label="Outcome" value={f.outcome} onChange={set('outcome')}><option value="">Any outcome</option>{Object.entries(OUTCOME).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className="cn-inp" type="date" aria-label="From date" value={f.from} onChange={set('from')} />
        <input className="cn-inp" type="date" aria-label="To date" value={f.to} onChange={set('to')} />
        <a className="cn-btn sm soft" href={`/api/v1/console/ai/usage.csv?${qs}`} download="ai-usage.csv"><Download size={14} aria-hidden /> Export CSV</a>
      </div>
      <Load s={api} />
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">AI render usage log</caption>
            <thead><tr>{['Time', 'Store', 'Style', 'Outcome', 'Est. cost', 'Charged', 'Balance after'].map((h) => <th key={h} scope="col" className={['Est. cost', 'Charged', 'Balance after'].includes(h) ? 'n' : undefined}>{h}</th>)}</tr></thead>
            <tbody>
              {(api.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td title={new Date(u.ts).toISOString()}>{stamp(new Date(u.ts).toISOString())}</td><td>{u.store}</td><td>{styleName(u.style)}</td>
                  <td><span className={OUTCOME[u.outcome]?.[1] ?? 'tag'}>{OUTCOME[u.outcome]?.[0] ?? u.outcome}</span>{u.kept === false && <small>Owner discarded</small>}</td>
                  <td className="n">{u.costUsd ? `$${u.costUsd.toFixed(3)}` : '—'}</td><td className="n">{u.price ? rs(u.price) : '—'}</td><td className="n">{rs(u.balanceAfter)}</td>
                </tr>
              ))}
              {api.data && api.data.length === 0 && <tr><td colSpan={7} className="empty">No usage for these filters. Default range is the last 30 days; the page shows the newest 500.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PricesTab({ v, bump }: { v: number; bump: () => void }) {
  const api = useApi<Cfg>('/ai/config', v);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState({ model: '', cost: '' });
  const [rest, setRest] = useState({ usdInr: '', low: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const c = api.data;
  useEffect(() => {
    if (!c) return;
    setPrices(Object.fromEntries(Object.entries(c.config.prices).map(([k, x]) => [k, String(x)])));
    setCosts(Object.fromEntries(Object.entries(c.config.modelCostUsd).map(([k, x]) => [k, String(x)])));
    setRest({ usdInr: String(c.config.usdInr), low: String(c.config.lowBalance) });
  }, [c]);
  if (!c) return <Load s={api} />;
  const save = async (body: object, ok: string) => {
    setBusy(true); setErr(''); setMsg('');
    try { await call('/ai/config', body); setMsg(ok); bump(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const inr = Number(rest.usdInr) || c.config.usdInr;
  const modelCost = Number(costs[c.model] ?? 0) * inr;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const modelCostUsd = Object.fromEntries(Object.entries({ ...costs, ...(extra.model.trim() ? { [extra.model.trim()]: extra.cost } : {}) }).map(([k, x]) => [k, Number(x)]));
    void save({ prices: Object.fromEntries(Object.entries(prices).map(([k, x]) => [k, Number(x)])), modelCostUsd, usdInr: Number(rest.usdInr), lowBalance: Number(rest.low) }, 'Saved. Recorded in the audit log.');
  };
  return (
    <>
      <div className={`cn-card cn-row${c.config.killSwitch ? ' ai-kill' : ''}`} style={{ justifyContent: 'space-between' }}>
        <div><b>Kill switch: {c.config.killSwitch ? 'ON, no store can start a render' : 'off'}</b><small style={{ display: 'block' }}>Stops new renders platform-wide. Server master switch AI_RENDER_ENABLED is {c.serverEnabled ? 'on' : 'OFF'}; this cannot turn it on.</small></div>
        <button type="button" className={`cn-btn sm ${c.config.killSwitch ? '' : 'bad'}`} disabled={busy} onClick={() => void save({ killSwitch: !c.config.killSwitch }, c.config.killSwitch ? 'AI renders resumed.' : 'AI renders paused platform-wide.')}>{c.config.killSwitch ? 'Resume AI renders' : 'Pause all AI renders'}</button>
      </div>
      <form className="cn-two" onSubmit={submit} aria-label="Price and model controls">
        <section className="cn-card cn-stack" aria-label="Price per style">
          <h2 className="ser" style={{ fontSize: '1.25rem' }}>Price per render (credits, Rs 1 each)</h2>
          <div className="cn-tw"><table className="cn-t">
            <thead><tr><th scope="col">Style</th><th scope="col" className="n">Price</th><th scope="col" className="n">Margin on {c.model}</th></tr></thead>
            <tbody>{STYLE_IDS.map((s) => {
              const m = Number(prices[s] ?? 0) - modelCost;
              return (
                <tr key={s}><td>{styleName(s)}</td>
                  <td className="n"><input className="cn-inp" style={{ width: 90, height: 34 }} type="number" min={0} max={100000} step="1" aria-label={`${styleName(s)} price`} value={prices[s] ?? ''} onChange={(e) => setPrices((p) => ({ ...p, [s]: e.target.value }))} /></td>
                  <td className="n" style={{ color: m < 0 ? 'var(--bad)' : undefined }}>{rs2(m)} <small>estimated</small></td></tr>
              );
            })}</tbody>
          </table></div>
        </section>
        <section className="cn-card cn-stack" aria-label="Provider cost and rates">
          <h2 className="ser" style={{ fontSize: '1.25rem' }}>Provider cost per image (USD, estimated)</h2>
          {Object.entries(costs).map(([m, x]) => (
            <label key={m} className="cn-fld">{m}{m === c.model ? ' (in use)' : ''}
              <input className="cn-inp" type="number" min={0} max={10} step="0.001" value={x} onChange={(e) => setCosts((p) => ({ ...p, [m]: e.target.value }))} />
            </label>
          ))}
          <div className="cn-row"><input className="cn-inp" placeholder="New model id" aria-label="New model id" value={extra.model} onChange={(e) => setExtra((p) => ({ ...p, model: e.target.value }))} /><input className="cn-inp" style={{ width: 100 }} type="number" min={0} step="0.001" placeholder="USD" aria-label="New model cost USD" value={extra.cost} onChange={(e) => setExtra((p) => ({ ...p, cost: e.target.value }))} /></div>
          <label className="cn-fld">USD to INR rate<input className="cn-inp" type="number" min={1} max={1000} step="0.01" value={rest.usdInr} onChange={(e) => setRest((p) => ({ ...p, usdInr: e.target.value }))} /></label>
          <label className="cn-fld">Low-balance alert at or below (credits)<input className="cn-inp" type="number" min={0} step="1" value={rest.low} onChange={(e) => setRest((p) => ({ ...p, low: e.target.value }))} /></label>
          {err && <p role="alert" className="cn-note">{err}</p>}
          {msg && <p role="status" className="cn-note ok">{msg}</p>}
          <button type="submit" className="cn-btn" disabled={busy} data-testid="ai-save-config">Save prices and rates</button>
          <small>Last changed {c.config.updatedAt ? `${stamp(c.config.updatedAt)} by ${c.config.updatedBy}` : 'never (defaults)'}. Per-store overrides, free grants, caps and on/off are under Stores.</small>
        </section>
      </form>
    </>
  );
}

const TABS: Array<[string, string]> = [['', 'Overview'], ['stores', 'Stores'], ['usage', 'Usage log'], ['prices', 'Prices & models'], ['alerts', 'Alerts']];

/** Console "AI" section: usage, prepaid credits, price controls. Real numbers; cost is estimated, never read from Cloud Billing. */
export function AiPage({ sub }: { sub?: string }) {
  const tab = TABS.some(([id]) => id === (sub ?? '')) ? (sub ?? '') : '';
  const [v, setV] = useState(0);
  const [act, setAct] = useState<Act | null>(null);
  const [note, setNote] = useState('');
  const list = useApi<{ rows: StoreAi[] }>('/ai/stores', v);
  const alerts = (list.data?.rows ?? []).filter(isAlert).length;
  return (
    <>
      <nav className="cn-tabs" aria-label="AI sections">
        {TABS.map(([id, label]) => (
          <a key={id} href={`#/ai${id ? `/${id}` : ''}`} aria-current={id === tab ? 'page' : undefined}>{label}{id === 'alerts' && alerts > 0 && <em>{alerts}</em>}</a>
        ))}
      </nav>
      {note && <p role="status" className="cn-note ok">{note}</p>}
      {tab === '' && <OverviewTab v={v} />}
      {tab === 'stores' && <StoresTab v={v} act={(a) => { setNote(''); setAct(a); }} />}
      {tab === 'usage' && <UsageTab stores={list.data?.rows ?? []} />}
      {tab === 'prices' && <PricesTab v={v} bump={() => setV((n) => n + 1)} />}
      {tab === 'alerts' && <StoresTab v={v} filter act={(a) => { setNote(''); setAct(a); }} />}
      <ActionDialog act={act} onClose={() => setAct(null)} onDone={(m) => { setNote(m); setAct(null); setV((n) => n + 1); }} />
    </>
  );
}
