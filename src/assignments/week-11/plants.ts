export interface Segment {
  region: string | null;
  ba: string;
  fuel: string;
  mw: number;
  generators: number;
}
export interface Plant {
  id: string;
  name: string;
  state: string;
  county: string;
  lat: number;
  lon: number;
  segments: Segment[];
}
export interface PlantData {
  snapshot: string;
  plants: Plant[];
  unmatchedAuthorities: Record<string, number>;
}
export const fuelNames: Record<string, string> = {
  SUN: 'Solar',
  WND: 'Wind',
  NG: 'Natural gas',
  NUC: 'Nuclear',
  WAT: 'Hydro',
  COL: 'Coal',
  GEO: 'Geothermal',
  BAT: 'Battery storage',
  PS: 'Pumped storage',
  OES: 'Other storage',
  OIL: 'Petroleum',
  OTH: 'Other / biomass',
};
export function regionPlants(plants: Plant[], region: string) {
  return plants.flatMap((p) => {
    const segments = p.segments.filter(
      (s) => region === 'ALL' || (region === 'UNMATCHED' ? !s.region : s.region === region),
    );
    return segments.length ? [{ ...p, segments }] : [];
  });
}
export const capacity = (p: Plant) => p.segments.reduce((sum, s) => sum + s.mw, 0);
// EIA-930 can report integrated batteries separately or group pumped storage with hydro.
// The inventory keeps individual generator technologies, rather than inferring hybrid output.
export function matchesFuel(fuel: string, focus: string[]) {
  return (
    !focus.length ||
    focus.some(
      (f) =>
        f === fuel ||
        (f === 'WAT' && fuel === 'PS') ||
        (f === 'SNB' && fuel === 'SUN') ||
        (f === 'WNB' && fuel === 'WND'),
    )
  );
}
export function plantFuel(p: Plant, focus: string[] = []) {
  const totals = new Map<string, number>();
  for (const s of p.segments)
    if (matchesFuel(s.fuel, focus)) totals.set(s.fuel, (totals.get(s.fuel) ?? 0) + s.mw);
  if (!totals.size && focus.length) return plantFuel(p);
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'OTH';
}
