import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData } from '../types';
import { api } from '../api';

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  updatedAt: Date | null;
  onNavigate: (screen: ActiveScreen) => void;
}

export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({
  analytics,
  updatedAt,
  onNavigate
}) => {
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
          <span className="font-mono text-[10px] text-[#715509] font-bold tracking-wider uppercase">
            Catalogue Intelligence
          </span>
          <h1 className="font-serif text-[22px] font-bold text-[#1c1c1a] tracking-tight">
            Admin Hub
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded bg-[#caeada] text-[#032017] font-mono text-xs font-bold shadow-2xs">
            {analytics.periodLabel}
          </span>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-white shadow-xs border border-[#d1c5b3]/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7f7666]">
            <span className="font-sans text-[11px] font-medium">Views</span>
            <span className="material-symbols-outlined text-[#486458] text-[17px]">visibility</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-[#1c1c1a] block leading-tight">
              {analytics.views.toLocaleString()}
            </span>
            <span className="font-mono text-[10px] text-[#486458] font-bold flex items-center gap-0.5 mt-0.5">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>
              {analytics.viewsTrend}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white shadow-xs border border-[#d1c5b3]/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7f7666]">
            <span className="font-sans text-[11px] font-medium">Inquiries</span>
            <span className="material-symbols-outlined text-[#715509] text-[17px]">chat</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-[#715509] block leading-tight">
              {analytics.inquiries}
            </span>
            <span className="font-sans text-[10px] text-[#7f7666] truncate block mt-0.5">
              WhatsApp & PO
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white shadow-xs border border-[#d1c5b3]/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#7f7666]">
            <span className="font-sans text-[11px] font-medium">Booked</span>
            <span className="material-symbols-outlined text-[#8c6d23] text-[17px]">verified</span>
          </div>
          <div className="mt-1">
            <span className="font-mono text-[16px] font-bold text-[#1c1c1a] block leading-tight">
              {analytics.bookedOrders}
            </span>
            <span className="font-mono text-[10px] text-[#7f7666] font-semibold block mt-0.5">
              {analytics.bookedWeightKg.toFixed(3)} kg
            </span>
          </div>
        </div>
      </div>

      {/* Product Listing & Upload Action Card */}
      <div className="p-4 rounded-xl bg-white shadow-xs border border-[#d1c5b3]/40 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#715509]/10 flex items-center justify-center text-[#715509] flex-shrink-0">
              <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
            </div>
            <div>
              <h2 className="font-serif text-[15px] text-[#1c1c1a] font-bold leading-tight">
                Product Listing & Upload
              </h2>
              <p className="font-sans text-xs text-[#7f7666]">
                Upload category designs directly to live B2B catalogue
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#caeada] text-[#032017] font-mono text-[10px] font-bold">
            {analytics.pendingDrafts} Pending Drafts
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onNavigate('new-product')}
            className="py-3 px-3 rounded-lg bg-[#715509] hover:bg-[#8c6d23] text-white font-sans text-xs font-semibold flex flex-col items-center justify-center gap-1 shadow-xs active:scale-95 transition-all text-center"
            type="button"
          >
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[19px]">photo_camera</span>
              <span>Take Photo</span>
            </div>
            <span className="text-[10px] text-white/80 font-normal">AI Karat & Edge Detect</span>
          </button>

          <button
            onClick={() => onNavigate('new-product')}
            className="py-3 px-3 rounded-lg bg-[#f0edea] hover:bg-[#ebe8e4] text-[#1c1c1a] font-sans text-xs font-semibold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all text-center border border-[#d1c5b3]/40"
            type="button"
          >
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#715509] text-[19px]">collections</span>
              <span>Select from Gallery</span>
            </div>
            <span className="text-[10px] text-[#7f7666] font-normal">Bulk Batch Upload</span>
          </button>
        </div>

        <div className="pt-1 flex items-center justify-between border-t border-[#f0edea]">
          <span className="text-xs text-[#7f7666] font-sans">Need a new wholesale segment?</span>
          <button
            onClick={() => onNavigate('add-category')}
            className="text-xs text-[#715509] font-sans font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">add_circle</span>
            <span>Add New Category</span>
          </button>
        </div>
      </div>

      {/* Visitor Engagement Card */}
      <div className="p-4 rounded-xl bg-white shadow-xs border border-[#d1c5b3]/40 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#486458] text-[20px]">timer</span>
              <h2 className="font-serif text-[15px] text-[#1c1c1a] font-bold">Visitor Engagement</h2>
            </div>
            <p className="font-sans text-xs text-[#7f7666] mt-0.5">
              Live sessions across verified & guest buyers, refreshed every 15 seconds{updatedAt ? ` • updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#486458]/15 text-[#486458] font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#486458] animate-pulse"></span>
            Live ({analytics.liveVisitors} Online)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-[#f6f3ef] border border-[#d1c5b3]/30 flex flex-col justify-between">
            <span className="text-[9px] font-sans text-[#7f7666] uppercase tracking-wider font-semibold">
              Total Tracked
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-[#1c1c1a] block leading-tight">
                {analytics.liveVisitors}{' '}
                <span className="text-[10px] text-[#7f7666] font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-[#486458] font-semibold mt-0.5 block">
                {analytics.todayVisitors} Today
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#f6f3ef] border border-[#d1c5b3]/30 flex flex-col justify-between">
            <span className="text-[9px] font-sans text-[#715509] uppercase tracking-wider font-semibold">
              Verified Merchants
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-[#715509] block leading-tight">
                {analytics.verifiedMerchants}{' '}
                <span className="text-[10px] text-[#7f7666] font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-[#715509] font-semibold mt-0.5 block">
                {verifiedShare}% ({analytics.verifiedToday} Today)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#f6f3ef] border border-[#d1c5b3]/30 flex flex-col justify-between">
            <span className="text-[9px] font-sans text-[#775300] uppercase tracking-wider font-semibold">
              Guest Retailers
            </span>
            <div className="mt-1">
              <span className="font-mono text-[14px] font-bold text-[#775300] block leading-tight">
                {analytics.guestRetailers}{' '}
                <span className="text-[10px] text-[#7f7666] font-normal">Live</span>
              </span>
              <span className="font-mono text-[9px] text-[#775300] font-semibold mt-0.5 block">
                {analytics.todayVisitors > 0 ? 100 - verifiedShare : 0}% ({Math.max(analytics.todayVisitors - analytics.verifiedToday, 0)} Today)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Export Visitor Audit */}
      <div className="p-3.5 rounded-xl bg-[#f6f3ef] border border-[#d1c5b3]/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#715509]/10 flex items-center justify-center text-[#715509]">
            <span className="material-symbols-outlined text-[19px]">download</span>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold text-[#1c1c1a]">Export Visitor Audit</h4>
            <p className="font-sans text-[11px] text-[#7f7666]">
              Download CSV report with IP & session times
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={downloading}
          className="px-3 py-1.5 rounded-lg bg-[#ebe8e4] hover:bg-[#e5e2de] text-[#1c1c1a] font-sans text-xs font-semibold active:scale-95 transition-all border border-[#d1c5b3]"
          type="button"
        >
          {downloading ? 'Downloading...' : 'Export'}
        </button>
      </div>
    </div>
  );
};
