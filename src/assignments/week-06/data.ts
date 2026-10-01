import { csvParse } from 'd3-dsv';

export interface Report {
  date: string;
  hour: number;
  area: string;
  name: string;
  fuel: string;
  fuelName: string;
  value: number;
}
export type Metric = 'amount' | 'share';
// Reference clocks chosen for this visualization, not official region-wide time zones.
export const regions: Record<string, { zone: string; clock: string }> = {
  CAL: { zone: 'America/Los_Angeles', clock: 'Pacific · Los Angeles' },
  CAR: { zone: 'America/New_York', clock: 'Eastern · New York' },
  CENT: { zone: 'America/Chicago', clock: 'Central · Chicago' },
  FLA: { zone: 'America/New_York', clock: 'Eastern · New York' },
  MIDA: { zone: 'America/New_York', clock: 'Eastern · New York' },
  MIDW: { zone: 'America/Chicago', clock: 'Central · Chicago' },
  NE: { zone: 'America/New_York', clock: 'Eastern · New York' },
  NW: { zone: 'America/Los_Angeles', clock: 'Pacific · Los Angeles' },
  NY: { zone: 'America/New_York', clock: 'Eastern · New York' },
  SE: { zone: 'America/New_York', clock: 'Eastern · New York' },
  SW: { zone: 'America/Phoenix', clock: 'Arizona · Phoenix' },
  TEN: { zone: 'America/Chicago', clock: 'Central · Chicago' },
  TEX: { zone: 'America/Chicago', clock: 'Central · Chicago' },
};
export const colors: Record<string, string> = {
  SUN: '#b98205',
  NG: '#c15b35',
  WND: '#2389b3',
  NUC: '#8561b2',
  WAT: '#218573',
  COL: '#475569',
  BAT: '#c34d86',
  GEO: '#688637',
  OIL: '#925d36',
  OTH: '#7c858e',
  PS: '#a93864',
  SNB: '#957021',
  WNB: '#406994',
  OES: '#934da8',
  UES: '#934da8',
  UNK: '#59636c',
};
export function parseReports(text: string): Report[] {
  return csvParse(text).flatMap((row) => {
    const value = row.value?.trim() ? Number(row.value) : NaN;
    if (!Number.isFinite(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(row.period)) return [];
    return [
      {
        date: row.period.slice(0, 10),
        hour: Number(row.period.slice(11)),
        area: row.respondent,
        name: row['respondent-name'],
        fuel: row.fueltype,
        fuelName: row['type-name'],
        value,
      },
    ];
  });
}

// Convert the timestamp before grouping by date or hour, including DST offsets.
export function localizeReports(rows: Report[], zone: string): Report[] {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const cache = new Map<string, { date: string; hour: number }>();
  return rows.map((row) => {
    const key = `${row.date}T${String(row.hour).padStart(2, '0')}:00:00Z`;
    let local = cache.get(key);
    if (!local) {
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(key)).map((p) => [p.type, p.value]),
      );
      local = { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
      cache.set(key, local);
    }
    return { ...row, ...local };
  });
}

// Require a report in every local clock-hour bin, in BOTH regions, on the same dates.
// This removes partial snapshot boundaries. It does not imply every fuel is complete.
export function commonCompleteDates(pair: Report[][]): string[] {
  const sets = pair.map((rows) => {
    const days = new Map<string, Set<number>>();
    rows.forEach((row) => {
      if (!days.has(row.date)) days.set(row.date, new Set());
      days.get(row.date)!.add(row.hour);
    });
    return new Set([...days].filter(([, hours]) => hours.size === 24).map(([date]) => date));
  });
  return [...(sets[0] ?? [])].filter((date) => sets.every((set) => set.has(date))).sort();
}

export function sampleCounts(rows: Report[], fuel: string): number[] {
  return Array.from(
    { length: 24 },
    (_, hour) =>
      new Set(rows.filter((r) => r.fuel === fuel && r.hour === hour).map((r) => r.date)).size,
  );
}

// First average repeated clock hours within a day (fall-back DST), then average
// daily values so each observed day has equal weight. Missing reports are excluded.
export function makeSeries(rows: Report[], fuels: string[], metric: Metric) {
  const grouped = new Map<string, Map<number, Map<string, number[]>>>();
  rows.forEach((row) => {
    if (!grouped.has(row.fuel)) grouped.set(row.fuel, new Map());
    const hours = grouped.get(row.fuel)!;
    if (!hours.has(row.hour)) hours.set(row.hour, new Map());
    const dates = hours.get(row.hour)!;
    if (!dates.has(row.date)) dates.set(row.date, []);
    dates.get(row.date)!.push(row.value);
  });
  const means = new Map(
    [...grouped].map(([fuel, hours]) => [
      fuel,
      Array.from({ length: 24 }, (_, hour) => {
        const days = hours.get(hour);
        if (!days) return null;
        const daily = [...days.values()].map(
          (values) => values.reduce((s, v) => s + v, 0) / values.length,
        );
        return daily.reduce((s, v) => s + v, 0) / daily.length;
      }),
    ]),
  );
  return new Map(
    fuels.map((fuel) => [
      fuel,
      Array.from({ length: 24 }, (_, hour) => {
        const value = means.get(fuel)?.[hour];
        if (value == null) return null;
        if (metric === 'amount') return value;
        const total = [...means.values()].reduce((sum, values) => sum + (values[hour] ?? 0), 0);
        return total > 0 ? (value / total) * 100 : null;
      }),
    ]),
  );
}
