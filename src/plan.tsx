import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { trialDaysLeft } from '../shared/trial';

export interface Entitlements {
  effectivePlan: 'basic' | 'pro';
  plan: string;
  trialEndsAt: string | null;
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

export const TrialBanner: React.FC = () => {
  const days = trialDaysLeft(usePlan());
  if (days === null) return null;
  return (
    <div role="status" className="px-4 py-2 bg-secondary-container text-on-secondary-container font-sans text-sm font-bold text-center">
      {days} {days === 1 ? 'day' : 'days'} of Pro left
    </div>
  );
};
