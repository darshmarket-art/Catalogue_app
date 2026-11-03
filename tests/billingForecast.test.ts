import { describe, expect, it } from 'vitest';
import { daysInMonth, forecast } from '../server/billingForecast';

describe('forecast', () => {
  it('says not enough data on days 1-3 (fewer than 3 completed days)', () => {
    for (const n of [1, 2, 3]) {
      const f = forecast(Array(n).fill(10), 30);
      expect(f.enough).toBe(false);
      expect(f.total).toBeNull();
      expect(f.mtd).toBe(10 * n);
    }
    expect(forecast([], 30)).toMatchObject({ enough: false, mtd: 0 });
  });

  it('forecasts from day 4: flat spend gives mtd + rate * remaining days', () => {
    const f = forecast(Array(4).fill(10), 30); // 3 completed days at 10, today partial 10
    expect(f.enough).toBe(true);
    expect(f.basedOnDays).toBe(3);
    expect(f.perDay).toBeCloseTo(10);
    expect(f.total).toBeCloseTo(40 + 10 * 26);
    expect(f.low!).toBeLessThanOrEqual(f.total!);
    expect(f.high!).toBeGreaterThanOrEqual(f.total!);
  });

  it('blends the last 7 days with the month average, ignoring the partial today', () => {
    // 10 completed days: 3 at 0 then 7 at 10, today 1 (partial, ignored for the rate)
    const daily = [0, 0, 0, 10, 10, 10, 10, 10, 10, 10, 1];
    const f = forecast(daily, 30);
    expect(f.perDay).toBeCloseTo(0.6 * 10 + 0.4 * 7);
    expect(f.total).toBeCloseTo(71 + f.perDay! * 19);
    expect(f.high!).toBeGreaterThan(f.total!);
    expect(f.low!).toBeLessThan(f.total!);
  });

  it('zero spend forecasts zero with a zero range', () => {
    expect(forecast(Array(10).fill(0), 31)).toMatchObject({ enough: true, total: 0, low: 0, high: 0, perDay: 0 });
  });

  it('never goes below month-to-date when credits make recent days negative', () => {
    const f = forecast([5, 5, 5, 5, -50, 3], 30);
    expect(f.total!).toBeGreaterThanOrEqual(f.mtd);
    expect(f.low!).toBeGreaterThanOrEqual(Math.min(f.mtd, f.total!) - 1e-9);
  });

  it('last day of the month has nothing left to project', () => {
    const f = forecast(Array(30).fill(2), 30);
    expect(f.total).toBeCloseTo(60);
    expect(f.low).toBeCloseTo(60);
    expect(f.high).toBeCloseTo(60);
  });

  it('refuses a series longer than the month', () => {
    expect(forecast(Array(32).fill(1), 31).enough).toBe(false);
  });

  it('month lengths, including leap years', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });
});
