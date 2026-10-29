import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { colors, type Metric } from '../week-06/data';
import {
  averageSeries,
  comparisonDays,
  counts,
  dailySeries,
  inspectDates,
  linePath,
  nearestDay,
  type Loaded,
  type Manifest,
  type Values,
} from '../week-08/data';
import { useManifest, usePair } from '../week-08/useData';
import './explorer.css';
import { summarizeWindow, type HourWindow } from './window';

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
const dayLabel = (date: string) =>
  date
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${date}T12:00:00Z`),
      )
    : 'No date';
const format = (value: number | null | undefined, metric: Metric) =>
  value == null
    ? 'No report'
    : metric === 'share'
      ? `${value.toFixed(1)}%`
      : `${number.format(value)} MWh`;
const color = (fuel: string) => colors[fuel] ?? '#64748b';
const x = scaleLinear().domain([0, 23]).range([62, 552]);
const priority = ['SUN', 'WND', 'NG', 'NUC', 'WAT', 'COL', 'GEO', 'BAT'];

export function ElectricityExplorer() {
  const [retry, setRetry] = useState(0);
  const { value, error } = useManifest(retry);
  return (
    <section className="week-ten">
      <div className="w10-inner">
        <header className="w10-header">
          <p className="w10-eyebrow">WEEK 10 / ELECTRICITY EXPLORER</p>
          <h1>Compare the hours that matter</h1>
          <p>
            Brush a time window and preview fuels to compare electricity generation across places
            and seasons.
          </p>
        </header>
        {error ? (
          <div className="w10-status" role="alert">
            {error} <button onClick={() => setRetry(retry + 1)}>Try again</button>
          </div>
        ) : value ? (
          <Explorer manifest={value} />
        ) : (
          <p className="w10-status" role="status">
            Loading available regions and months…
          </p>
        )}
      </div>
    </section>
  );
}

interface ViewSettings {
  mode: 'average' | 'actual';
  variation: boolean;
  fuel: string;
  focus: string[];
  metric: Metric;
  hour: number;
  window: HourWindow | null;
}

function Explorer({ manifest }: { manifest: Manifest }) {
  const [settings, setSettings] = useState<ViewSettings>({
    mode: 'average',
    variation: false,
    fuel: 'WND',
    focus: [],
    metric: 'amount',
    hour: 18,
    window: null,
  });
  const entries = manifest.datasets;
  const latest = entries
    .map((e) => e.month)
    .sort()
    .at(-1)!;
  const [areas, setAreas] = useState(['CAL', 'TEX']);
  const [months, setMonths] = useState([latest, latest]);
  const [linked, setLinked] = useState(true);
  const [retry, setRetry] = useState(0);
  const regions = [...new Map(entries.map((e) => [e.area, e.name])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const chosen = areas.map(
    (area, i) =>
      entries.find((e) => e.area === area && e.month === months[i]) ??
      entries.find((e) => e.area === area) ??
      entries[0],
  );
  const [left, right] = chosen;
  const { value: pair, error } = usePair(left, right, retry);
  const sharedMonths = entries
    .filter(
      (e) =>
        e.area === left.area &&
        entries.some((other) => other.area === right.area && other.month === e.month),
    )
    .map((e) => e.month)
    .sort();
  function changeArea(panel: number, area: string) {
    const nextAreas = chosen.map((e, i) => (i === panel ? area : e.area));
    const available = entries
      .filter((e) => e.area === area)
      .map((e) => e.month)
      .sort();
    const month = available.includes(chosen[panel].month) ? chosen[panel].month : available.at(-1)!;
    let nextMonths = chosen.map((e, i) => (i === panel ? month : e.month));
    if (linked) {
      const common = available.filter((m) =>
        entries.some((e) => e.area === nextAreas[1 - panel] && e.month === m),
      );
      const selected = common.includes(month) ? month : common.at(-1);
      if (selected) nextMonths = [selected, selected];
      else setLinked(false);
    }
    setAreas(nextAreas);
    setMonths(nextMonths);
  }
  function changeMonth(panel: number, month: string) {
    setMonths(linked ? [month, month] : chosen.map((e, i) => (i === panel ? month : e.month)));
  }
  return (
    <>
      <div className="w10-selection">
        {chosen.map((entry, i) => (
          <div className="w10-selection-panel" key={i}>
            <span className="w10-panel-letter">{i === 0 ? 'A' : 'B'}</span>
            <label>
              Region {i === 0 ? 'A' : 'B'}
              <select
                aria-label={`Region ${i === 0 ? 'A' : 'B'}`}
                value={entry.area}
                onChange={(e) => changeArea(i, e.target.value)}
              >
                {regions.map(([area, name]) => (
                  <option key={area} value={area}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month {i === 0 ? 'A' : 'B'}
              <select
                aria-label={`Month ${i === 0 ? 'A' : 'B'}`}
                value={entry.month}
                onChange={(e) => changeMonth(i, e.target.value)}
              >
                {(linked
                  ? sharedMonths
                  : entries
                      .filter((e) => e.area === entry.area)
                      .map((e) => e.month)
                      .sort()
                ).map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        <label className="w10-link-months">
          <input
            type="checkbox"
            checked={linked}
            disabled={!sharedMonths.length}
            onChange={(e) => {
              setLinked(e.target.checked);
              if (e.target.checked) {
                const month = sharedMonths.includes(left.month) ? left.month : sharedMonths.at(-1)!;
                setMonths([month, month]);
              }
            }}
          />{' '}
          Use the same month in both panels <span>Uncheck to compare winter and summer.</span>
        </label>
      </div>
      {error ? (
        <div className="w10-status" role="alert">
          {error} <button onClick={() => setRetry(retry + 1)}>Try again</button>
        </div>
      ) : pair ? (
        <Comparison
          key={`${left.file}|${right.file}`}
          pair={pair}
          settings={settings}
          update={(patch) => setSettings((current) => ({ ...current, ...patch }))}
        />
      ) : (
        <p className="w10-status" role="status">
          Loading {left.name} and {right.name} · selected region/month files only…
        </p>
      )}
      <p className="w10-download-note">
        On-demand data ·{' '}
        {number.format(
          [...new Map(chosen.map((e) => [e.file, e])).values()].reduce(
            (sum, e) => sum + e.bytes,
            0,
          ) / 1024,
        )}{' '}
        KB of saved JSON for this selection. Files are reused during this visit.
      </p>
    </>
  );
}

function Comparison({
  pair,
  settings,
  update,
}: {
  pair: Loaded[];
  settings: ViewSettings;
  update: (patch: Partial<ViewSettings>) => void;
}) {
  const { mode, variation, fuel, focus, metric, hour, window: timeWindow } = settings;
  const [previewFuel, setPreviewFuel] = useState<string | null>(null);
  const [focusedFuel, setFocusedFuel] = useState<string | null>(null);
  const legendPreview = previewFuel ?? focusedFuel;
  const setWindow = (window: HourWindow | null) => update({ window });
  const setMode = (mode: ViewSettings['mode']) => update({ mode });
  const setVariation = (variation: boolean) => update({ variation });
  const setFuel = (fuel: string) => update({ fuel });
  const setFocus = (focus: string[]) => update({ focus });
  const setMetric = (metric: Metric) => update({ metric });
  const setHour = (hour: number) => update({ hour });
  const [hovered, setHovered] = useState<{ panel: number; date: string } | null>(null);
  const eligible = useMemo(() => comparisonDays(pair), [pair]);
  const [dates, setDates] = useState<[string, string]>(() =>
    inspectDates(pair, 0, eligible[0].at(-1)?.date ?? pair[0].days.at(-1)?.date ?? ''),
  );
  const [preview, setPreview] = useState<string[]>(() =>
    eligible.map((days) => days[0]?.date ?? ''),
  );
  const sameMonth = pair[0].entry.month === pair[1].entry.month;
  const fuels = useMemo(
    () =>
      [...new Map(pair.flatMap((p) => Object.entries(p.data.fuels))).entries()].sort(
        (a, b) =>
          (priority.includes(a[0]) ? priority.indexOf(a[0]) : 99) -
            (priority.includes(b[0]) ? priority.indexOf(b[0]) : 99) || a[1].localeCompare(b[1]),
      ),
    [pair],
  );
  const selectedFuel = fuels.some(([code]) => code === fuel) ? fuel : fuels[0][0];
  const fuelName = fuels.find(([code]) => code === selectedFuel)![1];
  const showVariation = mode === 'average' && variation;
  const codes = useMemo(() => fuels.map(([f]) => f), [fuels]);
  const shownDays = useMemo(
    () =>
      mode === 'average' ? eligible : pair.map((p, i) => p.days.filter((d) => d.date === dates[i])),
    [pair, eligible, mode, dates],
  );
  const series = useMemo(
    () => shownDays.map((days) => averageSeries(days, codes, metric)),
    [shownDays, codes, metric],
  );
  const daily = useMemo(
    () => eligible.map((days) => dailySeries(days, selectedFuel, metric)),
    [eligible, selectedFuel, metric],
  );
  const sampleCounts = useMemo(
    () => shownDays.map((days) => new Map(codes.map((f) => [f, counts(days, f)]))),
    [shownDays, codes],
  );
  const summaries = useMemo(
    () => shownDays.map((days) => summarizeWindow(days, codes, timeWindow ?? [hour, hour], metric)),
    [shownDays, codes, timeWindow, hour, metric],
  );
  const values = series
    .flatMap((s) =>
      [...s].filter(([f]) => !showVariation || f === selectedFuel).flatMap(([, v]) => v),
    )
    .concat(showVariation ? daily.flatMap((lines) => lines.flatMap((line) => line.values)) : [])
    .filter((v): v is number => v !== null);
  const y = scaleLinear()
    .domain([Math.min(0, ...values), Math.max(metric === 'share' ? 100 : 1, ...values)])
    .nice()
    .range([285, 30]);
  const barValues = summaries.flatMap((summary) =>
    [...summary.values()].flatMap((s) => (s.value === null ? [] : [s.value])),
  );
  const bar = scaleLinear()
    .domain(
      timeWindow
        ? [Math.min(0, ...barValues), Math.max(metric === 'share' ? 100 : 1, ...barValues)]
        : y.domain(),
    )
    .range([0, 100]);
  const activeFocus = focus.filter((f) => codes.includes(f));
  const chartFocus = legendPreview ? [legendPreview] : activeFocus;
  const visibleFuels = fuels.filter(([f]) => (showVariation ? f === selectedFuel : true));
  const activeDate = (panel: number) => (hovered?.panel === panel ? hovered.date : preview[panel]);
  function inspect(panel: number, date: string) {
    if (!date) return;
    setDates(inspectDates(pair, panel, date));
    setMode('actual');
    setFocus([]);
    setHovered(null);
  }
  function changeActualDate(panel: number, date: string) {
    setDates(
      sameMonth
        ? [date, date]
        : (dates.map((d, i) => (i === panel ? date : d)) as [string, string]),
    );
  }
  return (
    <>
      <div className="w10-view-controls">
        <fieldset className="w10-segment">
          <legend>Day profile</legend>
          <button
            aria-pressed={mode === 'average'}
            onClick={() => {
              setMode('average');
              setHovered(null);
            }}
          >
            Average day
          </button>
          <button
            aria-pressed={mode === 'actual'}
            onClick={() => {
              setMode('actual');
              setHovered(null);
            }}
          >
            Actual day
          </button>
        </fieldset>
        <fieldset className="w10-segment">
          <legend>Compare by</legend>
          <button aria-pressed={metric === 'amount'} onClick={() => setMetric('amount')}>
            MWh
          </button>
          <button aria-pressed={metric === 'share'} onClick={() => setMetric('share')}>
            Share %
          </button>
        </fieldset>
        {mode === 'average' && (
          <label className="w10-variation-toggle">
            <input
              type="checkbox"
              checked={variation}
              onChange={(e) => {
                setVariation(e.target.checked);
                setHovered(null);
              }}
            />{' '}
            Show daily variation
          </label>
        )}
        {showVariation && (
          <label className="w10-fuel-select">
            Explore one fuel
            <select
              aria-label="Variation fuel"
              value={selectedFuel}
              onChange={(e) => {
                setFuel(e.target.value);
                setHovered(null);
              }}
            >
              {fuels.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'actual' && (
          <button className="w10-back" onClick={() => setMode('average')}>
            ← Back to average & variation
          </button>
        )}
      </div>
      <div className="w10-chart-intro">
        <div>
          <p className="w10-eyebrow">
            {showVariation
              ? 'LOOK BEYOND THE AVERAGE'
              : mode === 'actual'
                ? 'INVESTIGATE A DAY'
                : 'FIND THE DAILY PATTERN'}
          </p>
          <h2>
            {showVariation
              ? `${fuelName}: one month, many different days`
              : mode === 'actual'
                ? 'What happened on this day?'
                : 'Two profiles, one shared scale'}
          </h2>
        </div>
        {showVariation && (
          <div className="w10-line-key">
            <span>
              <i style={{ background: color(selectedFuel), opacity: 0.3 }} /> Individual day
            </span>
            <span>
              <i style={{ background: color(selectedFuel), height: 3 }} /> Average day
            </span>
            <span>
              <i style={{ borderTop: `2px dashed ${color(selectedFuel)}`, height: 0 }} />{' '}
              Highlighted day
            </span>
          </div>
        )}
      </div>
      <p className="w10-context">
        {showVariation
          ? 'Thin lines show individual days; the thick line shows their average. Hover near a thin line to identify it, then click to explore that date. You can also use the date controls below each chart.'
          : mode === 'actual'
            ? 'All fuel sources for the dates below. Move across either chart to inspect the same local hour in both panels.'
            : 'Select fuels to focus both charts. Turn on daily variation to see what the average hides.'}
      </p>
      {showVariation && metric === 'share' && (
        <p className="w10-share-note">
          The thick line shows the average generation mix. Thin lines show each day’s mix; the thick
          line is not an average of those daily percentages.
        </p>
      )}
      <p className="w10-coverage-rule">
        {sameMonth
          ? 'Monthly averages use the same dates with all 24 clock-hour bins reported in both regions.'
          : 'Different months: each average uses that month’s available days with all 24 clock-hour bins reported. Sample sizes can differ.'}{' '}
        All times follow each panel’s reference city.
      </p>
      {pair[0].entry.file === pair[1].entry.file && (
        <p className="w10-notice">
          Both panels show the same region and month. Choose another region, or unlink months to
          compare seasons.
        </p>
      )}
      <div className="w10-brush-controls">
        <div>
          <strong>
            {timeWindow
              ? `${hourLabel(timeWindow[0])}–${hourLabel(timeWindow[1])}`
              : 'Inspecting a single hour'}
          </strong>
          <p>
            Drag across either chart to select a window in both regions. Endpoints are inclusive.
          </p>
        </div>
        <label>
          Start hour
          <select
            aria-label="Window start hour"
            value={timeWindow?.[0] ?? hour}
            onChange={(e) => {
              const start = Number(e.target.value);
              setWindow([start, Math.max(start, timeWindow?.[1] ?? hour)]);
            }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <label>
          End hour
          <select
            aria-label="Window end hour"
            value={timeWindow?.[1] ?? hour}
            onChange={(e) => {
              const end = Number(e.target.value);
              setWindow([Math.min(end, timeWindow?.[0] ?? hour), end]);
            }}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!timeWindow} onClick={() => setWindow(null)}>
          Reset to single hour
        </button>
      </div>
      <div className="w10-charts">
        {pair.map((p, i) => {
          const lineDate = activeDate(i);
          const selectedLine = daily[i].find((line) => line.date === lineDate);
          const dateOptions = sameMonth
            ? [...new Set(pair.flatMap((item) => item.days.map((d) => d.date)))].sort()
            : p.days.map((d) => d.date);
          return (
            <article className="w10-chart-card" key={i}>
              <div className="w10-card-heading">
                <div>
                  <p className="w10-eyebrow">PANEL {i === 0 ? 'A' : 'B'}</p>
                  <h3>{p.entry.name}</h3>
                  <p>
                    {monthLabel(p.entry.month)} · {p.entry.clock} reference time
                  </p>
                </div>
                <span className="w10-coverage">
                  {mode === 'average'
                    ? `${eligible[i].length}/${p.entry.calendarDays} days averaged`
                    : `${shownDays[i][0]?.hours ?? 0}/24 clock hours`}
                </span>
              </div>
              {mode === 'actual' && (
                <label className="w10-actual-date">
                  Date {i === 0 ? 'A' : 'B'}
                  <select
                    aria-label={`Actual date ${i === 0 ? 'A' : 'B'}`}
                    value={dates[i]}
                    onChange={(e) => changeActualDate(i, e.target.value)}
                  >
                    {dateOptions.map((date) => (
                      <option key={date} value={date}>
                        {date}
                        {p.days.find((d) => d.date === date)?.hours !== 24
                          ? ' · partial or missing'
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!shownDays[i].length && (
                <p className="w10-empty" role="status">
                  {mode === 'average'
                    ? 'No complete days available for this comparison.'
                    : 'No reports for this date. Choose another day.'}
                </p>
              )}
              {showVariation && !daily[i].some((line) => line.values.some((v) => v !== null)) && (
                <p className="w10-empty" role="status">
                  No {fuelName.toLowerCase()} reports in the eligible days. Choose another fuel.
                </p>
              )}
              <ProfileChart
                panel={i}
                name={p.entry.name}
                series={series[i]}
                fuels={showVariation ? [[selectedFuel, fuelName]] : fuels}
                focus={chartFocus}
                timeWindow={timeWindow}
                setWindow={setWindow}
                y={y}
                metric={metric}
                hour={hour}
                setHour={setHour}
                daily={showVariation ? daily[i] : []}
                variationFuel={selectedFuel}
                activeDate={showVariation ? lineDate : ''}
                onHover={(date) => setHovered(date ? { panel: i, date } : null)}
                onInspect={(date) => inspect(i, date)}
              />
              {showVariation && (
                <div className="w10-day-detail">
                  <div className="w10-day-readout" aria-live="polite">
                    <span>
                      {dayLabel(lineDate)} at {hourLabel(hour)}
                    </span>
                    <strong>{format(selectedLine?.values[hour], metric)}</strong>
                    <small>Average: {format(series[i].get(selectedFuel)?.[hour], metric)}</small>
                  </div>
                  <div className="w10-pick-day">
                    <label>
                      Highlight a day
                      <select
                        aria-label={`Highlight day ${i === 0 ? 'A' : 'B'}`}
                        value={preview[i]}
                        disabled={!eligible[i].length}
                        onChange={(e) => {
                          setPreview(preview.map((d, panel) => (panel === i ? e.target.value : d)));
                          setHovered(null);
                        }}
                      >
                        {eligible[i].map((d) => (
                          <option key={d.date} value={d.date}>
                            {d.date}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button disabled={!lineDate} onClick={() => inspect(i, lineDate)}>
                      Explore this day →
                    </button>
                  </div>
                </div>
              )}
              <p className="w10-card-note">
                {mode === 'average'
                  ? `${eligible[i].length ? `${dayLabel(eligible[i][0].date)}–${dayLabel(eligible[i].at(-1)!.date)} · ` : ''}Coverage is by clock hour; individual fuels may have fewer reports.`
                  : `${dates[i]} · ${sameMonth ? 'Same calendar date in both regions.' : 'Dates can be changed independently.'}`}
              </p>
            </article>
          );
        })}
      </div>
      {!showVariation && (
        <fieldset className="w10-fuel-controls">
          <legend>
            Hover or keyboard-focus to preview · click to pin fuels across charts and bars
          </legend>
          <div>
            {fuels.map(([code, name]) => (
              <button
                key={code}
                aria-pressed={focus.includes(code)}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') setPreviewFuel(code);
                }}
                onPointerLeave={() => setPreviewFuel(null)}
                onFocus={() => setFocusedFuel(code)}
                onBlur={() => setFocusedFuel(null)}
                onClick={() =>
                  setFocus(
                    focus.includes(code) ? focus.filter((f) => f !== code) : [...focus, code],
                  )
                }
              >
                <i
                  style={{
                    background: color(code),
                    opacity: !chartFocus.length || chartFocus.includes(code) ? 1 : 0.25,
                  }}
                />
                {name}
                {focus.includes(code) && ' ✓'}
              </button>
            ))}
            <button className="w10-clear" disabled={!focus.length} onClick={() => setFocus([])}>
              Show all
            </button>
          </div>
        </fieldset>
      )}
      <section className="w10-hour-comparison" aria-labelledby="w10-hour-title">
        <div className="w10-hour-heading">
          <div>
            <p className="w10-eyebrow">
              {timeWindow ? 'COMPARE A LOCAL TIME WINDOW' : 'COMPARE THE SAME LOCAL HOUR'}
            </p>
            <h2 id="w10-hour-title">
              {timeWindow
                ? `${hourLabel(timeWindow[0])}–${hourLabel(timeWindow[1])}`
                : hourLabel(hour)}{' '}
              <span>{mode === 'average' ? 'average day' : 'selected dates'}</span>
            </h2>
          </div>
          <label>
            Inspect hour
            <input
              aria-label="Inspect local hour"
              type="range"
              min="0"
              max="23"
              value={hour}
              aria-valuetext={`${hourLabel(hour)} local reference time`}
              onChange={(e) => {
                setHour(Number(e.target.value));
                setWindow(null);
              }}
            />
          </label>
        </div>
        <p className="w10-window-note" role="status">
          {timeWindow
            ? `Average hourly generation over ${timeWindow[1] - timeWindow[0] + 1} selected clock hours. Shares use the window’s generation mix, not an average of hourly percentages. A fuel needs a report in every selected hour; gaps remain unavailable.`
            : 'One local hour. Move the slider to return to single-hour inspection.'}
        </p>
        <div className="w10-bar-head">
          <span>Fuel source</span>
          {pair.map((p, i) => (
            <strong key={i}>
              {i === 0 ? 'A' : 'B'} / {p.entry.name}
              <small>{mode === 'average' ? monthLabel(p.entry.month) : dates[i]}</small>
            </strong>
          ))}
        </div>
        {visibleFuels.map(([code, name]) => (
          <div
            className="w10-bar-row"
            key={code}
            style={{
              opacity: showVariation || !chartFocus.length || chartFocus.includes(code) ? 1 : 0.2,
            }}
          >
            <span>{name}</span>
            {series.map((s, i) => {
              const v = timeWindow ? summaries[i].get(code)?.value : s.get(code)?.[hour];
              const n = sampleCounts[i].get(code)?.[hour] ?? 0;
              return (
                <div className="w10-bar-cell" key={i}>
                  <div className="w10-bar-track">
                    <span className="w10-bar-zero" style={{ left: `${bar(0)}%` }} />
                    {v != null && (
                      <span
                        className="w10-bar-fill"
                        style={{
                          background: color(code),
                          left: `${Math.min(bar(0), bar(v))}%`,
                          width: `${Math.abs(bar(v) - bar(0))}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className="w10-bar-value">
                    {v == null && metric === 'share' && n > 0 ? 'No share' : format(v, metric)}
                    {mode === 'average' && (
                      <small>
                        {timeWindow
                          ? `${summaries[i].get(code)?.hours ?? 0}/${timeWindow[1] - timeWindow[0] + 1} hours · ${summaries[i].get(code)?.minDays ?? 0}–${summaries[i].get(code)?.maxDays ?? 0} days/hour`
                          : `${n}/${eligible[i].length} days reported`}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {showVariation && (
          <div className="w10-ranges">
            {daily.map((lines, i) => {
              const readings = lines
                .map((line) => line.values[hour])
                .filter((v): v is number => v !== null);
              return (
                <p key={i}>
                  <strong>
                    {pair[i].entry.name} · individual days at {hourLabel(hour)}
                  </strong>
                  {readings.length ? (
                    <>
                      {format(Math.min(...readings), metric)} –{' '}
                      {format(Math.max(...readings), metric)}
                      <span>
                        {readings.length} days with{' '}
                        {metric === 'share' ? 'a defined share' : 'reports'}
                      </span>
                    </>
                  ) : (
                    'No reports'
                  )}
                </p>
              );
            })}
          </div>
        )}
      </section>
      <details className="w10-methods">
        <summary>About the data & how to read this comparison</summary>
        <p>
          <strong>Brushing.</strong> Drag in either chart to replace the linked, inclusive hour
          window. A click still inspects an individual day in variation mode. The hour menus provide
          keyboard and touch alternatives. Reset or move the hour slider to inspect one hour again.
          Both charts retain their full-day context and shared scales.
        </p>
        <p>
          <strong>Window calculations.</strong> We first compute each fuel’s mean at each local hour
          using the existing equal-day weighting. Window MWh is the mean of those hourly means, not
          total energy. A fuel missing an entire selected hour has no window value; if any reported
          fuel has such a gap, window shares are unavailable. Otherwise shares divide each fuel’s
          summed hourly means by the sum across all reported fuels. Legend previews and pinned fuels
          never change these denominators.
        </p>
        <p>
          <strong>Legend.</strong> Hover or focus a fuel to temporarily emphasize it in both charts
          and the bars. Clicking toggles a persistent selection. Leaving the legend restores pinned
          selections; Show all clears them.
        </p>
        <p>
          <strong>Local time.</strong> Panels align clock hours, not simultaneous instants. Each EIA
          region uses a reference city; regions can span time zones. Daylight saving follows that
          city.
        </p>
        <p>
          <strong>Averages and gaps.</strong> Only days with reports in all 24 clock-hour bins enter
          the average. Same-month comparisons use shared dates; different-month comparisons use each
          month’s eligible dates. Missing fuel observations are excluded, never replaced with zero.
          The counts below each bar show how many days contributed to that fuel/hour. Repeated
          fall-back hours are averaged within their day; spring-forward days are excluded from
          averages but remain available in Actual day.
        </p>
        <p>
          <strong>Daily variation.</strong> Thin lines use the same eligible dates as the thick
          average. Hover identifies the closest line within a small distance; overlapping lines can
          also be selected by date. Lines stop at missing hourly values. Clicking opens all fuels
          for that day; for different months the other panel starts at the corresponding
          day-of-month when available.
        </p>
        <p>
          <strong>Share %.</strong> The thick line is each fuel’s mean generation divided by the sum
          of fuel means. Thin lines are each individual day’s hourly shares. The thick line is
          therefore not necessarily the mean of the thin percentage lines. Denominators always
          include all reported fuels. Missing fuels can affect shares; nonpositive totals have no
          defined share. Negative net generation is retained.
        </p>
        <p>
          <strong>Scope.</strong> Regional generation totals are used directly, without adding
          balancing authorities. These figures describe generation, not household electricity
          supply. Historical reports may be revised. Saved snapshots are served by GitHub Pages;
          visitors never call EIA or receive an API key.
        </p>
        <div className="w10-sources">
          {pair.map((p, i) => (
            <p key={i}>
              <strong>
                {i === 0 ? 'A' : 'B'} / {p.entry.name} · {monthLabel(p.entry.month)}
              </strong>
              {number.format(p.entry.rows)} numeric observations · {p.entry.reportedDays}/
              {p.entry.calendarDays} days with reports · {p.data.omittedNonNumeric} nonnumeric
              reports omitted.
              <br />
              {p.data.retrieved
                ? `Retrieved ${p.data.retrieved.slice(0, 10)}.`
                : 'Prepared from the saved CSV; original retrieval date unavailable.'}{' '}
              <a href={`${import.meta.env.BASE_URL}data/week-08/${p.entry.file}`} download>
                Download this snapshot
              </a>
            </p>
          ))}
        </div>
        <p>
          Source:{' '}
          <a href="https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data">
            U.S. Energy Information Administration · hourly generation by fuel
          </a>
          .
        </p>
      </details>
    </>
  );
}

