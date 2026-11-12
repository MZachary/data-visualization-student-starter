import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useEffect,
  type FocusEvent,
  type MouseEvent,
} from 'react';
import { hierarchy, treemap, treemapResquarify } from 'd3-hierarchy';
import {
  aggregateGeneration,
  parseGenerationRows,
  periods,
  type FuelTotal,
  type GenerationRow,
  type PeriodId,
} from './data';
import './treemap.css';

const DATA_URL = `${import.meta.env.BASE_URL}data/eia_generation_6hour.csv`;
const palette = [
  '#28666e',
  '#d27c2c',
  '#6d597a',
  '#4f772d',
  '#b24c63',
  '#1d70a2',
  '#9c6644',
  '#577590',
  '#b56576',
  '#5f6f52',
  '#7b2cbf',
  '#bc6c25',
  '#3a86a8',
  '#8a817c',
  '#588157',
  '#c8553d',
];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const monthName = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

interface HierarchyDatum {
  fuel?: string;
  fuelCode?: string;
  value?: number;
  children?: HierarchyDatum[];
}

interface TooltipState extends FuelTotal {
  x: number;
  y: number;
}

function fuelColor(code: string) {
  let hash = 0;
  for (const character of code) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function readableText(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.58
    ? '#14231f'
    : '#fffdf7';
}

function formatMonth(month: string) {
  return monthName.format(new Date(`${month}-01T12:00:00Z`));
}

function formatTotal(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)} TWh` : `${number.format(value)} MWh`;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export function ElectricityTreemap() {
  const [rows, setRows] = useState<GenerationRow[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(DATA_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Data request failed (${response.status})`);
        return response.text();
      })
      .then((text) => setRows(parseGenerationRows(text)))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : 'The data could not be loaded.');
      });
    return () => controller.abort();
  }, [retry]);

  if (error) {
    return (
      <section className="week-twelve">
        <div className="w12-status" role="alert">
          <strong>Could not load the generation data.</strong>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError('');
              setRows([]);
              setRetry((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="week-twelve">
        <div className="w12-status" role="status">
          <span className="w12-loader" aria-hidden="true" />
          Loading 6-hour electricity records…
        </div>
      </section>
    );
  }

  return <TreemapExplorer rows={rows} />;
}

function TreemapExplorer({ rows }: { rows: GenerationRow[] }) {
  const regions = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.regionCode, row.region])).entries()]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );
  const months = useMemo(() => [...new Set(rows.map((row) => row.month))].sort(), [rows]);
  const [region, setRegion] = useState(
    regions.some((candidate) => candidate.code === 'CAL') ? 'CAL' : regions[0]?.code ?? '',
  );
  const [month, setMonth] = useState(months[0] ?? '');
  const [periodId, setPeriodId] = useState<PeriodId>('month');
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>();
  const clipBase = useId().replaceAll(':', '');

  const aggregate = useMemo(
    () => aggregateGeneration(rows, region, month, periodId),
    [rows, region, month, periodId],
  );
  const regionName = regions.find((candidate) => candidate.code === region)?.name ?? region;
  const period = periods.find((candidate) => candidate.id === periodId) ?? periods[0];
  const reducedCount = aggregate.positives.length + aggregate.negatives.length;

  const nodes = useMemo(() => {
    if (!stageSize.width || !stageSize.height || !aggregate.positives.length) return [];
    const root = hierarchy<HierarchyDatum>({
      children: aggregate.positives.map((fuel) => ({ ...fuel })),
    })
      .sum((datum) => datum.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const laidOut = treemap<HierarchyDatum>()
      .tile(treemapResquarify)
      .size([stageSize.width, stageSize.height])
      .round(true)
      .paddingInner(3)
      .paddingOuter(2)(root);
    return laidOut.leaves();
  }, [aggregate.positives, stageSize]);

  const selectRegion = (value: string) => {
    setRegion(value);
    setPinned(new Set());
    setTooltip(null);
  };
  const selectMonth = (value: string) => {
    setMonth(value);
    setPinned(new Set());
    setTooltip(null);
  };
  const selectPeriod = (value: PeriodId) => {
    setPeriodId(value);
    setPinned(new Set());
    setTooltip(null);
  };
  const togglePinned = useCallback((fuelCode: string) => {
    setPinned((current) => {
      const next = new Set(current);
      if (next.has(fuelCode)) next.delete(fuelCode);
      else next.add(fuelCode);
      return next;
    });
  }, []);
  const showTooltip = (
    fuel: FuelTotal,
    event: MouseEvent<SVGGElement> | FocusEvent<SVGGElement>,
  ) => {
    const point =
      'clientX' in event
        ? { x: event.clientX, y: event.clientY }
        : (() => {
            const box = event.currentTarget.getBoundingClientRect();
            return { x: box.right, y: box.top };
          })();
    setTooltip({ ...fuel, x: point.x + 14, y: point.y + 14 });
  };

  return (
    <section className="week-twelve">
      <div className="w12-shell">
        <header className="w12-header">
          <div>
            <p className="w12-eyebrow">WEEK 12 / REDUCE</p>
            <h1>The shape of a region’s power</h1>
          </div>
          <p>
            Filter thousands of six-hour records, then aggregate them into a readable fuel mix.
            Area represents each fuel’s share of positive generation.
          </p>
        </header>

        <div className="w12-controls" aria-label="Treemap filters">
          <label>
            <span>Region</span>
            <select value={region} onChange={(event) => selectRegion(event.target.value)}>
              {regions.map((candidate) => (
                <option key={candidate.code} value={candidate.code}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Month</span>
            <select value={month} onChange={(event) => selectMonth(event.target.value)}>
              {months.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {formatMonth(candidate)}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Period</legend>
            <div className="w12-periods">
              {periods.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={periodId === candidate.id}
                  title={candidate.detail}
                  onClick={() => selectPeriod(candidate.id)}
                >
                  {candidate.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="w12-reduction" aria-label="Reduction summary">
          <div>
            <span>Full dataset</span>
            <strong>{number.format(rows.length)}</strong>
            <small>6-hour fuel records</small>
          </div>
          <span className="w12-reduction-arrow" aria-hidden="true">→</span>
          <div>
            <span>After filtering</span>
            <strong>{number.format(aggregate.intervalCount)}</strong>
            <small>{aggregate.dayCount} reported days</small>
          </div>
          <span className="w12-reduction-arrow" aria-hidden="true">→</span>
          <div>
            <span>After aggregation</span>
            <strong>{reducedCount}</strong>
            <small>signed fuel totals</small>
          </div>
        </div>

        <div className="w12-chart-heading">
          <div>
            <p className="w12-eyebrow">POSITIVE GENERATION MIX</p>
            <h2>{regionName}</h2>
            <p>{formatMonth(month)} · {period.label} · {aggregate.dayCount} days</p>
          </div>
          <div className="w12-total">
            <span>Total positive generation</span>
            <strong>{formatTotal(aggregate.positiveTotal)}</strong>
          </div>
        </div>

        <div className="w12-chart-layout">
          <div>
            <div className="w12-stage" ref={stageRef}>
              <svg
                width={stageSize.width}
                height={stageSize.height}
                role="img"
                aria-label={`Treemap of positive electricity generation by fuel in ${regionName}, ${formatMonth(month)}, ${period.label}`}
              >
                <defs>
                  {nodes.map((node) => (
                    <clipPath key={node.data.fuelCode} id={`${clipBase}-${node.data.fuelCode}`}>
                      <rect width={node.x1 - node.x0} height={node.y1 - node.y0} rx="5" />
                    </clipPath>
                  ))}
                </defs>
                {nodes.map((node) => {
                  const fuel = node.data as FuelTotal;
                  const width = node.x1 - node.x0;
                  const height = node.y1 - node.y0;
                  const fill = fuelColor(fuel.fuelCode);
                  const share = aggregate.positiveTotal ? fuel.value / aggregate.positiveTotal : 0;
                  const selected = pinned.has(fuel.fuelCode);
                  return (
                    <g
                      key={fuel.fuelCode}
                      className="w12-leaf"
                      style={{ transform: `translate(${node.x0}px, ${node.y0}px)` }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${fuel.fuel}, ${percent.format(share)} of positive generation. ${selected ? 'Pinned' : 'Not pinned'}.`}
                      onMouseEnter={(event) => showTooltip(fuel, event)}
                      onMouseMove={(event) => showTooltip(fuel, event)}
                      onMouseLeave={() => setTooltip(null)}
                      onFocus={(event) => showTooltip(fuel, event)}
                      onBlur={() => setTooltip(null)}
                      onClick={() => togglePinned(fuel.fuelCode)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          togglePinned(fuel.fuelCode);
                        }
                      }}
                    >
                      <rect
                        className="w12-leaf-rect"
                        width={width}
                        height={height}
                        rx="5"
                        fill={fill}
                        data-pinned={selected || undefined}
                      />
                      {width >= 66 && height >= 34 && (
                        <g clipPath={`url(#${clipBase}-${fuel.fuelCode})`} fill={readableText(fill)}>
                          <text className="w12-leaf-name" x="10" y="22">
                            {fuel.fuel}
                          </text>
                          {height >= 55 && (
                            <text className="w12-leaf-share" x="10" y="42">
                              {percent.format(share)}
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
              {!nodes.length && <p className="w12-empty">No positive generation in this selection.</p>}
            </div>
            <div className="w12-legend" aria-label="Fuel legend">
              {aggregate.positives.map((fuel) => (
                <button
                  type="button"
                  key={fuel.fuelCode}
                  aria-pressed={pinned.has(fuel.fuelCode)}
                  onClick={() => togglePinned(fuel.fuelCode)}
                >
                  <i style={{ background: fuelColor(fuel.fuelCode) }} />
                  {fuel.fuel}
                </button>
              ))}
            </div>
          </div>

          <aside className="w12-rail" aria-label="Generation details">
            <section>
              <p className="w12-eyebrow">BELOW ZERO</p>
              <h3>Charging & pumping</h3>
              <p>Negative readings are reported net consumption, not missing data.</p>
              {aggregate.negatives.length ? (
                <ul>
                  {aggregate.negatives.map((fuel) => (
                    <li key={fuel.fuelCode}>
                      <span>{fuel.fuel}</span>
                      <strong>{number.format(fuel.value)} MWh</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="w12-muted">No negative fuels in this period.</p>
              )}
            </section>
            <section>
              <p className="w12-eyebrow">PINNED COMPARISON</p>
              <h3>Selected fuels</h3>
              {!pinned.size ? (
                <p className="w12-muted">Select a tile or legend item to hold it here.</p>
              ) : (
                <ul>
                  {aggregate.positives
                    .filter((fuel) => pinned.has(fuel.fuelCode))
                    .map((fuel) => (
                      <li key={fuel.fuelCode} className="w12-pinned-row">
                        <i style={{ background: fuelColor(fuel.fuelCode) }} />
                        <span>{fuel.fuel}</span>
                        <strong>
                          {percent.format(fuel.value / aggregate.positiveTotal)}
                          <small>{number.format(fuel.value / aggregate.dayCount)} MWh/day</small>
                        </strong>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {tooltip && (
        <div className="w12-tooltip" style={{ left: tooltip.x, top: tooltip.y }} role="tooltip">
          <strong>{tooltip.fuel}</strong>
          <span>{formatMonth(month)} · {period.label}</span>
          <dl>
            <div><dt>Positive</dt><dd>{number.format(tooltip.value)} MWh</dd></div>
            <div><dt>Share</dt><dd>{percent.format(tooltip.value / aggregate.positiveTotal)}</dd></div>
            <div><dt>Mean/day</dt><dd>{number.format(tooltip.value / aggregate.dayCount)} MWh</dd></div>
          </dl>
          <small>Click to pin</small>
        </div>
      )}
    </section>
  );
}
