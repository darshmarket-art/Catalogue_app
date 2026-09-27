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

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({
  analytics,
  updatedAt,
  onNavigate,
  onOpenVisitors
}) => {
  const showGuests = merchant.catalogueAccess === 'public';
  const [downloading, setDownloading] = useState(false);
  const verifiedShare =
    analytics.todayVisitors > 0 ? Math.round((analytics.verifiedToday / analytics.todayVisitors) * 100) : 0;

  const handleExportCSV = () => {
    setDownloading(true);
    api
      .downloadAuditExport()
      .catch((err) => alert(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="flex flex-col w-full pb-32 max-w-xl mx-auto px-4 pt-3 space-y-4">
      {/* Title & Period Banner */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] text-primary font-bold tracking-wider uppercase">
            Catalogue Intelligence
          </span>
          <h1 className="font-serif text-[22px] font-bold text-on-surface tracking-tight">
            Admin Hub
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-mono text-xs font-bold shadow-2xs">
            {analytics.periodLabel}
          </span>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-sans text-[11px] font-medium">Views</span>
            <span className="material-symbols-outlined text-secondary text-[17px]">visibility</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-on-surface block leading-tight">
              {analytics.views.toLocaleString()}
            </span>
            <span className="font-mono text-[10px] text-secondary font-bold flex items-center gap-0.5 mt-0.5">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>
              {analytics.viewsTrend}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-sans text-[11px] font-medium">Inquiries</span>
            <span className="material-symbols-outlined text-primary text-[17px]">chat</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-primary block leading-tight">
              {analytics.inquiries}
            </span>
            <span className="font-sans text-[10px] text-outline truncate block mt-0.5">
              WhatsApp & PO
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline">
            <span className="font-sans text-[11px] font-medium">Booked</span>
            <span className="material-symbols-outlined text-primary-container text-[17px]">verified</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-on-surface block leading-tight">
              {analytics.bookedOrders}
            </span>
            <span className="font-mono text-[10px] text-outline font-semibold block mt-0.5">
              {analytics.bookedWeightKg.toFixed(3)} kg
            </span>
          </div>
        </div>
      </div>

      {/* Orders shortcut */}
      <button
        type="button"
        onClick={() => onNavigate('admin-orders')}
        className="w-full p-3.5 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex items-center justify-between text-left active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          </div>
          <div>
            <h2 className="font-serif text-[15px] text-on-surface font-bold leading-tight">Orders</h2>
            <p className="font-sans text-xs text-outline">Review and dispatch buyer orders</p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
            analytics.newOrders > 0 ? 'bg-primary-fixed text-on-tertiary-fixed' : 'bg-secondary-fixed text-on-secondary-fixed'
          }`}
        >
          {analytics.newOrders} New
        </span>
      </button>

      {/* Buyers shortcut */}
      <button
        type="button"
        onClick={() => onNavigate('admin-buyers')}
        className="w-full p-3.5 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex items-center justify-between text-left active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">groups</span>
          </div>
          <div>
            <h2 className="font-serif text-[15px] text-on-surface font-bold leading-tight">Buyers</h2>
            <p className="font-sans text-xs text-outline">See accounts and help with forgotten passwords</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-outline text-[20px]">chevron_right</span>
      </button>

      {/* Product Listing & Upload Action Card */}
      <div className="p-4 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
            </div>
            <div>
              <h2 className="font-serif text-[15px] text-on-surface font-bold leading-tight">
                Product Listing & Upload
              </h2>
              <p className="font-sans text-xs text-outline">
                Add designs to the live catalogue. Open any design to edit or delete it.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-mono text-[10px] font-bold">
            {analytics.pendingDrafts} Pending Drafts
          </span>
        </div>

        <button
          onClick={() => onNavigate('new-product')}
          className="py-3 px-3 rounded-lg bg-primary hover:bg-primary-container text-white font-sans text-xs font-semibold flex flex-col items-center justify-center gap-1 shadow-xs active:scale-95 transition-all text-center"
          type="button"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[19px]">add_a_photo</span>
            <span>Add a Design</span>
          </div>
          <span className="text-[10px] text-white/80 font-normal">Take or pick photos, then fill in the details</span>
        </button>

        <div className="pt-1 flex items-center justify-between border-t border-surface-container">
          <span className="text-xs text-outline font-sans">Need a new wholesale segment?</span>
          <button
            onClick={() => onNavigate('add-category')}
            className="text-xs text-primary font-sans font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">add_circle</span>
            <span>Add New Category</span>
          </button>
        </div>
      </div>

      {/* Visitor Engagement Card */}
      <div className="p-4 rounded-xl bg-white shadow-xs border border-outline-variant/40 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[20px]">timer</span>
              <h2 className="font-serif text-[15px] text-on-surface font-bold">Visitor Engagement</h2>
            </div>
            <p className="font-sans text-xs text-outline mt-0.5">
              Live sessions across {showGuests ? 'verified & guest buyers' : 'verified buyers'}, refreshed every 15 seconds{updatedAt ? ` • updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-secondary/15 text-secondary font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            Live ({analytics.liveVisitors} Online)
          </span>
        </div>

        <div className={`grid gap-2 ${showGuests ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            data-testid="block-all"
            onClick={() => onOpenVisitors('all')}
            className="text-left p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between active:scale-[0.98] transition-all"
          >
            <span className="text-[9px] font-sans text-outline uppercase tracking-wider font-semibold">
              Total Tracked
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-on-surface block leading-tight">
                {analytics.liveVisitors}{' '}
                <span className="text-[10px] text-outline font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-secondary font-semibold mt-0.5 block">
                {analytics.todayVisitors} Today
              </span>
            </div>
          </button>

          <button
            type="button"
            data-testid="block-verified"
            onClick={() => onOpenVisitors('verified')}
            className="text-left p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between active:scale-[0.98] transition-all"
          >
            <span className="text-[9px] font-sans text-primary uppercase tracking-wider font-semibold">
              Verified Merchants
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-primary block leading-tight">
                {analytics.verifiedMerchants}{' '}
                <span className="text-[10px] text-outline font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-primary font-semibold mt-0.5 block">
                {verifiedShare}% ({analytics.verifiedToday} Today)
              </span>
            </div>
          </button>

          {showGuests && (
          <button
            type="button"
            data-testid="block-guest"
            onClick={() => onOpenVisitors('guest')}
            className="text-left p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between active:scale-[0.98] transition-all"
          >
            <span className="text-[9px] font-sans text-tertiary uppercase tracking-wider font-semibold">
              Guest Retailers
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-tertiary block leading-tight">
                {analytics.guestRetailers}{' '}
                <span className="text-[10px] text-outline font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-tertiary font-semibold mt-0.5 block">
                {analytics.todayVisitors > 0 ? 100 - verifiedShare : 0}% ({Math.max(analytics.todayVisitors - analytics.verifiedToday, 0)} Today)
              </span>
            </div>
          </button>
          )}
        </div>
        <p className="font-sans text-[11px] text-outline">Tap a block to see each buyer's activity: designs viewed and for how long, searches and selections.</p>
      </div>

      {/* Export Visitor Audit */}
      <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[19px]">download</span>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold text-on-surface">Export Visitor Audit</h4>
            <p className="font-sans text-[11px] text-outline">
              Download CSV report with IP & session times
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={downloading}
          className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-sans text-xs font-semibold active:scale-95 transition-all border border-outline-variant"
          type="button"
        >
          {downloading ? 'Downloading...' : 'Export'}
        </button>
      </div>
    </div>
  );
};
