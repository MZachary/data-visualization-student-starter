import { localizeReports, makeSeries, type Metric, type Report } from '../week-06/data.ts';

export type Values = (number | null)[];
export interface Entry {
  area: string;
  name: string;
  month: string;
  zone: string;
  clock: string;
  calendarDays: number;
  reportedDays: number;
  completeDays: number;
  retrieved: string | null;
  file: string;
  bytes: number;
  rows: number;
}
export interface Manifest {
  schemaVersion: number;
  datasets: Entry[];
}
export interface Dataset {
  schemaVersion: number;
  area: string;
  name: string;
  month: string;
  zone: string;
  clock: string;
  units: string;
  source: string;
  retrieved: string | null;
  fuels: Record<string, string>;
  records: [string, string, number][];
  omittedNonNumeric: number;
}
export interface Profile {
  date: string;
  rows: Report[];
  hours: number;
}
export interface Loaded {
  entry: Entry;
  data: Dataset;
  days: Profile[];
}

export function decodeDataset(data: Dataset, entry: Entry): Loaded {
  if (
    data.schemaVersion !== 1 ||
    data.area !== entry.area ||
    data.month !== entry.month ||
    data.zone !== entry.zone ||
    data.units !== 'MWh' ||
    !Array.isArray(data.records) ||
    !data.fuels
  ) {
    throw new Error('The saved dataset does not match the selected region/month.');
  }
  const seen = new Set<string>();
  const utc = data.records.map(([period, fuel, value]) => {
    const key = `${period}/${fuel}`;
    if (
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])$/.test(period) ||
      !Number.isFinite(Date.parse(`${period}:00:00Z`)) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !data.fuels[fuel] ||
      seen.has(key)
    ) {
      throw new Error('The saved dataset contains an invalid or duplicate observation.');
    }
    seen.add(key);
    return {
      date: period.slice(0, 10),
      hour: Number(period.slice(11)),
      area: data.area,
      name: data.name,
      fuel,
      fuelName: data.fuels[fuel],
      value,
    };
  });
  const rows = localizeReports(utc, data.zone);
  if (rows.some((r) => !r.date.startsWith(entry.month))) {
    throw new Error('The saved dataset contains observations outside its local month.');
  }
  const grouped = new Map<string, Report[]>();
  rows.forEach((r) => {
    if (!grouped.has(r.date)) grouped.set(r.date, []);
    grouped.get(r.date)!.push(r);
  });
  return {
    entry,
    data,
    days: [...grouped]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rows]) => ({ date, rows, hours: new Set(rows.map((r) => r.hour)).size })),
  };
}

// Match actual calendar dates only when both panels show the same month.
export function comparisonDays(pair: Loaded[]): Profile[][] {
  const complete = pair.map((p) => p.days.filter((d) => d.hours === 24));
  if (pair[0].entry.month !== pair[1].entry.month) return complete;
  const shared = new Set(
    complete[0].map((d) => d.date).filter((d) => complete[1].some((other) => other.date === d)),
  );
  return complete.map((days) => days.filter((d) => shared.has(d.date)));
}

export function averageSeries(days: Profile[], fuels: string[], metric: Metric) {
  return makeSeries(
    days.flatMap((d) => d.rows),
    fuels,
    metric,
  );
}
export function dailySeries(days: Profile[], fuel: string, metric: Metric) {
  return days.map((day) => ({
    date: day.date,
    values: makeSeries(day.rows, [fuel], metric).get(fuel)!,
  }));
}
export function counts(days: Profile[], fuel: string) {
  return Array.from(
    { length: 24 },
    (_, hour) => days.filter((d) => d.rows.some((r) => r.hour === hour && r.fuel === fuel)).length,
  );
}
// Same date across regions; a corresponding day-of-month is just a starting point
// across different months. Both dates are always shown and independently editable.
export function inspectDates(pair: Loaded[], panel: number, date: string): [string, string] {
  if (pair[0].entry.month === pair[1].entry.month) return [date, date];
  return pair.map((p, i) => {
    if (i === panel) return date;
    const target = `${p.entry.month}-${date.slice(8)}`;
    return p.days.find((d) => d.date === target)?.date ?? p.days.at(-1)?.date ?? '';
  }) as [string, string];
}

export function linePath(
  values: Values,
  x: (hour: number) => number,
  y: (value: number) => number,
) {
  return values
    .map((value, hour) =>
      value === null
        ? ''
        : `${hour === 0 || values[hour - 1] === null ? 'M' : 'L'}${x(hour)},${y(value)}`,
    )
    .join(' ');
}
// Test distance to the actual line segment (not just the nearest hourly point).
export function nearestDay(
  lines: { date: string; values: Values }[],
  px: number,
  py: number,
  x: (hour: number) => number,
  y: (value: number) => number,
  tolerance: number,
) {
  let best: string | null = null;
  let distance = tolerance;
  for (const line of lines) {
    for (let h = 0; h < 24; h++) {
      const value = line.values[h];
      if (value === null) continue;
      const ax = x(h),
        ay = y(value);
      const next = line.values[h + 1];
      const bx = h < 23 && next != null ? x(h + 1) : ax;
      const by = h < 23 && next != null ? y(next) : ay;
      const dx = bx - ax,
        dy = by - ay;
      const t =
        dx || dy
          ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
          : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < distance) {
        distance = d;
        best = line.date;
      }
    }
  }
  return best;
}
