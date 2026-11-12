import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateGeneration, parseGenerationRows } from './data.ts';

const csv = `period_start_local,month,region_code,region,fuel_code,fuel,generation_mwh
2026-01-01T00:00,2026-01,CAL,California,NG,Natural Gas,100
2026-01-01T06:00,2026-01,CAL,California,BAT,Battery storage,10
2026-01-01T12:00,2026-01,CAL,California,BAT,Battery storage,-4
2026-01-03T00:00,2026-01,CAL,California,NG,Natural Gas,50
2026-01-03T06:00,2026-01,TEX,Texas,NG,Natural Gas,999
2026-07-01T00:00,2026-07,CAL,California,NG,Natural Gas,999`;

test('parses valid rows and derives local calendar fields without a timezone shift', () => {
  const rows = parseGenerationRows(csv);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    { date: rows[3].date, day: rows[3].day, dow: rows[3].dow },
    { date: '2026-01-03', day: 3, dow: 6 },
  );
});

test('filters before aggregating and preserves positive and negative readings separately', () => {
  const aggregate = aggregateGeneration(parseGenerationRows(csv), 'CAL', '2026-01', 'month');
  assert.equal(aggregate.intervalCount, 4);
  assert.equal(aggregate.dayCount, 2);
  assert.equal(aggregate.positiveTotal, 160);
  assert.deepEqual(
    aggregate.positives.map(({ fuelCode, value }) => [fuelCode, value]),
    [
      ['NG', 150],
      ['BAT', 10],
    ],
  );
  assert.deepEqual(
    aggregate.negatives.map(({ fuelCode, value }) => [fuelCode, value]),
    [['BAT', -4]],
  );
});

test('weekend reduction includes Saturdays and Sundays only', () => {
  const aggregate = aggregateGeneration(parseGenerationRows(csv), 'CAL', '2026-01', 'weekends');
  assert.equal(aggregate.intervalCount, 1);
  assert.equal(aggregate.positiveTotal, 50);
});
