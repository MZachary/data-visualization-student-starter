import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  averageSeries,
  comparisonDays,
  counts,
  dailySeries,
  decodeDataset,
  inspectDates,
  linePath,
  nearestDay,
} from './data.ts';

const entry = (month = '2026-01', area = 'CAL', zone = 'UTC') => ({ month, area, zone });
const row = (date, hour, fuel, value) => ({
  date,
  hour,
  fuel,
  value,
  area: 'CAL',
  name: 'California',
  fuelName: fuel,
});
const day = (date, rows, hours = 24) => ({ date, rows, hours });
const loaded = (month, days) => ({ entry: entry(month), days });

test('means weight days equally, omit missing fuels, retain negatives, and keep all fuels in share denominators', () => {
  const days = [
    day('2026-01-01', [
      row('2026-01-01', 0, 'WND', 10),
      row('2026-01-01', 0, 'NG', 90),
      row('2026-01-01', 0, 'BAT', -10),
    ]),
    day('2026-01-02', [row('2026-01-02', 0, 'WND', 30), row('2026-01-02', 0, 'NG', 10)]),
    day('2026-01-03', [row('2026-01-03', 0, 'NG', 20)]),
  ];
  assert.equal(averageSeries(days, ['WND'], 'amount').get('WND')[0], 20);
  assert.equal(averageSeries(days, ['BAT'], 'amount').get('BAT')[0], -10);
  assert.equal(averageSeries(days, ['WND'], 'share').get('WND')[0], 40);
  assert.equal(averageSeries(days, ['WND'], 'share').get('WND')[1], null);
  assert.equal(counts(days, 'WND')[0], 2);
  assert.equal(dailySeries(days, 'WND', 'share')[0].values[0], 100 / 9);
  assert.equal(dailySeries(days, 'WND', 'share')[2].values[0], null);
  assert.equal(
    averageSeries([day('2026-01-01', [row('2026-01-01', 0, 'BAT', -1)])], ['BAT'], 'share').get(
      'BAT',
    )[0],
    null,
  );
});

test('same month compares shared complete dates; different months retain independent complete days', () => {
  const a = loaded('2026-01', [
    day('2026-01-01', []),
    day('2026-01-02', []),
    day('2026-01-03', [], 23),
  ]);
  const b = loaded('2026-01', [day('2026-01-02', []), day('2026-01-03', [])]);
  assert.deepEqual(
    comparisonDays([a, b]).map((ds) => ds.map((d) => d.date)),
    [['2026-01-02'], ['2026-01-02']],
  );
  const c = loaded('2026-07', [day('2026-07-01', [])]);
  assert.deepEqual(
    comparisonDays([a, c]).map((ds) => ds.length),
    [2, 1],
  );
  assert.deepEqual(inspectDates([a, b], 0, '2026-01-01'), ['2026-01-01', '2026-01-01']);
  assert.deepEqual(inspectDates([a, c], 0, '2026-01-02'), ['2026-01-02', '2026-07-01']);
});

function decode(records, month, zone = 'America/New_York') {
  return decodeDataset(
    {
      schemaVersion: 1,
      area: 'CAL',
      month,
      zone,
      name: 'Fixture',
      units: 'MWh',
      fuels: { WND: 'Wind' },
      records,
    },
    entry(month, 'CAL', zone),
  );
}

test('UTC conversion preserves local boundaries and DST repeated hours get equal-day weighting', () => {
  const records = [
    ['2026-11-01T04', 'WND', 10], // local midnight
    ['2026-11-01T05', 'WND', 10], // 01:00 EDT
    ['2026-11-01T06', 'WND', 30], // 01:00 EST
    ['2026-11-02T06', 'WND', 40],
  ];
  const data = decode(records, '2026-11');
  assert.equal(data.days[0].date, '2026-11-01');
  assert.equal(data.days[0].hours, 2);
  assert.equal(averageSeries(data.days, ['WND'], 'amount').get('WND')[1], 30);
  assert.equal(counts(data.days, 'WND')[1], 2);
  const spring = Array.from({ length: 23 }, (_, h) => [
    new Date(Date.UTC(2026, 2, 8, 5 + h)).toISOString().slice(0, 13),
    'WND',
    10,
  ]);
  const springData = decode(spring, '2026-03');
  assert.equal(springData.days.length, 1);
  assert.equal(springData.days[0].hours, 23);
  assert.equal(comparisonDays([springData, springData])[0].length, 0);
  assert.throws(() => decode([['2026-11-01T03', 'WND', 10]], '2026-11'), /outside/);
});

test('rejects duplicate and invalid records', () => {
  assert.throws(
    () =>
      decode(
        [
          ['2026-01-02T00', 'WND', 1],
          ['2026-01-02T00', 'WND', 1],
        ],
        '2026-01',
      ),
    /duplicate/,
  );
  assert.throws(() => decode([['2026-01-02T99', 'WND', 1]], '2026-01'), /invalid/);
  assert.throws(() => decode([['2026-01-02T00', 'WND', null]], '2026-01'), /invalid/);
});

test('line paths and hit testing respect gaps and use segment distance', () => {
  const values = Array(24).fill(null);
  values[0] = 0;
  values[1] = 10;
  values[3] = 10;
  const lines = [{ date: '2026-01-01', values }];
  const x = (h) => h * 10,
    y = (v) => v;
  assert.match(linePath(values, x, y), /^M0,0 L10,10  M30,10/);
  assert.equal(nearestDay(lines, 5, 5, x, y, 1), '2026-01-01');
  assert.equal(nearestDay(lines, 20, 10, x, y, 1), null);
});

test('published manifest matches every shard, reproduces coverage counts', () => {
  const base = new URL('../../../public/data/week-08/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)));
  assert.ok(manifest.datasets.length >= 39);
  for (const e of manifest.datasets) {
    const buffer = readFileSync(new URL(e.file, base));
    const raw = JSON.parse(buffer);
    const data = decodeDataset(raw, e);
    assert.equal(buffer.length, e.bytes);
    assert.equal(raw.records.length, e.rows);
    assert.equal(data.days.length, e.reportedDays);
    assert.equal(data.days.filter((d) => d.hours === 24).length, e.completeDays);
    assert.ok(e.completeDays <= e.calendarDays);
    assert.ok(e.bytes < 400_000);
  }
});
