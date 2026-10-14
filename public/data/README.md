My dataset came from the EIA hourly generation API
i had to actually write a quick python script to actually download the data and turn it into a csv

anyway it tracks the hourly generation of energy in the US at each electricity balancing authority
examples of sources include nuclear, coal, solar, wind

The current CSV contains 151,391 rows from 2026-09-03T00 through 2026-09-16T06 UTC.
The downloader requests the previous 14 complete UTC days each time it runs; some reports may not yet be available.

the api is accessible here:

https://api.eia.gov/v2/electricity/rto/fuel-type-data/data/

Each row represents the amount of electricity generated from one energy source by one balancing authority during a particular hour.
A balancing authority is an organization responsible for maintaining the balance between electricity supply and demand within a particular portion of the electrical grid.

Atrributes:

period
Type: Time - Timestamp
Description: The hour during which the electricity generation was reported. Example: 2026-09-02T00.

respondent
Type: Categorical / Geographic identifier
Description: Short identifier for the balancing authority reporting the generation data, such as AECI or AVA. The balancing authority represents a particular area of the U.S. electrical grid.

respondent-name
Type: Categorical
Description: Full name of the balancing authority, such as Associated Electric Cooperative, Inc.

fueltype
Type: Categorical
Description: Short code identifying the source used to generate electricity, such as COL for coal, NG for natural gas, WND for wind, or SUN for solar.

type-name
Type: Categorical
Description: Human-readable name of the electricity generation source, such as Coal, Natural Gas, Wind, or Solar.

value
Type: Quantitative
Description: Amount of electricity generated from the specified source during that hour.

value-units
Type: Categorical
Description: Units used for the value field. In this dataset, the values are reported in megawatt-hours.

## Week 8 region/month snapshots

`week-08/manifest.json` indexes 39 compact JSON snapshots: all 13 EIA regions in January, July, and September 2026. Each file covers a local calendar month using its stated reference city. The browser fetches only the selected files. The original CSV remains in use for Weeks 2–6.

Run `python3 get_data.py --months 2026-01 2026-07 2026-09` from the repository root to reproduce the downloads (existing files are skipped; add `--refresh` for revisions). Use an `EIA_API_KEY` environment variable or an ignored `.env.local` file. See [Week 8 documentation](../../src/assignments/week-08/README.md) for schema, coverage rules, and offline preparation.
