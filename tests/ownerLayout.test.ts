import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/layouts/select';

// App.tsx picks the kit with layoutFor(merchant.layout, maisonFailed) for every session: buyers and the signed-in owner alike.
describe('layout for an owner session', () => {
  it('a Maison store gives the owner the Maison kit (and so "View as a buyer" shows Maison)', () => {
    expect(layoutFor('maison')).toBe('maison');
  });
  it('a Classic store, a missing or unknown layout stays Classic (Emergent)', () => {
    expect(layoutFor('emergent')).toBe('emergent');
    expect(layoutFor(undefined)).toBe('emergent');
    expect(layoutFor('gilded')).toBe('emergent');
  });
  it('falls back to Classic when the Maison chunk could not load', () => {
    expect(layoutFor('maison', true)).toBe('emergent');
  });
});
