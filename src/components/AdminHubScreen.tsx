import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData, VisitorKind } from '../types';
import { api } from '../api';
import { merchant } from '../merchant';

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  updatedAt: Date | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenVisitors: (kind: VisitorKind) => void;
}

const card = 'bg-white rounded-2xl border border-outline-variant/40 shadow-xs';
const label = 'font-mono text-[10px] uppercase tracking-[0.14em] text-outline font-semibold';

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ analytics, updatedAt, onNavigate, onOpenVisitors }) => {
  const [downloading, setDownloading] = useState(false);
  const showGuests = merchant.catalogueAccess === 'public';

  // Split of who is online right now. A login-only catalogue has no guests, so it is all verified merchants.
  const online = showGuests ? analytics.verifiedMerchants + analytics.guestRetailers : analytics.verifiedMerchants;
  const verifiedPct = online > 0 ? Math.round((analytics.verifiedMerchants / online) * 100) : 0;
  const guestOnline = analytics.guestRetailers;
  const verifiedShareToday =
    analytics.todayVisitors > 0 ? Math.round((analytics.verifiedToday / analytics.todayVisitors) * 100) : 0;

  const handleExportCSV = () => {
    setDownloading(true);
    api
      .downloadAuditExport()
      .catch((err) => alert(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-4 space-y-4">
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
          <span className={label}>Catalogue management</span>
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
        <p className="font-sans text-[11px] text-outline -mt-1 text-center">Take or pick photos, then fill in the details. Open any design in the catalogue to edit or delete it.</p>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => onNavigate('add-category')}
            type="button"
            className="px-3.5 py-1.5 rounded-full border border-primary-container/50 bg-primary-fixed/20 text-primary font-sans text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[15px]">add_circle</span>
            Add Category
          </button>
          <button
            onClick={() => onNavigate('admin-orders')}
            type="button"
            className="px-3.5 py-1.5 rounded-full border border-outline-variant/60 bg-surface text-on-surface font-sans text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">receipt_long</span>
            Orders
            <span
              className={`px-1.5 py-px rounded-full font-mono text-[10px] ${
                analytics.newOrders > 0 ? 'bg-primary text-white' : 'bg-surface-container-high text-outline'
              }`}
            >
              {analytics.newOrders} new
            </span>
          </button>
          <button
            onClick={() => onNavigate('admin-buyers')}
            type="button"
            className="px-3.5 py-1.5 rounded-full border border-outline-variant/60 bg-surface text-on-surface font-sans text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">groups</span>
            Buyers
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

        {/* Verified vs guest split */}
        <div>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-container-high">
            <div className="bg-primary transition-all" style={{ width: `${online > 0 ? verifiedPct : 0}%` }} />
            {showGuests && <div className="bg-primary-container/40 transition-all" style={{ width: `${online > 0 ? 100 - verifiedPct : 0}%` }} />}
          </div>
          <div className="flex items-center justify-between mt-1.5 font-sans text-[11px] text-on-surface-variant">
            <span>
              <span className="font-mono font-bold text-primary">{analytics.verifiedMerchants}</span> verified {online > 0 ? `(${verifiedPct}%)` : ''}
            </span>
            {showGuests && (
              <span>
                <span className="font-mono font-bold text-on-surface">{guestOnline}</span> guest {online > 0 ? `(${100 - verifiedPct}%)` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Tap a segment to see who is behind it */}
        <div className={`grid gap-2 ${showGuests ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            data-testid="block-all"
            onClick={() => onOpenVisitors('all')}
            className="text-left p-3 rounded-xl bg-surface border border-outline-variant/40 flex flex-col active:scale-[0.98] transition-all"
          >
            <span className="text-[9px] font-sans text-outline uppercase tracking-wider font-semibold">Total Tracked</span>
            <span className="font-serif text-[20px] font-bold text-on-surface leading-tight mt-1">{analytics.todayVisitors}</span>
            <span className="font-mono text-[10px] text-secondary font-semibold">today · {analytics.liveVisitors} live</span>
          </button>

          <button
            type="button"
            data-testid="block-verified"
            onClick={() => onOpenVisitors('verified')}
            className="text-left p-3 rounded-xl bg-surface border border-outline-variant/40 flex flex-col active:scale-[0.98] transition-all"
          >
            <span className="text-[9px] font-sans text-primary uppercase tracking-wider font-semibold">Verified Merchants</span>
            <span className="font-serif text-[20px] font-bold text-primary leading-tight mt-1">{analytics.verifiedToday}</span>
            <span className="font-mono text-[10px] text-primary font-semibold">
              today · {verifiedShareToday}% · {analytics.verifiedMerchants} live
            </span>
          </button>

          {showGuests && (
            <button
              type="button"
              data-testid="block-guest"
              onClick={() => onOpenVisitors('guest')}
              className="text-left p-3 rounded-xl bg-surface border border-outline-variant/40 flex flex-col active:scale-[0.98] transition-all"
            >
              <span className="text-[9px] font-sans text-tertiary uppercase tracking-wider font-semibold">Guest Retailers</span>
              <span className="font-serif text-[20px] font-bold text-tertiary leading-tight mt-1">
                {Math.max(analytics.todayVisitors - analytics.verifiedToday, 0)}
              </span>
              <span className="font-mono text-[10px] text-tertiary font-semibold">
                today · {analytics.todayVisitors > 0 ? 100 - verifiedShareToday : 0}% · {guestOnline} live
              </span>
            </button>
          )}
        </div>
        <p className="font-sans text-[11px] text-outline -mt-1">
          Tap a block to see each buyer: designs viewed and for how long, searches and selections.
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
