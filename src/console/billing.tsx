import { Fragment, useState, type ReactNode } from 'react';
import { NOT_CONNECTED, stamp, useApi } from './api';

/* ---------- types (what server/routes/consoleBilling.ts returns) ---------- */
interface Amt { gross: number; credits: number; net: number }
interface Fc { enough: boolean; basedOnDays: number; mtd: number; total: number | null; low: number | null; high: number | null; perDay: number | null }
interface Sku extends Amt { sku: string }
interface Svc extends Amt { service: string; share: number; skus: Sku[] }
interface Data {
  connected: boolean; generatedAt: string; project: string; setup?: string[]; table: string | null;
  currency: string; cachedAt: string; hasData: boolean; months: string[]; month: string;
  current: Amt & { month: string; daily: Array<{ day: string; net: number; gross: number }>; forecast: Fc; perService: Array<{ service: string; forecast: Fc }> };
  trend: Array<Amt & { month: string }>;
  selected: Amt & { month: string; services: Svc[] };
  ai: {
    month: string; actual: Amt; actualInr: number | null; skus: Array<Sku & { service: string }>;
    estimate: { costUsd: number; costInr: number; revenueInr: number; marginInr: number; calls: number; usdInr: number };
    diffInr: number | null; actualMarginInr: number | null; forecast: Fc;
  };
}

const PLUM = '#5c1f3a', GOLD = '#c9a961';
const mlabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const dlabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const inr = (n: number) => `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.01 ? 1 : 0)}%`;
const makeMoney = (cur: string) => {
  try {
    const f = new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 });
    return (n: number) => f.format(n);
  } catch {
    return (n: number) => `${cur} ${n.toFixed(2)}`;
  }
};

const Box = ({ eyebrow, title, link, children }: { eyebrow: string; title: string; link?: ReactNode; children: ReactNode }) => (
  <section className="cn-card" aria-label={title}>
    <div className="cn-ch"><div><div className="ey">{eyebrow}</div><h2 className="ser">{title}</h2></div>{link}</div>
    {children}
  </section>
);

/** Bars for a list of values with an x label under the first and last bar; a text table for screen readers. */
function Bars({ rows, label, money, mark }: { rows: Array<{ k: string; label: string; v: number }>; label: string; money: (n: number) => string; mark?: string }) {
  const W = 560, H = 176, L = 56, R = 8, T = 10, B = 24;
  const max = Math.max(1, ...rows.map((r) => r.v));
  const step = (W - L - R) / rows.length, bw = Math.max(3, step - 4);
  const y = (n: number) => T + (H - T - B) * (1 - Math.max(0, n) / max);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="cn-chart" role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${money(r.v)}`).join(', ')}`}>
        <g stroke="#e6ddd0">{[0, 0.5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={T + (H - T - B) * f} y2={T + (H - T - B) * f} />)}</g>
        <g fontSize="12" fill="#6a625c" fontFamily="Inter, sans-serif">
          <text x={L - 5} y={T + 4} textAnchor="end">{money(max)}</text><text x={L - 5} y={H - B + 4} textAnchor="end">0</text>
          <text x={L} y={H - 6}>{rows[0]?.label}</text><text x={W - R} y={H - 6} textAnchor="end">{rows[rows.length - 1]?.label}</text>
        </g>
        {rows.map((r, i) => {
          const x = L + i * step + (step - bw) / 2;
          return (
            <g key={r.k}>
              <rect x={x} y={y(r.v)} width={bw} height={Math.max(0, y(0) - y(r.v))} fill={r.k === mark ? GOLD : PLUM} rx="2" />
              <rect x={L + i * step} y={T} width={step} height={H - T - B} fill="transparent"><title>{`${r.label}: ${money(r.v)}`}</title></rect>
            </g>
          );
        })}
      </svg>
      <div className="sr-only"><table><caption>{label}</caption><thead><tr><th scope="col">Period</th><th scope="col">Cost</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.k}><td>{r.label}</td><td>{money(r.v)}</td></tr>)}</tbody></table></div>
    </>
  );
}

function ForecastNote({ f, money }: { f: Fc; money: (n: number) => string }) {
  if (!f.enough) return <>Not enough data yet to forecast (needs 3 full days of this month, have {f.basedOnDays}).</>;
  return <>{money(f.total ?? 0)} expected by month end · range {money(f.low ?? 0)} to {money(f.high ?? 0)}</>;
}

function NotConnected({ d }: { d: Data }) {
  return (
    <section className="cn-card cn-stack" aria-label="Billing not connected">
      <div className="ey">Google Cloud billing</div>
      <h2 className="ser">{NOT_CONNECTED}</h2>
      <p>Project <b>{d.project}</b>. Real costs come from the Cloud Billing export in BigQuery. Nothing is called until the owner finishes these steps:</p>
      <ol className="cn-stack" style={{ paddingLeft: 20 }}>{(d.setup ?? []).map((s) => <li key={s}>{s}</li>)}</ol>
    </section>
  );
}

