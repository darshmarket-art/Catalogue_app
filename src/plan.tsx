import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { trialDaysLeft, DOWNGRADE_CHANGES } from '../shared/trial';
import { SALES_EMAIL, UPGRADE_TO_PRO } from '../shared/sales';
import { Sheet, btnPrimary, btnOutline } from './components/ui';

export interface Entitlements {
  effectivePlan: 'basic' | 'pro';
  plan: string;
  trialEndsAt: string | null;
  trialNotice?: string | null;
  limits: { categories: number | null; photos: number | null; photosPerDesign: number; users: number | null };
  flags: Record<'orders' | 'insights' | 'liveVisitors' | 'buyerEngagement' | 'alerts' | 'auditLog' | 'pdfCatalogue' | 'staffRoles' | 'banners' | 'purities', boolean>;
  usage?: { categories: number; photos: number };
}

// Until the server answers (or if it cannot be reached) the app behaves as Pro, exactly as it did before plans existed. The server enforces the real limits.
const PRO: Entitlements = {
  effectivePlan: 'pro', plan: 'pro', trialEndsAt: null,
  limits: { categories: null, photos: 3000, photosPerDesign: 3, users: null },
  flags: { orders: true, insights: true, liveVisitors: true, buyerEngagement: true, alerts: true, auditLog: true, pdfCatalogue: true, staffRoles: true, banners: true, purities: true }
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

const UpgradeModal: React.FC<{ feature: string; onClose: () => void }> = ({ feature, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(SALES_EMAIL).then(() => setCopied(true)).catch(() => {});
  return (
    <Sheet label="Upgrade to Pro" onClose={onClose}>
      <div className="px-5 flex flex-col gap-3 font-sans text-on-surface">
        <h2 className="text-lg font-extrabold">{feature} is part of Pro</h2>
        <p className="text-[15px]">Pro adds orders, insights, live visitors, buyer engagement, the audit log, PDF catalogues, staff roles and up to 3 photos per design. {UPGRADE_TO_PRO}</p>
        <p className="rounded-xl bg-surface-container px-3 py-3 text-center text-base font-bold select-all" data-testid="sales-email">{SALES_EMAIL}</p>
        <button type="button" className={btnOutline} onClick={copy}>{copied ? 'Copied' : 'Copy email'}</button>
        <a className={btnPrimary} href={`mailto:${SALES_EMAIL}`}>Email sales</a>
        <button type="button" className="min-h-11 font-bold text-primary" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  );
};

export const ProBadge: React.FC = () => (
  <span className="inline-flex items-center gap-0.5 ml-1.5 align-middle rounded-full bg-secondary-container text-on-secondary-container px-1.5 py-0.5 font-sans text-[11px] font-extrabold leading-none">
    <span className="material-symbols-outlined text-[12px]">lock</span>Pro
  </span>
);

/** Escalating countdown at 7, 3 and 1 days; after the trial, what changed on Basic. */
export const TrialBanner: React.FC = () => {
  const ent = usePlan();
  const days = trialDaysLeft(ent);
  const ended = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  if (days === null && !ended) return null;
  const tone = ended || days! <= 1 ? 'bg-error-container text-on-surface' : days! <= 3 ? 'bg-tertiary-container text-on-tertiary' : 'bg-secondary-container text-on-secondary-container';
  return (
    <div role="status" className={`px-4 py-2 ${tone} font-sans text-sm font-bold text-center`}>
      {ended ? 'Your trial has ended: you are on Basic' : `${days} ${days === 1 ? 'day' : 'days'} of Pro left${days! <= 7 ? ': after that you move to Basic' : ''}`}
      {(ended || days! <= 7) && (
        <details className="font-normal mt-1">
          <summary className="cursor-pointer font-bold">What changes</summary>
          <ul className="text-left list-disc pl-5 max-w-md mx-auto">{DOWNGRADE_CHANGES.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="mt-1">{UPGRADE_TO_PRO} Everything you added comes straight back.</p>
        </details>
      )}
    </div>
  );
};
