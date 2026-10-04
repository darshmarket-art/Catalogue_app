import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData } from '../types';
import { api } from '../api';
import { trialDaysLeft } from '../../shared/trial';
import { OrderNotificationsToggle } from './OrderNotificationsToggle';
import { I, Notice } from './ui';
import { usePlan, upgradeNotice } from '../plan';

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  /** Collections in the store, for the Basic usage meter. */
  categories: number;
  updatedAt: Date | null;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenVisitors: () => void;
}

const of = (used: number, limit: number | null) => (limit === null ? `${used} · unlimited` : `${used} of ${limit}`);
const pct = (used: number, limit: number | null) => (limit ? Math.min(100, Math.round((used / limit) * 100)) : 0);

/** The owner's home (artboard 3.1 on Pro, 4.1 on Basic): the week, what needs attention, and every tool. */
export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ analytics, categories, onNavigate, onOpenVisitors }) => {
  const ent = usePlan();
  const { flags, limits } = ent;
  const isPro = ent.effectivePlan === 'pro';
  const days = trialDaysLeft(ent);
  const trialEnded = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const usedCategories = ent.usage?.categories ?? categories;
  const usedPhotos = ent.usage?.photos ?? 0;

  const handleExportCSV = () => {
    setDownloading(true);
    setExportError(null);
    api
      .downloadAuditExport()
      .catch((err) => setExportError(err.message || 'Could not download the audit log.'))
      .finally(() => setDownloading(false));
  };

  const tiles: Array<{ label: string; note: string; go: () => void; locked?: boolean; testId?: string }> = [
    { label: 'Orders', note: flags.orders ? (analytics.newOrders > 0 ? `${analytics.newOrders} new` : 'All buyers') : 'Enquire on WhatsApp instead', go: () => onNavigate('orders'), locked: !flags.orders },
    { label: 'Buyers', note: limits.users === null ? 'Signed-in buyers' : `Up to ${limits.users}`, go: () => onNavigate('admin-buyers') },
    { label: 'Buyer engagement', note: flags.liveVisitors ? `${analytics.todayVisitors} today · ${analytics.liveVisitors} online` : 'Pro feature', go: onOpenVisitors, testId: 'block-all', locked: !flags.liveVisitors },
    { label: 'Home banners', note: 'Photos on the home', go: () => onNavigate('admin-banners') },
    { label: 'Purity options', note: 'Karat list for designs', go: () => onNavigate('admin-purities') },
    { label: 'About us', note: 'Your details for buyers', go: () => onNavigate('admin-about') },
    ...(isPro ? [{ label: 'PDF catalogue', note: 'Pick designs, download', go: () => onNavigate('catalogue'), locked: !flags.pdfCatalogue }] : []),
    { label: 'Audit log', note: flags.auditLog ? (downloading ? 'Downloading…' : 'Export CSV') : 'Pro feature', go: handleExportCSV, locked: !flags.auditLog },
    ...(!isPro || days === null ? [{ label: 'Plan and usage', note: isPro ? 'Your plan' : 'See what Pro adds', go: () => onNavigate('admin-plan') }] : [])
  ];

  return (
    <div className="scroll" style={{ gap: 12 }}>
      {flags.insights ? (
        <section className="hero" style={{ padding: '18px 18px 16px' }}>
          <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
            <span className="stat" style={{ fontSize: 44, color: '#fff7ea' }}>
              {analytics.bookedWeightKg.toFixed(3)}
            </span>
            <b style={{ color: '#e2c389' }}>kg booked</b>
          </div>
          <p className="sub" style={{ fontSize: 13, margin: '4px 0 14px' }}>
            {analytics.bookedOrders} {analytics.bookedOrders === 1 ? 'order' : 'orders'} · views {analytics.viewsTrend}
          </p>
          <div className="row" style={{ gap: 0, borderTop: '1px solid rgb(226 195 137 / 0.3)', paddingTop: 12 }}>
            <div className="grow">
              <span className="stat" style={{ fontSize: 22, color: '#fff7ea' }}>
                {analytics.views.toLocaleString('en-IN')}
              </span>
              <span className="sub" style={{ display: 'block', fontSize: 12.5 }}>
                Catalogue views
              </span>
            </div>
            <div className="grow" style={{ borderLeft: '1px solid rgb(226 195 137 / 0.3)', paddingLeft: 14 }}>
              <span className="stat" style={{ fontSize: 22, color: '#fff7ea' }}>
                {analytics.inquiries}
              </span>
              <span className="sub" style={{ display: 'block', fontSize: 12.5 }}>
                Enquiries and orders
              </span>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div className="kv">
              <span>Collections</span>
              <b>{of(usedCategories, limits.categories)}</b>
            </div>
            {limits.categories !== null && (
              <div className={`meter${usedCategories >= limits.categories ? ' over' : ''}`} style={{ margin: '6px 0 10px' }}>
                <i style={{ width: `${pct(usedCategories, limits.categories)}%` }} />
              </div>
            )}
            <div className="kv">
              <span>Photos</span>
              <b>{of(usedPhotos, limits.photos)}</b>
            </div>
            {limits.photos !== null && (
              <div className={`meter${usedPhotos >= limits.photos ? ' over' : ''}`} style={{ marginTop: 6 }}>
                <i style={{ width: `${pct(usedPhotos, limits.photos)}%` }} />
              </div>
            )}
          </div>
          <button type="button" className="lockbox" onClick={() => upgradeNotice('Kg booked, views and enquiries')}>
            <I n="lock" />
            <span className="grow">
              <b style={{ color: 'var(--ink)' }}>Kg booked, views and enquiries</b>
            </span>
            <span className="pro">Pro</span>
          </button>
        </>
      )}

      {days !== null && (
        <button type="button" className="note row" style={{ padding: '11px 14px' }} onClick={() => onNavigate('admin-plan')}>
          <I n="clock" size="s" />
          <span className="grow">
            <b>
              {days} {days === 1 ? 'day' : 'days'} of Pro left.
            </b>{' '}
            Then you move to Basic.
          </span>
          <I n="chev" size="s" />
        </button>
      )}
      {trialEnded && (
        <button type="button" className="note warn row" style={{ padding: '11px 14px' }} onClick={() => onNavigate('admin-plan')}>
          <I n="sparkle" size="s" />
          <span className="grow">
            <b>Your Pro trial has ended.</b> Nothing was deleted.
          </span>
          <I n="chev" size="s" />
        </button>
      )}

      {analytics.newOrders > 0 && flags.orders && (
        <button type="button" className="card row" style={{ padding: '11px 14px' }} onClick={() => onNavigate('orders')}>
          <span className="badge" style={{ position: 'static', minWidth: 24, height: 24, fontSize: 12 }}>
            {analytics.newOrders}
          </span>
          <span className="grow">
            <b>New {analytics.newOrders === 1 ? 'order' : 'orders'}</b> waiting to be confirmed
          </span>
          <I n="chev" size="s" style={{ color: 'var(--mut)' }} />
        </button>
      )}

      {exportError && <Notice tone="error">{exportError}</Notice>}

      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn" style={{ flex: 1 }} onClick={() => onNavigate('new-product')}>
          <I n="plus" />
          New design
        </button>
        <OrderNotificationsToggle />
      </div>

      <div className="grid2" style={{ gap: 10 }}>
        {tiles.map((t) => (
          <button key={t.label} type="button" data-testid={t.testId} className={`tile${t.locked ? ' lk' : ''}`} onClick={t.locked ? () => upgradeNotice(t.label) : t.go}>
            <b>
              {t.label}
              {t.locked && (
                <>
                  {' '}
                  <span className="pro">Pro</span>
                </>
              )}
            </b>
            <span>{t.note}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
