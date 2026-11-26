#!/usr/bin/env node
/* Lawnak curriculum generator.
   Rebuilds ALL 130 levels as one coherent difficulty curve:
   starts trivial, ends near-impossible (but always solvable and
   witness-verified). Every generated level carries a solver-verified
   `solution` used for hints, star calibration and validation.
   Writes www/src/data/levels.js (1-130) and empties levels2.js.
   Run: node scripts/generate-curriculum.cjs */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Math, Uint8Array, Int8Array, Int32Array, Array, Object, Number, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['www/src/core/mechanics.js', 'www/src/core/solver.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const CL = sandbox.ColorLink;
const Solver = CL.Solver;

/* ---------- RNG ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ri(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- helpers ---------- */
function neighbors(w, h, cell) {
  const x = cell % w, y = (cell / w) | 0;
  const out = [];
  if (x > 0) out.push(cell - 1);
  if (x < w - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - w);
  if (y < h - 1) out.push(cell + w);
  return out;
}
function manhattan(w, a, b) {
  return Math.abs((a % w) - (b % w)) + Math.abs(((a / w) | 0) - ((b / w) | 0));
}

function randomWalk(rng, w, h, start, len, occupied) {
  const visited = new Set([start]);
  const path = [start];
  let steps = 0;
  function dfs(cell) {
    if (path.length === len) return true;
    if (++steps > 4000) return false;
    for (const n of shuffled(rng, neighbors(w, h, cell))) {
      if (visited.has(n) || occupied.has(n)) continue;
      visited.add(n);
      path.push(n);
      if (dfs(n)) return true;
      path.pop();
      visited.delete(n);
    }
    return false;
  }
  return dfs(start) ? path : null;
}

function randomEndpoints(rng, w, h, nPairs, minPairDist) {
  for (let round = 0; round < 40; round++) {
    const all = shuffled(rng, Array.from({ length: w * h }, (_, i) => i));
    const chosen = [];
    for (const c of all) {
      if (chosen.length >= nPairs * 2) break;
      let ok = true;
      for (const u of chosen) {
        if (manhattan(w, c, u) < 2) { ok = false; break; }
      }
      if (ok) chosen.push(c);
    }
    if (chosen.length < nPairs * 2) continue;
    for (let pr = 0; pr < 25; pr++) {
      const pool = shuffled(rng, chosen);
      const pairs = [];
      let ok = true;
      for (let p = 0; p < nPairs; p++) {
        const a = pool[2 * p], b = pool[2 * p + 1];
        if (manhattan(w, a, b) < minPairDist) { ok = false; break; }
        pairs.push([a, b]);
      }
      if (!ok) continue;
      return pairs.map(([a, b]) => [a % w, (a / w) | 0, b % w, (b / w) | 0]);
    }
  }
  return null;
}

function solveLevel(level, nodeLimit) {
  return Solver.solve(level, { nodeLimit: nodeLimit || 700000 });
}

function optMoves(w, paths) {
  let n = 0;
  for (const p of paths) n += p.length - 1;
  return n;
}

function signature(level) {
  const canon = level.pairs.map(p => p.join(',')).sort().join(';');
  return level.w + 'x' + level.h + ':' + canon;
}

/* Objective difficulty score (drives the curve ordering). */
function difficultyScore(level) {
  const cells = level.w * level.h - (level.obstacles ? level.obstacles.length : 0);
  const pairs = level.pairs.length;
  const opt = optMoves(level.w, level.solution);
  const winding = opt / cells;
  return (
    pairs * 10 +
    cells * 0.55 +
    winding * 30 +
    (level.fullBoard ? 25 : 0) +
    (level.obstacles ? level.obstacles.length * 2 : 0) +
    (level.bridges ? level.bridges.length * 8 : 0) +
    (level.teleports ? level.teleports.length * 10 : 0) +
    (level.directionals ? level.directionals.length * 4 : 0) +
    (level.restricted ? level.restricted.length * 6 : 0) +
    (level.locks ? level.locks.length * 8 : 0)
  );
}

function difficultyLabel(score) {
  if (score < 70) return 'easy';
  if (score < 105) return 'medium';
  if (score < 140) return 'hard';
  return 'expert';
}

/* ---------- generators (same engines as Phase 2) ---------- */
function genStandard(rng, spec, signatures, minOptRatio) {
  const deadline = Date.now() + (spec.w >= 8 ? 25000 : 12000);
  let fallback = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const minDist = spec.pairs >= 6 ? 2 : 3;
    const pairs = randomEndpoints(rng, spec.w, spec.h, spec.pairs, minDist);
    if (!pairs) continue;
    const level = { w: spec.w, h: spec.h, pairs: pairs };
    if (spec.obstacles) {
      const cells = shuffled(rng, Array.from({ length: spec.w * spec.h }, (_, i) => i));
      const obs = [];
      const epSet = new Set();
      pairs.forEach(p => { epSet.add(p[1] * spec.w + p[0]); epSet.add(p[3] * spec.w + p[2]); });
      for (const c of cells) {
        if (obs.length >= spec.obstacles) break;
        if (!epSet.has(c)) obs.push([c % spec.w, (c / spec.w) | 0]);
      }
      level.obstacles = obs;
    }
    const sig = signature(level);
    if (signatures.has(sig)) continue;
    const res = solveLevel(level, spec.w >= 8 ? 500000 : 300000);
    if (res.solved) {
      const free = spec.w * spec.h - (level.obstacles ? level.obstacles.length : 0);
      const opt = optMoves(spec.w, res.paths);
      if (opt >= free * (minOptRatio || 0.5)) {
        level.solution = res.paths;
        return level;
      }
      if (!fallback) {
        fallback = level;
        fallback.solution = res.paths;
      }
    }
    if (Date.now() > deadline) break;
  }
  return fallback;
}

