import React from 'react';
import { LIMITS, TRIAL_DAYS, flagsFor } from '../../shared/limits';
import { SALES_EMAIL } from '../../shared/sales';
import { usePlan } from '../plan';
import { I } from './ui';
import { Icon } from '../layouts/emergent/ui';

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
export const PlansCompare: React.FC<{ current?: 'basic' | 'pro'; atlas?: boolean }> = ({ current, atlas }) => (
  <>
    {atlas ? (
      <div className="em-antarixs" data-testid="plans-banner">
        <div className="em-row" style={{ gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgb(255 255 255 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="plans-axg" x1=".1" y1="0" x2=".95" y2="1">
                  <stop offset="0" stopColor="#7CC4FF" />
                  <stop offset=".55" stopColor="#6100F0" />
                  <stop offset="1" stopColor="#2B0A7A" />
                </linearGradient>
              </defs>
              <path d="M50 8L92 90L75 90L50 40L25 90L8 90Z" fill="url(#plans-axg)" />
              <path d="M33 78Q16 90-4 101Q17 94 37 86Z" fill="#F3E35A" />
              <path d="M45 42C46.6 51 49.4 53.8 58 55.5C49.4 57.2 46.6 60 45 69C43.4 60 40.6 57.2 32 55.5C40.6 53.8 43.4 51 45 42Z" fill="#F3E35A" />
            </svg>
          </span>
          <div>
            <div className="em-ser" style={{ fontSize: 19 }}>
              Antarixs
            </div>
            <div className="em-ey" style={{ color: 'rgb(247 243 255 / 0.7)', fontSize: 9 }}>
              Plans
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, marginTop: 14 }}>Every new store starts with Pro for {TRIAL_DAYS} days. Then it moves to Basic unless you upgrade. Nothing is deleted.</div>
      </div>
    ) : (
      <div className="note trial">
        <b>Every new store starts with Pro for {TRIAL_DAYS} days.</b> Then it moves to Basic unless you upgrade. Nothing is deleted.
      </div>
    )}
    <div className={atlas ? 'em-planpair' : 'grid2'}>
      <div className={atlas ? 'em-plan' : 'card col'} style={atlas ? undefined : { gap: 6 }} data-testid="plan-card-basic">
        <span className="row" style={{ gap: 6 }}>
          <span className="tag mut">Basic</span>
          {current === 'basic' && <span className="tag ok">Your plan</span>}
        </span>
        <div>
          <span className={atlas ? 'em-ser' : 'stat'} style={atlas ? undefined : { fontSize: 24 }}>
            Free
          </span>
          <p className="sub" style={atlas ? { fontSize: 11 } : undefined}>
            To get started
          </p>
        </div>
      </div>
      <div className={atlas ? 'em-plan hi' : 'card col'} style={atlas ? undefined : { gap: 6, borderColor: 'var(--plum)' }} data-testid="plan-card-pro">
        <span className="row" style={{ gap: 6 }}>
          <span className="pro dark">Pro</span>
          {current === 'pro' && <span className="tag ok">Your plan</span>}
        </span>
        <div>
          <span className={atlas ? 'em-ser' : 'stat'} style={atlas ? { whiteSpace: 'nowrap' } : { fontSize: 24, whiteSpace: 'nowrap' }}>
            Contact us
          </span>
          <p className="sub" style={atlas ? { fontSize: 11, color: 'inherit', opacity: 0.7 } : undefined}>
            To grow
          </p>
        </div>
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
      <PlansCompare current={ent.effectivePlan} atlas />
      {ent.plan === 'basic' && (
        <a className="em-btn" data-testid="plans-cta" href={`mailto:${SALES_EMAIL}`}>
          <Icon n="award" size={18} />
          {ent.trialEndsAt ? 'Email sales to upgrade' : 'Upgrade to Pro'}
        </a>
      )}
    </div>
  );
};
