import React from 'react';
import { usePlan } from '../plan';
import { trialDaysLeft } from '../../shared/trial';
import { Icon } from '../layouts/emergent/ui';

/**
 * A slim trial line shown on every owner screen except the Admin hub (which has its own card): the days left, turning amber in the
 * last three days, and "ended" once the store is on Basic. Tapping opens Plan and usage.
 */
export const TrialBanner: React.FC<{ onOpenPlan: () => void }> = ({ onOpenPlan }) => {
  const ent = usePlan();
  const days = trialDaysLeft(ent);
  const ended = days === null && ent.plan === 'basic' && !!ent.trialEndsAt;
  if (days === null && !ended) return null;
  const urgent = ended || (days !== null && days <= 3);
  return (
    <button type="button" className={`em-trialbar${urgent ? ' urgent' : ''}`} data-testid="trial-bar" onClick={onOpenPlan}>
      <Icon n={urgent ? 'clock' : 'award'} size={14} />
      <span>{ended ? 'Your Pro trial has ended: you are on Basic.' : `${days} ${days === 1 ? 'day' : 'days'} of your Pro trial left${urgent ? ' · upgrade to keep orders, insights and PDF' : ''}.`}</span>
      <b>{ended ? 'Upgrade' : 'Plan'}</b>
    </button>
  );
};
