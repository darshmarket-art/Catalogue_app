import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { SALES_EMAIL, UPGRADE_TO_PRO } from '../shared/sales';
import { I, Sheet } from './components/ui';

export interface Entitlements {
  effectivePlan: 'basic' | 'pro';
  plan: string;
  trialEndsAt: string | null;
  trialNotice?: string | null;
  limits: { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null };
  flags: Record<'orders' | 'insights' | 'liveVisitors' | 'buyerEngagement' | 'alerts' | 'auditLog' | 'pdfCatalogue' | 'banners' | 'purities', boolean>;
  usage?: { categories: number; photos: number };
}

// Until the server answers (or if it cannot be reached) the app behaves as Pro, exactly as it did before plans existed. The server enforces the real limits.
const PRO: Entitlements = {
  effectivePlan: 'pro', plan: 'pro', trialEndsAt: null,
  limits: { categories: null, photos: 3000, photosPerDesign: 3, users: null },
  flags: { orders: true, insights: true, liveVisitors: true, buyerEngagement: true, alerts: true, auditLog: true, pdfCatalogue: true, banners: true, purities: true }
};

const Ctx = createContext<Entitlements>(PRO);
export const usePlan = () => useContext(Ctx);

/** Fetched once on load. */
export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ent, setEnt] = useState<Entitlements>(PRO);
  const [feature, setFeature] = useState<string | null>(null);
  useEffect(() => { openNotice = setFeature; return () => { openNotice = null; }; }, []);
  useEffect(() => {
    api.getEntitlements().then(setEnt).catch(() => {});
  }, []);
  return <Ctx.Provider value={ent}>{children}{feature && <UpgradeModal feature={feature} onClose={() => setFeature(null)} />}</Ctx.Provider>;
};

let openNotice: ((feature: string) => void) | null = null;
/** Opens the in-page upgrade notice (no browser alert). Payments come later, so it points to sales. */
export const upgradeNotice = (feature: string) => openNotice?.(feature);

/** The upgrade sheet (artboard 4.4). Payments come later, so it points to sales. */
const UpgradeModal: React.FC<{ feature: string; onClose: () => void }> = ({ feature, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(SALES_EMAIL).then(() => setCopied(true)).catch(() => {});
  return (
    <Sheet label="Upgrade to Pro" onClose={onClose}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--gold-l)', color: 'var(--gold-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <I n="lock" size="l" />
      </div>
      <h2 style={{ fontSize: 26 }}>{feature} is a Pro feature</h2>
      <p className="sub" style={{ fontSize: 15.5 }}>Pro adds orders, insights, live visitors, buyer engagement, the audit log, PDF catalogues and up to 3 photos per design.</p>
      <div className="card col" style={{ gap: 8, padding: '12px 16px' }}>
        {['Buyers place orders you confirm and dispatch', 'Kg booked, views and live visitors', 'Unlimited collections and buyers'].map((t) => (
          <div key={t} className="row"><I n="check" size="s" style={{ color: 'var(--ok)' }} /><span>{t}</span></div>
        ))}
      </div>
      <p className="sub" style={{ textAlign: 'center' }}>{UPGRADE_TO_PRO} <button type="button" className="lnk" style={{ minHeight: 0 }} onClick={copy} data-testid="sales-email">{copied ? 'Copied' : SALES_EMAIL}</button></p>
      <a className="btn" href={'mailto:' + SALES_EMAIL}><I n="chat" />Contact sales to upgrade</a>
      <button type="button" className="btn alt" onClick={onClose}>Not now</button>
    </Sheet>
  );
};

export const ProBadge: React.FC = () => <span className="pro" style={{ marginLeft: 6 }}>Pro</span>;
