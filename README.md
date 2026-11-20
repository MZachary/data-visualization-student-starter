# data-visualization-student-starter

Starter repository for student assignments for the data visualization course [Constructing Visualizations](https://github.com/curran/constructing-visualizations).

How to use, for the first assignment:

- Fork this repository
- Modify the content of `src/assignments/week-01` as the first assignment
- Deploy your project using GitHub Pages (you may need to change `base` in `vite.config.ts`, depending on your repository name)
- Submit the link to your repo and hosted site

How to use, for subsequent assignments:

- Add a new directory `src/assignments`, potentially by copying a previous assignment as a starter, or copying files in from `src/examples` in [constructing-visualizations](https://github.com/curran/constructing-visualizations)
- Update the index at `src/assignments/index.ts` to add the new listing
- Redeploy to GitHub pages
- Submit the link to your hosted assignment in GitHub pages

## Week 7

[The reptile tree](src/assignments/week-07/README.md) recreates an Observable hyperbolic tree viewer with 12,650 reptile species. Select **Week 7** or open `?example=7`. The entry includes the source checklist, reproducible data preparation, and citations.

## Week 8

[How typical is an average day?](src/assignments/week-08/README.md) expands the electricity comparison to January, July, and September 2026 for all 13 regions. Load just the selected region/month files, compare seasonal patterns, reveal individual days behind the average, and click a day to investigate its full fuel mix. Select **Week 8** or open `?example=8`.

## Week 10

[Compare the hours that matter](src/assignments/week-10/README.md) builds on Week 8 with linked time-window brushing and an interactive fuel legend. Drag across either chart to compare a window’s average hourly generation or generation mix, hover or focus legend items to preview fuels, and click to pin selections. Open **Week 10** or `?example=10`.

## Week 11

[Where electricity begins](src/assignments/week-11/README.md) adds an EIA power-plant map to the electricity explorer. Browse 14,066 plants, link fuel highlighting to the charts, search plant details, and filter capacity-sized dots. Separate **Power plants** and **Generation patterns** tabs preserve exploration state, with emoji fuel legends. Open **Week 11** or `?example=11`.

## Week 13

[Focus across patterns and places](src/assignments/week-13/README.md) continues the Week 11 final-project direction with direct line inspection, unambiguous brushed-window controls, a more prominent plant-map scope, and fuel filters that always remain visible and removable across views. Open **Week 13** or `?example=13`.
