import React from 'react';
import { LIMITS, TRIAL_DAYS, flagsFor } from '../../shared/limits';
import { SALES_EMAIL } from '../../shared/sales';
import { usePlan } from '../plan';
import { I } from './ui';

type FlagName = keyof ReturnType<typeof flagsFor>;

// Every flag has a label, so a flag added to flagsFor shows up here (the compiler insists).
const FLAG_LABEL: Record<FlagName, string> = {
  orders: 'Orders and orders desk',
  insights: 'Insights: kg booked and views',
  liveVisitors: 'Live visitors',
  buyerEngagement: 'Buyer engagement',
  alerts: 'Order alerts',
  auditLog: 'Audit log',
  pdfCatalogue: 'PDF catalogue',
  staffRoles: 'Staff roles',
  premiumLayouts: 'Boutique storefront layout',
  banners: 'Home banners',
  purities: 'Purity options'
};

const n = (v: number | null) => (v === null ? 'Unlimited' : v.toLocaleString('en-IN'));
const basic = flagsFor('basic');
const pro = flagsFor('pro');

const rows: Array<{ label: string; basic: string | boolean; pro: string | boolean }> = [
  { label: 'Collections', basic: n(LIMITS.basic.categories), pro: n(LIMITS.pro.categories) },
  { label: 'Photos', basic: n(LIMITS.basic.photos), pro: n(LIMITS.pro.photos) },
  { label: 'Photos per design', basic: n(LIMITS.basic.photosPerDesign), pro: n(LIMITS.pro.photosPerDesign) },
  { label: 'Buyers', basic: n(LIMITS.basic.users), pro: n(LIMITS.pro.users) },
  { label: 'Enquire on WhatsApp', basic: true, pro: true },
  ...(Object.keys(FLAG_LABEL) as FlagName[]).map((k) => ({ label: FLAG_LABEL[k], basic: basic[k], pro: pro[k] }))
];

const cell = (v: string | boolean) =>
  v === true ? (
    <I n="check" size="s" style={{ color: 'var(--ok)' }} />
  ) : v === false ? (
    <span style={{ color: 'var(--mut)' }} aria-label="Not included">
      -
    </span>
  ) : (
    v
  );

/** Basic against Pro: the trial note, two plan cards and the table. Limits and flags come from the same tables the server enforces. */
export const PlansCompare: React.FC<{ current?: 'basic' | 'pro' }> = ({ current }) => (
  <>
    <div className="note trial">
      <b>Every new store starts with Pro for {TRIAL_DAYS} days.</b> Then it moves to Basic unless you upgrade. Nothing is deleted.
    </div>
    <div className="grid2">
      <div className="card col" style={{ gap: 6 }} data-testid="plan-card-basic">
        <span className="row" style={{ gap: 6 }}>
          <span className="tag mut">Basic</span>
          {current === 'basic' && <span className="tag ok">Your plan</span>}
        </span>
        <span className="stat" style={{ fontSize: 24 }}>
          Free
        </span>
        <p className="sub">To get started</p>
      </div>
      <div className="card col" style={{ gap: 6, borderColor: 'var(--plum)' }} data-testid="plan-card-pro">
        <span className="row" style={{ gap: 6 }}>
          <span className="pro dark">Pro</span>
          {current === 'pro' && <span className="tag ok">Your plan</span>}
        </span>
        <span className="stat" style={{ fontSize: 24, whiteSpace: 'nowrap' }}>
          Contact us
        </span>
        <p className="sub">To grow</p>
      </div>
    </div>
    <section aria-label="Basic and Pro compared" className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="t" data-testid="plans-table">
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Basic</th>
            <th scope="col">Pro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{cell(r.basic)}</td>
              <td>
                <b>{cell(r.pro)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
    <p className="hint">Payments are handled by our sales team for now: {SALES_EMAIL}.</p>
  </>
);

/** The Plans screen inside a store: the compare, marked with the store's own plan, and the way to upgrade. */
export const PlansScreen: React.FC = () => {
  const ent = usePlan();
  return (
    <div className="scroll no-tabs" style={{ gap: 12 }}>
      <PlansCompare current={ent.effectivePlan} />
      {ent.plan === 'basic' && (
        <a className="btn" href={`mailto:${SALES_EMAIL}`}>
          <I n="chat" />
          Email sales to upgrade
        </a>
      )}
    </div>
  );
};
