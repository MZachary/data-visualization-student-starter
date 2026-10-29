import { averageSeries, counts, type Profile } from '../week-08/data.ts';
import type { Metric } from '../week-06/data.ts';

export type HourWindow = [number, number];

// Equal weight per clock hour, after the shared calculation gives each day equal weight.
// Incomplete fuel profiles remain unavailable; never silently turn gaps into zero.
export function summarizeWindow(
  days: Profile[],
  fuels: string[],
  window: HourWindow,
  metric: Metric,
) {
  const allFuels = [...new Set([...fuels, ...days.flatMap((d) => d.rows.map((r) => r.fuel))])];
  const means = averageSeries(days, allFuels, 'amount');
  const [start, end] = window;
  const length = end - start + 1;
  const summaries = new Map(
    allFuels.map((fuel) => {
      const values = means.get(fuel)!.slice(start, end + 1);
      const observed = values.filter((v): v is number => v !== null);
      const samples = counts(days, fuel).slice(start, end + 1);
      return [
        fuel,
        {
          value: observed.length === length ? observed.reduce((a, b) => a + b, 0) / length : null,
          hours: observed.length,
          minDays: Math.min(...samples),
          maxDays: Math.max(...samples),
        },
      ] as const;
    }),
  );
  const reported = [...summaries.values()].filter((s) => s.hours > 0);
  const total = reported.every((s) => s.value !== null)
    ? reported.reduce((sum, s) => sum + s.value!, 0)
    : 0;
  return new Map(
    fuels.map((fuel) => {
      const summary = summaries.get(fuel)!;
      return [
        fuel,
        {
          ...summary,
          value:
            metric === 'amount'
              ? summary.value
              : summary.value !== null && total > 0
                ? (summary.value / total) * 100
                : null,
        },
      ];
    }),
  );
}
