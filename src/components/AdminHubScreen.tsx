import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData } from '../types';
import { api } from '../api';
import { PageTitle, Notice } from './ui';
import { usePlan, ProBadge, upgradeNotice } from '../plan';

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  updatedAt: Date | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenVisitors: () => void;
}

/** The owner's home: how the week is going, what needs attention, and a shortcut to everything they manage. */
export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ analytics, updatedAt, onNavigate, onOpenVisitors }) => {
  const { flags } = usePlan();
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportCSV = () => {
    setDownloading(true);
    setExportError(null);
    api
      .downloadAuditExport()
      .catch((err) => setExportError(err.message || 'Could not download the audit log.'))
      .finally(() => setDownloading(false));
  };

  const shortcuts = [
    { label: 'Orders', note: analytics.newOrders > 0 ? `${analytics.newOrders} new` : 'All buyers', go: () => onNavigate('orders'), locked: !flags.orders },
    { label: 'Buyers', note: 'Accounts and passwords', go: () => onNavigate('admin-buyers') },
    { label: 'Buyer engagement', note: `${analytics.todayVisitors} today · ${analytics.liveVisitors} online`, go: onOpenVisitors, testId: 'block-all', locked: !flags.liveVisitors },
    { label: 'Home banners', note: 'Photos on the home', go: () => onNavigate('admin-banners') },
    { label: 'Purity options', note: 'Karat list for designs', go: () => onNavigate('admin-purities') },
    { label: 'About us', note: 'Your details for buyers', go: () => onNavigate('admin-about') },
    { label: 'Audit log', note: downloading ? 'Downloading…' : 'Export CSV', go: handleExportCSV, locked: !flags.auditLog }
  ].map((s) => (s.locked ? { ...s, note: 'Pro feature', go: () => upgradeNotice(s.label) } : s));

  return (
    <div className="flex flex-col w-full pb-32 max-w-2xl mx-auto">
      <PageTitle title="Admin" sub={`${analytics.periodLabel}${updatedAt ? ` · updated ${updatedAt.toLocaleTimeString('en-IN', { hour12: false })}` : ''}`} />

      {!flags.insights && (
        <button type="button" onClick={() => upgradeNotice('Kg booked, views and enquiries')} className="mx-5 mb-5 text-left rounded-2xl border border-dashed border-outline-variant px-4 py-3.5 font-sans text-[15px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] align-middle mr-1">monitoring</span>
          Kg booked, views and enquiries
          <ProBadge />
        </button>
      )}
      {flags.insights && <section className="px-5 mb-5">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[44px] leading-none text-primary">{analytics.bookedWeightKg.toFixed(3)}</span>
          <span className="font-sans text-base font-bold text-on-surface-variant">kg booked</span>
        </div>
        <p className="font-sans text-[15px] text-on-surface-variant mt-1">
          {analytics.bookedOrders} {analytics.bookedOrders === 1 ? 'order' : 'orders'} · views {analytics.viewsTrend}
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <span className="font-serif text-[28px] leading-none text-primary">{analytics.views.toLocaleString()}</span>
            <span className="block font-sans text-sm text-on-surface-variant mt-1">Catalogue views</span>
          </div>
          <div>
            <span className="font-serif text-[28px] leading-none text-primary">{analytics.inquiries}</span>
            <span className="block font-sans text-sm text-on-surface-variant mt-1">Inquiries (WhatsApp and orders)</span>
          </div>
        </div>
      </section>}

      <div className="px-5 flex flex-col gap-3">
        {analytics.newOrders > 0 && (
          <button type="button" onClick={() => onNavigate('orders')} className="text-left rounded-2xl bg-secondary-container px-4 py-3.5 text-on-secondary-container font-sans text-[15px]">
            <strong>
              {analytics.newOrders} new {analytics.newOrders === 1 ? 'order is' : 'orders are'}
            </strong>{' '}
            waiting for you to confirm.
          </button>
        )}
        {exportError && <Notice tone="error">{exportError}</Notice>}

        <button
          onClick={() => onNavigate('new-product')}
          type="button"
          className="w-full h-14 px-5 rounded-2xl bg-secondary hover:bg-secondary-dark text-on-secondary font-sans text-base font-extrabold flex items-center gap-3 active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[24px]">add</span>
          New design
        </button>

        <div className="grid grid-cols-2 gap-3">
          {shortcuts.map((item) => (
            <button
              key={item.label}
              type="button"
              data-testid={item.testId}
              onClick={item.go}
              className="text-left rounded-2xl bg-white border border-outline-variant px-4 py-3.5 min-h-[76px] active:scale-[0.98] transition-all"
            >
              <span className="block font-sans text-[15.5px] font-extrabold text-on-surface">
                {item.label}
                {item.locked && <ProBadge />}
              </span>
              <span className="block font-sans text-sm text-on-surface-variant mt-0.5">{item.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
