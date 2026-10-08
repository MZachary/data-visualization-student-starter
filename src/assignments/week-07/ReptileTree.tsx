import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleSqrt } from 'd3-scale';
import {
  buildTree,
  clampDisk,
  color,
  edge,
  groups,
  project,
  type Dataset,
  type Point,
  type TreeNode,
} from './tree';
import './reptiles.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const origin = { x: 0, y: 0 };
const number = new Intl.NumberFormat('en-US');
const radiusScale = scaleSqrt().domain([1, 12650]).range([2, 10]).clamp(true);

export function ReptileTree() {
  const [data, setData] = useState<Dataset>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/week-07/reptiles.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <div className="reptile-status" role="alert">
        Could not load the saved reptile checklist ({error}).{' '}
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  if (!data)
    return (
      <div className="reptile-status" role="status">
        Loading the reptile tree…
      </div>
    );
  return <Explorer data={data} />;
}

function Explorer({ data }: { data: Dataset }) {
  const [spread, setSpread] = useState(1.65);
  const root = useMemo(() => buildTree(data.records, spread), [data, spread]);
  const nodes = useMemo(() => root.descendants() as TreeNode[], [root]);
  const [selectedId, setSelectedId] = useState('Reptilia');
  const selected = nodes.find((node) => node.data.id === selectedId) ?? root;
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<Point>(origin);
  const [query, setQuery] = useState('');
  const [labels, setLabels] = useState(true);
  const [hovered, setHovered] = useState<TreeNode>();
  const [size, setSize] = useState({ width: 700, height: 700 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const animation = useRef(0);
  const drag = useRef<{ start: Point; last: Point; moved: boolean } | null>(null);
  const positions = useRef<{ node: TreeNode; point: Point }[]>([]);
  const focusRef = useRef(focus);
  const diskRadius = Math.max(1, Math.min(size.width, size.height) / 2 - 30) * zoom;
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return nodes
      .filter((node) => node.data.name.toLowerCase().includes(text))
      .sort(
        (a, b) =>
          Number(b.data.name.toLowerCase() === text) - Number(a.data.name.toLowerCase() === text) ||
          a.depth - b.depth,
      );
  }, [nodes, query]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => cancelAnimationFrame(animation.current), []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    // React's delegated wheel listener is passive; use a native listener so zooming
    // the plot does not also scroll the page or trigger browser pinch zoom.
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const pixels =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setZoom((value) =>
        clampZoom(value * Math.exp(-Math.max(-200, Math.min(200, pixels)) * 0.003)),
      );
      setHovered(undefined);
      drag.current = null;
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [size.height]);

  function changeZoom(factor: number) {
    setZoom((value) => clampZoom(value * factor));
    setHovered(undefined);
    drag.current = null;
  }

  function moveFocus(next: Point) {
    focusRef.current = next;
    setFocus(next);
  }
  function navigate(node: TreeNode) {
    cancelAnimationFrame(animation.current);
    setSelectedId(node.data.id);
    setHovered(undefined);
    const from = focusRef.current;
    const target = project(node.point, from);
    const distance = Math.atanh(Math.min(0.999999, Math.hypot(target.x, target.y)));
    const started = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function tick(now: number) {
      const t = reduced ? 1 : Math.min(1, (now - started) / 650);
      const ease = t * t * (3 - 2 * t);
      const length = Math.hypot(target.x, target.y);
      const fraction = length ? Math.tanh(distance * ease) / length : 0;
      moveFocus(
        project({ x: target.x * fraction, y: target.y * fraction }, { x: -from.x, y: -from.y }),
      );
      if (t < 1) animation.current = requestAnimationFrame(tick);
    }
    animation.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    element.width = Math.round(size.width * dpr);
    element.height = Math.round(size.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.translate(size.width / 2, size.height / 2);
    const r = diskRadius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fffef9';
    ctx.fill();
    ctx.strokeStyle = '#d8dfd5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const points = new Map(nodes.map((node) => [node, project(node.point, focus)]));
    const path = new Set(selected.ancestors());
    ctx.save();
    ctx.clip();
    for (const node of nodes) {
      if (!node.parent) continue;
      const p = points.get(node)!;
      const parent = points.get(node.parent as TreeNode)!;
      // Subpixel perimeter links convey density; retain the full underlying tree.
      if (Math.hypot(p.x - parent.x, p.y - parent.y) * r < 0.4) continue;
      ctx.beginPath();
      edge(ctx, parent, p, r);
      ctx.strokeStyle = color(node);
      ctx.globalAlpha = path.has(node) ? 0.95 : 0.25;
      ctx.lineWidth = path.has(node) ? 2 : 0.65;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    positions.current = nodes.map((node) => ({ node, point: points.get(node)! }));
    for (const { node, point: p } of positions.current) {
      const magnification = 1 - p.x * p.x - p.y * p.y;
      const nodeRadius = Math.max(
        0.45,
        radiusScale(node.value ?? 1) * Math.sqrt(Math.max(0, magnification) * zoom),
      );
      ctx.beginPath();
      ctx.arc(p.x * r, p.y * r, nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = color(node);
      ctx.fill();
      if (node === selected || node === hovered) {
        ctx.beginPath();
        ctx.arc(p.x * r, p.y * r, nodeRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = color(node);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
    if (!labels) return;
    const candidates = positions.current
      .filter(
        ({ node, point }) =>
          Math.abs(point.x * r) < size.width / 2 - 12 &&
          Math.abs(point.y * r) < size.height / 2 - 12 &&
          (node === selected || node === hovered || Math.hypot(point.x, point.y) < 0.88),
      )
      .sort(
        (a, b) =>
          Number(b.node === selected || b.node === hovered) -
            Number(a.node === selected || a.node === hovered) ||
          a.node.depth - b.node.depth ||
          Math.hypot(a.point.x, a.point.y) - Math.hypot(b.point.x, b.point.y),
      );
    const boxes: { x: number; y: number; w: number }[] = [];
    for (const { node, point } of candidates) {
      if (boxes.length >= 65) break;
      const emphasized = node === selected || node === hovered;
      ctx.font = `${emphasized ? '600' : '400'} ${emphasized ? 13 : 11}px system-ui`;
      const w = ctx.measureText(node.data.name).width;
      const x = Math.min(size.width / 2 - w - 8, Math.max(-size.width / 2 + 8, point.x * r + 9));
      const y = point.y * r;
      if (
        !emphasized &&
        boxes.some((box) => Math.abs(box.y - y) < 16 && x < box.x + box.w + 7 && x + w + 7 > box.x)
      )
        continue;
      boxes.push({ x, y, w });
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fffef9';
      ctx.strokeText(node.data.name, x, y + 4);
      ctx.fillStyle = '#243e35';
      ctx.fillText(node.data.name, x, y + 4);
    }
  }, [nodes, focus, size, diskRadius, selected, hovered, labels, zoom]);

  function pointerPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - size.width / 2) / diskRadius,
      y: (event.clientY - rect.top - size.height / 2) / diskRadius,
    };
  }
  function nearest(p: Point) {
    let best: TreeNode | undefined;
    let distance = 12 / diskRadius;
    for (const item of positions.current) {
      const d = Math.hypot(item.point.x - p.x, item.point.y - p.y);
      if (d < distance) {
        best = item.node;
        distance = d;
      }
    }
    return best;
  }
  const children = (selected.children ?? []) as TreeNode[];
  const ancestry = selected.ancestors().reverse() as TreeNode[];
  return (
    <section className="reptile-page">
      <header className="reptile-header">
        <div className="reptile-eyebrow">
          WEEK 07 <span> / </span> RECREATING A REFERENCE
        </div>
        <h1>The reptile tree</h1>
        <p>A world of scales, shells, and branching connections.</p>
        <div className="reptile-stats">
          <span>
            <b>{number.format(data.records.length)}</b> species
          </span>
          <span>
            <b>{number.format(nodes.filter((n) => n.data.rank === 'genus').length)}</b> genera
          </span>
          <span>
            <b>{nodes.filter((n) => n.data.rank === 'family').length}</b> families
          </span>
          <span className="reptile-snapshot">JUNE 2026 CHECKLIST</span>
        </div>
      </header>
      <div className="reptile-layout">
        <div className="reptile-visual">
          <div className="reptile-toolbar">
            <span>
              <i /> POINCARÉ DISK
            </span>
            <div className="reptile-zoom" role="group" aria-label="Plot zoom">
              <button
                aria-label="Zoom out"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => changeZoom(1 / 1.25)}
              >
                −
              </button>
              <output aria-label="Zoom level">{Math.round(zoom * 100)}%</output>
              <button
                aria-label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => changeZoom(1.25)}
              >
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  navigate(root);
                }}
              >
                ↺ Reset view
              </button>
            </div>
          </div>
          <div className="reptile-disk" ref={frame}>
            <canvas
              ref={canvas}
              aria-label="Interactive hyperbolic tree of 12,650 reptile species. Scroll to zoom. Use the zoom buttons, search, group buttons, and branch explorer for keyboard navigation."
              role="img"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const p = pointerPoint(event);
                if (Math.hypot(p.x, p.y) > 1) return;
                cancelAnimationFrame(animation.current);
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { start: p, last: p, moved: false };
              }}
              onPointerMove={(event) => {
                const p = pointerPoint(event);
                if (!drag.current) {
                  setHovered(nearest(p));
                  return;
                }
                const state = drag.current;
                if (Math.hypot(p.x - state.start.x, p.y - state.start.y) > 4 / diskRadius)
                  state.moved = true;
                if (state.moved) {
                  const delta = clampDisk({ x: state.last.x - p.x, y: state.last.y - p.y }, 0.15);
                  moveFocus(
                    clampDisk(project(delta, { x: -focusRef.current.x, y: -focusRef.current.y })),
                  );
                  setHovered(undefined);
                }
                state.last = p;
              }}
              onPointerUp={(event) => {
                if (drag.current && !drag.current.moved) {
                  const node = nearest(pointerPoint(event));
                  if (node) navigate(node);
                }
                drag.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onPointerLeave={() => setHovered(undefined)}
            />
            {hovered && (
              <div className="reptile-tooltip">
                <b>{hovered.data.name}</b>
                <span>
                  {hovered.data.rank} · {number.format(hovered.value ?? 1)} species
                </span>
              </div>
            )}
          </div>
          <p className="reptile-hint">
            Click to focus. Scroll or pinch your trackpad to zoom. Drag to explore; reset to see the
            whole disk.
          </p>
          <div className="reptile-legend">
            {groups.map((group) => (
              <button
                key={group.name}
                onClick={() => {
                  const node = nodes.find((n) => n.data.name === group.name);
                  if (node) navigate(node);
                }}
              >
                <i style={{ background: group.color }} />
                {group.label}
              </button>
            ))}
          </div>
        </div>
        <aside className="reptile-panel" aria-label="Tree controls and taxonomy explorer">
          <label className="reptile-label" htmlFor="reptile-search">
            FIND A TAXON
          </label>
          <input
            id="reptile-search"
            type="search"
            placeholder="Try Gekko, Naja, Testudines…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query.trim() && (
            <div className="reptile-search-results">
              <p role="status">
                {number.format(matches.length)} matches
                {matches.length > 30 ? ' · first 30 shown' : ''}
              </p>
              {matches.slice(0, 30).map((node) => (
                <button
                  key={node.data.id}
                  onClick={() => {
                    navigate(node);
                    setQuery('');
                  }}
                >
                  <span>{node.data.name}</span>
                  <small>{node.data.rank}</small>
                </button>
              ))}
              {!matches.length && <p>Try a scientific group, family, genus, or species name.</p>}
            </div>
          )}
          <div className="reptile-selection" aria-live="polite">
            <div className="reptile-label">
              IN FOCUS <span>{selected.data.rank}</span>
            </div>
            <h2>{selected.data.name}</h2>
            <p className="reptile-count">
              {number.format(selected.value ?? 1)}{' '}
              <span>{selected.data.rank === 'species' ? 'species' : 'species in this branch'}</span>
            </p>
            {selected.data.authority && (
              <p className="reptile-authority">{selected.data.authority}</p>
            )}
            <nav className="reptile-breadcrumb" aria-label="Taxonomic ancestry">
              {ancestry.map((node, index) => (
                <span key={node.data.id}>
                  {index > 0 && ' / '}
                  <button onClick={() => navigate(node)}>{node.data.name}</button>
                </span>
              ))}
            </nav>
            {selected.data.rank === 'species' && (
              <a
                className="reptile-source-link"
                href={`https://reptile-database.reptarium.cz/species?genus=${encodeURIComponent(selected.data.name.split(' ')[0])}&species=${encodeURIComponent(selected.data.name.split(' ').slice(1).join(' '))}`}
                target="_blank"
                rel="noreferrer"
              >
                Species record ↗
              </a>
            )}
          </div>
          <div className="reptile-label">
            EXPLORE {children.length ? `${children.length} BRANCHES` : 'THE TREE'}
          </div>
          <div className="reptile-children">
            {children.map((node) => (
              <button key={node.data.id} onClick={() => navigate(node)}>
                <i style={{ background: color(node) }} />
                <span>{node.data.name}</span>
                <small>{number.format(node.value ?? 1)} →</small>
              </button>
            ))}
            {!children.length && (
              <p>You’ve reached a species. Follow the path above to explore its relatives.</p>
            )}
          </div>
          <div className="reptile-settings">
            <label htmlFor="reptile-spread">
              Branch spacing <output>{spread.toFixed(2)}</output>
            </label>
            <input
              id="reptile-spread"
              type="range"
              min="1.1"
              max="2.2"
              step="0.05"
              value={spread}
              onChange={(event) => {
                cancelAnimationFrame(animation.current);
                setSpread(Number(event.target.value));
                setSelectedId('Reptilia');
                moveFocus(origin);
              }}
            />
            <label className="reptile-checkbox">
              <input
                type="checkbox"
                checked={labels}
                onChange={(event) => setLabels(event.target.checked)}
              />{' '}
              Show labels
            </label>
          </div>
        </aside>
      </div>
      <footer className="reptile-footer">
        <p>
          <b>Focus + context.</b> Near the center, branches open up; near the boundary, they
          compress. Colors identify checklist groups. Larger nodes contain more species; apparent
          size also changes with focus.
        </p>
        <p>
          A taxonomic browsing tree, not an evolutionary timeline. “Sauria” follows the source’s
          grouping and includes worm lizards. Birds and extinct reptiles are outside this checklist.
        </p>
        <div>
          Inspired by{' '}
          <a
            href="https://observablehq.com/@ambassadors/hyperbolic-tree-viewer-part-3"
            target="_blank"
            rel="noreferrer"
          >
            ee2dev’s Hyperbolic Tree Viewer ↗
          </a>
          <span>
            Data:{' '}
            <a
              href="https://www.reptile-database.org/data/index.html"
              target="_blank"
              rel="noreferrer"
            >
              The Reptile Database ↗
            </a>{' '}
            ·{' '}
            <a href={`${import.meta.env.BASE_URL}data/week-07/reptiles.json`} download>
              Download snapshot ↓
            </a>
          </span>
        </div>
      </footer>
    </section>
  );
}
