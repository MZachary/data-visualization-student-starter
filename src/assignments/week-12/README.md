# Week 12 — Reduce

This view adapts the VizHub **Regional Fuel Mix Treemap** into the course project.

It applies two visible reduction strategies to `eia_generation_6hour.csv`:

1. **Filtering** by region, month, and a day-based period.
2. **Aggregation** from six-hour fuel records into one signed total per fuel.

Positive totals use treemap area. Negative charging and pumping values remain visible in a separate
rail so the reduction does not silently discard meaningful values. The month control is an addition
to the VizHub prototype because the project dataset contains January, July, and September.
