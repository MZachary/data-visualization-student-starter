topic to explore:
How is electricity generated in America. the goal is to explore the various ways that electricity is generated (fuel source, primarily) for a given region in the US at a given time of day/throughout the average day

A secondary goal is a map of the major powerplant locations for that region and where the electricity is generated

A couple questions to investigate:
how does electricity generation mix change throughout the day
how does the cost of electricity change throughout the day
how are the sources different between regions of the us
which regions have the most/least renewable energy
how does it change across seasons, or hot/cold days
by region, i mainly mean balancing authority

links to potential datasets:
the us energy information administration has a lot of data for this, including an API
https://www.eia.gov/opendata/browser/electricity/rto/fuel-type-data?frequency=hourly&data=value;&sortColumn=period;&sortDirection=desc;

links to related visualization:
https://app.electricitymaps.com/map/live/fifteen_minutes
they have a very advanced visualization but it is a bit "heavy" compared to what i am envisioning for my tool. I want mine to be a bit more clear/comparison focused on each regions ultimate source of energy

sketches:
this sketch shows the energy production amount for each energy source for a day. the "width" of the line chart across time shows how much energy is coming from it
<img width="849" height="1131" alt="image" src="https://github.com/user-attachments/assets/041f0238-dc69-4b20-9982-c92c06a5edab" />

this sketch shows a map of the US, with fake example powerplants for where the energy is coming from
<img width="1509" height="1131" alt="image" src="https://github.com/user-attachments/assets/1a59ef7a-cdab-43e3-b6d8-5a553210619a" />

## Task Analysis

The main goal of this visualization is to help users discover how electricity generation sources vary across US balancing authorities and over time. Users should be able to understand a region's generation mix, compare it with other regions, and investigate changes or unusual patterns. These goals are independent of the visualization type used to support them.

### Tasks and targets

- Summarizing generation mix: I want to determine how much electricity each fuel source generates for a given authority and time period. The targets are the distribution of generation across fuel sources
- Compare time trends: I want to compare how generation changes throughout the day, daily cycles, and in seasons. I want to identify when each source reaches highest and lowest output. The targets are trends and extremes
- Comparing regions: I want to compare fuel-source amounts and shares across authorities during the same time period. Identifying which regions have the highest/lowest reneweable sources, nuclear, etc. The targets are differences and extremes
- Locate outliers: I want to find unusually large changes in generation relative to a regions typical behavior and then compare those with other times or regions. Targets are outliers in generation amounts and source shares
- Investigating relationships: Maybe find compatible price and weather data to compare how those changes result in changes in electricity generation amounts and sources. Targets are relationships among attributes
- Map of powerplants: if i can find the right dataset, I want to create a map of where energy is generated in large quantities. Compare how plants are located within regions and the density of them

### How users carry out these tasks

The primary analysis purpose is discovering patterns. Users may also produce derived data, such as each fuel source's percentage of total generation or average generation by hour of day. A typical-day calculation would need a defined date range and consistent treatment of local time.

Search tasks depend on what the user already knows. Users could look up a known balancing authority and time in an organized index, locate an unusually high renewable share without knowing which region or time contains it, browse the available fuel sources and plants within a selected region, or explore unfamiliar regions and periods for interesting patterns.

Query tasks include identifying a single region's fuel share at a particular time, comparing a few regions or periods, and summarizing the full generation mix over a selected scope.

These tasks can form a sequence: summarize a region's typical daily generation mix, locate a period that differs from that pattern, identify which fuel sources changed, and compare that period with another region or season. The individual steps support the larger goal of understanding how electricity generation varies by place and time.
