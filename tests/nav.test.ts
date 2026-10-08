import { describe, expect, it } from 'vitest';
import { backAction } from '../src/nav';

describe('back button rules', () => {
  it('goes home from any other screen', () => {
    for (const s of ['catalogue', 'shortlist', 'orders', 'admin-orders', 'new-product']) expect(backAction(s, 'categories', 0, 1000)).toBe('home');
  });
  it('asks on home, and leaves only on a second press inside 2 seconds', () => {
    expect(backAction('categories', 'categories', 0, 10_000)).toBe('ask');
    expect(backAction('categories', 'categories', 10_000, 11_500)).toBe('leave');
    expect(backAction('categories', 'categories', 10_000, 12_500)).toBe('ask');
  });
});
