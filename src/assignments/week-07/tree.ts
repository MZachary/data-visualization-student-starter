import { hierarchy, type HierarchyNode } from 'd3-hierarchy';

export type Point = { x: number; y: number };
export type RecordRow = [string, string, string, string, string];
export interface Dataset {
  records: RecordRow[];
  snapshot: string;
}
export interface Taxon {
  id: string;
  name: string;
  rank: string;
  group: string;
  authority?: string;
  children?: Taxon[];
}
export type TreeNode = HierarchyNode<Taxon> & { point: Point };
export const groups = [
  { name: 'Sauria', label: 'Lizards & worm lizards', color: '#377d63' },
  { name: 'Serpentes', label: 'Snakes', color: '#c47e35' },
  { name: 'Testudines', label: 'Turtles', color: '#527eaf' },
  { name: 'Crocodylia', label: 'Crocodilians', color: '#ad6576' },
  { name: 'Rhynchocephalia', label: 'Tuatara', color: '#8d78ab' },
];
export const color = (node: TreeNode) =>
  groups.find((g) => g.name === node.data.group)?.color ?? '#243e35';

// Disk automorphism (z - f) / (1 - conjugate(f) * z): f maps to the origin.
export function project(z: Point, f: Point): Point {
  const ax = z.x - f.x,
    ay = z.y - f.y;
  const bx = 1 - f.x * z.x - f.y * z.y,
    by = f.y * z.x - f.x * z.y;
  const denominator = bx * bx + by * by;
  return { x: (ax * bx + ay * by) / denominator, y: (ay * bx - ax * by) / denominator };
}
export function clampDisk(p: Point, limit = 0.99995): Point {
  const radius = Math.hypot(p.x, p.y);
  return radius > limit ? { x: (p.x * limit) / radius, y: (p.y * limit) / radius } : p;
}
export function buildTree(records: RecordRow[], spread: number): TreeNode {
  const data: Taxon = { id: 'Reptilia', name: 'Reptilia', rank: 'root', group: '', children: [] };
  const lookup = new Map<string, Taxon>([[data.id, data]]);
  for (const [name, group, family, authority] of records) {
    let parent = data;
    for (const [label, rank] of [
      [group, 'group'],
      [family, 'family'],
      [name.split(' ')[0], 'genus'],
      [name, 'species'],
    ]) {
      const id = `${parent.id}/${label}`;
      let node = lookup.get(id);
      if (!node) {
        node = {
          id,
          name: label,
          rank,
          group,
          ...(rank === 'species' ? { authority } : { children: [] }),
        };
        parent.children!.push(node);
        lookup.set(id, node);
      }
      parent = node;
    }
  }
  const root = hierarchy(data)
    .sum((d) => (d.rank === 'species' ? 1 : 0))
    .sort((a, b) => a.data.name.localeCompare(b.data.name)) as TreeNode;
  // Allocate angular wedges by sqrt(species count) so small groups remain discoverable.
  // Hyperbolic distance grows linearly with depth; Euclidean disk radius is tanh(d/2).
  function position(node: TreeNode, start: number, end: number) {
    const angle = (start + end) / 2;
    const radius = Math.tanh((node.depth * spread) / 2);
    node.point = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    const children = (node.children ?? []) as TreeNode[];
    const total = children.reduce((sum, child) => sum + Math.sqrt(child.value ?? 1), 0);
    let cursor = start;
    for (const child of children) {
      const width = ((end - start) * Math.sqrt(child.value ?? 1)) / total;
      position(child, cursor, cursor + width);
      cursor += width;
    }
  }
  position(root, -Math.PI, Math.PI);
  return root;
}

// A Poincaré geodesic is a circular arc orthogonal to the unit boundary.
export function edge(ctx: CanvasRenderingContext2D, a: Point, b: Point, radius: number) {
  const cross = a.x * b.y - a.y * b.x;
  ctx.moveTo(a.x * radius, a.y * radius);
  if (Math.abs(cross) < 1e-7) {
    ctx.lineTo(b.x * radius, b.y * radius);
    return;
  }
  const aa = (1 + a.x * a.x + a.y * a.y) / 2;
  const bb = (1 + b.x * b.x + b.y * b.y) / 2;
  const cx = (aa * b.y - bb * a.y) / cross;
  const cy = (a.x * bb - b.x * aa) / cross;
  const r = Math.hypot(a.x - cx, a.y - cy);
  const start = Math.atan2(a.y - cy, a.x - cx);
  const end = Math.atan2(b.y - cy, b.x - cx);
  const delta = Math.atan2(Math.sin(end - start), Math.cos(end - start));
  if (r > 1e5) ctx.lineTo(b.x * radius, b.y * radius);
  else ctx.arc(cx * radius, cy * radius, r * radius, start, start + delta, delta < 0);
}
