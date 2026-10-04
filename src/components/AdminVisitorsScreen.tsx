import React, { useEffect, useState } from 'react';
import { AnalyticsData, VisitorDetail, VisitorSummary } from '../types';
import { api } from '../api';
import { Notice } from './ui';

const duration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Seen in the last two minutes counts as online (heartbeats arrive every minute).
const isOnline = (iso: string) => Date.now() - new Date(iso).getTime() < 120000;

const Figures: React.FC<{ items: Array<[string, string]> }> = ({ items }) => (
  <div className="grid2" style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))`, gap: 6, textAlign: 'center' }}>
    {items.map(([label, value]) => (
      <div key={label}>
        <b>{value}</b>
        <span className="sub" style={{ display: 'block', fontSize: 12 }}>
          {label}
        </span>
      </div>
    ))}
  </div>
);

/** Buyer engagement (artboard 3.6): who is browsing, and which designs held their attention. */
export const AdminVisitorsScreen: React.FC<{ analytics: AnalyticsData }> = ({ analytics }) => {
  const [rows, setRows] = useState<VisitorSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getVisitors('all')
        .then((data) => active && setRows(data))
        .catch((e) => active && setError(e.message));
    setRows(null);
    setError(null);
    load();
    const timer = setInterval(() => !document.hidden && load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetail(null);
    api
      .getVisitor(openId)
      .then((d) => active && setDetail(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [openId]);

  if (openId) {
    return (
      <div className="scroll" style={{ gap: 12 }}>
        <button type="button" className="lnk" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenId(null)}>
          <i aria-hidden="true" className="i s i-back" />
          All buyers
        </button>
        {!detail ? (
          <p className="hint" style={{ textAlign: 'center', padding: '24px 0' }}>{error ?? 'Loading…'}</p>
        ) : (
          <>
            <div className="card col" style={{ gap: 10 }}>
              <div className="row">
                <div className="grow">
                  <h2 style={{ fontSize: 22 }}>{detail.name}</h2>
                  <p className="sub" style={{ fontSize: 13 }}>
                    {detail.kind === 'verified' ? 'Buyer' : 'Guest visitor'} · last seen {ago(detail.lastSeen)} · last 30 days
                  </p>
                </div>
                <span className={isOnline(detail.lastSeen) ? 'tag ok' : 'tag mut'}>{isOnline(detail.lastSeen) ? 'Online' : 'Away'}</span>
              </div>
              <Figures items={[['Visits', String(detail.sessions)], ['In app', duration(detail.activeSeconds)], ['Seen', String(detail.productsViewed)], ['Hearted', String(detail.selections)]]} />
              <Figures items={[['On designs', duration(detail.dwellSeconds)], ['Added', String(detail.addedToCart)]]} />
            </div>

            <h2 style={{ fontSize: 18 }}>Designs they spent time on</h2>
            {detail.products.length === 0 ? (
              <p className="sub">No design views recorded yet.</p>
            ) : (
              <div className="card kvs">
                {detail.products.map((pr) => (
                  <div key={pr.sku} className="kv">
                    <span>
                      {pr.title} · {pr.sku}
                    </span>
                    <b>{duration(pr.seconds)}</b>
                  </div>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 18 }}>What they searched for</h2>
            {detail.searchTerms.length === 0 ? (
              <p className="sub">No searches yet.</p>
            ) : (
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {detail.searchTerms.map((t) => (
                  <span key={t.term} className="chip" style={{ cursor: 'default' }}>
                    {t.term}
                    {t.count > 1 ? ` ×${t.count}` : ''}
                  </span>
                ))}
              </div>
            )}

            <h2 style={{ fontSize: 18 }}>Hearted or added to order</h2>
            {detail.picked.length === 0 ? (
              <p className="sub">Nothing yet.</p>
            ) : (
              <div className="card kvs">
                {detail.picked.map((pr) => (
                  <div key={pr.sku} className="kv">
                    <span>{pr.title}</span>
                    <b>{ago(pr.lastAt)}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="scroll" style={{ gap: 12 }}>
      <p className="sub">Tap a buyer to see which designs held their attention. Last 30 days, refreshed every 15 seconds.</p>
      <div className="grid2">
        <div className="card">
          <span className="stat" style={{ fontSize: 30 }}>
            {analytics.todayVisitors}
          </span>
          <span className="sub" style={{ display: 'block', fontSize: 13 }}>
            Visitors today
          </span>
        </div>
        <div className="card">
          <span className="stat" style={{ fontSize: 30, color: 'var(--ok)' }}>
            {analytics.liveVisitors}
          </span>
          <span className="sub" style={{ display: 'block', fontSize: 13 }}>
            Online now
          </span>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {rows === null && !error && <p className="hint" style={{ textAlign: 'center' }}>Loading…</p>}
      {rows?.length === 0 && <p className="sub" style={{ textAlign: 'center', padding: '16px 0' }}>No one has been tracked yet. Buyers appear here once they sign in and browse.</p>}

      <div className="col" style={{ gap: 12 }} data-testid="visitor-list">
        {rows?.map((v) => {
          const online = isOnline(v.lastSeen);
          return (
            <button key={v.id} type="button" className="card col" style={{ gap: 8, width: '100%' }} onClick={() => setOpenId(v.id)}>
              <div className="row">
                <div className="grow">
                  <b>{v.name}</b>
                  <p className="sub" style={{ fontSize: 13 }}>
                    {v.kind === 'guest' ? 'Guest · ' : ''}
                    {online ? 'Looking at designs now' : ago(v.lastSeen)}
                  </p>
                </div>
                <span className={online ? 'tag ok' : 'tag mut'}>{online ? 'Online' : 'Away'}</span>
              </div>
              <Figures items={[['In app', duration(v.activeSeconds)], ['Seen', String(v.productsViewed)], ['Searches', String(v.searches)]]} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
