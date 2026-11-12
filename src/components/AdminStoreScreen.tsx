import React, { useState } from 'react';
import { api } from '../api';
import { usePlan, upgradeNotice } from '../plan';
import type { ActiveScreen, AdminSummary } from '../types';
import { Icon, Title } from '../layouts/emergent/ui';
import { Notice } from './ui';
import { OrderNotificationsToggle } from './OrderNotificationsToggle';
import { AiCreditsCard } from './AiCredits';
import { errorText } from '../bugReport';
import { coverSrc, merchant } from '../merchant';
import { notify } from '../notify';
import { DEFAULT_LAYOUT, LAYOUTS, LOOK_NAMES, MAISON_LOOKS, type LayoutId, type MaisonLook } from '../../shared/layouts';

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
  const [layout, setLayout] = useState<LayoutId>(merchant.layout ?? DEFAULT_LAYOUT);
  const [savingLayout, setSavingLayout] = useState<LayoutId | null>(null);
  const [look, setLook] = useState<MaisonLook>(merchant.look ?? 'ivory');
  const [savingLook, setSavingLook] = useState(false);
  const SWATCH: Record<MaisonLook, [string, string, string]> = { ivory: ['#ffffff', '#1b1b1b', '#f3f1ee'], noir: ['#0d0c0a', '#f3eee4', '#c9a961'], midnight: ['#0f1420', '#ece7dc', '#d6b66a'], garnet: ['#fbf6f3', '#2a1118', '#8c1d3a'] };
  const pickLook = (id: MaisonLook) => {
    if (id === look || savingLook) return;
    setSavingLook(true);
    setError(null);
    api
      .setLook(id)
      .then(() => {
        merchant.look = id;
        window.dispatchEvent(new Event('store-look-changed'));
        setLook(id);
        notify(`Buyers now see the ${LOOK_NAMES[id]} look.`);
      })
      .catch((e) => setError(errorText(e, 'AdminStoreScreen', 'Could not change the look.')))
      .finally(() => setSavingLook(false));
  };

  // The Welcome photo: the one photograph shown to visitors before they sign in.
  const [cover, setCover] = useState(coverSrc());
  const [savingCover, setSavingCover] = useState(false);
  const putCover = (file: File | undefined) => {
    if (!file || savingCover) return;
    setSavingCover(true);
    setError(null);
    api
      .uploadCover(file)
      .then((u) => { merchant.welcome.cover = u; setCover(coverSrc()); notify('The Welcome photo is live.'); })
      .catch((e) => setError(errorText(e, 'AdminStoreScreen', 'Could not upload the photo.')))
      .finally(() => setSavingCover(false));
  };
  const dropCover = () => {
    if (savingCover) return;
    setSavingCover(true);
    api
      .removeCover()
      .then(() => { delete merchant.welcome.cover; setCover(undefined); notify('The Welcome photo is removed.'); })
      .catch((e) => setError(errorText(e, 'AdminStoreScreen', 'Could not remove the photo.')))
      .finally(() => setSavingCover(false));
  };

  const pickLayout = (id: LayoutId) => {
    if (id === layout || savingLayout) return;
    setSavingLayout(id);
    setError(null);
    api
      .setLayout(id)
      .then(() => {
        merchant.layout = id;
        window.dispatchEvent(new Event('store-layout-changed'));
        setLayout(id);
        notify(`Buyers now see the ${LAYOUTS.find((l) => l.id === id)?.name} layout.`);
      })
      .catch((e) => setError(errorText(e, 'AdminStoreScreen', 'Could not change the layout.')))
      .finally(() => setSavingLayout(null));
  };

  const exportAudit = () => {
    if (!flags.auditLog) return void upgradeNotice('The audit log');
    setDownloading(true);
    setError(null);
    api
      .downloadAuditExport()
      .catch((e) => setError(errorText(e, 'AdminStoreScreen', 'Could not download the audit log.')))
      .finally(() => setDownloading(false));
  };

  const Row: React.FC<{ icon: string; title: string; note: string; onClick: () => void; testId: string; extra?: React.ReactNode; danger?: boolean }> = ({ icon, title, note, onClick, testId, extra, danger }) => (
    <button type="button" className="em-li" data-testid={testId} style={{ width: '100%', textAlign: 'left', font: 'inherit', color: danger ? 'var(--em-bad)' : 'inherit', background: 'none', border: 0, borderBottom: '1px solid var(--em-line)', cursor: 'pointer' }} onClick={onClick}>
      <span className="em-circ" style={{ background: danger ? undefined : 'var(--em-tint)' }}><Icon n={icon} size={18} /></span>
      <span className="em-grow">
        <b style={{ display: 'block', fontWeight: 600 }}>{title}{extra}</b>
        <span className="em-mut" style={{ fontSize: '0.75rem' }}>{note}</span>
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
        <Title title="Store" />
        {error && <Notice tone="error">{error}</Notice>}
        <Group title="Your store">
          <Row icon="info" title="About us" note="What buyers see about you" testId="store-about" onClick={() => onNavigate('admin-about')} />
          <Row icon="share" title="Share store" note="Link and QR for buyers" testId="store-share" onClick={onShare} />
          <Row icon="eye" title="View as a buyer" note="See the catalogue the way buyers do" testId="store-view-buyer" onClick={onViewAsBuyer} />
        </Group>
        <div className="em-ey" style={{ marginTop: 8 }}>Store layout</div>
        <div role="radiogroup" aria-label="Store layout" data-testid="store-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {LAYOUTS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={layout === l.id} data-testid={`layout-${l.id}`} disabled={savingLayout !== null} onClick={() => pickLayout(l.id)} className="em-card" style={{ padding: 10, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', outline: layout === l.id ? '2px solid var(--em-primary)' : undefined, outlineOffset: -2 }}>
              <LayoutPreview id={l.id} />
              <b style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>{l.name}{layout === l.id ? ' · in use' : savingLayout === l.id ? ' · saving…' : ''}</b>
              <span className="em-mut" style={{ fontSize: '0.75rem' }}>{l.id === 'maison' ? 'Black and white, large serif, full-width photos' : 'Your colours, rounded cards, tab bar'}</span>
            </button>
          ))}
        </div>
        {layout === 'maison' && (
          <>
            <div className="em-ey" style={{ marginTop: 8 }}>Look</div>
            <div role="radiogroup" aria-label="Look" data-testid="store-look" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {MAISON_LOOKS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={look === id} data-testid={`look-${id}`} disabled={savingLook} onClick={() => pickLook(id)} className="em-card" style={{ padding: 8, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', outline: look === id ? '2px solid var(--em-primary)' : undefined, outlineOffset: -2 }}>
                  <span style={{ display: 'flex', height: 34, border: '1px solid var(--em-line)' }}><i style={{ flex: 2, background: SWATCH[id][0] }} /><i style={{ flex: 1, background: SWATCH[id][1] }} /><i style={{ flex: 1, background: SWATCH[id][2] }} /></span>
                  <b style={{ display: 'block', fontWeight: 600, marginTop: 6, fontSize: '0.875rem' }}>{LOOK_NAMES[id]}</b>
                </button>
              ))}
            </div>
            <p className="em-mut" style={{ fontSize: '0.75rem', margin: 0 }}>Noir is the immersive look: black, ivory and champagne gold, full-screen chapters on Home and its own way through categories and collections. Buyers see the look; this console stays light. Use View as a buyer to see it. The PDF catalogue follows it too.</p>
            <div className="em-ey" style={{ marginTop: 8 }}>Welcome photo</div>
            <div className="em-card" data-testid="store-cover" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10 }}>
              <span style={{ width: 72, height: 96, flex: 'none', background: 'var(--em-tint)', border: '1px solid var(--em-line)', overflow: 'hidden', display: 'block' }}>
                {cover && <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <span className="em-mut" style={{ fontSize: '0.75rem' }}>The photograph behind your first page, seen before a buyer signs in. Anyone with the link can see it, so choose one you are happy to show. A tall photo works best.</span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="em-btn sec" style={{ minHeight: 36, padding: '0 14px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    {savingCover ? 'Saving…' : cover ? 'Replace photo' : 'Choose a photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" data-testid="store-cover-input" hidden disabled={savingCover} onChange={(e) => { putCover(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {cover && <button type="button" className="em-link" data-testid="store-cover-remove" disabled={savingCover} onClick={dropCover}>Remove</button>}
                </span>
              </span>
            </div>
          </>
        )}
        <Group title="Alerts">
          <OrderNotificationsToggle row />
        </Group>
        <Group title="Reports">
          <Row icon="trend" title="Insights" note="Views, orders, active buyers, top designs" testId="store-insights" onClick={() => (flags.insights ? onNavigate('admin-insights') : upgradeNotice('Insights'))} extra={!flags.insights ? <> <span className="pro">Pro</span></> : undefined} />
          <Row icon="wa" title="WA Lighthouse" note="WhatsApp numbers, test alert and message log" testId="store-wa-lighthouse" onClick={() => (flags.alerts ? onNavigate('admin-alerts') : upgradeNotice('WA Lighthouse'))} extra={!flags.alerts ? <> <span className="pro">Pro</span></> : summary.messagesFailed > 0 ? <> <span className="pill conf" style={{ background: 'var(--em-bad)', color: '#fff' }}>{summary.messagesFailed}</span></> : undefined} />
          <Row icon="file" title="Audit log" note={downloading ? 'Downloading…' : 'Export every change as CSV'} testId="store-audit" onClick={exportAudit} extra={!flags.auditLog ? <> <span className="pro">Pro</span></> : undefined} />
        </Group>
        <div className="em-ey" style={{ marginTop: 8 }}>AI credits</div>
        <AiCreditsCard />
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

/** A miniature of each layout's Home, drawn in CSS so it needs no screenshots. */
const LayoutPreview: React.FC<{ id: LayoutId }> = ({ id }) => {
  const box: React.CSSProperties = { position: 'relative', aspectRatio: '4 / 5', overflow: 'hidden', borderRadius: id === 'maison' ? 0 : 12 };
  if (id === 'maison')
    return (
      <span aria-hidden="true" style={{ ...box, display: 'block', background: '#fff', border: '1px solid #ddd' }}>
        <span style={{ display: 'block', height: '12%', borderBottom: '1px solid #ddd', textAlign: 'center', font: '400 8px/2.6 Georgia, serif', letterSpacing: '0.18em', color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>{merchant.brand.name.toUpperCase()}</span>
        <span style={{ display: 'block', height: '46%', background: 'linear-gradient(160deg,#3a3a3a,#0c0c0c)', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, bottom: 8, font: '300 18px/1 Georgia, serif', color: '#fff' }}>Aa</span>
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 6, background: '#f1efec', height: '42%' }}>
          <span style={{ background: '#e2ded8' }} /><span style={{ background: '#e2ded8' }} />
        </span>
      </span>
    );
  return (
    <span aria-hidden="true" style={{ ...box, display: 'block', background: 'var(--em-bg)', border: '1px solid var(--em-line)', padding: 6 }}>
      <span style={{ display: 'block', height: 10, width: '55%', borderRadius: 99, background: 'var(--em-tint)' }} />
      <span style={{ display: 'block', height: '40%', marginTop: 6, borderRadius: 10, background: 'var(--em-primary)' }} />
      <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6, height: '30%' }}>
        <span style={{ borderRadius: 8, background: 'var(--em-tint)' }} /><span style={{ borderRadius: 8, background: 'var(--em-tint)' }} />
      </span>
      <span style={{ position: 'absolute', left: 6, right: 6, bottom: 6, height: 12, borderRadius: 99, background: 'var(--em-card)', border: '1px solid var(--em-line)' }} />
    </span>
  );
};
