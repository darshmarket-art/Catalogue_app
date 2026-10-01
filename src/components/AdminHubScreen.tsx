import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData } from '../types';
import { api } from '../api';

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  updatedAt: Date | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenVisitors: () => void;
}

const card = 'bg-white rounded-2xl border border-outline-variant/40 shadow-xs';
const label = 'font-mono text-[10px] uppercase tracking-[0.14em] text-outline font-semibold';

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ analytics, updatedAt, onNavigate, onOpenVisitors }) => {
  const [downloading, setDownloading] = useState(false);
  const handleExportCSV = () => {
    setDownloading(true);
    api
      .downloadAuditExport()
      .catch((err) => alert(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl md:max-w-3xl mx-auto px-4 pt-4 space-y-4">
      {/* Executive summary */}
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between">
          <span className={label}>Executive summary</span>
          <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed/50 text-primary font-mono text-[10px] font-bold">{analytics.periodLabel}</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-serif text-[34px] leading-none font-bold text-on-surface tracking-tight">
              {analytics.bookedWeightKg.toFixed(3)}
              <span className="text-base font-normal text-outline ml-1">kg</span>
            </div>
            <div className="font-sans text-xs text-outline mt-1">
              net weight booked · {analytics.bookedOrders} {analytics.bookedOrders === 1 ? 'order' : 'orders'}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary-container/70 text-secondary font-mono text-[11px] font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {analytics.viewsTrend}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-primary-container/30 grid grid-cols-2 divide-x divide-primary-container/30">
          <div className="pr-4">
            <span className={label}>Catalogue views</span>
            <div className="font-serif text-[24px] font-bold text-on-surface leading-tight mt-0.5">{analytics.views.toLocaleString()}</div>
          </div>
          <div className="pl-4">
            <span className={label}>Inquiries</span>
            <div className="font-serif text-[24px] font-bold text-on-surface leading-tight mt-0.5">{analytics.inquiries}</div>
            <span className="font-sans text-[10px] text-outline">WhatsApp & PO</span>
          </div>
        </div>
      </section>

      {/* Catalogue management */}
      <section className={`${card} p-5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2">
          <span className={label}>Product management</span>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold">
            {analytics.pendingDrafts} {analytics.pendingDrafts === 1 ? 'draft' : 'drafts'} pending
          </span>
        </div>

        <button
          onClick={() => onNavigate('new-product')}
          type="button"
          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-container text-white font-sans text-sm font-semibold flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          New Product Listing
        </button>
        <p className="font-sans text-[11px] text-outline -mt-1 text-center">Take or pick photos, then fill in the details. Open any product to edit or delete it.</p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => onNavigate('admin-buyers')}
            type="button"
            className="px-3.5 py-1.5 rounded-full border border-outline-variant/60 bg-surface text-on-surface font-sans text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">groups</span>
            Buyers
          </button>
          <button
            onClick={() => onNavigate('admin-banners')}
            type="button"
            className="px-3.5 py-1.5 rounded-full border border-outline-variant/60 bg-surface text-on-surface font-sans text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">view_carousel</span>
            Home banners
          </button>
        </div>
      </section>

      {/* Live buyer engagement */}
      <section className={`${card} p-5 flex flex-col gap-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className={label}>Buyer engagement</span>
            <span className="font-sans text-[11px] text-outline mt-0.5">
              Refreshed every 15 seconds{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary/12 text-secondary font-mono text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            {analytics.liveVisitors} Online Now
          </span>
        </div>

        {/* One box for every buyer; tap to see who they are */}
        <button
          type="button"
          data-testid="block-all"
          onClick={() => onOpenVisitors()}
          className="text-left p-4 rounded-xl bg-surface border border-outline-variant/40 flex items-center justify-between gap-3 active:scale-[0.99] transition-all"
        >
          <div className="flex flex-col">
            <span className="text-[11px] font-sans text-primary uppercase tracking-wider font-semibold">Buyers</span>
            <span className="font-serif text-[26px] font-bold text-on-surface leading-tight mt-0.5">{analytics.todayVisitors}</span>
            <span className="font-mono text-[11px] text-secondary font-semibold">today · {analytics.liveVisitors} online now</span>
          </div>
          <span className="material-symbols-outlined text-[22px] text-outline">chevron_right</span>
        </button>
        <p className="font-sans text-[11px] text-outline -mt-1">
          Tap to see each buyer: designs viewed and for how long, searches and selections.
        </p>

        <div className="pt-3 border-t border-primary-container/30 flex items-center justify-between">
          <span className="font-sans text-[11px] text-outline">Audit ledger with IP and session times</span>
          <button
            onClick={handleExportCSV}
            disabled={downloading}
            type="button"
            className="px-3 py-1.5 rounded-full border border-primary-container/50 text-primary font-sans text-xs font-bold flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            {downloading ? 'Downloading...' : 'Export Audit Log (CSV)'}
          </button>
        </div>
      </section>
    </div>
  );
};
