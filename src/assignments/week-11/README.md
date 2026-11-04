# Week 11 — Where electricity begins

Open **Week 11**, or `?example=11&hideSidebar=true`.

This iteration copies Week 10’s electricity explorer and adds the power-plant map from the original project vision. It preserves regional/monthly comparisons, brushing, daily variation, and linked fuel highlighting.

## Explore

- Switch between **Power plants** and **Generation patterns** using the tabs. Region selectors are shared; month and day controls belong to Generation patterns.
- Switching tabs preserves map search, selection, capacity threshold, sizing, zoom/pan, and generation mode, hour window, units, and fuel selections. Dataset changes retain their existing reset behavior.
- Fuel legends supplement text and color swatches with decorative emojis. Map markers remain circles. Tabs support arrow keys, Home, and End.

- Map panel A or B’s region, all Lower 48 plants, or plants with unmatched authority codes. The selected panel persists when chart regions or months change.
- **Circle area represents nameplate capacity by default**; a size legend explains the encoding. Small plants use lighter dots. Equal-sized dots remain optional.
- The map defaults to 500+ MW. Filter to All plants, 10+ MW, 100+ MW, or 500+ MW. Counts show the percentage of regional plants and capacity retained by the threshold and search. Fuel highlighting does not change these coverage percentages.
- Hover a plant for details; click to keep them open. Details retain all fuels at mixed-fuel sites, capacity by fuel, operating generator counts, and authority codes.
- Hover or keyboard-focus a fuel legend button to preview it across the map and generation charts; click to pin it. The map legend and chart legend share selection state. Daily variation uses its selected fuel instead.
- Search by plant name, county, state code, or EIA plant ID. The paginated plant list gives keyboard/touch access to all matching plants, including overlapping dots.
- Drag to pan; use the zoom buttons and Reset map. Selecting another region fits its plant locations.

Try California’s **Diablo Canyon**, then switch the map to Texas and find **Comanche Peak**. Preview Solar to see where solar generators are located and how the generation profiles differ.

## Saved data and provenance

Sources downloaded November 3, 2026:

- [EIA-860M, September 2026 workbook](https://www.eia.gov/electricity/data/eia860m/xls/september_generator2026.xlsx), saved in `data/september_generator2026.xlsx`.
- [EIA-930 authority reference workbook](https://www.eia.gov/electricity/930-content/EIA930_Reference_Tables.xlsx), saved in `data/EIA930_Reference_Tables.xlsx`.
- [US Atlas v3 states-10m](https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json), derived from 2017 U.S. Census cartographic boundaries. The local basemap and its ISC license are in `public/data/week-11/`.

The JSON contains **14,066 plants and 25,547 operating generators**. Only the inventory’s `(OP) Operating` rows are included. Standby and out-of-service rows are excluded (2,249 generators), as are Alaska and Hawaii (688 operating generators); the separate Puerto Rico worksheets are outside scope. Proposed and retired worksheets are not used. EIA’s inventory covers facilities with at least 1 MW combined nameplate capacity, not every distributed installation.

Plants are joined to regions through each generator’s balancing-authority code and the reference table’s active U.S. authority entries. State location is never used to guess a grid region. **318 generators** have retired, foreign, or otherwise unmatched codes; they remain in the national and unmatched views, but not regional totals. The source’s retired WACM/WAUW codes are deliberately not reassigned to successors. Some plants have multiple authorities; regional details count only that region’s generators.

Capacity is preliminary **nameplate MW**, not hourly production or storage energy in MWh. The map is a fixed September 2026 inventory, even when chart months change. EIA-860M inventory and EIA-930 metered generation differ in scope; map capacities are not meant to reconcile to the hourly chart.

Generator primary fuel codes are grouped to the chart palette. Coal and petroleum variants are grouped; biomass, purchased steam, and other fuels appear as Other. Pumped-storage prime movers are distinguished from conventional hydro. Battery and other electric storage are separated by prime mover. Integrated solar/wind-with-battery chart categories highlight the solar/wind generator components; the map does not infer integrated output. Dot color is the fuel with greatest capacity among highlighted fuels; optional dot size remains total capacity in the selected region, even during fuel highlighting.

## Reproduction

No API key or Python packages are needed. The source XLSX files are retained in the repository; browsers download only the derived JSON and basemap.

```sh
python3 src/assignments/week-11/data/prepare.py
```

`xlsx.py` reads spreadsheet XML with the Python standard library. `prepare.py` verifies the snapshot/header schema, rejects duplicate generator keys and inconsistent plant coordinates, validates capacity/coordinates, maps fuels, and aggregates by plant + region + authority + fuel. It fails for unknown energy-source codes. The JSON records source workbook SHA-256 hashes, excluded counts, and unmatched authority counts.

## Validation

```sh
npm run build
npm run lint
node --test src/assignments/week-11/plants.test.mjs src/assignments/week-10/window.test.mjs src/assignments/week-08/data.test.mjs src/assignments/week-07/tree.test.mjs
python3 -m unittest discover -s tests
```

Data tests check unique plants, valid coordinates/capacities, all 13 regions, unmatched-generator counts, a known nuclear plant, mixed-fuel/mixed-authority aggregation, fuel aliases, and storage versus purchased-steam categorization.

Chromium verification covers default California, Texas, national and unmatched scopes, search, plant details, linked legend preview, capacity sizing, pan/zoom, and a 390px mobile viewport without horizontal overflow. Pinned selections restore after hover previews; keyboard Tab previews, panel persistence after region changes, window brushing, and simulated HTTP failure/retry were also checked. Earlier electricity calculation tests continue to pass.

Screenshots: [Power plants](../../../docs/week-11-plants.png) · [Generation patterns](../../../docs/week-11-generation.png).
