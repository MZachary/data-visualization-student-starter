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

## Validation

These are some hypothetical ways I could check if the project works at each of the four levels.

### 1. Domain situation

My user could be someone curious about how electricity is generated in their region. I would talk to them and watch how they currently find this information, to make sure I understand what they want to know. They might care about the electricity delivered to their home, which is different from what is generated in their balancing authority.

### 2. Data and task abstraction

I want users to compare fuel sources, regions, and changes over time. I would need to decide when to show total generation vs percentage of generation, since a bigger region could produce more renewable energy but have a smaller renewable share. I would let users explore their own questions and see if these comparisons actually help them.

### 3. Visual encoding and interaction idiom

I could try a stacked area chart or separate line charts and see which makes changes in each fuel source throughout the day easier to understand. I might also use a map for powerplant locations. I would ask users to find things like the hour with the most solar generation, and compare how long it takes and how many mistakes they make with each chart.

### 4. Algorithm

The tool needs to load the data and update when someone changes the region or time period. I would check that the totals and percentages are correct, and measure how long updates take with larger amounts of data. If it is too slow, I could save common summaries so they do not need to be recalculated every time.

## New Learnings/Ideas:

One of the things i have learned immediately from my first initial sketches are that I believe a line chart is significantly better at displaying this data over time than the bar chart idea i had. The bar charts can still be useful for a specific hour comparison, but for looking for trends during time periods the line charts i have started to make are much better. see image for line charts:

<img width="1297" height="1112" alt="image" src="https://github.com/user-attachments/assets/a3cd3482-aa0d-4170-8568-1cc909ec6fed" />

and then these bar charts from week 3 might come back for a single hourly comparison instead of the big table of numbers that you see in the bottom of the image above:

<img width="1123" height="620" alt="image" src="https://github.com/user-attachments/assets/eda83337-2f45-40a7-8013-48c70a34aed0" />

That is one problem i have with the current week 5 visual. I think the numbers at the bottom are really hard to see when comparing all of the energy sources.

Additionally, and youll see this in the north star plot, I'm still entirely missing any way to compare different regions or reporting authorities. so thats probably the next big thing i need to work on, and itll require changing the page around a bit to get another plot in. I did use AI to generate my north star plot based off of all the things that I really want my final project to become. that looks like this:

<img width="1536" height="1024" alt="electricity-north-star-sketch" src="https://github.com/user-attachments/assets/d5e49b8a-b28c-4ef8-8260-a444569b3bf0" />

One thing I am still tracking as a goal is the map of america with where the energy is generated. Its kind of a silly goal because it requires a completely separate dataset that will for sure be difficult to find, but I think asking the average person how there energy is generated and even where at is a question few people can answer and I want my project to be able to answer that. 

Another thing that will prove important is doing some data management. My dataset _can_ be very large to get to what i want, so i think some amount of down selecting/averaging of the data will be important. The goal isnt really to let someone make a line chart of 365 days of energy generation, its more to give them the ability to see on average how is there energy generated, how does that change during a day/month/season, and how does it compare to other regions.


## Week 6 — Comparison plot V1

[Open Week 6](https://mzachary.github.io/data-visualization-student-starter/?example=6&hideSidebar=true) · [Implementation](../src/assignments/week-06/ElectricityComparison.tsx) · [Submission notes](WEEK_06.md)

This version implements the comparison part of my north-star sketch. Week 5 let me explore one region or authority at a time, but it was hard to compare places and the hourly numbers were difficult to scan. Week 6 puts two EIA regions side by side, starting with California and Texas, and replaces the hourly number cards with paired horizontal bars. Regions use familiar names and the EIA's reported regional totals directly.

The default is an average day for the available dates in September 2026. The current California/Texas comparison includes September 3–15: 13 shared local dates with reports in all 24 clock-hour bins in both regions. It is explicitly labeled as an available-days average, not the entire month. An actual-day option lets me investigate individual dates, including partial days.

Both charts align local clock hours using a stated reference city for each region: Pacific time for California and Central time for Texas. Regions can span time zones, so these are visualization reference clocks rather than official region-wide zones. Timestamps are converted before grouping by date and hour, with daylight saving handled by the reference city's time zone.

Both line charts use the same axes and fuel colors. Moving across either chart inspects the same local hour in both, and the hour slider supports keyboard inspection. Selecting fuels highlights them across both plots and narrows the hourly bars without changing the scale. The MWh/share toggle compares generation amounts or the reported mix.

![Week 6 comparison plot: California and Texas average days aligned to local time](week-06/comparison.png)

Missing fuel observations are excluded from averages, never treated as zero. The hourly bars show how many days contributed to each fuel's average. Negative net generation is retained. In average mode, shares divide each fuel's mean by the sum of all fuel means, rather than averaging daily percentages. Repeated fall-back clock hours are averaged within their date; dates missing any of the 24 clock-hour bins are excluded from the average. Coverage of all hours does not guarantee coverage of every fuel.

The U.S. map remains a later goal. Next steps include gathering a full month of data and showing how much individual days vary around the average. A useful peer-feedback task is to compare California and Texas's solar generation at local noon, then switch to shares and explain how the comparison changes.
