import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import {
  colors,
  makeSeries,
  parseReports,
  regions,
  localizeReports,
  commonCompleteDates,
  sampleCounts,
  type Metric,
  type Report,
} from './data';
import './comparison.css';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const unit = (metric: Metric) => (metric === 'amount' ? 'MWh' : '%');
const format = (value: number | null | undefined, metric: Metric) =>
  value == null
    ? 'No report'
    : `${metric === 'share' ? value.toFixed(1) : number.format(value)} ${unit(metric)}`;
const x = scaleLinear().domain([0, 23]).range([65, 545]);

export function ElectricityComparison() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState('CAL');
  const [right, setRight] = useState('TEX');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState('average');
  const [month, setMonth] = useState('');
  const [metric, setMetric] = useState<Metric>('amount');
  const [hour, setHour] = useState(18);
  const [focus, setFocus] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/eia_generation.csv`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Could not load generation data (${response.status}).`);
        const rows = parseReports(await response.text()).filter((r) => Boolean(regions[r.area]));
        if (!rows.length) throw new Error('No regional reports are available.');
        if (!controller.signal.aborted) setReports(rows);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'Could not load data.');
      }
    })();
    return () => controller.abort();
  }, []);
  const authorities = useMemo(
    () =>
      [...new Map(reports?.map((r) => [r.area, r.name])).entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    [reports],
  );
  const localPair = useMemo(
    () =>
      [left, right].map((area) => ({
        area,
        name: authorities.find(([code]) => code === area)?.[1] ?? area,
        rows: localizeReports(reports?.filter((r) => r.area === area) ?? [], regions[area].zone),
      })),
    [reports, authorities, left, right],
  );
  const dates = useMemo(
    () => [...new Set(localPair.flatMap((p) => p.rows.map((r) => r.date)))].sort(),
    [localPair],
  );
  const completeDates = useMemo(
    () => commonCompleteDates(localPair.map((p) => p.rows)),
    [localPair],
  );
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const selectedMonth = months.includes(month)
    ? month
    : completeDates.at(-1)?.slice(0, 7) || months.at(-1) || '';
  const selectedDate = dates.includes(date) ? date : completeDates.at(-1) || dates.at(-1) || '';
  const averageDates = completeDates.filter((d) => d.startsWith(selectedMonth));
  const periodLabel =
    mode === 'average'
      ? averageDates.length
        ? `${averageDates[0]} – ${averageDates.at(-1)} · ${averageDates.length} shared days`
        : 'No complete shared days'
      : selectedDate;
  const includedDates = mode === 'average' ? averageDates.join(',') : selectedDate;
  const pair = useMemo(
    () =>
      localPair.map((p) => ({
        ...p,
        rows: p.rows.filter((r) => includedDates.split(',').includes(r.date)),
      })),
    [localPair, includedDates],
  );
  const fuels = useMemo(() => {
    const priority = ['SUN', 'NG', 'WND', 'NUC', 'WAT', 'COL', 'GEO', 'BAT'];
    return [
      ...new Map(pair.flatMap((p) => p.rows.map((r) => [r.fuel, r.fuelName] as const))).entries(),
    ].sort(
      (a, b) =>
        (priority.includes(a[0]) ? priority.indexOf(a[0]) : 99) -
          (priority.includes(b[0]) ? priority.indexOf(b[0]) : 99) || a[1].localeCompare(b[1]),
    );
  }, [pair]);
  const series = useMemo(
    () =>
      pair.map((p) =>
        makeSeries(
          p.rows,
          fuels.map(([fuel]) => fuel),
          metric,
        ),
      ),
    [pair, fuels, metric],
  );
  const values = series.flatMap((s) =>
    [...s.values()].flat().filter((v): v is number => v !== null),
  );
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(metric === 'share' ? 100 : 1, ...values)])
    .nice()
    .range([280, 25]);
  const bar = scaleLinear().domain(y.domain()).range([0, 100]);
  const active = focus.filter((f) => fuels.some(([code]) => code === f));
  const highlighted = (fuel: string) => !active.length || active.includes(fuel);
  const inspect = (event: PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    setHour(
      Math.max(0, Math.min(23, Math.round(x.invert(point.matrixTransform(matrix.inverse()).x)))),
    );
  };
  if (error)
    return (
      <section className="electricity-comparison">
        <p role="alert">{error} Reload the page to try again.</p>
      </section>
    );
  if (!reports) return <p role="status">Loading electricity generation data…</p>;

  return (
    <section className="electricity-comparison">
      <div className="comparison-inner">
        <header className="comparison-header">
          <p className="eyebrow">WEEK 06 / PROJECT V1</p>
          <h1>Two regions. Different energy stories.</h1>
          <p>Compare daily electricity patterns, aligned to each region’s local clock.</p>
        </header>
        <div className="comparison-controls">
          {[left, right].map((area, i) => (
            <label key={i}>
              Region {i === 0 ? 'A' : 'B'}
              <select
                aria-label={`Region ${i === 0 ? 'A' : 'B'}`}
                value={area}
                onChange={(e) => (i === 0 ? setLeft : setRight)(e.target.value)}
              >
                {authorities.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Day profile
            <select aria-label="Day profile" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="average">Average day</option>
              <option value="actual">Actual day</option>
            </select>
          </label>
          <label>
            {mode === 'average' ? 'Month · available days' : 'Date · local time'}
            <select
              aria-label={mode === 'average' ? 'Average month' : 'Actual local day'}
              value={mode === 'average' ? selectedMonth : selectedDate}
              onChange={(e) =>
                mode === 'average' ? setMonth(e.target.value) : setDate(e.target.value)
              }
            >
              {(mode === 'average' ? months : dates).map((d) => (
                <option key={d} value={d}>
                  {mode === 'average'
                    ? new Intl.DateTimeFormat('en-US', {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${d}-01T12:00:00Z`))
                    : d}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="metric-controls">
            <legend>Compare by</legend>
            <button aria-pressed={metric === 'amount'} onClick={() => setMetric('amount')}>
              MWh
            </button>
            <button aria-pressed={metric === 'share'} onClick={() => setMetric('share')}>
              Share %
            </button>
          </fieldset>
        </div>
        <div className="comparison-section-title">
          <h2>{mode === 'average' ? 'Average daily generation' : 'Daily generation profiles'}</h2>
          <span>
            Matching axes ·{' '}
            {metric === 'amount' ? 'hourly net generation' : 'share of reported net generation'}
          </span>
        </div>
        <p className="comparison-period">
          {periodLabel}.{' '}
          {mode === 'average'
            ? 'Available complete local days, not a full-month average.'
            : 'The same calendar date in each region.'}{' '}
          Each region uses the reference clock shown below.
        </p>
        {left === right && (
          <p className="comparison-notice">
            Both panels show the same region. Choose a different region to compare places.
          </p>
        )}
        <div className="comparison-panels">
          {pair.map((p, i) => (
            <article className="profile-card" key={i}>
              <div className="profile-heading">
                <div>
                  <h3>
                    <span>{i === 0 ? 'A' : 'B'}</span>
                    {p.name}
                  </h3>
                  <p>{regions[p.area].clock} reference time</p>
                </div>
                <span className="coverage">
                  {mode === 'average'
                    ? `${averageDates.length} days averaged`
                    : `${new Set(p.rows.map((r) => r.hour)).size}/24 clock hours reported`}
                </span>
              </div>
              {!p.rows.length && (
                <p role="status">
                  No reports for this region and period. Choose another date, month, or region.
                </p>
              )}
              <svg
                viewBox="0 0 570 335"
                role="img"
                aria-label={`${p.name} ${mode} hourly generation, ${periodLabel}, ${regions[p.area].clock}, ${unit(metric)}`}
              >
                <text x="65" y="14" className="axis-label">
                  {metric === 'amount'
                    ? `${mode === 'average' ? 'Average net' : 'Net'} generation (MWh)`
                    : 'Share of net generation (%)'}
                </text>
                {y.ticks(5).map((tick) => (
                  <g key={tick}>
                    <line
                      x1="65"
                      x2="545"
                      y1={y(tick)}
                      y2={y(tick)}
                      stroke={tick === 0 ? '#9ba9ad' : '#e5e9e8'}
                    />
                    <text x="55" y={y(tick) + 4} textAnchor="end">
                      {number.format(tick)}
                    </text>
                  </g>
                ))}
                {[0, 6, 12, 18, 23].map((tick) => (
                  <g key={tick}>
                    <text x={x(tick)} y="302" textAnchor="middle">
                      {hourLabel(tick)}
                    </text>
                  </g>
                ))}
                <text x="305" y="326" textAnchor="middle" className="axis-label">
                  Hour of day (regional reference time)
                </text>
                {fuels.map(([fuel, name]) => {
                  const data = series[i].get(fuel)!;
                  const path = data
                    .map((v, h) =>
                      v === null
                        ? ''
                        : `${h === 0 || data[h - 1] === null ? 'M' : 'L'}${x(h)},${y(v)}`,
                    )
                    .join(' ');
                  return (
                    <g key={fuel} opacity={highlighted(fuel) ? 1 : 0.12}>
                      <path
                        d={path}
                        fill="none"
                        stroke={colors[fuel] ?? '#64748b'}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      >
                        <title>{name}</title>
                      </path>
                      {data.map(
                        (v, h) =>
                          v !== null && (
                            <circle
                              key={h}
                              cx={x(h)}
                              cy={y(v)}
                              r={h === hour ? 4.5 : 1.5}
                              fill={colors[fuel] ?? '#64748b'}
                              stroke={h === hour ? 'white' : 'none'}
                              strokeWidth="1.5"
                            />
                          ),
                      )}
                    </g>
                  );
                })}
                <line
                  className="hour-guide"
                  x1={x(hour)}
                  x2={x(hour)}
                  y1="25"
                  y2="280"
                  stroke="#52666c"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
                <rect
                  x="65"
                  y="25"
                  width="480"
                  height="255"
                  fill="transparent"
                  onPointerMove={inspect}
                  onPointerDown={inspect}
                  style={{ cursor: 'crosshair' }}
                />
              </svg>
            </article>
          ))}
        </div>
        <fieldset className="fuel-controls">
          <legend>Focus on fuels · applies to both plots</legend>
          <div>
            {fuels.map(([fuel, name]) => (
              <button
                key={fuel}
                aria-pressed={active.includes(fuel)}
                onClick={() =>
                  setFocus((current) =>
                    current.includes(fuel) ? current.filter((f) => f !== fuel) : [...current, fuel],
                  )
                }
              >
                <span
                  style={{
                    background: colors[fuel] ?? '#64748b',
                    opacity: highlighted(fuel) ? 1 : 0.2,
                  }}
                />
                {name}
                {active.includes(fuel) ? ' ✓' : ''}
              </button>
            ))}
            <button className="reset-fuels" disabled={!active.length} onClick={() => setFocus([])}>
              Show all
            </button>
          </div>
        </fieldset>
        <section className="hour-comparison" aria-labelledby="hour-title">
          <div className="hour-heading">
            <div>
              <p className="eyebrow">A CLOSER LOOK</p>
              <h2 id="hour-title">
                {hourLabel(hour)}{' '}
                <span>local time · {mode === 'average' ? 'average day' : selectedDate}</span>
              </h2>
            </div>
            <label className="hour-control">
              Inspect the same local hour
              <input
                aria-label="Inspect local hour"
                type="range"
                min="0"
                max="23"
                value={hour}
                aria-valuetext={`${hourLabel(hour)} local time in each region`}
                onChange={(e) => setHour(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="hour-hint">
            Move over either plot, or use the hour slider and arrow keys. Bar lengths use the same
            scale in both columns.
          </p>
          <div className="bar-head">
            <span>Fuel source</span>
            {pair.map((p, i) => (
              <strong key={i}>
                {i === 0 ? 'A' : 'B'} / {p.name}
              </strong>
            ))}
          </div>
          {fuels
            .filter(([fuel]) => highlighted(fuel))
            .map(([fuel, name]) => (
              <div className="comparison-bar-row" key={fuel}>
                <span className="fuel-name">{name}</span>
                {series.map((s, i) => {
                  const v = s.get(fuel)?.[hour];
                  return (
                    <div className="bar-cell" key={i}>
                      <div className="bar-track">
                        <span className="bar-zero" style={{ left: `${bar(0)}%` }} />
                        {v != null && (
                          <span
                            className="bar-fill"
                            style={{
                              left: `${Math.min(bar(0), bar(v))}%`,
                              width: `${Math.abs(bar(v) - bar(0))}%`,
                              background: colors[fuel] ?? '#64748b',
                            }}
                          />
                        )}
                      </div>
                      <span className="bar-value">
                        {v == null &&
                        metric === 'share' &&
                        pair[i].rows.some((r) => r.fuel === fuel && r.hour === hour)
                          ? 'No share'
                          : format(v, metric)}
                        {mode === 'average' && (
                          <small>
                            {sampleCounts(pair[i].rows, fuel)[hour]}/{averageDates.length} days
                          </small>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          {!fuels.length && <p role="status">No fuel reports available for this comparison.</p>}
        </section>
        <footer className="comparison-footer">
          <p>
            <strong>Reading this comparison.</strong> The guides align the same local clock hour,
            not the same instant. EIA regions can span time zones; each panel uses a chosen
            reference city, not a claim that the entire region shares one clock. Daylight saving
            follows that city’s time zone.
          </p>
          <p>
            <strong>Average day.</strong> Only dates with reports in all 24 local clock-hour bins in
            both regions are included. Partial boundary days are excluded. Each fuel is averaged
            across its available days at that hour; the bars show its sample count. Missing reports
            are excluded, never replaced with zero. Repeated fall-back hours are averaged within
            their day; days missing a clock hour are excluded from averages.
          </p>
          <p>
            Shares divide each fuel’s {mode === 'average' ? 'mean' : 'hourly'} net generation by the
            sum across all reported fuels. This is{' '}
            {mode === 'average'
              ? 'the share of the average profile, not an average of daily percentages'
              : 'the reported hourly mix'}
            . Missing fuels can affect the total. Negative net generation is retained; nonpositive
            totals have no share. Fuel focus changes neither scales nor denominators.
          </p>
          <p>
            Source: U.S. EIA ·{' '}
            <a href={`${import.meta.env.BASE_URL}data/eia_generation.csv`}>
              saved hourly generation CSV
            </a>
            . Regional totals are used directly, without adding individual authorities. Coverage
            indicates hours with any report, not completeness of every fuel. Generation does not
            describe electricity delivered to individual homes.
          </p>
        </footer>
      </div>
    </section>
  );
}
