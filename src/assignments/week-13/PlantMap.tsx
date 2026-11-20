import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbers, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { colors } from '../week-06/data';
import {
  capacity,
  fuelNames,
  matchesFuel,
  plantFuel,
  regionPlants,
  type Plant,
  type PlantData,
} from '../week-11/plants';
import './plants.css';
import { fuelEmoji } from '../week-11/fuelEmoji';
import { isMapFuelPinned, toggleMapFuel } from './interaction.ts';

type States = FeatureCollection<Geometry>;
interface Props {
  panel: string;
  onChangePanel: (panel: string) => void;
  areas: { code: string; name: string }[];
  focus: string[];
  pinned: string[];
  fuelLabels: Record<string, string>;
  onChangeFuels: (fuels: string[]) => void;
  onPreviewFuel: (fuel: string | null) => void;
}
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
export function PlantMap(props: Props) {
  const [data, setData] = useState<{ plants: PlantData; states: States }>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function read(file: string) {
      const response = await fetch(`${import.meta.env.BASE_URL}data/week-11/${file}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Could not load plant map (HTTP ${response.status}).`);
      return response.json();
    }
    void Promise.all([read('plants.json'), read('states-10m.json')])
      .then(([plants, topology]: [PlantData, Topology<{ states: GeometryCollection }>]) => {
        const states = feature(topology, topology.objects.states);
        states.features = states.features.filter(
          (s) => !['02', '15', '72'].includes(String(s.id).padStart(2, '0')),
        );
        if (!controller.signal.aborted) {
          setData({ plants, states });
          setError('');
        }
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message);
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <section className="w13-plant-map">
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setError('');
            setAttempt(attempt + 1);
          }}
        >
          Retry map
        </button>
      </section>
    );
  if (!data)
    return (
      <section className="w13-plant-map" role="status">
        Loading plant locations…
      </section>
    );
  return <MapExplorer {...props} data={data.plants} states={data.states} />;
}
function MapExplorer({
  panel,
  onChangePanel,
  areas,
  focus,
  pinned,
  fuelLabels,
  onChangeFuels,
  onPreviewFuel,
  data,
  states,
}: Props & { data: PlantData; states: States }) {
  const region = panel === '0' || panel === '1' ? areas[Number(panel)].code : panel;
  const scoped = useMemo(() => regionPlants(data.plants, region), [data, region]);
  const regionName =
    panel === '0' || panel === '1'
      ? areas[Number(panel)].name
      : panel === 'ALL'
        ? 'Lower 48 states'
        : 'Unmatched authorities';
  const fuels = [...new Set(scoped.flatMap((p) => p.segments.map((s) => s.fuel)))];
  const scopes = [
    { id: '0', label: `Panel A`, detail: areas[0].name },
    { id: '1', label: `Panel B`, detail: areas[1].name },
    { id: 'ALL', label: 'All plants', detail: 'Lower 48' },
    { id: 'UNMATCHED', label: 'Unmatched', detail: 'Authority codes' },
  ];
  return (
    <section className="w13-plant-map" aria-labelledby="w13-plant-map-title">
      <div className="w13-plant-heading">
        <div>
          <p className="w13-eyebrow">FROM PATTERNS TO PLACES</p>
          <h2 id="w13-plant-map-title">Where are the power plants?</h2>
          <p>Operating generators · September 2026 inventory · capacity, not hourly output</p>
        </div>
      </div>
      <fieldset className="w13-map-scope">
        <legend>Map scope</legend>
        <div className="w13-map-scope-heading" aria-live="polite">
          <span>Currently showing</span>
          <strong>{regionName}</strong>
        </div>
        <div className="w13-map-scope-options">
          {scopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              aria-pressed={panel === scope.id}
              onClick={() => onChangePanel(scope.id)}
            >
              <strong>{scope.label}</strong>
              <span>{scope.detail}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <p className="w13-plant-explanation">
        The region follows each generator’s balancing authority, so plants can lie outside the
        region’s namesake state. Mixed-fuel plants keep all their sources; dot color shows the
        largest capacity among the highlighted fuels.
      </p>
      {pinned.length > 0 && (
        <div className="w13-active-fuels" aria-label="Active fuel filters">
          <div>
            <strong>Active fuel filters</strong>
            <span>Shared with the generation charts</span>
          </div>
          <div>
            {pinned.map((fuel) => (
              <button
                type="button"
                key={fuel}
                onClick={() => onChangeFuels(pinned.filter((candidate) => candidate !== fuel))}
                aria-label={`Remove ${fuelLabels[fuel] ?? fuelNames[fuel] ?? fuel} filter`}
              >
                {fuelLabels[fuel] ?? fuelNames[fuel] ?? fuel} ×
              </button>
            ))}
            <button type="button" className="w13-clear-map-fuels" onClick={() => onChangeFuels([])}>
              Clear all
            </button>
          </div>
        </div>
      )}
      <div className="w13-plant-legend" aria-label="Linked plant fuel legend">
        {Object.keys(fuelNames)
          .filter((f) => fuels.includes(f))
          .map((f) => {
            const selected = isMapFuelPinned(f, pinned);
            return (
              <button
                key={f}
                aria-pressed={selected}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') onPreviewFuel(f);
                }}
                onPointerLeave={() => onPreviewFuel(null)}
                onFocus={(e) => {
                  if (e.currentTarget.matches(':focus-visible')) onPreviewFuel(f);
                }}
                onBlur={() => onPreviewFuel(null)}
                onClick={() => onChangeFuels(toggleMapFuel(f, pinned))}
              >
                <i style={{ background: colors[f] ?? '#64748b' }} />
                <span aria-hidden="true">{fuelEmoji[f] ?? '⚡'}</span> {fuelNames[f]}
                {selected ? ' ✓' : ''}
              </button>
            );
          })}
      </div>
      <p className="w13-plant-hint">
        Hover or focus a fuel to preview it in the map and charts. Click to pin. Daily variation
        keeps the map focused on its selected fuel.
      </p>
      <MapView key={region} plants={scoped} states={states} focus={focus} regionName={regionName} />
      <details className="w13-plant-methods">
        <summary>Map coverage and sources</summary>
        <p>
          The saved September 2026 inventory contains {number.format(data.plants.length)} mapped
          plants in the Lower 48 states. Only generators marked Operating are included; standby,
          out-of-service, proposed, and retired units are excluded. The inventory covers facilities
          with at least 1 MW combined nameplate capacity, not all rooftop solar.
        </p>
        <p>
          Generator authority codes are joined to EIA’s reference table, not inferred from state
          boundaries.{' '}
          {number.format(Object.values(data.unmatchedAuthorities).reduce((a, b) => a + b, 0))}{' '}
          operating generators have authority codes that could not be matched to an active U.S.
          region; their plants remain accessible under Unmatched authorities and All Lower 48
          plants. A plant spanning authorities contributes only the selected region’s generators to
          regional details.
        </p>
        <p>
          Capacity is preliminary nameplate capacity in MW. The minimum-capacity filter and coverage
          percentages use total plant capacity in the selected map scope. Coverage reflects the
          capacity filter and search; fuel highlighting dims plants without removing them. Small
          plants use lighter dots. Marker area can encode that capacity; it does not represent
          energy produced. The map stays at September 2026 when chart months or hours change.
          Inventory coverage differs from EIA-930’s metered generation coverage, so these plant
          capacities do not reconcile to the chart values.
        </p>
        <p>
          Biomass and other nonstandard fuels are grouped as Other. Solar/wind-with-battery chart
          categories highlight the corresponding solar/wind generators; the map does not infer
          integrated generation. Hydro highlighting includes pumped storage.
        </p>
        <p>
          Sources: <a href="https://www.eia.gov/electricity/data/eia860m/">EIA-860M inventory</a> ·{' '}
          <a href="https://www.eia.gov/electricity/930-content/EIA930_Reference_Tables.xlsx">
            EIA-930 region reference
          </a>{' '}
          ·{' '}
          <a href="https://github.com/topojson/us-atlas">
            US Atlas / Census state boundaries (2017)
          </a>{' '}
          ·{' '}
          <a href={`${import.meta.env.BASE_URL}data/week-11/plants.json`} download>
            Download plant snapshot
          </a>
        </p>
      </details>
    </section>
  );
}
function MapView({
  plants,
  states,
  focus,
  regionName,
}: {
  plants: Plant[];
  states: States;
  focus: string[];
  regionName: string;
}) {
  const [query, setQuery] = useState('');
  const [sizing, setSizing] = useState(true);
  const [minimumCapacity, setMinimumCapacity] = useState(500);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [view, setView] = useState({ zoom: 1, dx: 0, dy: 0 });
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; moved: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const projection = useMemo(
    () =>
      geoAlbers().fitExtent(
        [
          [20, 20],
          [880, 480],
        ],
        states,
      ),
    [states],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const points = useMemo(
    () => plants.map((p) => ({ p, point: projection([p.lon, p.lat])! })),
    [plants, projection],
  );
  const extent = useMemo(() => {
    if (!points.length) return { x: 0, y: 0, w: 900, h: 500 };
    const xs = points.map((p) => p.point[0]),
      ys = points.map((p) => p.point[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const w = Math.max(180, (maxX - minX) * 1.2, (maxY - minY) * 1.2 * 1.8),
      h = w / 1.8;
    return { x: (minX + maxX - w) / 2, y: (minY + maxY - h) / 2, w, h };
  }, [points]);
  const w = extent.w / view.zoom,
    h = extent.h / view.zoom;
  const vx = extent.x + (extent.w - w) / 2 + view.dx,
    vy = extent.y + (extent.h - h) / 2 + view.dy;
  const scale = w / 900;
  const visible = useMemo(
    () =>
      points.filter(
        ({ p }) =>
          capacity(p) >= minimumCapacity &&
          `${p.name} ${p.id} ${p.state} ${p.county}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
      ),
    [points, query, minimumCapacity],
  );
  const highlighted = visible.filter(({ p }) => p.segments.some((s) => matchesFuel(s.fuel, focus)));
  const sorted = [...highlighted].sort((a, b) => a.p.name.localeCompare(b.p.name));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(sorted.length / 20) - 1));
  const detail = visible.find(({ p }) => p.id === (hovered ?? selected))?.p;
  const totalCapacity = plants.reduce((sum, p) => sum + capacity(p), 0);
  const visibleCapacity = visible.reduce((sum, { p }) => sum + capacity(p), 0);
  const plantPercent = plants.length ? (100 * visible.length) / plants.length : 0;
  const capacityPercent = totalCapacity > 0 ? (100 * visibleCapacity) / totalCapacity : null;
  const drawOrder = [...visible].sort(
    (a, b) =>
      Number(a.p.segments.some((s) => matchesFuel(s.fuel, focus))) -
        Number(b.p.segments.some((s) => matchesFuel(s.fuel, focus))) ||
      capacity(b.p) - capacity(a.p),
  );
  function choose(p: Plant) {
    setSelected(p.id);
    setHovered(null);
  }
  return (
    <>
      <div className="w13-plant-controls">
        <label>
          Find a plant
          <input
            type="search"
            aria-label="Find a plant"
            placeholder="Name, county, state code, or plant ID"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="w13-plant-minimum">
          Minimum plant capacity
          <select
            aria-label="Minimum plant capacity"
            value={minimumCapacity}
            onChange={(e) => {
              setMinimumCapacity(Number(e.target.value));
              setPage(0);
              setHovered(null);
            }}
          >
            <option value="0">All plants</option>
            <option value="10">10+ MW</option>
            <option value="100">100+ MW</option>
            <option value="500">500+ MW</option>
          </select>
        </label>
        <label className="w13-plant-size">
          <input type="checkbox" checked={sizing} onChange={(e) => setSizing(e.target.checked)} />{' '}
          Size dots by capacity
        </label>
        <div className="w13-plant-zoom">
          <button
            aria-label="Zoom map in"
            disabled={view.zoom >= 8}
            onClick={() => setView({ ...view, zoom: Math.min(8, view.zoom * 1.5) })}
          >
            +
          </button>
          <button
            aria-label="Zoom map out"
            disabled={view.zoom <= 1}
            onClick={() => setView({ ...view, zoom: Math.max(1, view.zoom / 1.5) })}
          >
            −
          </button>
          <button onClick={() => setView({ zoom: 1, dx: 0, dy: 0 })}>Reset map</button>
        </div>
      </div>
      <p className="w13-plant-count" role="status">
        Showing {number.format(visible.length)} of {number.format(plants.length)} plants (
        {number.format(plantPercent)}%) in {regionName}, representing{' '}
        {capacityPercent === null
          ? 'unavailable'
          : `${number.format(capacityPercent)}% of regional`}{' '}
        nameplate capacity. {number.format(highlighted.length)} highlighted by fuel.
        {query && ' Search applied.'}
        {minimumCapacity > 0 && ` Minimum ${minimumCapacity} MW.`}{' '}
        {sizing
          ? 'Circle area represents nameplate capacity.'
          : 'Equal-sized dots; capacity is available in plant details.'}
      </p>
      {sizing && (
        <div className="w13-plant-capacity-key">
          Capacity (MW){' '}
          <svg
            viewBox="0 0 240 42"
            width="240"
            height="42"
            aria-label="Capacity size key: 100 and 1000 megawatts"
          >
            <circle cx="20" cy="20" r={Math.sqrt(100) * 0.32} fill="#697f73" />
            <text x="32" y="24">
              100 MW
            </text>
            <circle cx="133" cy="20" r={Math.sqrt(1000) * 0.32} fill="#697f73" />
            <text x="149" y="24">
              1,000 MW
            </text>
          </svg>
        </div>
      )}
      <div className="w13-plant-layout">
        <div>
          <svg
            className="w13-plant-svg"
            viewBox={`${vx} ${vy} ${w} ${h}`}
            aria-label={`Power plants in ${regionName}. Use the searchable plant list for keyboard selection.`}
            role="img"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              suppressClick.current = false;
              drag.current = { x: e.clientX, y: e.clientY, dx: view.dx, dy: view.dy, moved: false };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const rect = e.currentTarget.getBoundingClientRect();
              if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) d.moved = true;
              if (d.moved) {
                e.currentTarget.setPointerCapture(e.pointerId);
                setHovered(null);
                setView({
                  ...view,
                  dx: d.dx - ((e.clientX - d.x) * w) / rect.width,
                  dy: d.dy - ((e.clientY - d.y) * h) / rect.height,
                });
              }
            }}
            onPointerUp={(e) => {
              suppressClick.current = Boolean(drag.current?.moved);
              drag.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onPointerLeave={() => setHovered(null)}
          >
            <rect x={vx} y={vy} width={w} height={h} fill="#eaf0ed" />
            {states.features.map((s) => (
              <path
                key={s.id}
                d={path(s) ?? ''}
                fill="#fcfcf4"
                stroke="#c6d1c7"
                strokeWidth={0.8 * scale}
              />
            ))}
            {drawOrder.map(({ p, point }) => {
              const active = p.segments.some((s) => matchesFuel(s.fuel, focus));
              return (
                <circle
                  key={p.id}
                  data-w13-plant-id={p.id}
                  cx={point[0]}
                  cy={point[1]}
                  r={(sizing ? Math.sqrt(capacity(p)) * 0.32 : 3.2) * scale}
                  fill={colors[plantFuel(p, focus)] ?? '#64748b'}
                  fillOpacity={
                    active ? (capacity(p) < 10 ? 0.35 : capacity(p) < 100 ? 0.55 : 0.85) : 0.08
                  }
                  stroke={selected === p.id ? '#152d25' : '#fff'}
                  strokeWidth={(selected === p.id ? 2 : 0.4) * scale}
                  onPointerEnter={() => {
                    if (!drag.current?.moved) setHovered(p.id);
                  }}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => {
                    if (!suppressClick.current) choose(p);
                    drag.current = null;
                  }}
                >
                  <title>
                    {p.name} · {number.format(capacity(p))} MW
                  </title>
                </circle>
              );
            })}
            {selected &&
              visible
                .filter(({ p }) => p.id === selected)
                .map(({ p, point }) => (
                  <circle
                    key={p.id}
                    cx={point[0]}
                    cy={point[1]}
                    r={((sizing ? Math.sqrt(capacity(p)) * 0.32 : 3.2) + 4) * scale}
                    fill="none"
                    stroke="#152d25"
                    strokeWidth={1.5 * scale}
                    pointerEvents="none"
                  />
                ))}
          </svg>
          <p className="w13-plant-hint">
            Hover to inspect; click to keep plant details open. Drag to pan; use + / − to zoom.
            Search and the list also reach overlapping plants.
          </p>
        </div>
        <aside className="w13-plant-detail" aria-label="Plant details">
          {detail ? (
            <>
              <p className="w13-eyebrow">{hovered ? 'HOVER PREVIEW' : 'SELECTED PLANT'}</p>
              <h3>{detail.name}</h3>
              <p>
                {detail.county}, {detail.state} · EIA plant {detail.id}
              </p>
              <strong className="w13-plant-mw">{number.format(capacity(detail))} MW</strong>
              <p>Nameplate capacity of generators in this map scope</p>
              <ul>
                {Object.entries(
                  detail.segments.reduce<Record<string, number>>(
                    (acc, s) => ({ ...acc, [s.fuel]: (acc[s.fuel] ?? 0) + s.mw }),
                    {},
                  ),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([fuel, mw]) => (
                    <li key={fuel}>
                      <i style={{ background: colors[fuel] ?? '#64748b' }} />
                      {fuelNames[fuel]} <b>{number.format(mw)} MW</b>
                    </li>
                  ))}
              </ul>
              <p>
                {detail.segments.reduce((n, s) => n + s.generators, 0)} operating generators ·
                Authority:{' '}
                {[...new Set(detail.segments.map((s) => s.ba || 'Unreported'))].join(', ')}
              </p>
              <p>
                {detail.lat.toFixed(4)}°, {detail.lon.toFixed(4)}°
              </p>
              <button
                onClick={() => {
                  setSelected(null);
                  setHovered(null);
                }}
              >
                Clear plant selection
              </button>
            </>
          ) : (
            <>
              <h3>Explore a plant</h3>
              <p>
                Hover a dot or choose a plant below to see its fuels, capacity, and balancing
                authority.
              </p>
              <p>
                Solar sites and batteries can share a plant. The details retain each fuel’s
                capacity.
              </p>
            </>
          )}
        </aside>
      </div>
      <details className="w13-plant-list" open={Boolean(query)}>
        <summary>
          Browse {number.format(sorted.length)} highlighted plants · keyboard and touch selection
        </summary>
        {!sorted.length && (
          <p>
            No plants match this region, capacity threshold, search, and fuel selection. Lower the
            threshold, try another fuel, or clear the search.
          </p>
        )}
        <div className="w13-plant-list-items">
          {sorted.slice(currentPage * 20, currentPage * 20 + 20).map(({ p }) => (
            <button key={p.id} aria-pressed={selected === p.id} onClick={() => choose(p)}>
              <span>
                {p.name}
                <small>
                  {p.state} · {fuelNames[plantFuel(p, focus)]}
                </small>
              </span>
              <span>{number.format(capacity(p))} MW</span>
            </button>
          ))}
        </div>
        {sorted.length > 20 && (
          <div className="w13-plant-pagination">
            <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {Math.ceil(sorted.length / 20)}
            </span>
            <button
              disabled={(currentPage + 1) * 20 >= sorted.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
      </details>
    </>
  );
}
