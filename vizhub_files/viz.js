import * as d3 from 'd3';

// ---------------------------------------------------------------------------
// References (adapted):
//   - Treemap from bl.ocks.org (MIT, @tasqon), ported by VizHub:
//     https://vizhub.com/viz/12e12dd5abf54f10b1c7072a3405156c
//     Adapted the d3.treemap + d3.treemapResquarify + hierarchy/sum pattern,
//     clipPath-per-leaf label pattern, per-leaf title tooltip, and the
//     radio-button period toggle that re-sums the hierarchy and animates
//     the rect transitions over 750 ms.
//   - Treemap in d3 (@subh3ndu):
//     https://vizhub.com/viz/47c3cde0b0954fef9a5550a5b0efa9af
//     Adapted the clear/join rendering of rects and text from hierarchy
//     nodes and the proportional-area labelling.
// ---------------------------------------------------------------------------

// Shared, stable fuel colour scale. Colors are keyed by fuel name so
// identity persists across period toggles and re-sums.
const FUEL_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#0f766e', // teal
  '#9333ea', // purple
  '#ea580c', // orange
  '#475569', // slate
  '#0ea5e9', // sky
  '#84cc16', // chartreuse
  '#f43f5e', // rose
  '#a16207', // brown
];

const colorScale = d3.scaleOrdinal().domain([]).range(FUEL_COLORS);
const colorFor = (fuel) => {
  const known = colorScale.domain();
  if (!known.includes(fuel)) {
    // Grow the domain deterministically.
    colorScale.domain([...known, fuel]);
  }
  return colorScale(fuel);
};

// Choose readable text colour for a fill.
const textColorFor = (hex) => {
  const c = d3.color(hex);
  if (!c) return '#0f172a';
  const { r, g, b } = c.rgb();
  // Relative luminance
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0f172a' : '#f8fafc';
};

const pct = d3.format('.1%');
const mwhFmt = d3.format(',.0f');

