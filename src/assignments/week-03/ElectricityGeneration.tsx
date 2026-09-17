import { useEffect, useState } from 'react';
import { csvParse } from 'd3-dsv';
import { scaleLinear } from 'd3-scale';

interface GenerationRow {
  period: string;
  area: string;
  areaName: string;
  fuel: string;
  fuelName: string;
  value: number;
}

const DATA_URL = `${import.meta.env.BASE_URL}data/eia_generation.csv`;
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function ElectricityGeneration() {
  const [data, setData] = useState<GenerationRow[] | null>(null);
  const [error, setError] = useState('');
  const [area, setArea] = useState('');
  const [period, setPeriod] = useState('');

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
            area: row.respondent,
            areaName: row['respondent-name'],
            fuel: row.fueltype,
            fuelName: row['type-name'],
            value: row.value?.trim() ? Number(row.value) : NaN,
          }))
          .filter((row) => Number.isFinite(row.value));

        if (!rows.length) throw new Error('The CSV contains no numeric generation data.');
        if (controller.signal.aborted) return;
        const initialArea = rows.some((row) => row.area === 'CISO') ? 'CISO' : rows[0].area;
        setArea(initialArea);
        setPeriod(
          rows
            .filter((row) => row.area === initialArea)
            .map((row) => row.period)
            .sort()
            .at(-1)!,
        );
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
  if (!data) return <p role="status">Loading electricity generation data…</p>;

  const areas = [...new Map(data.map((row) => [row.area, row.areaName])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const periods = [...new Set(data.map((row) => row.period))].sort();
  const bars = data
    .filter((row) => row.area === area && row.period === period)
    .sort((a, b) => b.value - a.value);

  // Include zero and negative values so storage/net generation stays visible.
  const x = scaleLinear()
    .domain([
      Math.min(0, ...bars.map((row) => row.value)),
      Math.max(1, ...bars.map((row) => row.value)),
    ])
    .nice()
    .range([240, 750]);
  const height = bars.length * 36 + 90;
  const baseline = height - 55;

  return (
    <section className="w-full h-full overflow-auto p-6">
      <h1 className="text-2xl font-semibold">Electricity generation by fuel source</h1>
      <p className="mt-2 text-gray-600">Compare sources for one reporting area during one hour.</p>

      <div className="my-6 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span>Reporting area / balancing authority</span>
          <select
            className="max-w-full rounded border border-gray-300 p-2"
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
        <label className="flex flex-col gap-1">
          <span>Hour (UTC)</span>
          <select
            className="rounded border border-gray-300 p-2"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {periods.map((hour) => (
              <option key={hour} value={hour}>
                {hour.replace('T', ' ')}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      {bars.length === 0 ? (
        <p>No generation data for this area and hour.</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 860 ${height}`}
            className="w-full min-w-[640px] max-w-[1100px]"
            role="img"
            aria-label={`Electricity generation by fuel source for ${areas.find(([code]) => code === area)?.[1]}, ${period} UTC. Values in megawatt-hours.`}
          >
            {x.ticks(5).map((tick) => (
              <g key={tick}>
                <line x1={x(tick)} x2={x(tick)} y1={10} y2={baseline} stroke="#e5e7eb" />
                <text
                  x={x(tick)}
                  y={baseline + 20}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#4b5563"
                >
                  {numberFormat.format(tick)}
                </text>
              </g>
            ))}
            <line x1={x(0)} x2={x(0)} y1={10} y2={baseline} stroke="#6b7280" />
            {bars.map((row, index) => (
              <g key={row.fuel}>
                <text x={230} y={index * 36 + 30} textAnchor="end" fontSize={12}>
                  {row.fuelName}
                </text>
                <rect
                  x={Math.min(x(0), x(row.value))}
                  y={index * 36 + 12}
                  width={Math.abs(x(row.value) - x(0))}
                  height={26}
                  fill="#2563eb"
                >
                  <title>
                    {row.fuelName}: {numberFormat.format(row.value)} MWh
                  </title>
                </rect>
                <text x={x(Math.max(0, row.value)) + 8} y={index * 36 + 30} fontSize={12}>
                  {numberFormat.format(row.value)}
                </text>
              </g>
            ))}
            <text x={495} y={height - 5} textAnchor="middle" fontSize={14}>
              Hourly generation (MWh)
            </text>
          </svg>
        </div>
      )}

      <p className="mt-4 text-sm text-gray-600">
        Source: EIA hourly generation CSV. Each bar is one reported fuel source for the selected
        hour. Negative values are preserved; missing sources are not treated as zero. Reporting
        areas include balancing authorities and regional totals.
      </p>
    </section>
  );
}
