import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import { csvParse } from 'd3-dsv';
import { scaleLinear } from 'd3-scale';
import '../week-04/time-range.css';

interface GenerationRow {
  period: string;
  time: number;
  area: string;
  areaName: string;
  fuel: string;
  fuelName: string;
  value: number;
}

const DATA_URL = `${import.meta.env.BASE_URL}data/eia_generation.csv`;
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function InteractiveElectricityGeneration() {
  const [data, setData] = useState<GenerationRow[] | null>(null);
  const [error, setError] = useState('');
  const [focusedFuels, setFocusedFuels] = useState<string[]>([]);
  const [inspectedTime, setInspectedTime] = useState<number | null>(null);
  const [area, setArea] = useState('CAL');
  const [scope, setScope] = useState('regions');
  const [range, setRange] = useState<[number, number] | null>(null);
  const bounds = useMemo(
    () =>
      data?.reduce<[number, number]>(
        (result, row) => [Math.min(result[0], row.time), Math.max(result[1], row.time)],
        [Infinity, -Infinity],
      ),
    [data],
  );
  const areaRows = useMemo(() => data?.filter((row) => row.area === area) ?? [], [data, area]);
  const allAreas = useMemo(
    () => [...new Map(data?.map((row) => [row.area, row.areaName])).entries()],
    [data],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const response = await fetch(DATA_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`Could not load CSV (${response.status}).`);

        // Convert CSV strings into numbers before mapping values to bar lengths.
        const rows = csvParse(await response.text())
          .map((row) => ({
            period: row.period,
            time: Date.parse(`${row.period}:00:00Z`),
            area: row.respondent,
            areaName: row['respondent-name'],
            fuel: row.fueltype,
            fuelName: row['type-name'],
            value: row.value?.trim() ? Number(row.value) : NaN,
          }))
          .filter((row) => Number.isFinite(row.value));

        if (!rows.length) throw new Error('The CSV contains no numeric generation data.');
        if (controller.signal.aborted) return;
        setData(rows);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load generation data.');
        }
      }
    }

    void loadData();
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!data || !bounds) return <p role="status">Loading electricity generation data…</p>;

  const regionCodes = new Set([
    'CAL',
    'CAR',
    'CENT',
    'FLA',
    'MIDA',
    'MIDW',
    'NE',
    'NW',
    'NY',
    'SE',
    'SW',
    'TEN',
    'TEX',
  ]);
  const areas = allAreas
    .filter(([code]) =>
      scope === 'regions' ? regionCodes.has(code) : code !== 'US48' && !regionCodes.has(code),
    )
    .sort((a, b) => a[1].localeCompare(b[1]));
  const [minimum, maximum] = bounds;
  const [start, end] = range ?? bounds;
  const selected = areaRows.filter((row) => row.time >= start && row.time <= end);
  const areaName = areas.find(([code]) => code === area)?.[1] ?? area;
  const toTime = (period: string) => Date.parse(`${period}:00:00Z`);
  const hour = 3600000;
  const x = scaleLinear().domain([start, end]).range([100, 910]);
  const values = selected.map((row) => row.value);
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(1, ...values)])
    .nice()
    .range([470, 160]);
  const fuels = [...new Map(selected.map((row) => [row.fuel, row.fuelName])).entries()];
  const palette: Record<string, string> = {
    NG: '#b45309',
    SUN: '#ca8a04',
    WND: '#0284c7',
    NUC: '#7c3aed',
    WAT: '#0f766e',
    COL: '#334155',
    BAT: '#db2777',
    GEO: '#4d7c0f',
    PS: '#be185d',
    OIL: '#92400e',
    OTH: '#64748b',
    SNB: '#a16207',
    WNB: '#0369a1',
    OES: '#9333ea',
    UES: '#a21caf',
    UNK: '#475569',
  };
  const dateFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const rangeFormat = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
  const activeFuels = focusedFuels.filter((fuel) => fuels.some(([code]) => code === fuel));
  const isFocused = (fuel: string) => activeFuels.length === 0 || activeFuels.includes(fuel);
  const hoverTime = inspectedTime === null ? null : Math.max(start, Math.min(end, inspectedTime));
  const hourRows = new Map(
    selected.filter((row) => row.time === hoverTime).map((row) => [row.fuel, row]),
  );
  const toggleFuel = (fuel: string) =>
    setFocusedFuels((current) =>
      current.includes(fuel) ? current.filter((code) => code !== fuel) : [...current, fuel],
    );
  const inspectPointer = (event: PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || !selected.length) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    setInspectedTime(Math.max(start, Math.min(end, Math.round(x.invert(local.x) / hour) * hour)));
  };
  const dateRange = `${rangeFormat.format(start)} – ${rangeFormat.format(end)} (UTC)`;
  const tickHours =
    [1, 3, 6, 12, 24, 48, 72, 168].find((step) => (end - start) / hour / step <= 7) ?? 168;
  const ticks = Array.from(
    { length: Math.floor((end - start) / (tickHours * hour)) + 1 },
    (_, i) => start + i * tickHours * hour,
  );

  return (
    <section className="w-full h-full overflow-auto p-6 text-slate-800">
      <h1 className="text-2xl font-semibold">Explore electricity generation</h1>
      <p className="mt-2 text-slate-600">
        Select fuels to compare, then move across the chart to inspect an hour.
      </p>
      <div className="my-5 flex flex-wrap items-start gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1">
          <span>Explore</span>
          <select
            className="rounded border border-slate-300 p-2"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setFocusedFuels([]);
              setInspectedTime(null);
              setArea(event.target.value === 'regions' ? 'CAL' : 'CISO');
            }}
          >
            <option value="regions">Regions</option>
            <option value="authorities">Reporting authorities</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span>
            {scope === 'regions' ? 'Region' : 'Reporting authority (balancing authority)'}
          </span>
          <select
            className="w-full max-w-xl rounded border border-slate-300 p-2"
            value={area}
            onChange={(event) => {
              setArea(event.target.value);
              setFocusedFuels([]);
              setInspectedTime(null);
            }}
          >
            {areas.map(([code, name]) => (
              <option key={code} value={code}>
                {name} ({code})
              </option>
            ))}
          </select>
        </label>
        <fieldset className="w-[320px] max-w-full min-w-0">
          <legend className="mb-1">Time range (UTC)</legend>
          <div className="time-range">
            <div className="time-range-track" />
            <div
              className="time-range-selection"
              style={{
                left: `${(100 * (start - minimum)) / (maximum - minimum || 1)}%`,
                right: `${(100 * (maximum - end)) / (maximum - minimum || 1)}%`,
              }}
            />
            <input
              id="time-start"
              type="range"
              min={minimum}
              max={maximum}
              step={hour}
              value={start}
              disabled={maximum === minimum}
              aria-label="Beginning date and time (UTC)"
              aria-valuetext={`${rangeFormat.format(start)} UTC`}
              onChange={(event) =>
                setRange([Math.min(Number(event.target.value), end - hour), end])
              }
            />
            <input
              id="time-end"
              type="range"
              min={minimum}
              max={maximum}
              step={hour}
              value={end}
              disabled={maximum === minimum}
              aria-label="End date and time (UTC)"
              aria-valuetext={`${rangeFormat.format(end)} UTC`}
              onChange={(event) =>
                setRange([start, Math.max(Number(event.target.value), start + hour)])
              }
            />
          </div>
          <div className="flex justify-between gap-2 text-xs text-slate-600">
            <label htmlFor="time-start">
              {dateFormat.format(start)}, {String(new Date(start).getUTCHours()).padStart(2, '0')}
              :00
            </label>
            <label htmlFor="time-end">
              {dateFormat.format(end)}, {String(new Date(end).getUTCHours()).padStart(2, '0')}:00
            </label>
          </div>
          <button
            type="button"
            className="mt-1 text-xs text-slate-500 underline hover:text-slate-800"
            onClick={() => setRange(null)}
          >
            Reset
          </button>
        </fieldset>
      </div>
      <p className="mb-3 text-sm text-slate-600">
        {scope === 'regions'
          ? 'Regional totals combine reporting authorities within each EIA region.'
          : 'A balancing authority manages the balance of electricity supply and demand in its grid area.'}
      </p>

      {selected.length === 0 && (
        <p role="status" className="mb-3 text-slate-600">
          No generation reports for this area in the selected time range.
        </p>
      )}
      <fieldset className="mb-4 rounded-xl border border-slate-200 p-3">
        <legend className="px-2 font-semibold">Fuel legend · select to focus</legend>
        <div className="flex flex-wrap gap-2">
          {fuels.map(([fuel, name]) => (
            <button
              key={fuel}
              type="button"
              aria-pressed={activeFuels.includes(fuel)}
              onClick={() => toggleFuel(fuel)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                activeFuels.includes(fuel)
                  ? 'border-slate-800 bg-slate-100 font-semibold'
                  : 'border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-1 w-5 rounded"
                style={{ background: palette[fuel], opacity: isFocused(fuel) ? 1 : 0.25 }}
              />
              {name}
              {activeFuels.includes(fuel) ? ' ✓' : ''}
            </button>
          ))}
          <button
            type="button"
            disabled={!activeFuels.length}
            onClick={() => setFocusedFuels([])}
            className="rounded-lg px-3 py-2 text-sm underline disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Show all fuels
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Select multiple fuels to compare them. Select a fuel again to release it.
        </p>
      </fieldset>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <svg
            viewBox="0 0 1000 710"
            className="w-full min-w-[800px]"
            role="group"
            aria-labelledby="timeline-title timeline-description"
          >
            <title id="timeline-title">
              {areaName}: hourly net electricity generation by fuel source
            </title>
            <desc id="timeline-description">
              {dateRange}. Each line follows one fuel source in megawatt-hours. Values below zero
              represent net consumption. Missing observations appear as gaps.
            </desc>
            <text x="40" y="38" fontSize="23" fontWeight="600">
              {areaName.length > 65 ? `${areaName.slice(0, 62)}…` : areaName}
            </text>
            <text x="40" y="64" fontSize="14" fill="#475569">
              Hourly net electricity generation · {dateRange}
            </text>
            <text x="40" y="95" fontSize="13" fill="#475569">
              {activeFuels.length
                ? `${activeFuels.length} fuel sources selected · Other lines are dimmed`
                : 'All fuel sources shown'}{' '}
              · Scale stays fixed when selecting fuels
            </text>
            {y.ticks(5).map((tick) => (
              <g key={tick}>
                <line x1="100" x2="910" y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" />
                <text x="88" y={y(tick) + 4} textAnchor="end" fontSize="12" fill="#475569">
                  {numberFormat.format(tick)}
                </text>
              </g>
            ))}
            {ticks.map((time) => (
              <g key={time}>
                <line
                  x1={x(time)}
                  x2={x(time)}
                  y1="160"
                  y2="470"
                  stroke="#e2e8f0"
                  strokeDasharray={new Date(time).getUTCHours() ? '3 5' : undefined}
                />
                <text
                  x={x(time)}
                  y="495"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight={new Date(time).getUTCHours() ? '400' : '600'}
                >
                  {dateFormat.format(time)}
                </text>
                <text x={x(time)} y="513" textAnchor="middle" fontSize="12" fill="#475569">
                  {`${String(new Date(time).getUTCHours()).padStart(2, '0')}:00`}
                </text>
              </g>
            ))}
            <line x1="100" x2="910" y1={y(0)} y2={y(0)} stroke="#64748b" strokeWidth="1.5" />
            <text transform="translate(23 315) rotate(-90)" textAnchor="middle" fontSize="14">
              Hourly net generation (MWh)
            </text>
            <text x="505" y="545" textAnchor="middle" fontSize="14">
              Time (UTC)
            </text>
            {fuels.map(([fuel, name], i) => {
              const rows = selected
                .filter((row) => row.fuel === fuel)
                .sort((a, b) => a.period.localeCompare(b.period));
              const path = rows
                .map(
                  (row, index) =>
                    `${index === 0 || toTime(row.period) - toTime(rows[index - 1].period) !== hour ? 'M' : 'L'}${x(toTime(row.period))},${y(row.value)}`,
                )
                .join(' ');
              return (
                <g key={fuel} opacity={isFocused(fuel) ? 1 : 0.12}>
                  <path
                    d={path}
                    fill="none"
                    stroke={palette[fuel]}
                    strokeWidth="2.3"
                    strokeLinejoin="round"
                    strokeDasharray={i >= 8 ? '6 3' : undefined}
                  >
                    <title>{name}</title>
                  </path>
                  {rows.map((row) => (
                    <circle
                      key={row.period}
                      cx={x(toTime(row.period))}
                      cy={y(row.value)}
                      r="2"
                      fill={palette[fuel]}
                    >
                      <title>
                        {name} · {row.period.replace('T', ' ')}:00 UTC ·{' '}
                        {numberFormat.format(row.value)} MWh
                      </title>
                    </circle>
                  ))}
                </g>
              );
            })}
            {hoverTime !== null && (
              <g pointerEvents="none">
                <line
                  x1={x(hoverTime)}
                  x2={x(hoverTime)}
                  y1="160"
                  y2="470"
                  stroke="#0f172a"
                  strokeDasharray="4 4"
                />
                {fuels
                  .filter(([fuel]) => isFocused(fuel))
                  .map(([fuel]) => {
                    const row = hourRows.get(fuel);
                    return row ? (
                      <circle
                        key={fuel}
                        cx={x(hoverTime)}
                        cy={y(row.value)}
                        r="5"
                        fill={palette[fuel]}
                        stroke="white"
                        strokeWidth="2"
                      />
                    ) : null;
                  })}
              </g>
            )}
            <rect
              x="100"
              y="160"
              width="810"
              height="310"
              fill="transparent"
              tabIndex={selected.length ? 0 : undefined}
              role="slider"
              aria-label="Inspect generation by hour. Use left and right arrow keys."
              aria-valuemin={start / hour}
              aria-valuemax={end / hour}
              aria-valuenow={(hoverTime ?? start) / hour}
              aria-valuetext={`${rangeFormat.format(hoverTime ?? start)} UTC. ${fuels
                .filter(([fuel]) => isFocused(fuel))
                .map(([fuel, name]) => {
                  const row = selected.find(
                    (item) => item.time === (hoverTime ?? start) && item.fuel === fuel,
                  );
                  return `${name}: ${row ? `${numberFormat.format(row.value)} MWh` : 'No report'}`;
                })
                .join('. ')}`}
              className="cursor-crosshair focus-visible:stroke-blue-600 focus-visible:stroke-2"
              onPointerMove={inspectPointer}
              onPointerDown={inspectPointer}
              onFocus={() => setInspectedTime((current) => current ?? start)}
              onKeyDown={(event) => {
                const current = hoverTime ?? start;
                const next =
                  event.key === 'ArrowRight'
                    ? current + hour
                    : event.key === 'ArrowLeft'
                      ? current - hour
                      : event.key === 'Home'
                        ? start
                        : event.key === 'End'
                          ? end
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setInspectedTime(Math.max(start, Math.min(end, next)));
                }
              }}
            />
            <rect x="40" y="569" width="920" height="90" rx="8" fill="#f1f5f9" />
            <text x="56" y="592" fontSize="14" fontWeight="600">
              Why do some values fall below zero?
            </text>
            <text x="56" y="614" fontSize="13">
              Negative net generation means more electricity was consumed than produced in that
              hour.
            </text>
            <text x="56" y="633" fontSize="13">
              Storage may be charging or pumping water; other plants may use power to run their
              equipment.
            </text>
            <text x="56" y="650" fontSize="12" fill="#475569">
              The CSV does not identify the specific cause of each negative reading.
            </text>
            <text x="40" y="684" fontSize="12" fill="#475569">
              Source: U.S. EIA hourly generation CSV · One line per fuel source · Gaps indicate
              missing reports, not zero.
            </text>
          </svg>
        </div>
        <section
          aria-labelledby="hour-details-title"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <h2 id="hour-details-title" className="font-semibold">
            {hoverTime === null ? 'Hourly comparison' : `${rangeFormat.format(hoverTime)} UTC`}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {hoverTime === null
              ? 'Hover or touch the plot to inspect an hour. Keyboard: focus the plot and use ← / →.'
              : 'Values at the guide line. The last inspected hour stays visible so you can read and compare.'}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-1">
            {fuels
              .filter(([fuel]) => isFocused(fuel))
              .map(([fuel, name]) => {
                const row = hourRows.get(fuel);
                return (
                  <div key={fuel} className="rounded-lg border border-slate-200 bg-white p-3">
                    <dt className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: palette[fuel] }}
                      />
                      {name}
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">
                      {hoverTime === null
                        ? '—'
                        : row
                          ? `${numberFormat.format(row.value)} MWh`
                          : 'No report'}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </section>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        About the data:{' '}
        <a className="underline" href="https://www.eia.gov/tools/glossary/index.php?id=net">
          EIA’s definition of net generation
        </a>{' '}
        and{' '}
        <a
          className="underline"
          href="https://www.eia.gov/energyexplained/electricity/energy-storage-for-electricity-generation.php"
        >
          energy storage accounting
        </a>
        . Regional totals are shown as reported, without adding them to individual authorities.
      </p>
    </section>
  );
}
