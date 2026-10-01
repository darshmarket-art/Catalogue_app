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
const label = 'font-mono text-xs uppercase tracking-[0.14em] text-outline font-semibold';

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
          <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed/50 text-primary font-mono text-xs font-bold">{analytics.periodLabel}</span>
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
          <span className="px-2.5 py-1 rounded-full bg-secondary-container/70 text-secondary font-mono text-xs font-bold flex items-center gap-1">
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
            <span className="font-sans text-xs text-outline">WhatsApp & PO</span>
          </div>
        </div>
      </section>

      {/* Orders waiting, then shortcuts to everything the owner manages */}
      {analytics.newOrders > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className="w-full text-left flex items-center justify-between gap-3 rounded-2xl bg-secondary-container px-4 py-3 text-on-secondary-container"
        >
          <span className="font-sans text-sm">
            <strong>
              {analytics.newOrders} new {analytics.newOrders === 1 ? 'order is' : 'orders are'}
            </strong>{' '}
            waiting for you to confirm.
          </span>
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      )}

      <section className="flex flex-col gap-3">
        <button
          onClick={() => onNavigate('new-product')}
          type="button"
          className="w-full min-h-14 px-4 rounded-2xl bg-primary hover:bg-primary-container text-white font-sans text-base font-extrabold flex items-center gap-3 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[24px]">add</span>
          New product listing
        </button>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Orders', note: analytics.newOrders > 0 ? `${analytics.newOrders} new` : 'All buyers', go: () => onNavigate('orders') },
            { label: 'Buyers', note: `${analytics.todayVisitors} today · ${analytics.liveVisitors} online`, go: () => onNavigate('admin-buyers') },
            { label: 'Home banners', note: 'Photos on the home', go: () => onNavigate('admin-banners') },
            { label: 'Purity options', note: 'Karat list for products', go: () => onNavigate('admin-purities') },
            { label: 'Audit log', note: downloading ? 'Downloading…' : 'Export CSV', go: handleExportCSV }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.go}
              className="text-left rounded-2xl bg-white border border-outline-variant px-4 py-3.5 min-h-[72px] active:scale-[0.98] transition-all"
            >
              <span className="block font-sans text-[15px] font-extrabold text-on-surface">{item.label}</span>
              <span className="block font-sans text-sm text-on-surface-variant mt-0.5">{item.note}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Live buyer engagement */}
      <section className={`${card} p-5 flex flex-col gap-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className={label}>Buyer engagement</span>
            <span className="font-sans text-xs text-outline mt-0.5">
              Refreshed every 15 seconds{updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary/12 text-secondary font-mono text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
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
            <span className="text-xs font-sans text-primary uppercase tracking-wider font-semibold">Buyers</span>
            <span className="font-serif text-[26px] font-bold text-on-surface leading-tight mt-0.5">{analytics.todayVisitors}</span>
            <span className="font-mono text-xs text-secondary font-semibold">today · {analytics.liveVisitors} online now</span>
          </div>
          <span className="material-symbols-outlined text-[22px] text-outline">chevron_right</span>
        </button>
        <p className="font-sans text-xs text-outline -mt-1">
          Tap to see each buyer: designs viewed and for how long, searches and selections.
        </p>

        <div className="pt-3 border-t border-primary-container/30 flex items-center justify-between">
          <span className="font-sans text-xs text-outline">Audit ledger with IP and session times</span>
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
