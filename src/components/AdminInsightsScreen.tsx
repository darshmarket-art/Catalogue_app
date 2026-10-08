import React, { useEffect, useState } from 'react';
import { api, type Insights } from '../api';
import { Notice } from './ui';

const fmt = (n: number) => n.toLocaleString('en-IN');
const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 'new' : '—') : `${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%`);

/** Owner dashboard: what buyers looked at, ordered and shortlisted, who is active, and how WhatsApp delivered. */
export const AdminInsightsScreen: React.FC = () => {
  const [d, setD] = useState<Insights | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.getInsights().then(setD).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="scroll no-tabs"><Notice tone="error">{err}</Notice></div>;
  if (!d) return <div className="scroll no-tabs" style={{ gap: 12 }}><div className="card em-skel" style={{ height: 120 }} /><div className="card em-skel" style={{ height: 180 }} /></div>;

  const maxViews = Math.max(1, ...d.weeks.map((w) => w.views));
  const maxCol = Math.max(1, ...d.collections.map((c) => c.views));
  const k = d.kpis;

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="admin-insights-screen">
      <div className="em-card" style={{ padding: '14px 16px', fontSize: 14, lineHeight: 1.55 }} data-testid="insights-summary">
        <div className="em-ey" style={{ marginBottom: 6 }}>This week in plain words</div>
        {d.summary}
      </div>

      <div className="grid2" style={{ gap: 10 }} data-testid="insights-kpis">
        <Kpi label="Design views" value={fmt(k.views7)} note={`${delta(k.views7, k.views7Prev)} vs last week`} testId="kpi-views" />
        <Kpi label="Orders booked" value={fmt(k.orders7)} note={`${delta(k.orders7, k.orders7Prev)} vs last week`} testId="kpi-orders" />
        <Kpi label="Active buyers" value={fmt(k.activeBuyers7)} note={`${fmt(k.activeBuyers30)} in 30 days · ${fmt(k.buyers)} total`} testId="kpi-buyers" />
        <Kpi label="Shortlisting" value={fmt(k.shortlisters)} note={`${fmt(k.shortlistedDesigns)} designs shortlisted`} testId="kpi-shortlist" />
      </div>

      <Section title="Views and orders, last 8 weeks" testId="insights-weeks">
        <div className="em-row" style={{ gap: 6, alignItems: 'flex-end', height: 120 }}>
          {d.weeks.map((w) => (
            <div key={w.label} className="col" style={{ flex: 1, alignItems: 'center', gap: 4 }} title={`${w.label}: ${w.views} views, ${w.orders} orders`}>
              <span className="em-mut" style={{ fontSize: 10 }}>{w.orders > 0 ? `${w.orders}◆` : ''}</span>
              <i style={{ display: 'block', width: '100%', height: `${Math.max(4, Math.round((w.views / maxViews) * 90))}px`, borderRadius: 6, background: 'var(--em-primary)', opacity: w.label === 'This week' ? 1 : 0.55 }} />
            </div>
          ))}
        </div>
        <div className="em-row em-sb em-mut" style={{ fontSize: 10.5 }}>
          <span>7 weeks ago</span>
          <span>◆ orders booked</span>
          <span>This week</span>
        </div>
      </Section>

      <Section title="Most viewed designs (30 days)" testId="insights-top-designs">
        {d.topDesigns.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>No design views recorded yet.</p>
        ) : (
          d.topDesigns.map((p, i) => (
            <div key={p.sku} className="em-row em-sb" style={{ gap: 10, fontSize: 13.5 }} data-testid="insights-top-design">
              <span>
                <b style={{ fontWeight: 600 }}>{i + 1}.</b> {p.name} <span className="em-mut">· {p.category}</span>
              </span>
              <span className="tag mut">{fmt(p.views)} views</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Collections by views (30 days)" testId="insights-collections">
        {d.collections.map((c) => (
          <div key={c.name} className="col" style={{ gap: 4 }}>
            <div className="em-row em-sb" style={{ fontSize: 13 }}>
              <span>{c.name} <span className="em-mut">· {c.designs} designs</span></span>
              <span>{fmt(c.views)}</span>
            </div>
            <div className="meter"><i style={{ width: `${Math.round((c.views / maxCol) * 100)}%` }} /></div>
          </div>
        ))}
      </Section>

      {d.whatsapp && (
        <Section title="WhatsApp delivery (7 days)" testId="insights-whatsapp">
          <div className="em-row em-sb" style={{ fontSize: 13.5 }}>
            <span>{fmt(d.whatsapp.total)} messages · {fmt(d.whatsapp.failed)} failed</span>
            <span className={`tag ${d.whatsapp.deliveredRate === null ? 'mut' : d.whatsapp.deliveredRate >= 90 ? 'ok' : 'warn'}`} data-testid="insights-whatsapp-rate">
              {d.whatsapp.deliveredRate === null ? (d.whatsapp.receiptsConnected ? 'No receipts yet' : 'Receipts not connected') : `${d.whatsapp.deliveredRate}% delivered`}
            </span>
          </div>
        </Section>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; note: string; testId: string }> = ({ label, value, note, testId }) => (
  <div className="card col" style={{ gap: 2 }} data-testid={testId}>
    <span className="em-mut" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
    <b className="em-ser" style={{ fontSize: 24 }}>{value}</b>
    <span className="sub" style={{ fontSize: 12 }}>{note}</span>
  </div>
);

const Section: React.FC<{ title: string; testId: string; children: React.ReactNode }> = ({ title, testId, children }) => (
  <div className="card col" style={{ gap: 10 }} data-testid={testId}>
    <b style={{ fontWeight: 600 }}>{title}</b>
    {children}
  </div>
);
