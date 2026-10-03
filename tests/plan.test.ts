import { describe, expect, it } from 'vitest';
import { trialDaysLeft } from '../shared/trial';

const e = (o: { plan?: string; trialEndsAt?: string | null }) => ({ plan: 'basic', trialEndsAt: null, ...o });
describe('trialDaysLeft', () => {
  it('counts whole days, and is null when no trial runs', () => {
    const now = Date.parse('2026-10-04T00:00:00Z');
    expect(trialDaysLeft(e({ trialEndsAt: '2026-10-18T00:00:00Z' }), now)).toBe(14);
    expect(trialDaysLeft(e({ trialEndsAt: '2026-10-04T10:00:00Z' }), now)).toBe(1);
    expect(trialDaysLeft(e({ trialEndsAt: '2026-10-01T00:00:00Z' }), now)).toBeNull();
    expect(trialDaysLeft(e({ plan: 'founder' }), now)).toBeNull();
  });
});
