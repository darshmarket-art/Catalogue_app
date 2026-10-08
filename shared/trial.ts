import { CONTACT_SALES } from './sales';

/** Whole days of trial left, or null when not on a running trial (founder, paid, or Basic after the trial). */
export function trialDaysLeft(e: { plan: string; trialEndsAt: string | null }, now = Date.now()): number | null {
  if (e.plan !== 'basic' || !e.trialEndsAt) return null;
  const ms = Date.parse(e.trialEndsAt) - now;
  return ms > 0 ? Math.ceil(ms / 86400000) : null;
}

/** The one wording used by the WhatsApp reminder, the stored trialNotice and the admin banner. days = null means the trial has ended. */
export const trialMessage = (days: number | null) =>
  days === null
    ? 'Your Pro trial has ended: you are on Basic. Nothing was deleted. To upgrade and get everything back, ' + CONTACT_SALES + '.'
    : `${days} ${days === 1 ? 'day' : 'days'} of your Pro trial left. After that you move to Basic. To upgrade, ${CONTACT_SALES}.`;

/** What changes when the trial ends (plan.md downgrade rules). */
export const DOWNGRADE_CHANGES = [
  'Orders, order history and the orders desk are locked (visitors use Enquire on WhatsApp)',
  'Insights, live visitors, buyer engagement, audit log and PDF catalogue are locked',
  'Limits drop to 5 categories, 200 photos, 1 photo per design and 50 buyers',
  'Nothing is deleted or hidden: you only cannot add more beyond Basic limits'
];
