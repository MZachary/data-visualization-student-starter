# Week 13 — Focus + context

Week 13 continues the Week 11 electricity explorer rather than the separate Week 12 exercise. It
turns user feedback into a clearer focus-and-context workflow while preserving the plant map,
regional comparison, seasonal controls, brushing, and daily variation.

## What changed

- **Direct fuel inspection:** Hover near a generation line to identify its fuel, hour, and value.
  The line is previewed across both panels and the bars; clicking the line pins that fuel. The
  existing legend remains the keyboard and touch alternative.
- **Unambiguous time windows:** Hovering a chart no longer changes the committed inspection hour
  while a brushed window is active. Window summaries show their start and end hours, and the
  single-hour slider appears only in single-hour mode.
- **Visible map scope:** The plant map now names its current scope prominently and uses explicit
  buttons for Panel A, Panel B, the Lower 48, and unmatched authorities.
- **Recoverable fuel filters:** Active chart filters remain visible on the map even when the plant
  inventory has no equivalent category. Integrated solar/wind aliases map to their physical plant
  fuels, and every filter can be removed from the map.

## Interaction notes

The brushed window and the hover inspection are deliberately separate. A hover tooltip describes
one point on a line, while the comparison bars continue to summarize the visibly selected window.
Returning to single-hour mode restores the linked hour guide and slider.

Plant capacity and regional generation remain different datasets. Map fuel matching connects
related categories for highlighting only; it does not claim that plant nameplate capacity equals
hourly generation.

## Validation

```sh
npm run build
npm run lint
node --test src/assignments/week-13/interaction.test.mjs \
  src/assignments/week-11/plants.test.mjs \
  src/assignments/week-10/window.test.mjs \
  src/assignments/week-08/data.test.mjs
python3 -m unittest discover -s tests
```