function hamiltonianPath(rng, w, h) {
  const cells = w * h;
  for (let restart = 0; restart < 40; restart++) {
    const visited = new Uint8Array(cells);
    const path = [];
    let budget = 200000;
    function unvisitedDeg(cell) {
      let n = 0;
      for (const nb of neighbors(w, h, cell)) if (!visited[nb]) n++;
      return n;
    }
    function dfs(cell) {
      if (budget-- <= 0) return false;
      visited[cell] = 1;
      path.push(cell);
      if (path.length === cells) return true;
      const nbrs = neighbors(w, h, cell)
        .filter(n => !visited[n])
        .sort((a, b) => unvisitedDeg(a) - unvisitedDeg(b) || rng() - 0.5);
      for (const n of nbrs) {
        if (dfs(n)) return true;
      }
      visited[cell] = 0;
      path.pop();
      return false;
    }
    if (dfs(Math.floor(rng() * cells))) return path;
  }
  return null;
}

function genFullBoard(rng, spec, signatures) {
  const deadline = Date.now() + 15000;
  for (let attempt = 0; attempt < 60 && Date.now() <= deadline; attempt++) {
    const ham = hamiltonianPath(rng, spec.w, spec.h);
    if (!ham) return null;
    const n = ham.length, k = spec.pairs;
    const base = Math.floor(n / k);
    let rem = n % k;
    const sizes = [];
    for (let i = 0; i < k; i++) {
      let s = base;
      if (rem > 0 && rng() < rem / (k - i)) { s++; rem--; }
      sizes.push(s);
    }
    if (sizes.some(s => s < 2)) continue;
    const chunks = [];
    let off = 0;
    for (const s of sizes) { chunks.push(ham.slice(off, off + s)); off += s; }
    const pairs = chunks.map(ch => {
      const a = ch[0], b = ch[ch.length - 1];
      return [a % spec.w, (a / spec.w) | 0, b % spec.w, (b / spec.w) | 0];
    });
    const level = { w: spec.w, h: spec.h, pairs: pairs, fullBoard: true, solution: chunks };
    const sig = signature(level);
    if (signatures.has(sig)) continue;
    const v = Solver.verifyPaths(level, chunks);
    if (!v.ok) continue;
    return level;
  }
  return null;
}

