# Week 7 — The reptile tree

A React + D3 recreation of the focus-and-context idea in **Hyperbolic Tree Viewer — Part 3**, using reptiles instead of mammals. Open **Week 7** in the course sidebar, or visit `?example=7` (`&hideSidebar=true` gives the visualization the full window).

## Sources and attribution

- **Visualization reference:** [ee2dev / Observable Ambassadors, Hyperbolic Tree Viewer — Part 3](https://observablehq.com/@ambassadors/hyperbolic-tree-viewer-part-3). Its discussion of the Poincaré disk, Möbius navigation, geodesic edges, search, labels, and branch coloring informed this recreation. The [reference notebook export](https://api.observablehq.com/@ambassadors/hyperbolic-tree-viewer-part-3.js?v=4) was downloaded and inspected temporarily; the retrieved export identified revision 1299 and exposed the explanatory/documentation cells rather than the TypeScript viewer implementation. This is an independent implementation of those ideas, not a copied viewer or an embedded Observable notebook. No Observable runtime is needed.
- **Data:** Uetz, P., Freed, P., Aguilar, R., Reyes, F., Kudera, J. & Hošek, J. (eds.) (2026), [The Reptile Database](https://www.reptile-database.org/), accessed October 7, 2026. [Download index](https://www.reptile-database.org/data/index.html); [original June 17, 2026 checklist XLSX](https://www.reptile-database.org/data/reptile_checklist_2026_06.xlsx). The original workbook is retained in [`data/reptile_checklist_2026_06.xlsx`](data/reptile_checklist_2026_06.xlsx). Source data remain attributed to their original maintainers; the repository's code license does not relicense the dataset.
- **Data scope:** the database's [introduction and classification notes](https://www.reptile-database.org/db-info/introduction.html) describe its coverage of living non-avian reptiles.
- **D3:** [d3-hierarchy](https://d3js.org/d3-hierarchy/hierarchy) builds and counts the taxonomy; [D3 quantitative scales](https://d3js.org/d3-scale/pow) size nodes by descendant species count.

## Dataset and preparation

The saved snapshot contains **12,650 species**, **1,259 genera**, and **94 distinct family names**. These are computed from this workbook, rather than copied from a changing website total.

| Source group    | Display label          | Species |
| --------------- | ---------------------- | ------: |
| Sauria          | Lizards & worm lizards |   8,003 |
| Serpentes       | Snakes                 |   4,249 |
| Testudines      | Turtles                |     370 |
| Crocodylia      | Crocodilians           |      27 |
| Rhynchocephalia | Tuatara                |       1 |

[`data/prepare.py`](data/prepare.py) reads the workbook's `Checklist` worksheet using only Python's standard library. It extracts species, source group, family, authority, and source ID; derives genus from the scientific name; sorts records; and checks required fields, duplicate species/IDs, and genus-parent consistency. It excludes subspecies and the workbook's change-history sheets. No species are sampled or invented.

The workbook's `order` column is labeled **group** in the interface: its values are not all equivalent formal ranks. In particular, Sauria and Serpentes are retained as separate source groups rather than being portrayed as two modern orders. The synthetic root is Reptilia. The resulting hierarchy is **root → source group → family → genus → species**, with 14,009 total nodes. It is a taxonomic browsing hierarchy, not a phylogenetic reconstruction; branch length does not encode time or evolutionary distance. Birds and extinct reptiles are outside the source's scope.

To reproduce the browser JSON from the checked-in workbook:

```sh
python3 src/assignments/week-07/data/prepare.py
```

Output: [`public/data/week-07/reptiles.json`](../../../public/data/week-07/reptiles.json). It includes the source URL, snapshot/access dates, workbook SHA-256, column definitions, and all records. It is served locally through Vite's configured base URL; browsing the tree requires no external API. The UI also offers a JSON download and links to individual source species records.

## Implementation and interaction

- React manages selection, controls, search, loading/error states, and the keyboard-accessible taxonomy explorer.
- D3 hierarchy constructs parent/child relationships and descendant counts. Angular wedges are allocated in proportion to square roots of species counts so smaller branches remain discoverable.
- Each node's disk radius is `tanh(depth × spacing / 2)`. This is an original radial hyperbolic layout rather than a port of the reference's anchored layout.
- A complex Möbius transform `(z − f) / (1 − conjugate(f) × z)` moves the chosen focus to the disk center. Animated navigation follows a hyperbolic interpolation; reduced-motion preferences skip the animation.
- Edges follow circle arcs orthogonal to the disk boundary, with straight diameters as the limiting case.
- Canvas draws the 14,009-node tree at device pixel resolution. Subpixel links are omitted; collision-aware labels favor the focus and central/internal nodes. The full hierarchy remains searchable.
- Click nodes or group legend buttons to focus them, drag to pan, search scientific names, follow ancestry breadcrumbs, or browse child branches. Search reports the complete match count and shows the first 30 results; more specific queries narrow the list. The entire tree is reachable via native keyboard-operable controls outside the canvas.
- Scroll the mouse wheel or pinch a trackpad over the canvas to zoom from 100% to 600%, centered on the plot. The −/+ buttons provide the same control for keyboard and touch users. Zoom enlarges the disk within the canvas; its perimeter may leave the viewport. Labels remain readable and hit testing and dragging account for the magnification. Reset restores 100% zoom and returns to the root. Changing branch spacing also resets focus. Label visibility is optional. Node color identifies source group; node size reflects species count and shrinks toward the boundary.

The recreation intentionally concentrates on disk navigation and taxonomy exploration. It does not reproduce the reference's multiple layout modes, arbitrary-data mappings, theme editor, or animation-effect controls.

## Running and checking

```sh
npm install
npm run dev
npm run build
npm run lint
# Node 22.18+ with built-in TypeScript stripping:
node --test src/assignments/week-07/tree.test.mjs
```

The math/data tests check full species coverage, unique ancestry, group totals, finite in-disk coordinates at all supported spacing extremes, invertible focus transformations near the boundary, and geodesic orthogonality.

Browser verification was performed in Chromium at 1440 × 1100 and at 390 × 844 with the course sidebar hidden. Checks covered initial loading, group/child navigation, scientific-name search, species-record links, animated focus, dragging, reset, label toggling, and absence of browser exceptions.
