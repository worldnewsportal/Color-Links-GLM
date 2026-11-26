/* Dev tool: generates + verifies harder level configs, prints ready-to-paste JS.
   Run: node scripts/generate-levels.mjs */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'www/src/core/solver.js'), 'utf8'), ctx);
const Solver = ctx.ColorLink.Solver;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate({ w, h, pairs, obstacles, seed, minNodes, candidates }) {
  const rand = mulberry32(seed);
  const total = w * h;
  const need = pairs * 2 + obstacles;
  if (need > total) throw new Error('too dense');
  let best = null;
  for (let c = 0; c < (candidates || 80); c++) {
    const cells = [];
    for (let i = 0; i < total; i++) cells.push(i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const chosen = [];
    let ok = true;
    for (let i = 0; i < cells.length && chosen.length < need; i++) {
      const cell = cells[i];
      const x = cell % w, y = (cell / w) | 0;
      let near = false;
      for (const o of chosen) {
        const ox = o % w, oy = (o / w) | 0;
        const d = Math.abs(ox - x) + Math.abs(oy - y);
        const isObstacleSlot = chosen.length >= pairs * 2;
        if (d < 1) { near = true; break; }
      }
      if (!near) chosen.push(cell);
    }
    if (chosen.length < need) continue;
    const pts = chosen.slice(0, pairs * 2).map((cell) => [cell % w, (cell / w) | 0]);
    const obs = chosen.slice(pairs * 2, need).map((cell) => [cell % w, (cell / w) | 0]);
    const levelPairs = [];
    for (let p = 0; p < pairs; p++) {
      levelPairs.push([...pts[p * 2], ...pts[p * 2 + 1]]);
    }
    const level = { w, h, pairs: levelPairs, obstacles: obs };
    const res = Solver.solve(level, { nodeLimit: 400000 });
    if (!res.solved || res.aborted) continue;
    if (!best || res.nodes > best.res.nodes) best = { level, res };
    if (best && best.res.nodes > 30000) break;
    if (c > 30 && best) break;
  }
  return best;
}

const specs = [];
for (let i = 11; i <= 14; i++) specs.push({ id: i, w: 6, h: 6, pairs: 4, obstacles: 0, minNodes: 500 });
for (let i = 15; i <= 18; i++) specs.push({ id: i, w: 6, h: 6, pairs: 5, obstacles: 0, minNodes: 800 });
for (let i = 19; i <= 20; i++) specs.push({ id: i, w: 7, h: 7, pairs: 5, obstacles: 0, minNodes: 1500 });
for (let i = 21; i <= 23; i++) specs.push({ id: i, w: 7, h: 7, pairs: 5, obstacles: 2, minNodes: 1500 });
for (let i = 24; i <= 25; i++) specs.push({ id: i, w: 7, h: 7, pairs: 6, obstacles: 0, minNodes: 2000 });
for (let i = 26; i <= 27; i++) specs.push({ id: i, w: 8, h: 8, pairs: 6, obstacles: 0, minNodes: 2500 });
for (let i = 28; i <= 30; i++) specs.push({ id: i, w: 8, h: 8, pairs: 6, obstacles: i === 30 ? 3 : 2, minNodes: 2500 });

let seedBase = 1337;
for (const spec of specs) {
  const found = generate({ ...spec, seed: seedBase + spec.id * 7919 });
  if (!found) {
    console.error(`// L${spec.id}: GENERATION FAILED for spec`, spec);
    continue;
  }
  const { level } = found;
  const pairsStr = JSON.stringify(level.pairs);
  const obsStr = level.obstacles.length ? `, obstacles: ${JSON.stringify(level.obstacles)}` : '';
  console.log(`  { id: ${spec.id}, w: ${level.w}, h: ${level.h}, pairs: ${pairsStr}, difficulty: "hard"${obsStr} },`);
}
