import React, { useState } from 'react';
import { usePlan } from '../plan';
import { trialDaysLeft, DOWNGRADE_CHANGES } from '../../shared/trial';
import { LIMITS } from '../../shared/limits';
import { SALES_EMAIL, SALES_WHATSAPP } from '../../shared/sales';
import { merchant } from '../merchant';
import type { ActiveScreen } from '../types';
import { Icon, Sheet } from '../layouts/emergent/ui';

const n = (v: number | null) => (v === null ? 'unlimited' : v.toLocaleString('en-IN'));

/**
 * The "contact to upgrade" step (Phase 1): email or WhatsApp to sales with the store's details filled in.
 * Phase 3 replaces the inside of this sheet with live payment; the Upgrade button stays where it is.
 */
const UpgradeSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const text = `Hello Antarixs, I would like to upgrade my store "${merchant.brand.name}" (${merchant.id}) to Pro.`;
  const mail = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`Upgrade ${merchant.id} to Pro`)}&body=${encodeURIComponent(text)}`;
  const copy = () => navigator.clipboard?.writeText(SALES_EMAIL).then(() => setCopied(true)).catch(() => {});
  return (
    <Sheet label="Upgrade to Pro" onClose={onClose}>
      <div className="em-row em-sb">
        <span className="em-ser" style={{ fontSize: 22 }}>
          Upgrade to Pro
        </span>
        <button type="button" className="em-circ" aria-label="Close" onClick={onClose}>
          <Icon n="x" size={16} />
        </button>
      </div>
      <p className="em-mut" style={{ fontSize: 14, lineHeight: 1.5, marginTop: -4 }}>
        Pro unlocks orders and the orders desk, insights, live visitors, buyer engagement, the audit log, PDF catalogues, unlimited collections and buyers, and 3 photos per design.
      </p>
      <div className="em-card" style={{ padding: '12px 16px', fontSize: 13.5 }}>
        Self-serve payment is coming. For now, tell us and we switch your store to Pro, usually the same day.
      </div>
      <a className="em-btn" href={mail} data-testid="upgrade-email">
        <Icon n="mail" size={18} />
        Email {SALES_EMAIL}
      </a>
      {SALES_WHATSAPP && (
        <a className="em-btn wa" href={`https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" data-testid="upgrade-whatsapp">
          <Icon n="wa" size={18} />
          Message on WhatsApp
        </a>
      )}
      <button type="button" className="em-link" style={{ alignSelf: 'center' }} onClick={copy} data-testid="upgrade-copy-email">
        {copied ? 'Email address copied' : 'Copy the email address'}
      </button>
    </Sheet>
  );
};

