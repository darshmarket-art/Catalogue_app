import React, { useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen, AdminSummary } from '../types';
import { Icon, Title } from '../layouts/emergent/ui';
import { Notice } from './ui';
import { OrderNotificationsToggle } from './OrderNotificationsToggle';

interface Props {
  summary: AdminSummary;
  onNavigate: (screen: ActiveScreen) => void;
  onShare: () => void;
  onViewAsBuyer: () => void;
  onLogout: () => void;
}

/** Store: setup and account, kept out of the daily path. Everything the old Manage grid and profile menu held lives here. */
export const AdminStoreScreen: React.FC<Props> = ({ summary, onNavigate, onShare, onViewAsBuyer, onLogout }) => {
  const ent = usePlan();
  const { flags } = ent;
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportAudit = () => {
    if (!flags.auditLog) return void upgradeNotice('The audit log');
    setDownloading(true);
    setError(null);
    api
      .downloadAuditExport()
      .catch((e) => setError(e.message || 'Could not download the audit log.'))
      .finally(() => setDownloading(false));
  };

  const Row: React.FC<{ icon: string; title: string; note: string; onClick: () => void; testId: string; extra?: React.ReactNode; danger?: boolean }> = ({ icon, title, note, onClick, testId, extra, danger }) => (
    <button type="button" className="em-li" data-testid={testId} style={{ width: '100%', textAlign: 'left', font: 'inherit', color: danger ? 'var(--em-bad)' : 'inherit', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)', cursor: 'pointer' }} onClick={onClick}>
      <span className="em-circ" style={{ background: danger ? undefined : 'var(--em-tint)' }}><Icon n={icon} size={18} /></span>
      <span className="em-grow">
        <b style={{ display: 'block', fontWeight: 600 }}>{title}{extra}</b>
        <span className="em-mut" style={{ fontSize: 12 }}>{note}</span>
      </span>
      {!danger && <Icon n="right" size={18} />}
    </button>
  );
  const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <>
      <div className="em-ey" style={{ marginTop: 8 }}>{title}</div>
      <div className="em-card" style={{ padding: '0 16px' }}>{children}</div>
    </>
  );
  const planNote = ent.effectivePlan === 'pro' ? (ent.trialEndsAt && ent.plan === 'basic' ? 'Pro trial' : 'Pro') : 'Basic';

  return (
    <div className="em-page" data-testid="admin-store">
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Title eyebrow="Setup and account" title="Store" />
        {error && <Notice tone="error">{error}</Notice>}
        <Group title="Your store">
          <Row icon="info" title="About us" note="What buyers see about you" testId="store-about" onClick={() => onNavigate('admin-about')} />
          <Row icon="share" title="Share store" note="Link and QR for buyers" testId="store-share" onClick={onShare} />
          <Row icon="eye" title="View as a buyer" note="See the catalogue the way buyers do" testId="store-view-buyer" onClick={onViewAsBuyer} />
        </Group>
        <Group title="Alerts">
          <OrderNotificationsToggle />
        </Group>
        <Group title="Reports">
          <Row icon="trend" title="Insights" note="Views, orders, active buyers, top designs" testId="store-insights" onClick={() => (flags.insights ? onNavigate('admin-insights') : upgradeNotice('Insights'))} extra={!flags.insights ? <> <span className="pro">Pro</span></> : undefined} />
          <Row icon="wa" title="WA Lighthouse" note="WhatsApp numbers, test alert and message log" testId="store-wa-lighthouse" onClick={() => (flags.alerts ? onNavigate('admin-alerts') : upgradeNotice('WA Lighthouse'))} extra={!flags.alerts ? <> <span className="pro">Pro</span></> : summary.messagesFailed > 0 ? <> <span className="pill conf" style={{ background: 'var(--em-bad)', color: '#fff' }}>{summary.messagesFailed}</span></> : undefined} />
          <Row icon="file" title="Audit log" note={downloading ? 'Downloading…' : 'Export every change as CSV'} testId="store-audit" onClick={exportAudit} extra={!flags.auditLog ? <> <span className="pro">Pro</span></> : undefined} />
        </Group>
        <Group title="Plan">
          <Row icon="award" title="Plan and usage" note={`${planNote} · limits and what Pro adds`} testId="store-plan" onClick={() => onNavigate('admin-plan')} />
        </Group>
        <Group title="Account">
          <Row icon="lock" title="Change password" note="At least 10 characters" testId="store-password" onClick={() => onNavigate('admin-password')} />
          <Row icon="x" title="Log out" note="" testId="store-logout" onClick={onLogout} danger />
        </Group>
      </div>
    </div>
  );
};
