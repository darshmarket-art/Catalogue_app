import React, { useState } from 'react';
import { ActiveScreen, AnalyticsData } from '../types';
import { api } from '../api';
import { trialDaysLeft } from '../../shared/trial';
import { OrderNotificationsToggle } from './OrderNotificationsToggle';
import { Notice } from './ui';
import { Icon } from '../layouts/emergent/ui';
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

/** The owner's home (Emergent atlas "Admin dashboard"): who is online, the trial, the week, what needs attention, and every tool. */
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

  const tiles: Array<{ icon: string; label: string; note: string; go: () => void; locked?: boolean; testId?: string }> = [
    { icon: 'package', label: 'Orders', note: flags.orders ? (analytics.newOrders > 0 ? `${analytics.newOrders} new` : 'All buyers') : 'Enquire on WhatsApp instead', go: () => onNavigate('orders'), locked: !flags.orders },
    { icon: 'users', label: 'Buyers', note: limits.users === null ? 'Signed-in buyers' : `Up to ${limits.users}`, go: () => onNavigate('admin-buyers') },
    { icon: 'act', label: 'Engagement', note: flags.liveVisitors ? `${analytics.todayVisitors} today · ${analytics.liveVisitors} online` : 'Pro feature', go: onOpenVisitors, testId: 'block-all', locked: !flags.liveVisitors },
    { icon: 'image', label: 'Banners', note: 'Photos on the home', go: () => onNavigate('admin-banners') },
    { icon: 'disc', label: 'Purity', note: 'Karat list for designs', go: () => onNavigate('admin-purities') },
    { icon: 'info', label: 'About us', note: 'Buyer-facing details', go: () => onNavigate('admin-about') },
    { icon: 'down', label: 'PDF catalogue', note: flags.pdfCatalogue ? 'Pick · share on WhatsApp' : 'Pro feature', go: () => onNavigate('admin-pdf'), locked: !flags.pdfCatalogue, testId: 'tile-pdf' },
    { icon: 'file', label: 'Audit log', note: flags.auditLog ? (downloading ? 'Downloading…' : 'Export CSV') : 'Pro feature', go: handleExportCSV, locked: !flags.auditLog },
    ...(!isPro || days === null ? [{ icon: 'award', label: 'Plan and usage', note: isPro ? 'Your plan' : 'See what Pro adds', go: () => onNavigate('admin-plan') }] : [])
  ];

  return (
    <div className="scroll" style={{ gap: 12 }}>
      {flags.liveVisitors && (
        <div className="em-chipbox" data-testid="live-chip">
          <i />
          <b>{analytics.liveVisitors} online now</b>
          <span className="em-mut">· {analytics.todayVisitors} visitors today</span>
        </div>
      )}

      {days !== null && (
        <button type="button" className="em-banner" data-testid="trial-banner" onClick={() => onNavigate('admin-plan')}>
          <span className="em-badge">
            <Icon n="award" />
          </span>
          <span className="em-grow">
            <span className="em-ey">Pro Trial</span>
            <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>
              {days} {days === 1 ? 'day' : 'days'} of Pro left. Then you move to Basic.
            </span>
          </span>
          <Icon n="next" className="em-chev" />
        </button>
      )}
      {trialEnded && (
        <button type="button" className="em-banner" onClick={() => onNavigate('admin-plan')}>
          <span className="em-badge">
            <Icon n="award" />
          </span>
          <span className="em-grow">
            <span className="em-ey">Pro trial ended</span>
            <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>Nothing was deleted.</span>
          </span>
          <Icon n="next" className="em-chev" />
        </button>
      )}

      {flags.insights ? (
        <div style={{ marginTop: 8 }}>
          <span className="em-ey">This week</span>
          <div className="em-metrics">
            <div className="em-metric">
              <div className="em-row em-sb">
                <span className="em-ey">kg booked</span>
                <Icon n="trend" size={14} />
              </div>
              <div>
                <span className="em-ser">{analytics.bookedWeightKg.toFixed(3)}</span>
                <b>
                  {analytics.bookedOrders} {analytics.bookedOrders === 1 ? 'order' : 'orders'}
                </b>
              </div>
            </div>
            <div className="em-metric dk">
              <div className="em-row em-sb">
                <span className="em-ey">Views</span>
                <Icon n="eye" size={14} />
              </div>
              <div>
                <span className="em-ser">{analytics.views.toLocaleString('en-IN')}</span>
                <b>
                  {analytics.inquiries} enq. · {analytics.viewsTrend}
                </b>
              </div>
            </div>
          </div>
        </div>
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
            <Icon n="lock" size={18} />
            <span className="em-grow">
              <b>Kg booked, views and enquiries</b>
            </span>
            <span className="pro">Pro</span>
          </button>
        </>
      )}

      {flags.orders && (
        <button type="button" className="em-alertrow" data-testid="new-orders-row" onClick={() => onNavigate('orders')}>
          <span className="em-badge">
            <Icon n="bell" />
          </span>
          <span className="em-grow">
            <span style={{ display: 'block', fontWeight: 500 }}>
              {analytics.newOrders > 0 ? `${analytics.newOrders} new ${analytics.newOrders === 1 ? 'order' : 'orders'} awaiting confirm` : 'No new orders waiting'}
            </span>
            <span className="em-mut" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
              Tap to open the orders desk
            </span>
          </span>
          <Icon n="right" size={18} />
        </button>
      )}

      {exportError && <Notice tone="error">{exportError}</Notice>}

      <OrderNotificationsToggle />

      <button type="button" className="em-primary-card" style={{ marginTop: 6 }} onClick={() => onNavigate('new-product')}>
        <span className="em-badge">
          <Icon n="plus" size={22} />
        </span>
        <span className="em-grow">
          <span className="em-ser" style={{ display: 'block', fontSize: 20 }}>
            New design
          </span>
          <small>Add to catalogue in under a minute</small>
        </span>
        <Icon n="right" size={20} className="em-chev" />
      </button>

      <div style={{ marginTop: 12 }}>
        <div className="em-rule" style={{ width: 40, margin: '0 0 8px' }} />
        <div className="em-h3" style={{ marginBottom: 14 }}>
          Manage
        </div>
        <div className="grid2" style={{ gap: 10 }}>
          {tiles.map((t) => (
            <button key={t.label} type="button" data-testid={t.testId} className={`tile${t.locked ? ' lk' : ''}`} onClick={t.locked ? () => upgradeNotice(t.label) : t.go}>
              <span className="em-tile-ico">
                <Icon n={t.icon} size={16} />
              </span>
              <span>
                <span className="em-tile-t">
                  {t.label}
                  {t.locked && (
                    <>
                      {' '}
                      <span className="pro">Pro</span>
                    </>
                  )}
                </span>
                <span className="em-tile-n">{t.note}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
