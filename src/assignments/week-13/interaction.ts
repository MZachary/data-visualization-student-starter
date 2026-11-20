import type { Values } from '../week-08/data.ts';
import { matchesFuel } from '../week-11/plants.ts';

export interface FuelHit {
  code: string;
  label: string;
  hour: number;
  value: number;
}

export function nearestFuelAtHour(
  series: Map<string, Values>,
  fuels: [string, string][],
  hour: number,
  pointerY: number,
  projectY: (value: number) => number,
  maximumDistance: number,
): FuelHit | null {
  let closest: (FuelHit & { distance: number }) | null = null;

  for (const [code, label] of fuels) {
    const value = series.get(code)?.[hour];
    if (value == null) continue;
    const distance = Math.abs(projectY(value) - pointerY);
    if (distance <= maximumDistance && (!closest || distance < closest.distance)) {
      closest = { code, label, hour, value, distance };
    }
  }

  if (!closest) return null;
  return {
    code: closest.code,
    label: closest.label,
    hour: closest.hour,
    value: closest.value,
  };
}

export function isMapFuelPinned(mapFuel: string, pinned: string[]) {
  return pinned.some((fuel) => matchesFuel(mapFuel, [fuel]));
}

export function toggleMapFuel(mapFuel: string, pinned: string[]) {
  if (isMapFuelPinned(mapFuel, pinned)) {
    return pinned.filter((fuel) => !matchesFuel(mapFuel, [fuel]));
  }
  return [...pinned, mapFuel];
}
