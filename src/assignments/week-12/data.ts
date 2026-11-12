import { csvParse } from 'd3-dsv';

export type PeriodId = 'month' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5' | 'weekends';

export interface GenerationRow {
  date: string;
  day: number;
  dow: number;
  month: string;
  regionCode: string;
  region: string;
  fuelCode: string;
  fuel: string;
  value: number;
}

export interface FuelTotal {
  fuel: string;
  fuelCode: string;
  value: number;
}

export interface GenerationAggregate {
  positives: FuelTotal[];
  negatives: FuelTotal[];
  positiveTotal: number;
  dayCount: number;
  intervalCount: number;
}

export const periods: Array<{
  id: PeriodId;
  label: string;
  detail: string;
  matches: (day: number, dow: number) => boolean;
}> = [
  { id: 'month', label: 'Whole month', detail: 'All reported days', matches: () => true },
  { id: 'w1', label: 'Week 1', detail: 'Days 1–7', matches: (day) => day >= 1 && day <= 7 },
  { id: 'w2', label: 'Week 2', detail: 'Days 8–14', matches: (day) => day >= 8 && day <= 14 },
  { id: 'w3', label: 'Week 3', detail: 'Days 15–21', matches: (day) => day >= 15 && day <= 21 },
  { id: 'w4', label: 'Week 4', detail: 'Days 22–28', matches: (day) => day >= 22 && day <= 28 },
  { id: 'w5', label: 'Week 5', detail: 'Days 29–31', matches: (day) => day >= 29 && day <= 31 },
  {
    id: 'weekends',
    label: 'Weekends',
    detail: 'Saturdays and Sundays',
    matches: (_day, dow) => dow === 0 || dow === 6,
  },
];

export function parseGenerationRows(text: string): GenerationRow[] {
  return csvParse(text, (raw) => {
    const timestamp = raw.period_start_local;
    const value = Number(raw.generation_mwh);
    const date = timestamp?.slice(0, 10) ?? '';
    const year = Number(date.slice(0, 4));
    const monthNumber = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    if (
      !timestamp ||
      !raw.region_code ||
      !raw.region ||
      !raw.fuel_code ||
      !raw.fuel ||
      !Number.isFinite(value) ||
      !Number.isInteger(day)
    ) {
      return null;
    }
    return {
      date,
      day,
      dow: new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay(),
      month: raw.month || date.slice(0, 7),
      regionCode: raw.region_code,
      region: raw.region,
      fuelCode: raw.fuel_code,
      fuel: raw.fuel,
      value,
    };
  });
}

export function aggregateGeneration(
  rows: GenerationRow[],
  regionCode: string,
  month: string,
  periodId: PeriodId,
): GenerationAggregate {
  const period = periods.find((candidate) => candidate.id === periodId) ?? periods[0];
  const filtered = rows.filter(
    (row) =>
      row.regionCode === regionCode &&
      row.month === month &&
      period.matches(row.day, row.dow),
  );
  const days = new Set(filtered.map((row) => row.date));
  const positives = new Map<string, FuelTotal>();
  const negatives = new Map<string, FuelTotal>();

  for (const row of filtered) {
    const target = row.value >= 0 ? positives : negatives;
    const current = target.get(row.fuelCode);
    target.set(row.fuelCode, {
      fuel: row.fuel,
      fuelCode: row.fuelCode,
      value: (current?.value ?? 0) + row.value,
    });
  }

  const positiveTotals = [...positives.values()]
    .filter((fuel) => fuel.value > 0)
    .sort((a, b) => b.value - a.value);
  const negativeTotals = [...negatives.values()]
    .filter((fuel) => fuel.value < 0)
    .sort((a, b) => a.value - b.value);

  return {
    positives: positiveTotals,
    negatives: negativeTotals,
    positiveTotal: positiveTotals.reduce((total, fuel) => total + fuel.value, 0),
    dayCount: days.size,
    intervalCount: filtered.length,
  };
}
