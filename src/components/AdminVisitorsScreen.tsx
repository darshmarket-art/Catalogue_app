import React, { useEffect, useState } from 'react';
import { VisitorDetail, VisitorSummary } from '../types';
import { api } from '../api';
import { PageTitle, Notice, btnLink } from './ui';

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
  <div className="flex flex-col">
    <span className="font-serif text-[26px] leading-none text-primary">{value}</span>
    <span className="font-sans text-sm text-on-surface-variant mt-1">{label}</span>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <h2 className="font-serif text-[22px] text-primary mt-6 mb-2 px-5">{children}</h2>;

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
      <div className="flex flex-col w-full pb-32 max-w-xl mx-auto">
        <div className="px-2 pt-1">
          <button onClick={() => setOpenId(null)} className={btnLink}>
            &larr; All buyers
          </button>
        </div>
        {!detail ? (
          <p className="font-sans text-sm text-outline text-center py-10">{error ?? 'Loading…'}</p>
        ) : (
          <>
            <PageTitle title={detail.name} sub={`${detail.kind === 'verified' ? 'Buyer' : 'Guest visitor'} · last seen ${ago(detail.lastSeen)} · last 30 days`} />

            <div className="grid grid-cols-3 gap-y-5 gap-x-3 px-5">
              <Stat label="Time in app" value={duration(detail.activeSeconds)} />
              <Stat label="Looking at designs" value={duration(detail.dwellSeconds)} />
              <Stat label="Visits" value={String(detail.sessions)} />
              <Stat label="Designs seen" value={String(detail.productsViewed)} />
              <Stat label="Hearted" value={String(detail.selections)} />
              <Stat label="Added to order" value={String(detail.addedToCart)} />
            </div>

            <SectionTitle>Designs they spent time on</SectionTitle>
            {detail.products.length === 0 ? (
              <p className="font-sans text-[15px] text-on-surface-variant px-5">No design views recorded yet.</p>
            ) : (
              <ul>
                {detail.products.map((pr) => (
                  <li key={pr.sku} className="flex items-center justify-between gap-3 px-5 py-3 border-b border-surface-container">
                    <div className="min-w-0">
                      <p className="font-sans text-[15.5px] font-bold text-on-surface truncate">{pr.title}</p>
                      <p className="font-sans text-sm text-on-surface-variant">{pr.sku}</p>
                    </div>
                    <span className="font-sans text-[15px] font-extrabold text-primary whitespace-nowrap">{duration(pr.seconds)}</span>
                  </li>
                ))}
              </ul>
            )}

            <SectionTitle>What they searched for</SectionTitle>
            {detail.searchTerms.length === 0 ? (
              <p className="font-sans text-[15px] text-on-surface-variant px-5">No searches yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 px-5">
                {detail.searchTerms.map((t) => (
                  <span key={t.term} className="px-4 py-2 rounded-full bg-white border-[1.5px] border-outline-variant font-sans text-sm font-bold text-on-surface">
                    {t.term}
                    {t.count > 1 ? ` ×${t.count}` : ''}
                  </span>
                ))}
              </div>
            )}

            <SectionTitle>Hearted or added to order</SectionTitle>
            {detail.picked.length === 0 ? (
              <p className="font-sans text-[15px] text-on-surface-variant px-5">Nothing yet.</p>
            ) : (
              <ul>
                {detail.picked.map((pr) => (
                  <li key={pr.sku} className="flex items-center justify-between gap-3 px-5 py-3 border-b border-surface-container">
                    <span className="font-sans text-[15.5px] font-bold text-on-surface truncate">{pr.title}</span>
                    <span className="font-sans text-sm text-on-surface-variant whitespace-nowrap">{ago(pr.lastAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto">
      <PageTitle title="Buyer engagement" sub="Tap a buyer to see which designs held their attention. Last 30 days, refreshed every 15 seconds." />

      <div className="px-5">{error && <Notice tone="error">{error}</Notice>}</div>
      {rows === null && !error && <p className="font-sans text-sm text-outline text-center py-8">Loading…</p>}
      {rows?.length === 0 && (
        <div className="flex flex-col items-center text-center gap-2 px-8 pt-10">
          <span className="material-symbols-outlined text-[44px] text-primary-fixed-dim">groups</span>
          <p className="font-sans text-[15px] text-on-surface-variant">No one has been tracked yet. Buyers appear here once they sign in and browse.</p>
        </div>
      )}
      <ul className="flex flex-col" data-testid="visitor-list">
        {rows?.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => setOpenId(v.id)}
              className="w-full text-left grid grid-cols-[48px_1fr_auto] items-center gap-3 px-5 py-3 border-b border-surface-container active:bg-surface-container-low"
            >
              <span className="w-12 h-12 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-sans text-lg font-extrabold">
                {v.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-sans text-[15.5px] font-bold text-on-surface truncate">{v.name}</p>
                <p className="font-sans text-sm text-on-surface-variant">
                  {v.kind === 'guest' ? 'Guest · ' : ''}Seen {ago(v.lastSeen)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-sans text-[15px] font-extrabold text-primary whitespace-nowrap">{duration(v.activeSeconds)}</p>
                <p className="font-sans text-sm text-on-surface-variant whitespace-nowrap">
                  {v.productsViewed} seen · {v.searches} searches
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
