import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { usePlan } from '../plan';
import { trialDaysLeft, DOWNGRADE_CHANGES } from '../../shared/trial';
import { LIMITS } from '../../shared/limits';
import { SALES_EMAIL } from '../../shared/sales';
import type { ActiveScreen } from '../types';
import { Icon } from '../layouts/emergent/ui';

const n = (v: number | null) => (v === null ? 'unlimited' : v.toLocaleString('en-IN'));

/** Plan and usage (artboard 3.11 during the Pro trial, 4.6 once it has ended or on Basic). */
export const AdminPlanScreen: React.FC<{ categories: number; onNavigate: (screen: ActiveScreen) => void }> = ({ categories, onNavigate }) => {
  const ent = usePlan();
  const [buyerCount, setBuyerCount] = useState<number | null>(null);
  useEffect(() => {
    api.getBuyers().then((b) => setBuyerCount(b.length)).catch(() => {});
  }, []);
  const days = trialDaysLeft(ent);
  const isPro = ent.effectivePlan === 'pro';
  const ended = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  const usage = { categories: ent.usage?.categories ?? categories, photos: ent.usage?.photos ?? 0 };
  const endsOn = ent.trialEndsAt ? new Date(ent.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;

  const row = (label: string, used: number | string, limit: number | null | undefined, bar: boolean) => {
    const u = typeof used === 'number' ? used.toLocaleString('en-IN') : used;
    const over = bar && limit != null && typeof used === 'number' && used > limit;
    return (
      <div className="em-usage" key={label}>
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
            Over the limit: you keep all {used}, but cannot add more.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="scroll no-tabs" style={{ gap: 12 }}>
      <div className="em-rule" style={{ margin: '0 0 4px' }} />
      {days !== null ? (
        <div className="em-countdown" data-testid="plan-countdown">
          <span className="pro">Pro Trial</span>
          <div className="big">
            {days} {days === 1 ? 'day' : 'days'}
          </div>
          <div className="of">of Pro left</div>
          <p>
            {endsOn ? `Ends ${endsOn}. ` : ''}After that your store gracefully moves to Basic. Nothing is deleted.
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
          <p>
            {ended ? 'Nothing was deleted. ' : ''}To upgrade, contact sales at {SALES_EMAIL}.
          </p>
        </div>
      )}

      <div style={{ marginTop: 12 }} className="em-ey">
        Current usage
      </div>
      <div style={{ marginTop: -6 }}>
        {row('Photos', usage.photos, ent.limits.photos, true)}
        {row('Collections', usage.categories, ent.limits.categories, true)}
        {row('Buyers', buyerCount ?? '-', ent.limits.users, true)}
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

      {!(isPro && days === null) && (
        <a className="em-btn" style={{ marginTop: 12 }} href={`mailto:${SALES_EMAIL}`}>
          <Icon n="mail" size={18} />
          Email sales to upgrade
        </a>
      )}

      <button type="button" className="em-link" style={{ alignSelf: 'center' }} data-testid="plan-compare-link" onClick={() => onNavigate('plans')}>
        Compare Basic and Pro
      </button>
    </div>
  );
};
