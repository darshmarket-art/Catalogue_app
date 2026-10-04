import React from 'react';
import { usePlan } from '../plan';
import { trialDaysLeft, DOWNGRADE_CHANGES } from '../../shared/trial';
import { LIMITS } from '../../shared/limits';
import { SALES_EMAIL } from '../../shared/sales';
import { I } from './ui';

const n = (v: number | null) => (v === null ? 'unlimited' : v.toLocaleString('en-IN'));

/** Plan and usage (artboard 3.11 during the Pro trial, 4.6 once it has ended or on Basic). */
export const AdminPlanScreen: React.FC<{ categories: number }> = ({ categories }) => {
  const ent = usePlan();
  const days = trialDaysLeft(ent);
  const isPro = ent.effectivePlan === 'pro';
  const ended = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  const usage = { categories: ent.usage?.categories ?? categories, photos: ent.usage?.photos ?? 0 };
  const endsOn = ent.trialEndsAt ? new Date(ent.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;

  const meter = (label: string, used: number, limit: number | null) => {
    const over = limit !== null && used > limit;
    return (
      <div>
        <div className="kv">
          <span>{label}</span>
          <b>{limit === null ? `${used.toLocaleString('en-IN')} · unlimited` : `${used.toLocaleString('en-IN')} of ${limit.toLocaleString('en-IN')}`}</b>
        </div>
        {limit !== null && (
          <div className={`meter${over || used >= limit ? ' over' : ''}`} style={{ marginTop: 6 }}>
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
      {days !== null ? (
        <div className="note trial">
          <span className="pro" style={{ background: 'var(--card)', color: 'var(--plum)' }}>
            Pro trial
          </span>
          <div className="serif" style={{ fontSize: 30, marginTop: 8 }}>
            {days} {days === 1 ? 'day' : 'days'} left
          </div>
          <p style={{ fontSize: 14, marginTop: 2, opacity: 0.9 }}>{endsOn ? `Ends ${endsOn}. ` : ''}After that your store moves to Basic.</p>
        </div>
      ) : isPro ? (
        <div className="note trial">
          <span className="pro" style={{ background: 'var(--card)', color: 'var(--plum)' }}>
            Pro
          </span>
          <div className="serif" style={{ fontSize: 30, marginTop: 8 }}>
            Every feature is on
          </div>
        </div>
      ) : (
        <div className="note warn">
          <span className="tag mut">Basic</span>
          <p style={{ marginTop: 8, fontSize: 15 }}>
            {ended ? (
              <>
                <b>Your Pro trial has ended.</b> Nothing was deleted. To upgrade and get everything back, contact sales at {SALES_EMAIL}.
              </>
            ) : (
              <>
                <b>You are on Basic.</b> To upgrade, contact sales at {SALES_EMAIL}.
              </>
            )}
          </p>
        </div>
      )}

      <div className="card col" style={{ gap: 12 }}>
        {meter('Photos', usage.photos, ent.limits.photos)}
        {meter('Collections', usage.categories, ent.limits.categories)}
        <div className="kv">
          <span>Buyers</span>
          <b>{ent.limits.users === null ? 'unlimited' : `up to ${ent.limits.users}`}</b>
        </div>
        <div className="kv">
          <span>Photos per design</span>
          <b>up to {ent.limits.photosPerDesign}</b>
        </div>
      </div>

      {!(isPro && days === null) && (
        <div className="card">
          <b>{isPro ? 'If you stay on Basic' : 'What changed'}</b>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, lineHeight: 1.5, color: 'var(--mut)', listStyle: 'disc' }}>
            {DOWNGRADE_CHANGES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="hint">
            Basic: {n(LIMITS.basic.categories)} collections, {n(LIMITS.basic.photos)} photos, {LIMITS.basic.photosPerDesign} photo per design, {n(LIMITS.basic.users)} buyers.
          </p>
        </div>
      )}

      {!(isPro && days === null) && (
        <a className="btn" href={`mailto:${SALES_EMAIL}`}>
          <I n="chat" />
          Email sales to upgrade
        </a>
      )}
    </div>
  );
};
