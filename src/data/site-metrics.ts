/** Named employers, from the start of the career to the current role. No start year is published. */
export const organizations = [
  'Microsoft',
  'Insight',
  'Telefónica',
  'Lenovo',
  'Amazon Web Services',
  'Cloudflare',
] as const;

export interface YearCount {
  year: number;
  count: number;
}

export function countsByYear(dates: Date[]): YearCount[] {
  const totals = new Map<number, number>();
  for (const date of dates) {
    const year = date.getUTCFullYear();
    totals.set(year, (totals.get(year) || 0) + 1);
  }
  return [...totals.keys()]
    .sort((a, b) => a - b)
    .map((year) => ({ year, count: totals.get(year) || 0 }));
}

export function yearSpan(dates: Date[]): string | undefined {
  if (dates.length === 0) return undefined;
  const years = dates.map((date) => date.getUTCFullYear());
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min}–${max}`;
}

/** Positive only when the latest year has more items than the year before it. */
export function roseVersusPreviousYear(series: YearCount[]): boolean {
  if (series.length < 2) return false;
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];
  return latest.count > previous.count;
}

export function monthlyTotals(days: Array<{ date: string; count: number }>): number[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    totals.set(month, (totals.get(month) || 0) + day.count);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([, count]) => count);
}
