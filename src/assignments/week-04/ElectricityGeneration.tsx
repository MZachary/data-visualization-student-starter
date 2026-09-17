import { useEffect, useMemo, useState } from 'react';
import { csvParse } from 'd3-dsv';
import { scaleLinear } from 'd3-scale';
import './time-range.css';

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

export function ElectricityGenerationTimeline() {
  const [data, setData] = useState<GenerationRow[] | null>(null);
  const [error, setError] = useState('');
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
  const dateRange = `${rangeFormat.format(start)} – ${rangeFormat.format(end)} (UTC)`;
  const tickHours =
    [1, 3, 6, 12, 24, 48, 72, 168].find((step) => (end - start) / hour / step <= 7) ?? 168;
  const ticks = Array.from(
    { length: Math.floor((end - start) / (tickHours * hour)) + 1 },
    (_, i) => start + i * tickHours * hour,
  );

  return (
    <section className="w-full h-full overflow-auto p-6 text-slate-800">
      <h1 className="text-2xl font-semibold">Electricity generation over time</h1>
      <p className="mt-2 text-slate-600">
        Follow each fuel source across the available hourly reports.
      </p>
      <div className="my-5 flex flex-wrap items-start gap-x-6 gap-y-3">
        <label className="flex flex-col gap-1">
          <span>Explore</span>
          <select
            className="rounded border border-slate-300 p-2"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
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
            onChange={(event) => setArea(event.target.value)}
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <svg
          viewBox="0 0 1000 710"
          className="w-full min-w-[800px]"
          role="img"
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
          {fuels.map(([fuel, name], i) => (
            <g
              key={fuel}
              transform={`translate(${40 + (i % 4) * 240}, ${89 + Math.floor(i / 4) * 17})`}
            >
              <line
                x2="23"
                stroke={palette[fuel]}
                strokeWidth="3"
                strokeDasharray={i >= 8 ? '6 3' : undefined}
              />
              <text x="30" y="4" fontSize="12" fill="#334155">
                {name}
              </text>
            </g>
          ))}
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
              <g key={fuel}>
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
          <rect x="40" y="569" width="920" height="90" rx="8" fill="#f1f5f9" />
          <text x="56" y="592" fontSize="14" fontWeight="600">
            Why do some values fall below zero?
          </text>
          <text x="56" y="614" fontSize="13">
            Negative net generation means more electricity was consumed than produced in that hour.
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
