/** Whole days of trial left, or null when not on a running trial (founder, paid, or Basic after the trial). */
export function trialDaysLeft(e: { plan: string; trialEndsAt: string | null }, now = Date.now()): number | null {
  if (e.plan !== 'basic' || !e.trialEndsAt) return null;
  const ms = Date.parse(e.trialEndsAt) - now;
  return ms > 0 ? Math.ceil(ms / 86400000) : null;
}