function genBridge(rng, spec, signatures) {
  const deadline = Date.now() + 15000;
  for (let attempt = 0; attempt < 400 && Date.now() <= deadline; attempt++) {
    const w = spec.w, h = spec.h;
    const cx = ri(rng, 1, w - 2), cy = ri(rng, 1, h - 2);
    const c = cy * w + cx;
    const occupied = new Set();
    const la = ri(rng, 2, 3), lb = ri(rng, 2, 3);
    const A1 = randomWalk(rng, w, h, c, la, occupied);
    if (!A1) continue;
    for (const cell of A1) occupied.add(cell);
    const A2 = randomWalk(rng, w, h, c, lb, occupied);
    if (!A2) { for (const cell of A1) if (cell !== c) occupied.delete(cell); continue; }
    for (const cell of A2) occupied.add(cell);
    const pathA = A1.slice().reverse().concat(A2.slice(1));
    const lc = ri(rng, 2, 4), ld = ri(rng, 2, 4);
    const B1 = randomWalk(rng, w, h, c, lc, occupied);
    if (!B1) continue;
    const occB = new Set(occupied);
    for (const cell of B1) occB.add(cell);
    const B2 = randomWalk(rng, w, h, c, ld, occB);
    if (!B2) continue;
    for (const cell of B2) occB.add(cell);
    const pathB = B1.slice().reverse().concat(B2.slice(1));
    const used = new Set(occB);
    const walks = [pathA, pathB];
    let ok = true;
    for (let p = 2; p < spec.pairs; p++) {
      const free = [];
      for (let i = 0; i < w * h; i++) if (!used.has(i)) free.push(i);
      if (free.length < 4) { ok = false; break; }
      const start = free[Math.floor(rng() * free.length)];
      const walk = randomWalk(rng, w, h, start, ri(rng, 3, 5), used);
      if (!walk || walk.length < 3) { ok = false; break; }
      for (const cell of walk) used.add(cell);
      walks.push(walk);
    }
    if (!ok) continue;
    const epSet = new Set();
    let bad = false;
    const pairs = walks.map(walk => {
      const a = walk[0], b = walk[walk.length - 1];
      if (a === b || manhattan(w, a, b) < 2) bad = true;
      if (epSet.has(a) || epSet.has(b)) bad = true;
      epSet.add(a); epSet.add(b);
      return [a % w, (a / w) | 0, b % w, (b / w) | 0];
    });
    if (bad) continue;
    const level = { w: w, h: h, pairs: pairs, bridges: [[cx, cy]], solution: walks };
    const sig = signature(level);
    if (signatures.has(sig)) continue;
    const v = Solver.verifyPaths(level, walks);
    if (!v.ok) continue;
    const res = solveLevel(level, 400000);
    if (!res.solved && !res.aborted) continue;
    return level;
  }
  return null;
}

/* ---------- transform-based mechanics ---------- */
function pickColorWithInterior(rng, paths, minLen) {
  const options = [];
  for (let c = 0; c < paths.length; c++) {
    if (paths[c] && paths[c].length >= minLen) options.push(c);
  }
  if (!options.length) return -1;
  return options[Math.floor(rng() * options.length)];
}

function mechOf(level) { return new CL.Mechanics(level); }

function transformTeleport(rng, level) {
  const paths = level.solution;
  const c = pickColorWithInterior(rng, paths, 6);
  if (c === -1) return null;
  const path = paths[c];
  const w = level.w;
  const options = [];
  for (let si = 1; si < path.length - 4; si++) {
    for (let ti = si + 3; ti < path.length - 1; ti++) {
      const s = path[si], t = path[ti];
      if (manhattan(w, s, t) < 2) continue;
      options.push([si, ti]);
    }
  }
  if (!options.length) return null;
  const [si, ti] = options[Math.floor(rng() * options.length)];
  const s = path[si], t = path[ti];
  const newPaths = paths.map((p, i) => i === c
    ? p.slice(0, si + 1).concat(p.slice(ti))
    : p.slice());
  const lvl = JSON.parse(JSON.stringify(Object.assign({}, level, { solution: undefined })));
  lvl.teleports = [[s % w, (s / w) | 0, t % w, (t / w) | 0]];
  lvl.solution = newPaths;
  const v = Solver.verifyPaths(lvl, newPaths);
  if (!v.ok) return null;
  return lvl;
}

