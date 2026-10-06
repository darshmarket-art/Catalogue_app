import React from 'react';
import { ActiveScreen, AdminSummary, AnalyticsData, About } from '../types';
import { trialDaysLeft } from '../../shared/trial';
import { Icon, Title } from '../layouts/emergent/ui';
import { usePlan, upgradeNotice } from '../plan';
import { merchant } from '../merchant';

export type OpenTarget = { screen: 'orders'; filter?: 'new' } | { screen: 'catalogue'; segment?: 'designs' | 'collections' | 'banners' | 'purities' } | { screen: 'admin-buyers'; segment?: 'buyers' | 'enquiries' | 'activity' };

interface AdminHubScreenProps {
  analytics: AnalyticsData;
  summary: AdminSummary;
  collections: number;
  designs: number;
  banners: number;
  about: About;
  onNavigate: (screen: ActiveScreen) => void;
  onOpen: (target: OpenTarget) => void;
  onShare: () => void;
}

const of = (used: number, limit: number | null) => (limit === null ? `${used} · unlimited` : `${used} of ${limit}`);
const pct = (used: number, limit: number | null) => (limit ? Math.min(100, Math.round((used / limit) * 100)) : 0);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** Today: what is waiting for the owner first, then the week, then the shortcuts. Counts come from the server (summary) so the tab badges agree. */
export const AdminHubScreen: React.FC<AdminHubScreenProps> = ({ analytics, summary, collections, designs, banners, about, onNavigate, onOpen, onShare }) => {
  const ent = usePlan();
  const { flags, limits } = ent;
  const isPro = ent.effectivePlan === 'pro';
  const days = trialDaysLeft(ent);
  const trialEnded = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  const usedCategories = ent.usage?.categories ?? collections;
  const usedPhotos = ent.usage?.photos ?? 0;

  const waiting: Array<{ key: string; n: number; title: string; note: string; hot: boolean; go: () => void; testId: string }> = [
    ...(flags.orders && summary.newOrders > 0 ? [{ key: 'orders', n: summary.newOrders, title: summary.newOrders === 1 ? 'New order to confirm' : 'New orders to confirm', note: 'Confirm, or call the buyer first', hot: true, go: () => onOpen({ screen: 'orders', filter: 'new' }), testId: 'need-orders' }] : []),
    ...(flags.enquiries && summary.enquiriesWaiting > 0 ? [{ key: 'enq', n: summary.enquiriesWaiting, title: summary.enquiriesWaiting === 1 ? 'WhatsApp enquiry to answer' : 'WhatsApp enquiries to answer', note: 'Reply to the buyer in one tap', hot: true, go: () => onOpen({ screen: 'admin-buyers', segment: 'enquiries' }), testId: 'need-enquiries' }] : []),
    ...(summary.messagesFailed > 0 ? [{ key: 'msg', n: summary.messagesFailed, title: summary.messagesFailed === 1 ? 'WhatsApp message failed' : 'WhatsApp messages failed', note: 'Sign-in codes or alerts that did not arrive', hot: false, go: () => onNavigate('admin-messages'), testId: 'need-messages' }] : [])
  ];

  const hasAbout = Boolean(about.story || about.ownerName || about.address || about.phone);
  const checklist = [
    { done: collections > 0, label: 'Add your first collection', go: () => onNavigate('add-category') },
    { done: designs > 0, label: 'Add your first design', go: () => onNavigate('new-product') },
    { done: banners > 0, label: 'Add a home banner', go: () => onOpen({ screen: 'catalogue', segment: 'banners' }) },
    { done: hasAbout, label: 'Fill in About us', go: () => onNavigate('admin-about') }
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  const tiles: Array<{ icon: string; label: string; note: string; go: () => void; locked?: boolean; testId: string }> = [
    { icon: 'layers', label: 'New collection', note: 'Group designs for buyers', go: () => onNavigate('add-category'), testId: 'tile-new-collection' },
    { icon: 'share', label: 'Share store', note: 'Link and QR for buyers', go: onShare, testId: 'tile-share' },
    { icon: 'down', label: 'PDF catalogue', note: flags.pdfCatalogue ? 'Pick · share on WhatsApp' : 'Pro feature', go: () => onNavigate('admin-pdf'), locked: !flags.pdfCatalogue, testId: 'tile-pdf' },
    { icon: 'trend', label: 'Insights', note: flags.insights ? 'Views, orders, buyers' : 'Pro feature', go: () => onNavigate('admin-insights'), locked: !flags.insights, testId: 'tile-insights' }
  ];

  return (
    <div className="em-page" data-testid="admin-today">
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Title eyebrow={`${greeting()} · ${merchant.brand.name}`} title="Today" right={isPro ? <span className="pro dark" style={{ marginBottom: 8 }}>Pro</span> : <span className="tag mut" style={{ marginBottom: 8 }}>Basic</span>} />

        {flags.liveVisitors && (
          <div className="em-chipbox" data-testid="live-chip">
            <i />
            <b>{analytics.liveVisitors} online now</b>
            <span className="em-mut">· {analytics.todayVisitors} visitors today</span>
          </div>
        )}

        {days !== null && (
          <button type="button" className={`em-banner${days <= 3 ? ' urgent' : ''}`} data-testid="trial-banner" onClick={() => onNavigate('admin-plan')}>
            <span className="em-badge">
              <Icon n={days <= 3 ? 'clock' : 'award'} />
            </span>
            <span className="em-grow">
              <span className="em-ey">{days <= 3 ? 'Pro trial ending soon' : 'Pro Trial'}</span>
              <span style={{ display: 'block', fontSize: 14, marginTop: 2 }}>
                {days} {days === 1 ? 'day' : 'days'} of Pro left. {days <= 3 ? 'Upgrade to keep orders, insights and PDF.' : 'Then you move to Basic.'}
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

        <div className="em-ey" style={{ marginTop: 4 }}>Needs you</div>
        {waiting.length > 0 ? (
          <div data-testid="needs-you" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {waiting.map((w) => (
              <button key={w.key} type="button" className="em-alertrow" data-testid={w.testId} style={w.hot ? undefined : { borderColor: 'var(--em-line)' }} onClick={w.go}>
                <span className="em-badge" style={{ fontFamily: 'var(--font-serif)', fontSize: 16, ...(w.hot ? {} : { background: 'var(--em-bad)', color: '#fff' }) }}>{w.n}</span>
                <span className="em-grow">
                  <span style={{ display: 'block', fontWeight: 500 }}>{w.title}</span>
                  <span className="em-mut" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{w.note}</span>
                </span>
                <Icon n="right" size={18} />
              </button>
            ))}
          </div>
        ) : (
          <div className="em-card" data-testid="all-caught-up" style={{ fontSize: 14 }}>
            <b style={{ fontWeight: 600 }}>All caught up.</b> <span className="em-mut">No orders, enquiries or failed messages are waiting.</span>
          </div>
        )}

        {flags.insights ? (
          <div style={{ marginTop: 6 }}>
            <div className="em-row em-sb">
              <span className="em-ey">This week</span>
              <button type="button" className="em-link" onClick={() => onNavigate('admin-insights')}>
                Full report <Icon n="right" size={14} />
              </button>
            </div>
            <div className="em-metrics">
              <div className="em-metric" style={{ textAlign: 'left' }}>
                <div className="em-row em-sb">
                  <span className="em-ey">kg booked</span>
                  <Icon n="trend" size={14} />
                </div>
                <div>
                  <span className="em-ser">{analytics.bookedWeightKg.toFixed(3)}</span>
                  <b>{analytics.bookedOrders} {analytics.bookedOrders === 1 ? 'order' : 'orders'}</b>
                </div>
              </div>
              <div className="em-metric dk" style={{ textAlign: 'left' }}>
                <div className="em-row em-sb">
                  <span className="em-ey">Views</span>
                  <Icon n="eye" size={14} />
                </div>
                <div>
                  <span className="em-ser">{analytics.views.toLocaleString('en-IN')}</span>
                  <b>{analytics.inquiries} enq. · {analytics.viewsTrend}</b>
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

        <button type="button" className="em-primary-card" data-testid="new-design-card" style={{ marginTop: 4 }} onClick={() => onNavigate('new-product')}>
          <span className="em-badge">
            <Icon n="plus" size={22} />
          </span>
          <span className="em-grow">
            <span className="em-ser" style={{ display: 'block', fontSize: 20 }}>New design</span>
            <small>Add to catalogue in under a minute</small>
          </span>
          <Icon n="right" size={20} className="em-chev" />
        </button>

        <div style={{ marginTop: 6 }}>
          <div className="em-rule" style={{ width: 40, margin: '0 0 8px' }} />
          <div className="em-h3" style={{ marginBottom: 14 }}>Quick actions</div>
          <div className="grid2" style={{ gap: 10 }}>
            {tiles.map((t) => (
              <button key={t.label} type="button" data-testid={t.testId} className={`tile${t.locked ? ' lk' : ''}`} onClick={t.locked ? () => upgradeNotice(t.label) : t.go}>
                <span className="em-tile-ico">
                  <Icon n={t.icon} size={16} />
                </span>
                <span>
                  <span className="em-tile-t">
                    {t.label}
                    {t.locked && (<>{' '}<span className="pro">Pro</span></>)}
                  </span>
                  <span className="em-tile-n">{t.note}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {doneCount < checklist.length && (
          <div className="em-card" data-testid="setup-checklist">
            <div className="em-row em-sb">
              <b style={{ fontWeight: 500 }}>Finish setting up</b>
              <span className="em-mut" style={{ fontSize: 12 }}>{doneCount} of {checklist.length}</span>
            </div>
            <div className="meter" style={{ margin: '10px 0 6px' }}>
              <i style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>
            {checklist.map((c) => (
              <button key={c.label} type="button" className="em-row" disabled={c.done} onClick={c.go} style={{ gap: 10, padding: '8px 0', width: '100%', border: 0, background: 'none', textAlign: 'left', font: 'inherit', color: c.done ? 'var(--em-mut)' : 'inherit', textDecoration: c.done ? 'line-through' : 'none', cursor: c.done ? 'default' : 'pointer' }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${c.done ? 'var(--em-ok)' : 'var(--em-line)'}`, background: c.done ? 'var(--em-ok)' : 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  {c.done && <Icon n="check" size={13} />}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
