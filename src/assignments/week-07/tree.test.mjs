import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTree, project, edge } from './tree.ts';

const { records } = JSON.parse(
  readFileSync(new URL('../../../public/data/week-07/reptiles.json', import.meta.url)),
);

test('saved checklist preserves every species and its unique ancestry', () => {
  const root = buildTree(records, 1.65);
  const nodes = root.descendants();
  assert.equal(root.value, 12650);
  assert.equal(root.leaves().length, records.length);
  assert.equal(new Set(nodes.map((n) => n.data.id)).size, nodes.length);
  assert.equal(nodes.filter((n) => n.data.rank === 'genus').length, 1259);
  assert.equal(nodes.filter((n) => n.data.rank === 'family').length, 94);
  assert.deepEqual(Object.fromEntries(root.children.map((n) => [n.data.name, n.value])), {
    Crocodylia: 27,
    Rhynchocephalia: 1,
    Sauria: 8003,
    Serpentes: 4249,
    Testudines: 370,
  });
  for (const species of root.leaves()) {
    assert.equal(species.depth, 4);
    assert.equal(species.parent.data.name, species.data.name.split(' ')[0]);
  }
});

test('focusing even the deepest species keeps every node inside the disk', () => {
  for (const spread of [1.1, 1.65, 2.2]) {
    const root = buildTree(records, spread);
    const nodes = root.descendants();
    const focus = root.leaves().at(-1).point;
    assert.deepEqual(project(focus, focus), { x: 0, y: 0 });
    for (const node of nodes) {
      const p = project(node.point, focus);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(Math.hypot(p.x, p.y) < 1);
      const restored = project(p, { x: -focus.x, y: -focus.y });
      assert.ok(Math.hypot(restored.x - node.point.x, restored.y - node.point.y) < 1e-8);
    }
  }
});

test('geodesic circles meet the boundary orthogonally; diameters are straight', () => {
  let arc;
  let line;
  const context = {
    moveTo() {},
    lineTo(x, y) {
      line = [x, y];
    },
    arc(...args) {
      arc = args;
    },
  };
  edge(context, { x: 0, y: 0 }, { x: 0.5, y: 0.2 }, 1);
  assert.deepEqual(line, [0.5, 0.2]);
  edge(context, { x: 0.3, y: 0.1 }, { x: -0.2, y: 0.6 }, 1);
  const [cx, cy, radius] = arc;
  assert.ok(Math.abs(cx * cx + cy * cy - radius * radius - 1) < 1e-10);
});
