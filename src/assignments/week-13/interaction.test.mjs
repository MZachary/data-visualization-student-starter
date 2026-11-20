import assert from 'node:assert/strict';
import test from 'node:test';
import { isMapFuelPinned, nearestFuelAtHour, toggleMapFuel } from './interaction.ts';

test('nearest fuel inspection ignores missing and distant lines', () => {
  const series = new Map([
    ['SUN', [null, 12]],
    ['WND', [8, 20]],
  ]);
  const fuels = [
    ['SUN', 'Solar'],
    ['WND', 'Wind'],
  ];

  assert.deepEqual(
    nearestFuelAtHour(series, fuels, 1, 13, (value) => value, 3),
    {
      code: 'SUN',
      label: 'Solar',
      hour: 1,
      value: 12,
    },
  );
  assert.equal(
    nearestFuelAtHour(series, fuels, 0, 30, (value) => value, 3),
    null,
  );
});

test('map fuel controls recognize and clear integrated chart aliases', () => {
  assert.equal(isMapFuelPinned('SUN', ['SNB']), true);
  assert.deepEqual(toggleMapFuel('SUN', ['SNB', 'WND']), ['WND']);
  assert.deepEqual(toggleMapFuel('SUN', ['WND']), ['WND', 'SUN']);
});
