export const escapeIlikePattern = (value: string): string => {
  return value.replace(/[%_\\]/g, '\\$&');
};

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface MonthWindow {
  start: Date;
  end: Date;
  label: string;
}

/**
 * UTC [start, end) window for a given year/month. `month` may overflow or go
 * negative (e.g. -1 rolls back to December of the previous year).
 */
export const monthWindow = (year: number, month: number): MonthWindow => {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start, end, label: SHORT_MONTHS[start.getUTCMonth()] };
};

/** Last `n` month windows ending with the month of `now`, oldest first. */
export const lastNMonthWindows = (now: Date, n: number): MonthWindow[] => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return Array.from({ length: n }, (_, i) =>
    monthWindow(year, month - (n - 1 - i)),
  );
};

/** Month-over-month percent change, rounded to 1 decimal. */
export const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};