const ensureTooltip = () => {
  return d3
    .select(document.body)
    .selectAll('div.eia-tooltip')
    .data([null])
    .join('div')
    .attr('class', 'eia-tooltip')
    .style('position', 'fixed')
    .style('pointer-events', 'none')
    .style('padding', '8px 10px')
    .style('background', 'rgba(15,23,42,0.94)')
    .style('color', '#f8fafc')
    .style('border-radius', '6px')
    .style('font', '12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .style('box-shadow', '0 4px 14px rgba(15,23,42,0.25)')
    .style('opacity', 0)
    .style('z-index', 20);
};

export const viz = (
  svg,
  {
    leaves,
    negatives,
    positiveTotal,
    dayCount,
    regionName,
    periodLabel,
    pinned,
    width,
    height,
    onTogglePinned,
  },
) => {
  svg.attr('width', width).attr('height', height);

  const isFirstRender = !svg.select('g.treemap-root').node();

  // Clear per-render content (but preserve structure caching by joining later).
  if (isFirstRender) {
    svg.selectAll('*').remove();
  } else {
    // Remove stale layers that we re-draw each render.
    svg.selectAll('g.legend-layer').remove();
  }

  const margin = { top: 12, right: 12, bottom: 12, left: 12 };
  const railWidth = Math.min(260, Math.max(180, Math.floor(width * 0.28)));
  const hasRail = width > 640;
  const railGap = hasRail ? 16 : 0;

  const innerW = Math.max(
    10,
    width - margin.left - margin.right - (hasRail ? railWidth + railGap : 0),
  );
  const innerH = Math.max(10, height - margin.top - margin.bottom);

  // Title
  const grandTotal = positiveTotal;
  const totalStr =
    grandTotal >= 1e6
      ? `${(grandTotal / 1e6).toFixed(2)} TWh`
      : `${mwhFmt(grandTotal)} MWh`;
  const titleText = `${regionName} · ${periodLabel} · ${totalStr} positive generation`;

  svg
    .selectAll('text.chart-title')
    .data([titleText])
    .join('text')
    .attr('class', 'chart-title')
    .attr('x', margin.left)
    .attr('y', 20)
    .attr('font', '600 15px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .attr('fill', '#0f172a')
    .text((d) => d);

  // Subtitle (day count + note)
  svg
    .selectAll('text.chart-sub')
    .data([`${dayCount} day${dayCount === 1 ? '' : 's'} in period`])
    .join('text')
    .attr('class', 'chart-sub')
    .attr('x', margin.left)
    .attr('y', 38)
    .attr('font', '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .attr('fill', '#475569')
    .text((d) => d);

  const plotTop = 52;

  const rootG = svg
    .selectAll('g.treemap-root')
    .data([null])
    .join('g')
    .attr('class', 'treemap-root')
    .attr('transform', `translate(${margin.left},${plotTop})`);

  const plotH = Math.max(10, innerH - plotTop);

  // ----- Build hierarchy ------------------------------------------------
  const data = leaves && leaves.length ? leaves.slice() : [];
  // Sort descending so resquarify produces stable, tidy layouts.
  data.sort((a, b) => b.value - a.value);

  const hierarchyData = { children: data.map((d) => ({ ...d })) };

  const root = d3
    .hierarchy(hierarchyData)
    .sum((d) => (d.value != null ? d.value : 0))
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  d3
    .treemap()
    .tile(d3.treemapResquarify)
    .size([innerW, plotH])
    .round(true)
    .paddingInner(2)
    .paddingOuter(2)(root);

  const nodes = root.leaves();

  // ----- Clip paths (ids unique per fuel) -------------------------------
  const clipBaseId = `tm-clip-${Math.random().toString(36).slice(2)}`;

  const defs = rootG
    .selectAll('defs.tm-defs')
    .data([null])
    .join('defs')
    .attr('class', 'tm-defs');

  defs
    .selectAll('clipPath.leaf-clip')
    .data(nodes, (d) => d.data.fuel)
    .join(
      (enter) =>
        enter
          .append('clipPath')
          .attr('class', 'leaf-clip')
          .attr('id', (d) => `${clipBaseId}-${slug(d.data.fuel)}`)
          .append('rect'),
      (update) => update,
      (exit) => exit.remove(),
    )
    .select('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0));

  // ----- Leaves ---------------------------------------------------------
  const tooltip = ensureTooltip();

  const leavesG = rootG
    .selectAll('g.leaf')
    .data(nodes, (d) => d.data.fuel)
    .join(
      (enter) => {
        const g = enter
          .append('g')
          .attr('class', 'leaf')
          .attr('tabindex', 0)
          .attr('opacity', 0)
          .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
        g.append('rect').attr('class', 'leaf-rect').attr('rx', 3);
        g.append('rect')
          .attr('class', 'leaf-pin-outline')
          .attr('fill', 'none')
          .attr('stroke', '#0f172a')
          .attr('stroke-width', 2.5)
          .attr('pointer-events', 'none')
          .style('display', 'none');
        g.append('text')
          .attr('class', 'leaf-label')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none');
        g.append('text')
          .attr('class', 'leaf-pct')
          .attr('dominant-baseline', 'middle')
          .attr('pointer-events', 'none');
        return g;
      },
      (update) => update,
      (exit) => exit.remove(),
    );

  // Attach data for interaction (fresh on every render).
  leavesG
    .attr('aria-label', (d) => {
      const fuel = d.data.fuel;
      const share = positiveTotal > 0 ? d.value / positiveTotal : 0;
      return `${fuel}, ${Math.round(share * 100)}% of positive generation, ${periodLabel}`;
    })
    .attr('role', 'button')
    .style('cursor', 'pointer');

  // Transition position.
  leavesG
    .transition('tm-move')
    .duration(750)
    .ease(d3.easeCubicOut)
    .attr('opacity', 1)
    .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

  // Rect fill/size — fill applied immediately (stable per fuel).
  leavesG
    .select('rect.leaf-rect')
    .attr('fill', (d) => colorFor(d.data.fuel))
    .transition('tm-rect')
    .duration(750)
    .ease(d3.easeCubicOut)
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0));

  // Pin outline sizing.
  leavesG
    .select('rect.leaf-pin-outline')
    .attr('width', (d) => Math.max(0, d.x1 - d.x0))
    .attr('height', (d) => Math.max(0, d.y1 - d.y0))
    .attr('rx', 3)
    .style('display', (d) => (pinned.has(d.data.fuel) ? null : 'none'));

  leavesG.select('rect.leaf-pin-outline').raise();

  // Labels: only when rect is large enough; use clipPath to truncate.
  const LABEL_MIN_W = 52;
  const LABEL_MIN_H = 22;

  leavesG
    .select('text.leaf-label')
    .attr('clip-path', (d) => `url(#${clipBaseId}-${slug(d.data.fuel)})`)
    .attr('x', 6)
    .attr('y', (d) => {
      const h = d.y1 - d.y0;
      // Position near top area of the leaf: first line.
      return Math.min(Math.max(h / 2 - 6, 12), h - 14);
    })
    .attr('font', '600 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .attr('fill', (d) => textColorFor(colorFor(d.data.fuel)))
    .style('display', (d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      return w >= LABEL_MIN_W && h >= LABEL_MIN_H ? null : 'none';
    })
    .text((d) => d.data.fuel);

  leavesG
    .select('text.leaf-pct')
    .attr('clip-path', (d) => `url(#${clipBaseId}-${slug(d.data.fuel)})`)
    .attr('x', 6)
    .attr('y', (d) => {
      const h = d.y1 - d.y0;
      return Math.min(Math.max(h / 2 + 8, 26), h - 4);
    })
    .attr('font', '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .attr('fill', (d) => textColorFor(colorFor(d.data.fuel)))
    .style('display', (d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      return w >= LABEL_MIN_W && h >= LABEL_MIN_H + 12 ? null : 'none';
    })
    .text((d) => (positiveTotal > 0 ? pct(d.value / positiveTotal) : '0%'));

  // ----- Interaction ----------------------------------------------------
  leavesG
    .on('mouseenter', function (event, d) {
      // Highlight stroke
      d3.select(this)
        .select('rect.leaf-rect')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 2);
      showTooltip(tooltip, event, d, { positiveTotal, dayCount, periodLabel });
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.clientX + 16}px`)
        .style('top', `${event.clientY + 16}px`);
    })
    .on('mouseleave', function () {
      d3.select(this)
        .select('rect.leaf-rect')
        .attr('stroke', null)
        .attr('stroke-width', null);
      tooltip.style('opacity', 0);
    })
    .on('focus', function (event, d) {
      d3.select(this)
        .select('rect.leaf-rect')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 2);
      const rect = this.getBoundingClientRect();
      showTooltip(
        tooltip,
        { clientX: rect.right, clientY: rect.top },
        d,
        { positiveTotal, dayCount, periodLabel },
      );
    })
    .on('blur', function () {
      d3.select(this)
        .select('rect.leaf-rect')
        .attr('stroke', null)
        .attr('stroke-width', null);
      tooltip.style('opacity', 0);
    })
    .on('keydown', function (event, d) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onTogglePinned(d.data.fuel);
      }
    })
    .on('click', function (event, d) {
      onTogglePinned(d.data.fuel);
    });

  // ----- Side rail (negative fuels + pinned comparison) -----------------
  // We render the rail as absolutely positioned HTML inside the container
  // via D3 for simplicity, anchored to the right edge of the SVG.
  const containerNode = svg.node().ownerDocument.querySelector('.container');
  if (containerNode) {
    const railSel = d3
      .select(containerNode)
      .selectAll('aside.negative-rail')
      .data([null])
      .join('aside')
      .attr('class', 'negative-rail')
      .style('position', 'absolute')
      .style('top', '56px')
      .style('right', '12px')
      .style('width', `${railWidth}px`)
      .style('max-height', 'calc(100vh - 96px)')
      .style('overflow-y', 'auto')
      .style('font', '12px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
      .style('color', '#1e293b')
      .style('background', '#f8fafc')
      .style('border', '1px solid #e2e8f0')
      .style('border-radius', '8px')
      .style('padding', '10px 12px')
      .style('box-shadow', '0 1px 2px rgba(15,23,42,0.04)')
      .style('pointer-events', 'auto')
      .style('display', hasRail && (negatives.length || pinned.size) ? null : 'none');

    railSel.selectAll('*').remove();

    railSel
      .append('h3')
      .attr('class', 'rail-title')
      .style('margin', '0 0 4px 0')
      .style('font', '600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
      .style('color', '#0f172a')
      .text('Negative (charging/pumping)');

    railSel
      .append('p')
      .attr('class', 'rail-help')
      .style('margin', '0 0 8px 0')
      .style('color', '#475569')
      .text(
        'These are real reported values (net charging or pumping), not missing data.',
      );

    if (negatives.length === 0) {
      railSel
        .append('div')
        .attr('class', 'rail-empty')
        .style('color', '#475569')
        .style('font-style', 'italic')
        .text('No negative fuels in this period.');
    } else {
      const list = railSel
        .append('ul')
        .attr('class', 'rail-list')
        .style('list-style', 'none')
        .style('margin', '0 0 8px 0')
        .style('padding', '0');

      list
        .selectAll('li')
        .data(negatives)
        .join('li')
        .style('display', 'flex')
        .style('justify-content', 'space-between')
        .style('gap', '8px')
        .style('padding', '3px 0')
        .style('border-bottom', '1px dashed #e2e8f0')
        .html(
          (d) =>
            `<span>${escapeHtml(d.fuel)}</span>` +
            `<span style="color:#b91c1c;font-variant-numeric:tabular-nums;">${mwhFmt(
              d.value,
            )} MWh</span>`,
        );
    }

    // Pinned comparison list
    if (pinned.size) {
      railSel
        .append('h3')
        .attr('class', 'rail-title')
        .style('margin', '10px 0 4px 0')
        .style('font', '600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
        .style('color', '#0f172a')
        .text('Pinned comparison');

      const pinnedLeaves = nodes.filter((n) => pinned.has(n.data.fuel));

      const plist = railSel
        .append('ul')
        .attr('class', 'rail-list pinned-list')
        .style('list-style', 'none')
        .style('margin', '0')
        .style('padding', '0');

      plist
        .selectAll('li')
        .data(pinnedLeaves, (d) => d.data.fuel)
        .join('li')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '6px')
        .style('padding', '3px 0')
        .html((d) => {
          const value = d.value;
          const share = positiveTotal > 0 ? value / positiveTotal : 0;
          const mean = dayCount > 0 ? value / dayCount : 0;
          const col = colorFor(d.data.fuel);
          return (
            `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${col};flex:0 0 auto;"></span>` +
            `<span style="flex:1 1 auto;">${escapeHtml(d.data.fuel)}</span>` +
            `<span style="color:#475569;font-variant-numeric:tabular-nums;">${pct(
              share,
            )} · ${mwhFmt(mean)} MWh/d</span>`
          );
        });
    }
  }

  // ----- Legend ---------------------------------------------------------
  const legendG = rootG
    .selectAll('g.legend-layer')
    .data([null])
    .join('g')
    .attr('class', 'legend-layer')
    .attr('transform', `translate(0,${plotH + 8})`);

  const legendFuels = nodes.map((n) => n.data.fuel);
  const swatch = 12;
  const gapX = 14;
  const gapY = 6;
  const textEstW = (fuel) => 6 + fuel.length * 6.4;
  const itemW = (fuel) => swatch + 6 + textEstW(fuel) + gapX;

  let cx = 0;
  let cy = 0;
  const maxW = innerW;
  const positions = legendFuels.map((fuel) => {
    const w = itemW(fuel);
    if (cx + w > maxW && cx > 0) {
      cx = 0;
      cy += swatch + gapY;
    }
    const pos = { fuel, x: cx, y: cy };
    cx += w;
    return pos;
  });

  const legendItems = legendG
    .selectAll('g.legend-item')
    .data(positions, (d) => d.fuel)
    .join(
      (enter) => {
        const g = enter.append('g').attr('class', 'legend-item');
        g.append('rect').attr('class', 'legend-swatch').attr('rx', 2);
        g.append('text').attr('class', 'legend-text');
        return g;
      },
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('transform', (d) => `translate(${d.x},${d.y})`)
    .style('cursor', 'pointer')
    .attr('tabindex', 0)
    .attr('aria-label', (d) => {
      const node = nodes.find((n) => n.data.fuel === d.fuel);
      const share = node && positiveTotal > 0 ? node.value / positiveTotal : 0;
      return `${d.fuel}, ${Math.round(share * 100)}% of positive generation`;
    })
    .on('click', (event, d) => onTogglePinned(d.fuel))
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onTogglePinned(d.fuel);
      }
    });

  legendItems
    .select('rect.legend-swatch')
    .attr('width', swatch)
    .attr('height', swatch)
    .attr('fill', (d) => colorFor(d.fuel))
    .attr('stroke', (d) => (pinned.has(d.fuel) ? '#0f172a' : 'none'))
    .attr('stroke-width', (d) => (pinned.has(d.fuel) ? 1.5 : 0));

  legendItems
    .select('text.legend-text')
    .attr('x', swatch + 6)
    .attr('y', swatch - 2)
    .attr('font', '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif')
    .attr('fill', '#1e293b')
    .text((d) => d.fuel);
};

// ----- helpers --------------------------------------------------------------

function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]),
  );
}

function showTooltip(tooltip, event, d, opts) {
  const { positiveTotal, dayCount, periodLabel } = opts;
  const value = d.value;
  const share = positiveTotal > 0 ? value / positiveTotal : 0;
  const mean = dayCount > 0 ? value / dayCount : 0;
  tooltip
    .style('opacity', 1)
    .html(
      `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(d.data.fuel)}</div>` +
        `<div style="color:#cbd5e1;">${escapeHtml(periodLabel)}</div>` +
        `<div style="margin-top:4px;">Positive: <strong>${mwhFmt(value)} MWh</strong></div>` +
        `<div>Share: <strong>${pct(share)}</strong></div>` +
        `<div>Mean/day: <strong>${mwhFmt(mean)} MWh</strong></div>` +
        `<div>Days: <strong>${dayCount}</strong></div>`,
    )
    .style('left', `${event.clientX + 16}px`)
    .style('top', `${event.clientY + 16}px`);
}