function OverviewTab({ d, month, setMonth, money }: { d: Data; month: string; setMonth: (m: string) => void; money: (n: number) => string }) {
  const [open, setOpen] = useState('');
  const fc = d.current.forecast;
  const fcOf = new Map(d.current.perService.map((p) => [p.service, p.forecast]));
  const isCur = d.selected.month === d.current.month;
  return (
    <>
      <div className="cn-kpis">
        <div className="cn-k dk"><div className="ey">Month to date, net</div><div className="ser">{money(d.current.net)}</div><b>{money(d.current.gross)} gross · {money(d.current.credits)} credits</b></div>
        <div className="cn-k"><div className="ey">Forecast, month end</div><div className="ser">{fc.enough ? money(fc.total ?? 0) : '—'}</div><b>{fc.enough ? `${money(fc.low ?? 0)} to ${money(fc.high ?? 0)}` : 'Not enough data yet'}</b></div>
        <div className="cn-k"><div className="ey">Last month, net</div><div className="ser">{money(d.trend[10]?.net ?? 0)}</div><b>{mlabel(d.trend[10]?.month ?? d.current.month)}</b></div>
        <div className="cn-k"><div className="ey">12 months, net</div><div className="ser">{money(d.trend.reduce((t, m) => t + m.net, 0))}</div><b>Currency {d.currency || 'unknown'}</b></div>
      </div>
      {!d.hasData && <p className="cn-note" role="status">The export is connected but has no rows for this project yet. Data appears only from the day the export was enabled and can take up to a day.</p>}
      <div className="cn-grid">
        <Box eyebrow="Last 12 months" title="Net cost per month" link={<div className="cn-lg"><i style={{ background: PLUM }} />Month<i style={{ background: GOLD }} />Selected</div>}>
          <Bars label="Net cost per month" money={money} mark={month} rows={d.trend.map((m) => ({ k: m.month, label: mlabel(m.month), v: m.net }))} />
        </Box>
        <Box eyebrow={`${mlabel(d.current.month)} · UTC days`} title="Daily cost, this month">
          <Bars label="Net cost per day this month" money={money} rows={d.current.daily.map((x) => ({ k: x.day, label: dlabel(x.day), v: x.net }))} />
        </Box>
      </div>
      <div className="cn-bar">
        <label className="cn-fld" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>Month
          <select className="cn-inp" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            {[...d.months].reverse().map((m) => <option key={m} value={m}>{mlabel(m)}</option>)}
          </select>
        </label>
        <small>{money(d.selected.net)} net · {money(d.selected.gross)} gross · {money(d.selected.credits)} credits</small>
      </div>
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Cost per Google Cloud service, {mlabel(d.selected.month)}</caption>
            <thead><tr><th scope="col">Service</th><th scope="col" className="n">Cost</th><th scope="col" className="n">Credits</th><th scope="col" className="n">Net</th><th scope="col" className="n">Share</th>{isCur && <th scope="col" className="n">Forecast</th>}</tr></thead>
            <tbody>
              {d.selected.services.map((s) => (
                <Fragment key={s.service}>
                  <tr>
                    <td><button type="button" className="cn-btn sm soft" aria-expanded={open === s.service} onClick={() => setOpen(open === s.service ? '' : s.service)} data-testid="bill-svc">{open === s.service ? 'Hide' : 'SKUs'}</button> {s.service}</td>
                    <td className="n">{money(s.gross)}</td><td className="n">{money(s.credits)}</td><td className="n"><b>{money(s.net)}</b></td><td className="n">{pct(s.share)}</td>
                    {isCur && <td className="n">{fcOf.get(s.service)?.enough ? money(fcOf.get(s.service)!.total ?? 0) : '—'}</td>}
                  </tr>
                  {open === s.service && s.skus.map((k) => (
                    <tr key={k.sku} className="mut"><td style={{ paddingLeft: 36 }}>{k.sku}</td><td className="n">{money(k.gross)}</td><td className="n">{money(k.credits)}</td><td className="n">{money(k.net)}</td><td className="n">{s.net ? pct(k.net / s.net) : '—'}</td>{isCur && <td />}</tr>
                  ))}
                </Fragment>
              ))}
              {d.selected.services.length === 0 && <tr><td colSpan={isCur ? 6 : 5} className="empty">No cost recorded for {mlabel(d.selected.month)}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <small>Costs are in {d.currency || 'the billing account currency'} (the currency of the billing account), read from the export for project {d.project}. Days are UTC; Google invoices by Pacific time, so a day edge can differ slightly. Updated {stamp(d.cachedAt)}, cached up to 10 minutes. {isCur && <ForecastNote f={fc} money={money} />}</small>
    </>
  );
}

function AiTab({ d, money }: { d: Data; money: (n: number) => string }) {
  const a = d.ai, e = a.estimate;
  const known = a.diffInr !== null;
  return (
    <>
      <div className="cn-kpis">
        <div className="cn-k dk"><div className="ey">Actual Google AI cost</div><div className="ser">{money(a.actual.net)}</div><b>{mlabel(a.month)} · net of credits, Vertex AI and Gemini</b></div>
        <div className="cn-k"><div className="ey">Estimated by us</div><div className="ser">{inr(e.costInr)}</div><b>{e.calls} calls × price table (USD {e.costUsd.toFixed(2)} at {e.usdInr})</b></div>
        <div className="cn-k"><div className="ey">Estimate vs actual</div><div className="ser">{known ? inr(a.diffInr ?? 0) : '—'}</div><b>{known ? ((a.diffInr ?? 0) > 0 ? 'Google charged more than estimated' : (a.diffInr ?? 0) < 0 ? 'Google charged less than estimated' : 'Matches') : `Needs INR or USD billing, this is ${d.currency}`}</b></div>
        <div className="cn-k"><div className="ey">AI forecast, month end</div><div className="ser">{a.forecast.enough ? money(a.forecast.total ?? 0) : '—'}</div><b>{a.forecast.enough ? `${money(a.forecast.low ?? 0)} to ${money(a.forecast.high ?? 0)}` : 'Not enough data yet'}</b></div>
      </div>
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Estimate and actual AI cost, side by side</caption>
            <thead><tr><th scope="col">{mlabel(a.month)}</th><th scope="col" className="n">Estimated (ledger)</th><th scope="col" className="n">Actual (Google)</th><th scope="col" className="n">Difference</th></tr></thead>
            <tbody>
              <tr><td>Revenue (credits spent, Rs 1 each)</td><td className="n">{inr(e.revenueInr)}</td><td className="n">{inr(e.revenueInr)}</td><td className="n">—</td></tr>
              <tr><td>Provider cost</td><td className="n">{inr(e.costInr)}</td><td className="n">{known ? inr(a.actualInr ?? 0) : money(a.actual.net)}</td><td className="n">{known ? inr(a.diffInr ?? 0) : '—'}</td></tr>
              <tr><td>Margin</td><td className="n">{inr(e.marginInr)}</td><td className="n">{known ? inr(a.actualMarginInr ?? 0) : '—'}</td><td className="n">{known ? inr((a.actualMarginInr ?? 0) - e.marginInr) : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <small>Actual cost covers all Vertex AI and Gemini API usage on the project, not only renders, so some difference is expected. Raise or lower the per-model cost in AI &gt; Prices &amp; models until the two match over a full month.</small>
      <div className="cn-card" style={{ padding: 8 }}>
        <div className="cn-tw">
          <table className="cn-t">
            <caption className="sr-only">Actual AI cost lines from the billing export</caption>
            <thead><tr><th scope="col">Service</th><th scope="col">SKU</th><th scope="col" className="n">Cost</th><th scope="col" className="n">Credits</th><th scope="col" className="n">Net</th></tr></thead>
            <tbody>
              {a.skus.map((k) => <tr key={`${k.service}|${k.sku}`}><td>{k.service}</td><td>{k.sku}</td><td className="n">{money(k.gross)}</td><td className="n">{money(k.credits)}</td><td className="n">{money(k.net)}</td></tr>)}
              {a.skus.length === 0 && <tr><td colSpan={5} className="empty">No Vertex AI or Gemini cost lines for {mlabel(a.month)}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <small>Forecast for this month: <ForecastNote f={a.forecast} money={money} /></small>
    </>
  );
}

const TABS: Array<[string, string]> = [['', 'Overview'], ['ai', 'AI cost']];

/** Console "Billing" section: real Google Cloud cost from the BigQuery billing export (read only). */
export function BillingPage({ sub }: { sub?: string }) {
  const tab = TABS.some(([id]) => id === (sub ?? '')) ? (sub ?? '') : '';
  const [month, setMonth] = useState('');
  const api = useApi<Data>(`/billing/overview${month ? `?month=${month}` : ''}`);
  const d = api.data;
  return (
    <>
      <nav className="cn-tabs" aria-label="Billing sections">
        {TABS.map(([id, label]) => <a key={id} href={`#/billing${id ? `/${id}` : ''}`} aria-current={id === tab ? 'page' : undefined}>{label}</a>)}
      </nav>
      {api.error && <p role="alert" className="cn-note">{api.error}</p>}
      {api.loading && !d && <p className="mut" role="status">Loading…</p>}
      {d && !d.connected && <NotConnected d={d} />}
      {d?.connected && (tab === '' ? <OverviewTab d={d} month={d.month} setMonth={setMonth} money={makeMoney(d.currency || 'INR')} /> : <AiTab d={d} money={makeMoney(d.currency || 'INR')} />)}
    </>
  );
}