function ProfileChart({
  panel,
  name,
  series,
  fuels,
  focus,
  y,
  metric,
  hour,
  setHour,
  daily,
  variationFuel,
  activeDate,
  onHover,
  onInspect,
  timeWindow,
  setWindow,
}: {
  timeWindow: HourWindow | null;
  setWindow: (window: HourWindow | null) => void;
  panel: number;
  name: string;
  series: Map<string, Values>;
  fuels: [string, string][];
  focus: string[];
  y: ReturnType<typeof scaleLinear<number, number>>;
  metric: Metric;
  hour: number;
  setHour: (h: number) => void;
  daily: { date: string; values: Values }[];
  variationFuel: string;
  activeDate: string;
  onHover: (date: string | null) => void;
  onInspect: (date: string) => void;
}) {
  const drag = useRef<{
    start: number;
    clientX: number;
    moved: boolean;
    previous: HourWindow | null;
  } | null>(null);
  function pointerHour(event: PointerEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement!;
    const matrix = svg.getScreenCTM();
    if (!matrix) return hour;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return Math.max(
      0,
      Math.min(23, Math.round(x.invert(point.matrixTransform(matrix.inverse()).x))),
    );
  }
  function pointer(event: PointerEvent<SVGRectElement>, commit: boolean) {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    setHour(Math.max(0, Math.min(23, Math.round(x.invert(local.x)))));
    const date = nearestDay(
      daily,
      local.x,
      local.y,
      x,
      y,
      10 / Math.max(0.1, Math.hypot(matrix.a, matrix.b)),
    );
    onHover(date);
    if (commit && date) onInspect(date);
  }
  const active = daily.find((line) => line.date === activeDate);
  return (
    <svg
      className="w10-profile"
      viewBox="0 0 580 340"
      role="img"
      aria-labelledby={`w10-title-${panel} w10-desc-${panel}`}
    >
      <title id={`w10-title-${panel}`}>
        {name}: hourly {metric === 'amount' ? 'generation in MWh' : 'share of generation'}
      </title>
      <desc id={`w10-desc-${panel}`}>
        {daily.length
          ? 'Thin lines are individual days. The thick line is their average profile. Use the day selector below to explore any date.'
          : 'One line per fuel source.'}{' '}
        Negative values are retained; missing observations appear as gaps. Use the hour slider below
        for keyboard inspection.
      </desc>
      <text x="62" y="16" className="w10-axis-title">
        {metric === 'amount' ? 'Net generation (MWh)' : 'Share of reported net generation (%)'}
      </text>
      {y.ticks(5).map((tick) => (
        <g key={tick}>
          <line
            x1="62"
            x2="552"
            y1={y(tick)}
            y2={y(tick)}
            stroke={tick === 0 ? '#a3b4ac' : '#e6ebe5'}
          />
          <text x="53" y={y(tick) + 4} textAnchor="end">
            {number.format(tick)}
          </text>
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((h) => (
        <text key={h} x={x(h)} y="306" textAnchor="middle">
          {hourLabel(h)}
        </text>
      ))}
      <text x="307" y="330" textAnchor="middle" className="w10-axis-title">
        Hour of day · local reference time
      </text>
      {timeWindow && (
        <g pointerEvents="none" className="w10-brush-selection">
          <rect
            x={Math.max(62, x(timeWindow[0]) - 5)}
            y="30"
            width={Math.min(552, x(timeWindow[1]) + 5) - Math.max(62, x(timeWindow[0]) - 5)}
            height="255"
            fill="#315846"
            opacity="0.10"
          />
          {timeWindow.map((h, i) => (
            <line key={i} x1={x(h)} x2={x(h)} y1="30" y2="285" stroke="#315846" strokeWidth="2" />
          ))}
        </g>
      )}
      <g className="w10-daily-lines">
        {daily.map((line) => (
          <path
            key={line.date}
            data-date={line.date}
            d={linePath(line.values, x, y)}
            fill="none"
            stroke={color(variationFuel)}
            strokeWidth="1.3"
            opacity="0.18"
          />
        ))}
      </g>
      {active && (
        <g className="w10-highlighted-day">
          <path
            d={linePath(active.values, x, y)}
            fill="none"
            stroke={color(variationFuel)}
            strokeWidth="2"
            opacity="0.85"
            strokeDasharray="5 3"
          />
          {active.values.map(
            (v, h) =>
              v !== null && (
                <circle
                  key={h}
                  cx={x(h)}
                  cy={y(v)}
                  r={h === hour ? 4 : 1.5}
                  fill={color(variationFuel)}
                />
              ),
          )}
        </g>
      )}
      {fuels.map(([code, label]) => {
        const values = series.get(code)!;
        const emphasized = daily.length || !focus.length || focus.includes(code);
        return (
          <g key={code} className="w10-average-line" opacity={emphasized ? 1 : 0.12}>
            {daily.length > 0 && (
              <path d={linePath(values, x, y)} fill="none" stroke="white" strokeWidth="5.5" />
            )}
            <path
              d={linePath(values, x, y)}
              fill="none"
              stroke={color(code)}
              strokeWidth="2.8"
              strokeLinejoin="round"
            >
              <title>{label}</title>
            </path>
            {values.map(
              (v, h) =>
                v !== null && (
                  <circle
                    key={h}
                    cx={x(h)}
                    cy={y(v)}
                    r={h === hour ? 4.5 : 1.3}
                    fill={color(code)}
                    stroke={h === hour ? 'white' : 'none'}
                    strokeWidth="1.5"
                  />
                ),
            )}
          </g>
        );
      })}
      <line
        x1={x(hour)}
        x2={x(hour)}
        y1="30"
        y2="285"
        stroke="#536d63"
        strokeDasharray="3 5"
        pointerEvents="none"
      />
      <rect
        className="w10-chart-hit"
        x="62"
        y="30"
        width="490"
        height="255"
        fill="transparent"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = {
            start: pointerHour(e),
            clientX: e.clientX,
            moved: false,
            previous: timeWindow,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) {
            pointer(e, false);
            return;
          }
          if (Math.abs(e.clientX - d.clientX) > 5) d.moved = true;
          if (d.moved) {
            const h = pointerHour(e);
            setWindow([Math.min(d.start, h), Math.max(d.start, h)]);
            onHover(null);
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d && !d.moved) pointer(e, true);
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          if (drag.current) setWindow(drag.current.previous);
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onPointerLeave={() => onHover(null)}
      />
    </svg>
  );
}