function transformDirectional(rng, level) {
  const paths = level.solution;
  const c = pickColorWithInterior(rng, paths, 3);
  if (c === -1) return null;
  const path = paths[c];
  const w = level.w;
  const k = 1 + Math.floor(rng() * (path.length - 2));
  const cell = path[k], next = path[k + 1];
  const mech = new CL.Mechanics(level);
  const dir = mech.dirBetween(cell, next);
  if (!dir) return null;
  const lvl = JSON.parse(JSON.stringify(Object.assign({}, level, { solution: undefined })));
  lvl.directionals = [{ cell: [cell % w, (cell / w) | 0], dir: dir }];
  lvl.solution = paths;
  const v = Solver.verifyPaths(lvl, paths);
  if (!v.ok) return null;
  return lvl;
}

function transformRestricted(rng, level) {
  const paths = level.solution;
  const c = pickColorWithInterior(rng, paths, 3);
  if (c === -1) return null;
  const path = paths[c];
  const w = level.w;
  const k = 1 + Math.floor(rng() * (path.length - 2));
  const cell = path[k], next = path[k + 1];
  const mech = new CL.Mechanics(level);
  const exit = mech.dirBetween(cell, next);
  if (!exit) return null;
  const others = ['up', 'right', 'down', 'left'].filter(d => d !== exit);
  const nBan = 1 + (rng() < 0.4 ? 1 : 0);
  const banned = shuffled(rng, others).slice(0, nBan);
  const lvl = JSON.parse(JSON.stringify(Object.assign({}, level, { solution: undefined })));
  lvl.restricted = [{ cell: [cell % w, (cell / w) | 0], dirs: banned }];
  lvl.solution = paths;
  const v = Solver.verifyPaths(lvl, paths);
  if (!v.ok) return null;
  return lvl;
}

function transformLock(rng, level) {
  const paths = level.solution;
  const candidates = [];
  for (let a = 0; a < paths.length; a++) {
    for (let k = 0; k < paths.length; k++) {
      if (a === k) continue;
      candidates.push([a, k]);
    }
  }
  if (!candidates.length) return null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const [a, key] = candidates[Math.floor(rng() * candidates.length)];
    const path = paths[a];
    if (!path || path.length < 3) continue;
    const w = level.w;
    const kIdx = 1 + Math.floor(rng() * (path.length - 2));
    const cell = path[kIdx];
    const mech = mechOf(level);
    if (mech.lockKey[cell] !== -1 || mech.twin[cell] !== -1 ||
        mech.dirOf[cell] !== -1 || mech.restrictedMask[cell] || mech.bridge[cell]) continue;
    const lvl = JSON.parse(JSON.stringify(Object.assign({}, level, { solution: undefined })));
    lvl.locks = [{ cell: [cell % w, (cell / w) | 0], color: key }];
    lvl.solution = paths;
    const v = Solver.verifyPaths(lvl, paths);
    if (!v.ok) continue;
    return lvl;
  }
  return null;
}

/* ---------- curriculum: 130 slots across 5 chapters ----------
   Each chapter opens comfortably below the previous chapter's peak,
   then climbs. Mechanics are introduced gently and then combined. */
function spec(w, h, pairs, extra) {
  return Object.assign({ w, h, pairs }, extra || {});
}

const CURRICULUM = [];
function chapter(slots) { CURRICULUM.push(...slots); }