/** Plan and usage (artboard 3.11 during the Pro trial, 4.6 once it has ended or on Basic). */
export const AdminPlanScreen: React.FC<{ categories: number; onNavigate: (screen: ActiveScreen) => void }> = ({ categories, onNavigate }) => {
  const ent = usePlan();
  const [upgrading, setUpgrading] = useState(false);
  const days = trialDaysLeft(ent);
  const isPro = ent.effectivePlan === 'pro';
  const ended = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  const urgent = days !== null && days <= 3;
  const usage = { categories: ent.usage?.categories ?? categories, photos: ent.usage?.photos ?? 0, users: ent.usage?.users };
  const endsOn = ent.trialEndsAt ? new Date(ent.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
  // During the trial the owner is on Pro; show what Basic would allow so the meters mean something on day 15.
  const after = isPro && days !== null ? LIMITS.basic : ent.limits;

  const row = (label: string, used: number | string, limit: number | null | undefined, bar: boolean, testId?: string) => {
    const u = typeof used === 'number' ? used.toLocaleString('en-IN') : used;
    const over = bar && limit != null && typeof used === 'number' && used > limit;
    return (
      <div className="em-usage" key={label} data-testid={testId}>
        <div className="em-row em-sb">
          <b style={{ fontWeight: 500 }}>{label}</b>
          <span className="em-ser">
            {u} <span>{limit == null ? '· unlimited' : bar ? `/ ${limit.toLocaleString('en-IN')}` : `· up to ${limit}`}</span>
          </span>
        </div>
        {bar && limit != null && typeof used === 'number' && (
          <div className={`meter${over || used >= limit ? ' over' : ''}`} style={{ marginTop: 10 }}>
            <i style={{ width: `${Math.min(100, Math.round((used / limit) * 100))}%` }} />
          </div>
        )}
        {over && (
          <p className="hint" style={{ margin: '6px 0 0' }}>
            Over the Basic limit: you keep all {used}, but cannot add more once the trial ends.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }} data-testid="plan-screen">
      <div className="em-rule" style={{ margin: '0 0 4px' }} />
      {days !== null ? (
        <div className={`em-countdown${urgent ? ' urgent' : ''}`} data-testid="plan-countdown">
          <span className="pro">Pro Trial</span>
          <div className="big">
            {days} {days === 1 ? 'day' : 'days'}
          </div>
          <div className="of">of Pro left</div>
          <p>
            {endsOn ? `Ends ${endsOn}. ` : ''}
            {urgent ? 'Upgrade now to keep orders, insights and PDF catalogues without a break.' : 'After that your store gracefully moves to Basic. Nothing is deleted.'}
          </p>
        </div>
      ) : isPro ? (
        <div className="em-countdown">
          <span className="pro">Pro</span>
          <div className="big" style={{ fontSize: 34 }}>
            Every feature is on
          </div>
        </div>
      ) : (
        <div className="em-countdown">
          <span className="tag mut">Basic</span>
          <div className="big" style={{ fontSize: 34 }}>
            {ended ? 'Your Pro trial has ended' : 'You are on Basic'}
          </div>
          <p>{ended ? 'Nothing was deleted. Upgrade to get everything back.' : 'Upgrade any time to unlock orders, insights and more.'}</p>
        </div>
      )}

      {!(isPro && days === null) && (
        <button type="button" className="em-btn" data-testid="upgrade-button" onClick={() => setUpgrading(true)}>
          <Icon n="award" size={18} />
          Upgrade to Pro
        </button>
      )}

      {!isPro && (ent.turnedAway?.total ?? 0) > 0 && (
        <div className="em-card" data-testid="turned-away-nudge" style={{ padding: '12px 16px', fontSize: 13.5, lineHeight: 1.5 }}>
          <b style={{ fontWeight: 600 }}>
            {ent.turnedAway!.today} new buyer{ent.turnedAway!.today === 1 ? '' : 's'} turned away today
          </b>{' '}
          · {ent.turnedAway!.total} since the catalogue filled up. They asked for a sign-in code and were told the store is full. Pro has no buyer limit.
        </div>
      )}

      <div style={{ marginTop: 12 }} className="em-ey">
        {isPro && days !== null ? 'Current usage · against Basic limits after the trial' : 'Current usage'}
      </div>
      <div style={{ marginTop: -6 }}>
        {row('Photos', usage.photos, after.photos, true, 'usage-photos')}
        {row('Collections', usage.categories, after.categories, true, 'usage-collections')}
        {row('Buyers', usage.users ?? '-', after.users, true, 'usage-buyers')}
        {row('Photos per design', ent.limits.photosPerDesign, ent.limits.photosPerDesign, false)}
      </div>

      {!(isPro && days === null) && (
        <div style={{ marginTop: 12 }}>
          <div className="em-h3" style={{ marginBottom: 10 }}>
            {isPro ? 'If you stay on Basic' : 'What changed'}
          </div>
          <ul className="em-bullets">
            {DOWNGRADE_CHANGES.map((c) => (
              <li key={c}>{c}</li>
            ))}
            <li>
              Basic: {n(LIMITS.basic.categories)} collections, {n(LIMITS.basic.photos)} photos, {LIMITS.basic.photosPerDesign} photo per design, {n(LIMITS.basic.users)} buyers.
            </li>
          </ul>
        </div>
      )}

      <button type="button" className="em-link" style={{ alignSelf: 'center' }} data-testid="plan-compare-link" onClick={() => onNavigate('plans')}>
        Compare Basic and Pro
      </button>

      {upgrading && <UpgradeSheet onClose={() => setUpgrading(false)} />}
    </div>
  );
};
