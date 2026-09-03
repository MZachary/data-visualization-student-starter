My dataset came from the EIA hourly generation API
i had to actually write a quick python script to actually download the data and turn it into a csv

anyway it tracks the hourly generation of energy in the US at each electricity balancing authority
examples of sources include nuclear, coal, solar, wind

i grabbed the data from sunday august 30 to wednesday september 2

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

