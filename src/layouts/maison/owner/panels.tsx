import React, { useEffect, useState } from 'react';
import { api, type Insights } from '../../../api';
import type { AdminOrder, AnalyticsData, VisitorSummary } from '../../../types';
import { Funnel, HBars, Split, Spark } from './charts';
import { PageHeader, SectionTitle, Stat } from './ui';
import { t } from '../../../i18n';

// Chart panels for the owner screens (Maison only; each is lazy-loaded by its screen). Real data from the existing endpoints, short labels, big numbers.
const delta = (cur: number, prev: number) => (prev === 0 ? (cur > 0 ? 'new' : '') : `${cur >= prev ? '+' : ''}${Math.round(((cur - prev) / prev) * 100)}%`);
const duration = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);

/** The whole Insights screen: big numbers, trends, funnel, rankings. */
export const InsightsPanel: React.FC<{ d: Insights }> = ({ d }) => {
  const k = d.kpis;
  const wa = d.whatsapp;
  return (
    <div className="em-page" data-testid="admin-insights-screen">
      <div className="em-pad">
        <PageHeader eyebrow={d.periodLabel} title={t('Insights')} />
        <div className="mxo-four" data-testid="insights-kpis">
          <div data-testid="kpi-views"><Stat label={t('Views')} value={k.views7.toLocaleString('en-IN')} note={delta(k.views7, k.views7Prev)} /></div>
          <div data-testid="kpi-orders"><Stat label={t('Orders')} value={k.orders7} note={delta(k.orders7, k.orders7Prev)} /></div>
          <div data-testid="kpi-buyers"><Stat label={t('Active buyers')} value={k.activeBuyers7} note={`${k.activeBuyers30} / 30d`} /></div>
          <div data-testid="kpi-shortlist"><Stat label={t('Shortlisting')} value={k.shortlisters} note={`${k.shortlistedDesigns} ${t('designs')}`} /></div>
        </div>
        <SectionTitle>{t('Last 8 weeks')}</SectionTitle>
        <div className="mxo-three" data-testid="insights-weeks">
          <Spark label={t('Views')} value="" data={d.weeks.map((w) => w.views)} labels={d.weeks.map((w) => w.label)} />
          <Spark label={t('Orders')} value="" data={d.weeks.map((w) => w.orders)} labels={d.weeks.map((w) => w.label)} accent />
          <Spark label={t('Visitors')} value="" data={d.weeks.map((w) => w.visitors)} labels={d.weeks.map((w) => w.label)} />
        </div>
        <div className="mxo-two">
          <div data-testid="insights-funnel">
            <SectionTitle>{t('Buyers')}</SectionTitle>
            <Funnel steps={[{ label: t('Active'), value: k.activeBuyers7 }, { label: t('Shortlisted'), value: k.shortlisters }, { label: t('Orders'), value: k.orders7 }]} />
          </div>
          <div data-testid="insights-top-designs">
            <SectionTitle>{t('Top designs')}</SectionTitle>
            <HBars rows={d.topDesigns.slice(0, 6).map((p) => ({ label: p.name, value: p.views }))} />
          </div>
        </div>
        <div data-testid="insights-collections">
          <SectionTitle>{t('Collections')}</SectionTitle>
          <HBars rows={d.collections.slice(0, 8).map((c) => ({ label: c.name, value: c.views }))} />
        </div>
        {wa && (
          <div data-testid="insights-whatsapp">
            <SectionTitle>WhatsApp</SectionTitle>
            <div className="mxo-four">
              <Stat label={t('Sent')} value={wa.total} />
              <Stat label={t('Failed')} value={wa.failed} />
              <div data-testid="insights-whatsapp-rate"><Stat label={t('Delivered')} value={wa.deliveredRate === null ? '–' : `${wa.deliveredRate}%`} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Buyer engagement: two numbers and a ranking by time in the app; a bar opens that buyer. */
export const VisitorsPanel: React.FC<{ analytics: AnalyticsData; rows: VisitorSummary[] | null; onOpen: (id: string) => void }> = ({ analytics, rows, onOpen }) => (
  <div className="mxo-vis" data-testid="visitor-list">
    <div className="mxo-four">
      <Stat label={t('Today')} value={analytics.todayVisitors} />
      <Stat label={t('Online now')} value={analytics.liveVisitors} />
    </div>
    <SectionTitle>{t('Time in app')}</SectionTitle>
    <HBars
      rows={(rows ?? []).filter((v) => v.activeSeconds > 0).sort((a, b) => b.activeSeconds - a.activeSeconds).slice(0, 10).map((v) => ({ label: v.name, value: v.activeSeconds, text: duration(v.activeSeconds), onClick: () => onOpen(v.id) }))}
      empty={rows === null ? '…' : 'No data yet'}
    />
    <SectionTitle>{t('Designs seen')}</SectionTitle>
    <HBars rows={(rows ?? []).filter((v) => v.productsViewed > 0).sort((a, b) => b.productsViewed - a.productsViewed).slice(0, 10).map((v) => ({ label: v.name, value: v.productsViewed, onClick: () => onOpen(v.id) }))} />
  </div>
);

/** Orders: counts by status, orders per day, net weight. */
export const OrdersPanel: React.FC<{ orders: AdminOrder[] }> = ({ orders }) => {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i)); return d; });
  const per = days.map((d) => orders.filter((o) => new Date(o.timestamp).toDateString() === d.toDateString()).length);
  const kg = orders.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.totalNetGrams, 0) / 1000;
  const n = (s: string) => orders.filter((o) => o.status === s).length;
  return (
    <section className="mxo-charts" data-testid="orders-charts">
      <div className="mxo-two">
        <Spark label={t('Orders, 14 days')} value={orders.length} data={per} labels={days.map((d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))} accent />
        <div>
          <Stat label={t('Net weight')} value={`${kg.toFixed(3)} kg`} />
          <Split parts={[{ label: t('New'), value: n('new'), tone: 'acc' }, { label: t('Confirmed'), value: n('confirmed'), tone: 'ink' }, { label: t('Dispatched'), value: n('dispatched'), tone: 'mut' }, { label: t('Cancelled'), value: n('cancelled'), tone: 'line' }]} />
        </div>
      </div>
    </section>
  );
};
