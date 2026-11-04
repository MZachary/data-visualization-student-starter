import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { regionPlants, capacity, plantFuel, matchesFuel } from './plants.ts';
const data = JSON.parse(
  readFileSync(new URL('../../../public/data/week-11/plants.json', import.meta.url)),
);
test('published inventory has unique plants, valid coordinates, and capacity in all 13 regions', () => {
  assert.equal(data.snapshot, '2026-09');
  assert.equal(new Set(data.plants.map((p) => p.id)).size, data.plants.length);
  const regions = new Set();
  let unmatched = 0;
  for (const p of data.plants) {
    assert.ok(p.lat >= 24 && p.lat <= 50 && p.lon >= -125 && p.lon <= -66);
    assert.ok(p.name && p.segments.length);
    for (const s of p.segments) {
      assert.ok(Number.isFinite(s.mw) && s.mw >= 0 && s.generators > 0);
      if (s.region) regions.add(s.region);
      else unmatched += s.generators;
    }
  }
  assert.equal(regions.size, 13);
  assert.equal(
    unmatched,
    Object.values(data.unmatchedAuthorities).reduce((a, b) => a + b, 0),
  );
  const diablo = data.plants.find((p) => p.name === 'Diablo Canyon');
  assert.ok(diablo);
  assert.equal(plantFuel(diablo), 'NUC');
  assert.ok(regionPlants([diablo], 'CAL').length);
});
test('mixed-authority and mixed-fuel plants keep only the selected regional generators', () => {
  const p = {
    id: '1',
    name: 'Fixture',
    segments: [
      { region: 'CAL', ba: 'CISO', fuel: 'SUN', mw: 80, generators: 1 },
      { region: 'CAL', ba: 'CISO', fuel: 'BAT', mw: 20, generators: 1 },
      { region: 'TEX', ba: 'ERCO', fuel: 'NG', mw: 200, generators: 1 },
      { region: null, ba: 'OLD', fuel: 'OTH', mw: 10, generators: 1 },
    ],
  };
  const cal = regionPlants([p], 'CAL')[0];
  assert.equal(capacity(cal), 100);
  assert.equal(plantFuel(cal), 'SUN');
  assert.equal(plantFuel(cal, ['BAT']), 'BAT');
  assert.equal(capacity(regionPlants([p], 'ALL')[0]), 310);
  assert.equal(capacity(regionPlants([p], 'UNMATCHED')[0]), 10);
  assert.deepEqual(regionPlants([p], 'NY'), []);
  assert.equal(matchesFuel('PS', ['WAT']), true);
  assert.equal(matchesFuel('SUN', ['SNB']), true);
  assert.equal(matchesFuel('NG', ['SUN']), false);
});
