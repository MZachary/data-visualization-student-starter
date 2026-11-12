import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { select, csv } from 'd3';
import { useContainerDimensions } from './useContainerDimensions.js';
import { viz } from './viz.js';

const DATA_URL = '/data/eia_generation_6hour.csv';

// Period definitions. `matches(day)` returns true if a day-of-month
// belongs to the period.
const PERIODS = [
  { id: 'month', label: 'Whole month', matches: () => true },
  { id: 'w1', label: 'Week 1', sub: 'Jan 1–7', matches: (d) => d >= 1 && d <= 7 },
  { id: 'w2', label: 'Week 2', sub: 'Jan 8–14', matches: (d) => d >= 8 && d <= 14 },
  { id: 'w3', label: 'Week 3', sub: 'Jan 15–21', matches: (d) => d >= 15 && d <= 21 },
  { id: 'w4', label: 'Week 4', sub: 'Jan 22–28', matches: (d) => d >= 22 && d <= 28 },
  { id: 'w5', label: 'Week 5', sub: 'Jan 29–31', matches: (d) => d >= 29 && d <= 31 },
  { id: 'weekends', label: 'Weekends', sub: 'Sat & Sun', matches: null },
];

export const App = () => {
  const divRef = useRef(null);
  const svgRef = useRef(null);
  const [rawRows, setRawRows] = useState([]);
  const [error, setError] = useState(null);

  const [region, setRegion] = useState(null);
  const [periodId, setPeriodId] = useState('month');
  const [pinned, setPinned] = useState(() => new Set());

  const dimensions = useContainerDimensions(divRef);

  // ----- Load data -----------------------------------------------------
  useEffect(() => {
    csv(DATA_URL)
      .then((loaded) => {
        const parsed = [];
        for (const d of loaded) {
          const ts = d.period_start_local;
          const gen = Number(d.generation_mwh);
          if (!ts || !ts.length) continue;
          if (!Number.isFinite(gen)) continue;
          const date = ts.slice(0, 10); // "YYYY-MM-DD"
          // Parse day-of-week with UTC to avoid local timezone shifts.
          const y = Number(date.slice(0, 4));
          const m = Number(date.slice(5, 7));
          const day = Number(date.slice(8, 10));
          const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
          parsed.push({
            date,
            day,
            dow,
            region_code: d.region_code,
            region: d.region,
            fuel_code: d.fuel_code,
            fuel: d.fuel,
            value: gen,
          });
        }
        setRawRows(parsed);
      })
      .catch((err) => {
        console.error('Failed to load data', err);
        setError(String(err));
      });
  }, []);

  // ----- Regions list --------------------------------------------------
  const regions = useMemo(() => {
    const map = new Map();
    for (const r of rawRows) {
      if (!map.has(r.region_code)) map.set(r.region_code, r.region);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rawRows]);

  // Default region once regions load.
  useEffect(() => {
    if (region === null && regions.length > 0) {
      const cal = regions.find((r) => r.code === 'CAL');
      setRegion(cal ? cal.code : regions[0].code);
    }
  }, [regions, region]);

  // ----- Current period object ----------------------------------------
  const period = useMemo(
    () => PERIODS.find((p) => p.id === periodId) || PERIODS[0],
    [periodId],
  );

  // ----- Aggregate for region × period --------------------------------
  const aggregate = useMemo(() => {
    if (region === null || rawRows.length === 0) {
      return {
        positives: [],
        negatives: [],
        positiveTotal: 0,
        dayCount: 0,
        regionName: '',
        periodLabel: '',
      };
    }

    const regionRows = rawRows.filter((r) => r.region_code === region);
    const regionName = regionRows.length ? regionRows[0].region : region;

    const inPeriod = regionRows.filter((r) => {
      if (period.id === 'weekends') {
        return r.dow === 0 || r.dow === 6;
      }
      return period.matches(r.day);
    });

    // Count distinct days in the period (for mean MWh/day).
    const daySet = new Set();
    for (const r of inPeriod) daySet.add(r.date);
    const dayCount = daySet.size;

    // Sum per fuel — keep positives and negatives separate.
    const posByFuel = new Map();
    const negByFuel = new Map();
    for (const r of inPeriod) {
      if (r.value >= 0) {
        posByFuel.set(r.fuel, (posByFuel.get(r.fuel) || 0) + r.value);
      } else {
        negByFuel.set(r.fuel, (negByFuel.get(r.fuel) || 0) + r.value);
      }
    }

    const positives = Array.from(posByFuel.entries())
      .filter(([, v]) => v > 0)
      .map(([fuel, value]) => ({ fuel, value }));

    const negatives = Array.from(negByFuel.entries())
      .filter(([, v]) => v < 0)
      .map(([fuel, value]) => ({ fuel, value }))
      .sort((a, b) => a.value - b.value);

    const positiveTotal = positives.reduce((acc, d) => acc + d.value, 0);

    return {
      positives,
      negatives,
      positiveTotal,
      dayCount,
      regionName,
      periodLabel: period.label,
    };
  }, [rawRows, region, period]);

  const handleTogglePinned = useCallback((fuel) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(fuel)) next.delete(fuel);
      else next.add(fuel);
      return next;
    });
  }, []);

  // Clear pins when region/period changes so the list stays coherent.
  useEffect(() => {
    setPinned(new Set());
  }, [region, periodId]);

  // ----- Render --------------------------------------------------------
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (rawRows.length === 0) return;
    if (region === null) return;

    viz(select(svgRef.current), {
      leaves: aggregate.positives,
      negatives: aggregate.negatives,
      positiveTotal: aggregate.positiveTotal,
      dayCount: aggregate.dayCount,
      regionName: aggregate.regionName,
      periodLabel: aggregate.periodLabel,
      pinned,
      width: dimensions.width,
      height: dimensions.height,
      onTogglePinned: handleTogglePinned,
    });
  }, [
    aggregate,
    pinned,
    dimensions,
    rawRows.length,
    region,
    handleTogglePinned,
  ]);

  // Tooltip cleanup
  useEffect(() => {
    return () => {
      document.querySelectorAll('div.eia-tooltip').forEach((n) => n.remove());
    };
  }, []);

  return (
    <div ref={divRef} className="container">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Treemap of generation by fuel for the selected region and period"
      />
      <div className="controls" role="region" aria-label="Chart controls">
        <label className="ctrl-group">
          <span className="ctrl-label">Region</span>
          <select
            className="ctrl-select"
            value={region || ''}
            onChange={(e) => setRegion(e.target.value)}
            disabled={regions.length === 0}
          >
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <div className="ctrl-group period-group" role="radiogroup" aria-label="Period">
          <span className="ctrl-label">Period</span>
          <div className="period-buttons">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={periodId === p.id}
                className={
                  'period-btn' + (periodId === p.id ? ' active' : '')
                }
                onClick={() => setPeriodId(p.id)}
                title={p.sub || p.label}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          Failed to load data: {error}
        </div>
      )}
      {!error && rawRows.length === 0 && (
        <div className="loading" aria-live="polite">
          Loading generation data…
        </div>
      )}
    </div>
  );
};