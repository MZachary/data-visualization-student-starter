# Week 8 — How typical is an average day?

Open **Week 8** in the sidebar, or visit `?example=8`. Add `&hideSidebar=true` to use the full window (Escape toggles the course sidebar).

This iteration builds on Week 6's regional comparison. It expands the historical data beyond the original September 3–16 snapshot and adds individual daily profiles behind the average. Users can move from a typical pattern to the actual date that produced an interesting line.

## What changed

- **Complete historical months:** January, July, and September 2026 for all 13 EIA regions. The initial snapshots have all 24 local clock-hour bins represented on every calendar date; this does not mean every individual fuel is complete.
- **On-demand files:** the browser first reads a small manifest, then only the selected region/month JSON files. Requests are shared and cached during the visit. Switching selections cannot display results from a stale request; failed requests can be retried.
- **Seasonal comparisons:** months are linked by default. Uncheck “Use the same month” to compare different months, including the same region in winter and summer. Fuel, units, hour, and variation settings persist while changing datasets.
- **Daily variation:** select one fuel to show faint daily lines behind its thick average. A dashed line identifies the highlighted date. Both panels share axes, including daily extremes, and preserve negative net generation.
- **Drill-down:** hover near a daily line to identify its date and value at the inspected hour. Click it to open Actual day with every fuel. The date selector and “Explore this day” button provide keyboard and touch alternatives. Return with “Back to average & variation.”
- **Hourly comparison:** linked hour guides, keyboard-operable slider, paired fuel bars, per-fuel sample counts, and daily minimum/maximum values at the inspected hour.

## Try it

1. Start with California and Texas in September. Enable **Show daily variation**, with **Wind** selected. Compare the spread of daily lines at 18:00 and the ranges below the bars.
2. Highlight an interesting date by hovering a line or selecting its date. Choose **Explore this day** to examine all fuels for that date in both regions.
3. Return to the average, unlink months, and choose January for panel A and July for panel B. Select the same region in both panels to isolate seasonal differences.
4. Switch between MWh and Share %. A larger absolute output need not imply a larger share of the generation mix.

## Reproduce or extend the data

[`get_data.py`](../../../get_data.py) uses Python 3.9+ and the standard library (including system IANA time-zone data). It fetches the official [EIA hourly fuel-generation endpoint](https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data). The [EIA API documentation](https://www.eia.gov/opendata/documentation.php) describes filtering and the 5,000-row JSON pagination limit.

Store the key in the ignored `.env.local` file at the repository root:

```dotenv
EIA_API_KEY=your_key_here
```

Alternatively, set `EIA_API_KEY` in the process environment. Do **not** prefix it with `VITE_`. The browser never needs this key. The supplied downloader's existing credential was moved into `.env.local`; no credential is included in the published files.

From the repository root:

```sh
# All 13 regions; resumes by skipping region/month files already in the manifest.
python3 get_data.py --months 2026-01 2026-07 2026-09

# Add a month for selected regions, or use --refresh to re-download revisions.
python3 get_data.py --months 2026-08 --regions CAL TEX
python3 get_data.py --months 2026-09 --regions CAL TEX --refresh

# Offline preparation from a saved CSV, in a separate output directory.
# Partial months remain partial; coverage is computed from the observations.
python3 get_data.py --csv public/data/eia_generation.csv --months 2026-09 --output /tmp/week08-from-csv
```

The script requests **local-calendar-month boundaries converted to UTC**, including the UTC hours after the end of the nominal month where necessary. It paginates with a stable timestamp/respondent/fuel sort, checks reported row counts and duplicate keys, retries transient failures, validates units, and omits nonnumeric observations while recording their count. Zero and negative values are retained. Secrets and request URLs are not printed.

Files are written under `public/data/week-08/AREA/YYYY-MM-contenthash.json`. Compact rows contain `[periodUTC, fuel, value]`, with fuel labels and region metadata stored once. Each shard is written atomically before its manifest entry. Completed downloads survive a later failure; rerunning resumes the remaining work. Refreshing creates new versioned files and retains old ones so an older manifest remains valid. Once no published version needs the older files, they can be removed manually.

Commit the script, manifest, and JSON files with the site changes. The existing Pages workflow includes `public/` in the built site. Data are **saved historical snapshots**, not automatically refreshed on a schedule. Earlier weeks continue to use their original CSV.

The 39 initial shards total approximately **8.18 MB**. California and Texas for September require **406,396 bytes** of JSON, plus the small manifest, compared with the original **11,653,501-byte** CSV. Splitting files reduces what a visitor downloads per selection; it does not by itself reduce the total hosted dataset. The compact schema also avoids repeating labels in every row. Both the old CSV and the new shards are hosted so past assignments remain reproducible.

## Calculation and interpretation

- UTC timestamps are converted with `Intl.DateTimeFormat` using each region's explicit reference city. Regions can span time zones; these are chosen visualization clocks, not official region-wide time zones.
- Monthly averages require a report in every local clock-hour bin. When panels show the same month, only dates eligible in both panels enter either average. Different months use their own eligible dates and visibly report separate counts.
- A fuel's mean excludes its missing observations. Missing data are not zero, and gaps are not interpolated. Each observed day has equal weight at a given hour. Repeated fall-back hours are averaged within their date; spring-forward dates are excluded from the average but remain inspectable as actual days.
- In MWh mode, the thick line is the mean of the daily values. In Share mode, it is **share of mean generation**, while thin lines represent **each day's hourly share**. The thick percentage line is not generally the mean of the thin percentage lines; the interface calls out this distinction.
- Denominators include all reported fuels even when focusing on one. Nonpositive totals have no defined share. Negative net generation is preserved, including storage charging and other net consumption.
- Opening a day uses the same date in both panels for the same month. Across different months, the other panel starts on the corresponding day-of-month when available, otherwise its latest reported date. Both dates are displayed and independently editable.
- Regional totals are used directly; authorities are not added to those totals. This visualization describes generation, not electricity delivered to a particular home.

## Implementation and validation

`data.ts` holds the month/day comparison logic, drawing paths, and nearest-line hit testing. It reuses Week 6's local-time conversion and averaging functions. `useData.ts` loads and caches immutable shards. `ElectricityExplorer.tsx` contains the controls and coordinated SVG views. The original weeks are preserved.

```sh
npm run build
npm run lint
node --test src/assignments/week-08/data.test.mjs
python3 -m unittest discover -s tests
```

Calculation tests cover missing values, zeros/negatives, share denominators, equal-day weighting, shared versus independent month coverage, DST, day selection, gaps in line hit testing, and all published shard metadata. Downloader tests cover UTC month boundaries across DST, pagination/truncation, duplicates, and nonnumeric observations.

Browser verification in Chromium covered the default view, 60 daily lines for the September comparison, pointer and date-control drill-down, return navigation, independent winter/summer dates, persistent fuel/unit settings, keyboard hour inspection, file caching, and a 390px mobile layout. Simulated failures verified retry, protection against stale responses, and explicit empty-data states. No browser exceptions occurred in these checks.