/* Chapter 1 — Beginner (1-26): pure classic teaching curve */
chapter([
  spec(5, 5, 2, { ratio: 0.3 }), spec(5, 5, 2, { ratio: 0.3 }),
  spec(5, 5, 2, { ratio: 0.45 }), spec(5, 5, 2, { ratio: 0.45 }),
  spec(5, 5, 2, { ratio: 0.45 }), spec(5, 5, 2, { ratio: 0.45 }),
  spec(5, 5, 3, { ratio: 0.45 }), spec(5, 5, 3, { ratio: 0.45 }),
  spec(5, 5, 3, { ratio: 0.45 }), spec(5, 5, 3, { ratio: 0.45 }),
  spec(6, 6, 3, { ratio: 0.5 }), spec(6, 6, 3, { ratio: 0.5 }),
  spec(6, 6, 3, { ratio: 0.5 }), spec(6, 6, 3, { ratio: 0.5 }),
  spec(6, 6, 3, { ratio: 0.55 }), spec(6, 6, 4, { ratio: 0.5 }),
  spec(6, 6, 4, { ratio: 0.5 }), spec(6, 6, 4, { ratio: 0.5 }),
  spec(6, 6, 4, { ratio: 0.55 }), spec(6, 6, 4, { ratio: 0.55 }),
  spec(6, 6, 5, { ratio: 0.55 }), spec(6, 6, 5, { ratio: 0.55 }),
  spec(6, 6, 5, { ratio: 0.6 }), spec(7, 7, 5, { ratio: 0.5 }),
  spec(7, 7, 5, { ratio: 0.55 }), spec(7, 7, 5, { ratio: 0.55 })
]);

/* Chapter 2 — Intermediate (27-52): obstacles, timers, full-board */
chapter([
  spec(7, 7, 5, { ratio: 0.55 }), spec(7, 7, 5, { ratio: 0.55 }), spec(7, 7, 5, { ratio: 0.55 }),
  spec(6, 6, 4, { obstacles: 1, ratio: 0.5 }), spec(6, 6, 4, { obstacles: 2, ratio: 0.5 }),
  spec(6, 6, 4, { obstacles: 2, ratio: 0.55 }),
  spec(7, 7, 5, { obstacles: 2, ratio: 0.55 }), spec(7, 7, 5, { obstacles: 2, ratio: 0.55 }),
  spec(7, 7, 5, { obstacles: 3, ratio: 0.55 }), spec(7, 7, 5, { obstacles: 3, ratio: 0.55 }),
  spec(7, 7, 5, { obstacles: 2, ratio: 0.6 }),
  spec(7, 7, 5, { timed: true, ratio: 0.55 }), spec(7, 7, 5, { timed: true, obstacles: 2, ratio: 0.55 }),
  spec(7, 7, 5, { timed: true, obstacles: 2, ratio: 0.55 }),
  spec(6, 6, 4, { full: true }), spec(6, 6, 4, { full: true }),
  spec(6, 6, 5, { full: true }), spec(6, 6, 5, { full: true, timed: true }),
  spec(7, 7, 5, { full: true }), spec(7, 7, 5, { full: true, timed: true }),
  spec(7, 7, 6, { obstacles: 2, ratio: 0.6 }), spec(7, 7, 6, { obstacles: 3, ratio: 0.6 }),
  spec(7, 7, 6, { obstacles: 2, timed: true, ratio: 0.6 }),
  spec(7, 7, 6, { full: true }), spec(7, 7, 6, { obstacles: 3, ratio: 0.6 }),
  spec(7, 7, 6, { full: true, timed: true })
]);

