export const MIN_DAYS = 3;

export interface Forecast {
  enough: boolean;
  /** Completed days the forecast is based on. */
  basedOnDays: number;
  mtd: number;
  total: number | null;
  low: number | null;
  high: number | null;
  /** Blended cost per remaining day. */
  perDay: number | null;
}

export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * End-of-month forecast. `daily` = cost for day 1..today of the month (the last entry is today, partial, so it is
 * counted in month-to-date but ignored for the rates). The rate is 60% last-7-completed-days average + 40% average of
 * all completed days. Fewer than MIN_DAYS completed days: not enough data. Low/high = slower/faster of the two rates +/- 15%.
 */
export function forecast(daily: number[], monthDays: number): Forecast {
  const mtd = daily.reduce((t, n) => t + n, 0);
  const done = daily.slice(0, -1);
  const none = { enough: false, basedOnDays: done.length, mtd, total: null, low: null, high: null, perDay: null };
  if (done.length < MIN_DAYS || daily.length > monthDays) return none;
  const avg = (a: number[]) => a.reduce((t, n) => t + n, 0) / a.length;
  const recent = avg(done.slice(-7)), overall = avg(done);
  const perDay = Math.max(0, 0.6 * recent + 0.4 * overall);
  const left = monthDays - daily.length;
  const at = (rate: number) => mtd + Math.max(0, rate) * left;
  const total = at(perDay);
  return {
    enough: true, basedOnDays: done.length, mtd, perDay, total,
    low: Math.min(total, at(Math.min(recent, overall) * 0.85)),
    high: Math.max(total, at(Math.max(recent, overall) * 1.15))
  };
}
