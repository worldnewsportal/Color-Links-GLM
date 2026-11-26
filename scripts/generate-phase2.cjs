#!/usr/bin/env node
/* Color Link Phase 2 level generator.
   Generates + verifies levels 31-130 (chapters 2-5) with mechanics:
   obstacles, full-board, bridges, locks, teleports, directionals,
   restricted tiles and time limits. Writes www/src/data/levels2.js.
   Every emitted level is solver-verified or carries a rule-verified
   witness solution. */
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

/* Random self-avoiding walk of exact length starting at `start`,
   avoiding `occupied` cells. DFS with shuffled neighbors. */
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

/* Random endpoint placement: 2n well-spaced cells paired randomly. */
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

/* ---------- plain level generation ---------- */
function genStandard(rng, spec, signatures, minOptRatio) {
  const deadline = Date.now() + (spec.w >= 8 ? 25000 : 12000);
  let fallback = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const minDist = spec.minDist || (spec.pairs >= 6 ? 2 : 3);
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

/* ---------- full-board generation (Hamiltonian partition) ---------- */
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

/* ---------- bridge (genuine crossing) generation ---------- */
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

function mechOf(level) { return new CL.Mechanics(level); }

/* ---------- specs ---------- */
const SPECS = {};
function spec(id, w, h, pairs, difficulty, extra) {
  SPECS[id] = Object.assign({ w, h, pairs, difficulty }, extra || {});
}
// Chapter 2 (31-52) Intermediate
spec(31, 5, 5, 3, 'easy', { ratio: 0.4 });
spec(32, 5, 5, 3, 'easy', { ratio: 0.4 });
spec(33, 5, 5, 3, 'easy', { obstacles: 1, ratio: 0.4 });
spec(34, 6, 6, 3, 'easy', { ratio: 0.4 });
spec(35, 6, 6, 4, 'medium');
spec(36, 6, 6, 4, 'medium', { obstacles: 2 });
spec(37, 6, 6, 4, 'medium', { obstacles: 2 });
spec(38, 6, 6, 4, 'medium');
spec(39, 6, 6, 4, 'medium', { obstacles: 3 });
spec(40, 6, 6, 4, 'medium', { timed: true });
spec(41, 6, 6, 4, 'medium');
spec(42, 6, 6, 5, 'medium', { obstacles: 2 });
spec(43, 6, 6, 4, 'hard', { full: true });
spec(44, 6, 6, 4, 'hard', { full: true });
spec(45, 6, 6, 4, 'hard', { obstacles: 3 });
spec(46, 6, 6, 5, 'hard');
spec(47, 6, 6, 5, 'hard', { obstacles: 2 });
spec(48, 6, 6, 4, 'hard', { full: true });
spec(49, 6, 6, 5, 'hard', { timed: true });
spec(50, 7, 7, 5, 'hard', { obstacles: 2 });
spec(51, 6, 6, 4, 'hard', { full: true, timed: true });
spec(52, 7, 7, 5, 'hard', { obstacles: 3 });
// Chapter 3 (53-78) Advanced
spec(53, 7, 7, 5, 'medium', { ratio: 0.45 });
spec(54, 7, 7, 5, 'medium', { obstacles: 2, ratio: 0.45 });
spec(55, 6, 6, 4, 'medium', { bridge: true });
spec(56, 6, 6, 4, 'medium', { bridge: true });
spec(57, 7, 7, 5, 'medium', { bridge: true, ratio: 0.45 });
spec(58, 7, 7, 5, 'medium', { bridge: true, obstacles: 2, ratio: 0.45 });
spec(59, 7, 7, 5, 'medium', { bridge: true, ratio: 0.45 });
spec(60, 7, 7, 5, 'hard', { bridge: true, timed: true, ratio: 0.5 });
spec(61, 6, 6, 4, 'hard', { full: true });
spec(62, 7, 7, 5, 'hard', { full: true });
spec(63, 7, 7, 5, 'hard', { full: true });
spec(64, 7, 7, 5, 'hard', { full: true, timed: true });
spec(65, 7, 7, 5, 'hard', { obstacles: 3 });
spec(66, 7, 7, 6, 'hard');
spec(67, 7, 7, 6, 'hard', { bridge: true });
spec(68, 7, 7, 6, 'hard', { bridge: true });
spec(69, 7, 7, 5, 'hard', { bridge: true, timed: true });
spec(70, 7, 7, 6, 'hard', { bridge: true, obstacles: 2 });
spec(71, 7, 7, 5, 'hard', { full: true });
spec(72, 7, 7, 6, 'hard');
spec(73, 7, 7, 6, 'hard', { bridge: true, timed: true });
spec(74, 7, 7, 6, 'hard', { bridge: true, obstacles: 2 });
spec(75, 7, 7, 6, 'hard', { full: true });
spec(76, 7, 7, 6, 'hard', { bridge: true });
spec(77, 7, 7, 5, 'hard', { full: true, timed: true });
spec(78, 7, 7, 6, 'hard', { bridge: true, obstacles: 3 });
// Chapter 4 (79-104) Expert
spec(79, 6, 6, 4, 'hard', { teleport: true });
spec(80, 6, 6, 4, 'hard', { teleport: true });
spec(81, 7, 7, 5, 'hard', { teleport: true });
spec(82, 7, 7, 5, 'hard', { teleport: true, obstacles: 2 });
spec(83, 7, 7, 5, 'expert', { teleport: true, timed: true });
spec(84, 7, 7, 5, 'expert', { teleport: true });
spec(85, 7, 7, 5, 'expert', { directional: true });
spec(86, 7, 7, 5, 'expert', { directional: true, obstacles: 2 });
spec(87, 7, 7, 5, 'expert', { directional: true, timed: true });
spec(88, 7, 7, 5, 'expert', { directional: true });
spec(89, 7, 7, 5, 'expert', { restricted: true });
spec(90, 7, 7, 5, 'expert', { restricted: true, obstacles: 2 });
spec(91, 7, 7, 6, 'expert', { restricted: true });
spec(92, 7, 7, 6, 'expert', { restricted: true, timed: true });
spec(93, 7, 7, 5, 'expert', { teleport: true, directional: true });
spec(94, 7, 7, 5, 'expert', { teleport: true, restricted: true });
spec(95, 7, 7, 6, 'expert', { directional: true, restricted: true });
spec(96, 7, 7, 6, 'expert', { teleport: true, directional: true });
spec(97, 7, 7, 6, 'expert', { teleport: true, timed: true });
spec(98, 7, 7, 6, 'expert', { directional: true, obstacles: 2, timed: true });
spec(99, 7, 7, 6, 'expert', { restricted: true, obstacles: 3 });
spec(100, 7, 7, 6, 'expert', { teleport: true, directional: true, timed: true });
spec(101, 7, 7, 6, 'expert', { teleport: true, restricted: true });
spec(102, 8, 8, 6, 'expert', { teleport: true });
spec(103, 8, 8, 6, 'expert', { directional: true, obstacles: 2 });
spec(104, 8, 8, 6, 'expert', { teleport: true, restricted: true, timed: true });
// Chapter 5 (105-130) Master
spec(105, 7, 7, 5, 'expert', { lock: true });
spec(106, 7, 7, 5, 'expert', { lock: true });
spec(107, 7, 7, 5, 'expert', { lock: true, obstacles: 2 });
spec(108, 7, 7, 6, 'expert', { lock: true, timed: true });
spec(109, 7, 7, 6, 'expert', { lock: true });
spec(110, 7, 7, 6, 'expert', { lock: true, obstacles: 3 });
spec(111, 8, 8, 6, 'expert', { lock: true });
spec(112, 8, 8, 6, 'expert', { lock: true, timed: true });
spec(113, 7, 7, 6, 'expert', { lock: true, directional: true });
spec(114, 7, 7, 6, 'expert', { lock: true, restricted: true });
spec(115, 7, 7, 6, 'expert', { lock: true, directional: true, obstacles: 2 });
spec(116, 8, 8, 6, 'expert', { lock: true, restricted: true, timed: true });
spec(117, 7, 7, 6, 'expert', { bridge: true, lock: true });
spec(118, 7, 7, 6, 'expert', { teleport: true, lock: true });
spec(119, 8, 8, 6, 'expert', { teleport: true, directional: true });
spec(120, 8, 8, 6, 'expert', { bridge: true, directional: true, timed: true });
spec(121, 8, 8, 6, 'expert', { lock: true, teleport: true });
spec(122, 8, 8, 6, 'expert', { lock: true, restricted: true, obstacles: 2 });
spec(123, 8, 8, 7, 'expert', { bridge: true });
spec(124, 8, 8, 7, 'expert', { directional: true, restricted: true });
spec(125, 8, 8, 6, 'expert', { full: true, lock: true });
spec(126, 8, 8, 6, 'expert', { full: true, timed: true });
spec(127, 8, 8, 7, 'expert', { teleport: true, timed: true });
spec(128, 8, 8, 7, 'expert', { lock: true, obstacles: 2, timed: true });
spec(129, 8, 8, 7, 'expert', { full: true, directional: true });
spec(130, 8, 8, 7, 'expert', { full: true, timed: true });

/* ---------- assembly ---------- */
function starCriteria(opt) {
  const three = opt + 2;
  const two = Math.max(three + 4, Math.round(opt * 1.75) + 4);
  return { two: two, three: three };
}

function timeLimitFor(opt) {
  return Math.round((Math.max(60, opt * 4 + 30)) / 5) * 5;
}

const signatures = new Set();
const existing = require(path.join(ROOT, 'www/src/data/levels.js'));
for (const lvl of existing) signatures.add(signature(lvl));

const out = [];
const failures = [];
const t0 = Date.now();

for (let id = 31; id <= 130; id++) {
  const sp = SPECS[id];
  if (!sp) { failures.push(id + ': no spec'); continue; }
  const rng = mulberry32(id * 7919 + 13);
  const tid = Date.now();
  let level = null;

  if (sp.full) {
    level = genFullBoard(rng, sp, signatures);
  } else if (sp.bridge) {
    level = genBridge(rng, sp, signatures);
  }
  if (!level) {
    level = genStandard(rng, sp, signatures, sp.ratio || 0.5);
  }
  if (!level) { failures.push(id + ': generation failed'); continue; }

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

  const opt = optMoves(level.w, level.solution);
  const v = Solver.verifyPaths(level, level.solution);
  if (!v.ok) { failures.push(id + ': witness invalid: ' + v.errors.join('; ')); continue; }

  const rec = {
    id: id,
    w: level.w,
    h: level.h,
    pairs: level.pairs,
    difficulty: sp.difficulty,
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
  if (sp.timed) rec.timeLimit = timeLimitFor(opt);
  signatures.add(signature(rec));
  out.push(rec);
  console.error('level', id, 'ok', ((Date.now() - tid) / 1000).toFixed(2) + 's');
}

/* Independent re-verification of every emitted level. */
let verified = 0;
const report = [];
for (const rec of out) {
  const mech = new CL.Mechanics(rec);
  const v = Solver.verifyPaths(rec, rec.solution);
  let solved = true;
  if (!rec.fullBoard) {
    const res = solveLevel(rec, 900000);
    solved = res.solved || res.aborted;
  }
  if (v.ok && solved) verified++;
  else report.push('id ' + rec.id + (v.ok ? '' : ' witness:' + v.errors.join(';')) + (solved ? '' : ' solver:unsolved'));
}

fs.mkdirSync(path.join(ROOT, 'www/src/data'), { recursive: true });
const header = '/* Color Link - Level data (Phase 2: levels 31-130, generated and verified).\n' +
  '   Chapters 2-5. `solution` is a solver-verified witness used for hints and\n' +
  '   validation. `stars` = per-level move thresholds {two, three}.\n' +
  '   Every entry is verified by `npm run validate`. */\n';
let body = '(function () {\n  \'use strict\';\n\n  var LEVELS2 = [\n';
for (const rec of out) {
  body += '    ' + JSON.stringify(rec) + ',\n';
}
body += '  ];\n\n  var CL = globalThis.ColorLink = globalThis.ColorLink || {};\n  CL.LEVELS2 = LEVELS2;\n  if (typeof module !== \'undefined\' && module.exports) {\n    module.exports = LEVELS2;\n  }\n})();\n';
fs.writeFileSync(path.join(ROOT, 'www/src/data/levels2.js'), header + body);

console.log('generated:', out.length, 'levels in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('verified:', verified + '/' + out.length);
if (failures.length) console.log('generation failures:', failures.join(' | '));
if (report.length) console.log('verification failures:', report.join(' | '));
const mechanicsCount = { full: 0, bridge: 0, lock: 0, teleport: 0, directional: 0, restricted: 0, timed: 0, obstacles: 0 };
for (const rec of out) {
  if (rec.fullBoard) mechanicsCount.full++;
  if (rec.bridges) mechanicsCount.bridge++;
  if (rec.locks) mechanicsCount.lock++;
  if (rec.teleports) mechanicsCount.teleport++;
  if (rec.directionals) mechanicsCount.directional++;
  if (rec.restricted) mechanicsCount.restricted++;
  if (rec.timeLimit) mechanicsCount.timed++;
  if (rec.obstacles) mechanicsCount.obstacles++;
}
console.log('mechanics:', JSON.stringify(mechanicsCount));
process.exit(out.length === 100 && verified === 100 && !failures.length && !report.length ? 0 : 1);