/* Chapter 3 — Advanced (53-78): bridges + dense boards */
chapter([
  spec(7, 7, 6, { ratio: 0.6 }), spec(7, 7, 6, { obstacles: 2, ratio: 0.6 }),
  spec(7, 7, 5, { bridge: true }), spec(7, 7, 5, { bridge: true }), spec(7, 7, 5, { bridge: true }),
  spec(7, 7, 6, { bridge: true }), spec(7, 7, 6, { bridge: true }),
  spec(7, 7, 5, { bridge: true, obstacles: 2 }), spec(7, 7, 5, { bridge: true, obstacles: 2 }),
  spec(7, 7, 6, { bridge: true, obstacles: 2 }),
  spec(7, 7, 5, { bridge: true, timed: true }),
  spec(7, 7, 5, { full: true }), spec(7, 7, 5, { full: true }),
  spec(7, 7, 6, { full: true }), spec(7, 7, 6, { full: true }), spec(7, 7, 6, { full: true, timed: true }),
  spec(7, 7, 6, { bridge: true, timed: true }), spec(7, 7, 6, { bridge: true, obstacles: 2 }),
  spec(7, 7, 6, { bridge: true, full: true }), spec(7, 7, 6, { full: true, timed: true }),
  spec(7, 7, 6, { bridge: true, obstacles: 3 }), spec(7, 7, 6, { bridge: true, timed: true }),
  spec(7, 7, 6, { bridge: true, full: true }),
  spec(7, 7, 6, { bridge: true, obstacles: 2, timed: true }),
  spec(7, 7, 6, { full: true }), spec(7, 7, 6, { bridge: true, full: true })
]);

/* Chapter 4 — Expert (79-104): teleports, arrows, restricted, locks, 8x8 */
chapter([
  spec(7, 7, 6, { teleport: true }), spec(7, 7, 6, { teleport: true }),
  spec(7, 7, 6, { teleport: true, obstacles: 2 }), spec(7, 7, 6, { teleport: true, timed: true }),
  spec(7, 7, 5, { directional: true }), spec(7, 7, 5, { directional: true, obstacles: 2 }),
  spec(7, 7, 6, { directional: true }), spec(7, 7, 6, { directional: true, timed: true }),
  spec(7, 7, 5, { restricted: true }), spec(7, 7, 6, { restricted: true }),
  spec(7, 7, 6, { restricted: true, obstacles: 2 }), spec(7, 7, 6, { restricted: true, timed: true }),
  spec(7, 7, 6, { lock: true }), spec(7, 7, 6, { lock: true }), spec(7, 7, 6, { lock: true, obstacles: 2 }),
  spec(7, 7, 6, { lock: true, timed: true }), spec(7, 7, 6, { lock: true, directional: true }),
  spec(7, 7, 6, { teleport: true, directional: true }), spec(7, 7, 6, { teleport: true, restricted: true }),
  spec(7, 7, 6, { teleport: true, timed: true }),
  spec(8, 8, 6, { teleport: true }), spec(8, 8, 6, { directional: true, obstacles: 2 }),
  spec(8, 8, 6, { lock: true }), spec(8, 8, 6, { teleport: true, restricted: true, timed: true }),
  spec(8, 8, 6, { teleport: true, directional: true, timed: true }),
  spec(8, 8, 6, { lock: true, restricted: true })
]);

/* Chapter 5 — Master (105-130): 8x8 mastery, 8 pairs, near-impossible finale */
chapter([
  spec(8, 8, 6, { obstacles: 2, ratio: 0.6 }), spec(8, 8, 6, { obstacles: 3, ratio: 0.6 }),
  spec(8, 8, 6, { lock: true, obstacles: 2 }), spec(8, 8, 6, { teleport: true, timed: true }),
  spec(8, 8, 6, { bridge: true, timed: true }),
  spec(8, 8, 7, { ratio: 0.6 }), spec(8, 8, 7, { obstacles: 2, ratio: 0.6 }),
  spec(8, 8, 7, { bridge: true }), spec(8, 8, 7, { directional: true, restricted: true }),
  spec(8, 8, 7, { lock: true, timed: true }),
  spec(8, 8, 6, { full: true, lock: true }), spec(8, 8, 6, { full: true, timed: true }),
  spec(8, 8, 6, { full: true, directional: true }), spec(8, 8, 6, { full: true, teleport: true }),
  spec(8, 8, 6, { full: true, lock: true, timed: true }),
  spec(8, 8, 7, { teleport: true, timed: true }), spec(8, 8, 7, { lock: true, obstacles: 2, timed: true }),
  spec(8, 8, 7, { bridge: true, timed: true }), spec(8, 8, 7, { teleport: true, directional: true }),
  spec(8, 8, 7, { restricted: true, obstacles: 3 }),
  spec(8, 8, 8, { ratio: 0.55 }), spec(8, 8, 8, { teleport: true, ratio: 0.55 }),
  spec(8, 8, 8, { directional: true, ratio: 0.55 }),
  spec(8, 8, 8, { full: true }), spec(8, 8, 8, { full: true, teleport: true }),
  spec(8, 8, 8, { full: true })
]);

