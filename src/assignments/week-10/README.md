# Week 10 — Compare the hours that matter

Open **Week 10** in the assignment sidebar, or use `?example=10&hideSidebar=true`.

This visualization starts as a copy of Week 8 and adds **brushing** and an **interactive color legend with hover previews**. Earlier assignments remain intact. It reuses Week 8’s saved region/month data and loading functions and Week 6’s local-time calculations.

## Why these interactions?

A single-hour comparison cannot summarize a question like “How does the evening generation mix differ between California and Texas?” Brushing lets the viewer choose a meaningful part of the day while keeping the full daily profiles visible. The same window appears in both panels, and the bars summarize it.

The legend offers quick visual identification without committing a selection. Hovering a fuel temporarily emphasizes its lines and bars across both regions. Clicking pins or unpins a fuel; multiple fuels can be pinned. Moving away restores the pinned selection. Keyboard focus provides the same preview, and native buttons support keyboard and touch selection. Dimmed bars remain visible for context. Focus and preview never alter data, scales, or share denominators.

## Try it

1. Start with California and Texas in September, in Average day mode.
2. Drag across either chart from 16:00 to 21:00. Both panels highlight the six selected hourly bins, including both endpoints. Drag again to replace the selection; reverse-direction dragging works too.
3. Compare the bars below, then switch from MWh to Share %. The bars now summarize the window, while the charts retain their full-day profiles.
4. Hover over Solar, then Wind in the legend. Click one or both to pin them, then move away from the legend to see the pinned selection restored.
5. Use the Start hour and End hour menus to select a window without dragging. Choose **Reset to single hour**, or move the inspection slider, to restore the single-hour bars.
6. Enable daily variation. Dragging still brushes; a click on a daily line still opens that date. The single-fuel variation menu replaces the multi-fuel legend in this mode. Day readouts and variation ranges remain explicitly tied to the inspected hour.

## Calculation choices

- Windows use each panel’s local reference clock, not simultaneous UTC instants. The endpoints are inclusive; windows do not wrap across midnight.
- MWh bars show **average hourly generation**, not energy summed over the window. First, each hour is averaged across eligible days using the existing equal-day weighting; then those hourly means receive equal weight across the window.
- Window shares divide the sum of a fuel’s hourly means by the sum of all reported fuels’ hourly means. They are **not averages of hourly percentages**.
- Missing observations remain missing. A fuel with no observation in an entire selected hour has no window value. If any fuel reported within the window has an incomplete hourly profile, window shares are unavailable. Fuels absent throughout the window are not invented as zero observations.
- Negative net generation is retained. Nonpositive denominators have no defined share. Bars show hour coverage and the minimum/maximum contributing days per hour in average mode.
- Chart scales remain shared across panels and unchanged by the brush or legend. Window bars use a shared scale across all fuels and both regions, including any negative values.

## Implementation and checks

`ElectricityExplorer.tsx` and `explorer.css` were copied from Week 8 and scoped to Week 10. Linked brush state lives above the comparison panels. SVG pointer coordinates are transformed into local chart coordinates; pointer capture supports dragging beyond the chart boundary. Canceled gestures restore the prior selection. Native hour menus provide an alternative to dragging.

`window.ts` contains the window summarization. Tests exercise inclusive endpoints, generation-weighted shares, unselected fuel denominators, gaps, zero and negative values, repeated-hour weighting, and uneven sample counts.

Validated with:

```sh
npm run build
npm run lint
node --test src/assignments/week-10/window.test.mjs src/assignments/week-08/data.test.mjs src/assignments/week-07/tree.test.mjs
```

Browser interaction checks remain to be performed; the commands above validate compilation, lint, and calculation behavior.
