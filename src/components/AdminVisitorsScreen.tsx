import React, { useEffect, useState } from 'react';
import { VisitorDetail, VisitorSummary } from '../types';
import { api } from '../api';

const duration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-2 flex flex-col">
    <span className="text-[9px] uppercase tracking-wider text-outline font-semibold">{label}</span>
    <span className="font-mono text-[13px] font-bold text-on-surface">{value}</span>
  </div>
);

export const AdminVisitorsScreen: React.FC = () => {
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
      <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 space-y-4">
        <button onClick={() => setOpenId(null)} className="self-start flex items-center gap-1 text-xs font-sans font-bold text-primary">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          All visitors
        </button>
        {!detail ? (
          <p className="text-xs text-outline text-center py-8">{error ?? 'Loading…'}</p>
        ) : (
          <>
            <div>
              <span className="font-mono text-[10px] text-primary font-bold tracking-wider uppercase">
                {detail.kind === 'verified' ? 'Buyer' : 'Guest visitor'}
              </span>
              <h1 className="font-serif text-[22px] font-bold text-on-surface leading-tight">{detail.name}</h1>
              <span className="font-sans text-xs text-outline">Last seen {ago(detail.lastSeen)} · last 30 days</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Time in app" value={duration(detail.activeSeconds)} />
              <Stat label="Looking at designs" value={duration(detail.dwellSeconds)} />
              <Stat label="Visits" value={String(detail.sessions)} />
              <Stat label="Designs seen" value={String(detail.productsViewed)} />
              <Stat label="Selected" value={String(detail.selections)} />
              <Stat label="Added to order" value={String(detail.addedToCart)} />
            </div>

            <section className="bg-white rounded-xl border border-outline-variant/40 p-3 flex flex-col gap-2">
              <h2 className="font-serif text-[15px] font-bold text-on-surface">Designs they spent time on</h2>
              {detail.products.length === 0 ? (
                <p className="text-xs text-outline">No design views recorded yet.</p>
              ) : (
                detail.products.map((p) => (
                  <div key={p.sku} className="flex items-center justify-between gap-2 text-xs font-sans">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-on-surface truncate">{p.title}</span>
                      <span className="font-mono text-[10px] text-outline">{p.sku}</span>
                    </div>
                    <span className="font-mono font-bold text-primary whitespace-nowrap">{duration(p.seconds)}</span>
                  </div>
                ))
              )}
            </section>

            <section className="bg-white rounded-xl border border-outline-variant/40 p-3 flex flex-col gap-2">
              <h2 className="font-serif text-[15px] font-bold text-on-surface">What they searched for</h2>
              {detail.searchTerms.length === 0 ? (
                <p className="text-xs text-outline">No searches yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.searchTerms.map((t) => (
                    <span key={t.term} className="px-2.5 py-1 rounded-full bg-surface-container text-xs font-sans text-on-surface">
                      {t.term}
                      {t.count > 1 ? ` ×${t.count}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl border border-outline-variant/40 p-3 flex flex-col gap-2">
              <h2 className="font-serif text-[15px] font-bold text-on-surface">Selected or added to order</h2>
              {detail.picked.length === 0 ? (
                <p className="text-xs text-outline">Nothing selected yet.</p>
              ) : (
                detail.picked.map((p) => (
                  <div key={p.sku} className="flex items-center justify-between text-xs font-sans">
                    <span className="font-semibold text-on-surface truncate">{p.title}</span>
                    <span className="font-mono text-outline whitespace-nowrap">{ago(p.lastAt)}</span>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 space-y-4">
      <div>
        <span className="font-mono text-[10px] text-primary font-bold tracking-wider uppercase">Buyer engagement</span>
        <h1 className="font-serif text-[22px] font-bold text-on-surface">Buyers</h1>
        <p className="font-sans text-xs text-outline">Tap a buyer to see which designs held their attention. Last 30 days, refreshed every 15 seconds.</p>
      </div>

      {error && <p className="text-xs text-error font-semibold">{error}</p>}
      {rows === null && !error && <p className="text-xs text-outline text-center py-8">Loading…</p>}
      {rows?.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center border border-outline-variant/40">
          <span className="material-symbols-outlined text-4xl text-outline">groups</span>
          <p className="text-xs text-outline mt-1">No one has been tracked yet. Buyers appear here once they sign in and browse.</p>
        </div>
      )}
      <div className="flex flex-col gap-2" data-testid="visitor-list">
        {rows?.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setOpenId(v.id)}
            className="text-left bg-white rounded-xl border border-outline-variant/40 p-3 flex items-center justify-between gap-3 active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-sm font-bold text-on-surface truncate">{v.name}</span>
              <span className="font-sans text-[11px] text-outline">
                {v.kind === 'guest' ? 'Guest · ' : ''}Seen {ago(v.lastSeen)}
              </span>
            </div>
            <div className="flex flex-col items-end font-mono text-[11px] text-on-surface whitespace-nowrap">
              <span className="font-bold text-primary">{duration(v.activeSeconds)} in app</span>
              <span className="text-outline">
                {v.productsViewed} seen · {v.searches} searches
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