if (CURRICULUM.length !== 130) {
  console.error('curriculum slots: ' + CURRICULUM.length + ' (expected 130)');
  process.exit(1);
}

/* ---------- build every slot, then order each chapter by real score ---------- */
function starCriteria(opt) {
  const three = opt + 2;
  const two = Math.max(three + 4, Math.round(opt * 1.75) + 4);
  return { two: two, three: three };
}
function timeLimitFor(opt) {
  return Math.round((Math.max(50, opt * 3.5 + 25)) / 5) * 5;
}

const CHAPTER_SIZES = [26, 26, 26, 26, 26];
const signatures = new Set();
const chapterPools = [];
let slotIndex = 0;

for (let ch = 0; ch < 5; ch++) {
  const pool = [];
  for (let s = 0; s < CHAPTER_SIZES[ch]; s++, slotIndex++) {
    const sp = CURRICULUM[slotIndex];
    const rng = mulberry32((slotIndex + 1) * 7919 + 13);
    let level = null;
    let pairs = sp.pairs;
    while (pairs >= 2 && !level) {
      const work = Object.assign({}, sp, { pairs: pairs });
      if (work.full) {
        level = genFullBoard(rng, work, signatures);
      } else if (work.bridge) {
        level = genBridge(rng, work, signatures);
      }
      if (!level) level = genStandard(rng, work, signatures, work.ratio || 0.5);
      if (!level) {
        console.error('slot ' + (slotIndex + 1) + ': degrading pairs ' + pairs + ' -> ' + (pairs - 1));
        pairs--;
      }
    }
    if (!level) {
      console.error('slot ' + (slotIndex + 1) + ': FAILED');
      process.exit(1);
    }
    if (!sp.full) {
      if (sp.teleport) level = transformTeleport(rng, level) || level;
      if (sp.directional) level = transformDirectional(rng, level) || level;
      if (sp.restricted) level = transformRestricted(rng, level) || level;
      if (sp.lock) level = transformLock(rng, level) || level;
    } else if (sp.lock) {
      level = transformLock(rng, level) || level;
    } else if (sp.directional) {
      level = transformDirectional(rng, level) || level;
    }
    const v = Solver.verifyPaths(level, level.solution);
    if (!v.ok) {
      console.error('slot ' + (slotIndex + 1) + ': witness invalid: ' + v.errors.join('; '));
      process.exit(1);
    }
    signatures.add(signature(level));
    level.timed = !!sp.timed;
    pool.push(level);
  }
  chapterPools.push(pool);
}

/* order each chapter ascending by objective score */
for (const pool of chapterPools) {
  pool.sort((a, b) => difficultyScore(a) - difficultyScore(b));
}

/* ---------- emit ---------- */
const out = [];
let id = 0;
for (const pool of chapterPools) {
  for (const level of pool) {
    id++;
    const opt = optMoves(level.w, level.solution);
    const score = difficultyScore(level);
    const rec = {
      id: id,
      w: level.w,
      h: level.h,
      pairs: level.pairs,
      difficulty: difficultyLabel(score),
      stars: starCriteria(opt),
      solution: level.solution
    };
    if (level.obstacles) rec.obstacles = level.obstacles;
    if (level.fullBoard) rec.fullBoard = true;
    if (level.bridges) rec.bridges = level.bridges;
    if (level.locks) rec.locks = level.locks;
    if (level.teleports) rec.teleports = level.teleports;
    if (level.directionals) rec.directionals = level.directionals;
    if (level.restricted) rec.restricted = level.restricted;
    if (level.timed) rec.timeLimit = timeLimitFor(opt);
    out.push(rec);
  }
}

