import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWindow } from './window.ts';
const day = (date, entries) => ({
  date,
  hours: 24,
  rows: entries.map(([hour, fuel, value]) => ({
    date,
    hour,
    fuel,
    value,
    area: 'CAL',
    name: 'California',
    fuelName: fuel,
  })),
});
test('window shares use generation totals, include unselected fuels, and include both endpoints', () => {
  const days = [
    day('2026-01-01', [
      [16, 'SUN', 10],
      [16, 'NG', 10],
      [17, 'SUN', 90],
      [17, 'NG', 10],
    ]),
  ];
  assert.equal(summarizeWindow(days, ['SUN'], [16, 17], 'amount').get('SUN').value, 50);
  assert.ok(
    Math.abs(
      summarizeWindow(days, ['SUN'], [16, 17], 'share').get('SUN').value - (100 * 100) / 120,
    ) < 1e-10,
  );
  assert.equal(summarizeWindow(days, ['SUN'], [16, 16], 'share').get('SUN').value, 50);
});
test('missing hours stay unavailable and invalidate window shares; zeros and negatives survive', () => {
  const days = [
    day('2026-01-01', [
      [0, 'SUN', 0],
      [1, 'SUN', 10],
      [0, 'BAT', -2],
    ]),
  ];
  const amount = summarizeWindow(days, ['SUN', 'BAT'], [0, 1], 'amount');
  assert.equal(amount.get('SUN').value, 5);
  assert.equal(amount.get('BAT').value, null);
  assert.equal(amount.get('BAT').hours, 1);
  assert.equal(summarizeWindow(days, ['SUN'], [0, 1], 'share').get('SUN').value, null);
  assert.equal(summarizeWindow(days, ['BAT'], [0, 0], 'amount').get('BAT').value, -2);
  assert.equal(summarizeWindow(days, ['SUN'], [0, 0], 'share').get('SUN').value, null);
});
test('repeated hours retain equal-day weighting and counts show uneven coverage', () => {
  const days = [
    day('2026-11-01', [
      [1, 'WND', 10],
      [1, 'WND', 30],
      [2, 'WND', 40],
    ]),
    day('2026-11-02', [[1, 'WND', 40]]),
  ];
  const result = summarizeWindow(days, ['WND'], [1, 2], 'amount').get('WND');
  assert.deepEqual(result, { value: 35, hours: 2, minDays: 1, maxDays: 2 });
});
