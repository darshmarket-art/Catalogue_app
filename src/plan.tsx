import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { trialDaysLeft, DOWNGRADE_CHANGES } from '../shared/trial';

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
  useEffect(() => {
    api.getEntitlements().then(setEnt).catch(() => {});
  }, []);
  return <Ctx.Provider value={ent}>{children}</Ctx.Provider>;
};

export const upgradeNotice = (feature: string) =>
  alert(`${feature} is part of the Pro plan. Pro adds orders, insights, live visitors, buyer engagement, the audit log, PDF catalogues, staff roles and up to 3 photos per design. Contact Antarixs to upgrade.`);

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
          <p className="mt-1">Upgrade to Pro: contact Antarixs. Everything you added comes straight back.</p>
        </details>
      )}
    </div>
  );
};