/* independent re-verification of every emitted level */
let verified = 0;
const report = [];
for (const rec of out) {
  const v = Solver.verifyPaths(rec, rec.solution);
  let solved = true;
  if (!rec.fullBoard) {
    const res = solveLevel(rec, 900000);
    solved = res.solved || res.aborted;
  }
  if (v.ok && solved) verified++;
  else report.push('id ' + rec.id + (v.ok ? '' : ' witness:' + v.errors.join(';')) + (solved ? '' : ' solver:unsolved'));
}

/* structural checks like LevelManager.validate */
for (const rec of out) {
  const seen = {};
  for (const o of rec.obstacles || []) seen[o[1] * rec.w + o[0]] = 1;
  for (const p of rec.pairs) {
    for (const e of [0, 2]) {
      const idx = p[e + 1] * rec.w + p[e];
      if (seen[idx]) report.push('id ' + rec.id + ': endpoint overlap');
      seen[idx] = 1;
    }
  }
  if (!rec.stars || rec.stars.three >= rec.stars.two) report.push('id ' + rec.id + ': bad stars');
}

const firstPairL1 = out[0].w === 5 && out[0].h === 5 && out[0].pairs.length === 2;
if (!firstPairL1) report.push('level 1 must be 5x5 with 2 pairs');

/* curve summary */
const t0 = Date.now();
console.log('=== CURRICULUM SUMMARY ===');
for (const chk of [1, 5, 10, 20, 26, 27, 40, 52, 53, 65, 78, 79, 90, 104, 105, 115, 125, 128, 130]) {
  const l = out[chk - 1];
  console.log('lvl ' + chk + ': ' + l.w + 'x' + l.h + ' pairs=' + l.pairs.length +
    ' score=' + difficultyScore(l).toFixed(0) + ' ' + l.difficulty +
    (l.fullBoard ? ' FULL' : '') + (l.timeLimit ? ' t' + l.timeLimit : ''));
}
let mono = true;
for (let i = 1; i < out.length; i++) {
  const a = difficultyScore(out[i - 1]);
  const b = difficultyScore(out[i]);
  const chA = Math.floor((i - 1) / 26), chB = Math.floor(i / 26);
  if (chA === chB && b < a - 2) { mono = false; console.log('non-monotone at ' + (i + 1) + ': ' + a.toFixed(0) + ' -> ' + b.toFixed(0)); }
}
console.log('within-chapter monotone: ' + mono);
console.log('verified: ' + verified + '/130');
if (report.length) { console.log('REPORT:\n' + report.join('\n')); process.exit(1); }

fs.writeFileSync(path.join(ROOT, 'www/src/data/levels.js'),
  '/* Lawnak - Level data: all 130 levels as one verified difficulty curve.\n' +
  '   Generated by scripts/generate-curriculum.cjs; every level carries a\n' +
  '   solver-verified witness `solution` used for hints and validation.\n' +
  '   Verified by `npm run validate`. */\n' +
  '(function () {\n  \'use strict\';\n\n  var LEVELS = [\n' +
  out.map(l => '    ' + JSON.stringify(l)).join(',\n') +
  '\n  ];\n\n  CL.LEVELS = LEVELS;\n  if (typeof module !== \'undefined\' && module.exports) {\n    module.exports = LEVELS;\n  }\n})();\n');

fs.writeFileSync(path.join(ROOT, 'www/src/data/levels2.js'),
  '/* Lawnak - Phase 2 expansion data (superseded by the unified 130-level\n' +
  '   curriculum in levels.js). Kept as an empty list so the load order in\n' +
  '   index.html stays intact. */\n' +
  '(function () {\n  \'use strict\';\n\n  var LEVELS2 = [];\n\n  CL.LEVELS2 = LEVELS2;\n})();\n');

console.log('written levels.js (130 levels) + levels2.js (empty) in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
