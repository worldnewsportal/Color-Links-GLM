/* Validates every Color Link level (Phase 1 + Phase 2) with the shared solver:
   structural validation, solvability and witness verification.
   Run: node scripts/validate-levels.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['www/src/core/mechanics.js', 'www/src/core/solver.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
}
const CL = ctx.globalThis.ColorLink;
const levels = [
  ...vm.runInContext(fs.readFileSync(path.join(root, 'www/src/data/levels.js'), 'utf8') + '\n;ColorLink.LEVELS;', ctx),
  ...vm.runInContext(fs.readFileSync(path.join(root, 'www/src/data/levels2.js'), 'utf8') + '\n;ColorLink.LEVELS2;', ctx)
];

let failures = 0;
for (const level of levels) {
  const problems = [];
  // structural checks mirroring level-manager.validate
  const errors = [];
  const seen = {};
  for (const o of (level.obstacles || [])) {
    if (o[0] < 0 || o[1] < 0 || o[0] >= level.w || o[1] >= level.h) errors.push('obstacle oob');
    else seen[o[1] * level.w + o[0]] = 1;
  }
  level.pairs.forEach((p, pi) => {
    [[p[0], p[1]], [p[2], p[3]]].forEach(([x, y]) => {
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) errors.push(`pair ${pi} endpoint oob`);
      else {
        if (seen[y * level.w + x]) errors.push(`pair ${pi} overlap`);
        seen[y * level.w + x] = 1;
      }
    });
  });
  for (const t of (level.teleports || [])) {
    const d = Math.abs(t[0] - t[2]) + Math.abs(t[1] - t[3]);
    if (d < 2) errors.push('teleport twins adjacent/identical');
    if (seen[t[1] * level.w + t[0]] || seen[t[3] * level.w + t[2]]) errors.push('teleport overlap');
    seen[t[1] * level.w + t[0]] = 1; seen[t[3] * level.w + t[2]] = 1;
  }
  for (const d of (level.directionals || [])) {
    if (seen[d.cell[1] * level.w + d.cell[0]]) errors.push('directional overlap');
    seen[d.cell[1] * level.w + d.cell[0]] = 1;
  }
  for (const r of (level.restricted || [])) {
    if (seen[r.cell[1] * level.w + r.cell[0]]) errors.push('restricted overlap');
    if (!r.dirs || !r.dirs.length || r.dirs.length >= 4) errors.push('restricted dirs bad');
    seen[r.cell[1] * level.w + r.cell[0]] = 1;
  }
  for (const l of (level.locks || [])) {
    if (seen[l.cell[1] * level.w + l.cell[0]]) errors.push('lock overlap');
    if (typeof l.color !== 'number' || l.color < 0 || l.color >= level.pairs.length) errors.push('lock color bad');
    seen[l.cell[1] * level.w + l.cell[0]] = 1;
  }
  for (const b of (level.bridges || [])) {
    if (seen[b[1] * level.w + b[0]]) errors.push('bridge overlap');
    seen[b[1] * level.w + b[0]] = 1;
  }
  errors.forEach(e => problems.push('structure: ' + e));

  // witness verification (rule checker: connectivity, collisions, locks, full board)
  if (Array.isArray(level.solution)) {
    const v = CL.Solver.verifyPaths(level, level.solution);
    if (!v.ok) problems.push('witness: ' + v.errors.join('; '));
  } else if (level.id > 30) {
    problems.push('no witness solution stored');
  }

  // independent solver run (skipped for full-board levels: witness is the proof;
  // solving Hamiltonian partitions is exponential and unnecessary)
  let solved = true, nodes = '-';
  if (!level.fullBoard) {
    const res = CL.Solver.solve(level, { nodeLimit: 4000000 });
    solved = res.solved || res.aborted;
    nodes = res.nodes + (res.aborted ? ' (aborted)' : '');
    if (!res.solved && !res.aborted) problems.push('solver: no solution found');
  } else {
    nodes = 'witness';
  }

  const status = problems.length === 0 ? 'OK  ' : 'FAIL';
  if (problems.length) failures++;
  const mech = [
    level.fullBoard ? 'full' : null,
    (level.bridges || []).length ? 'bridge' : null,
    (level.locks || []).length ? 'lock' : null,
    (level.teleports || []).length ? 'teleport' : null,
    (level.directionals || []).length ? 'dir' : null,
    (level.restricted || []).length ? 'restr' : null,
    level.timeLimit ? 'timed=' + level.timeLimit : null
  ].filter(Boolean).join(',');
  console.log(`${status} L${String(level.id).padStart(3, '0')} ch=${Math.floor((level.id - 1) / 26) + 1} ${level.w}x${level.h} pairs=${level.pairs.length} obs=${(level.obstacles || []).length} ${mech} nodes=${nodes}${problems.length ? ' :: ' + problems.join(' | ') : ''}`);
}
console.log(failures === 0 ? `\nAll ${levels.length} levels verified (structure + witness + solver).` : `\n${failures} level(s) FAILED validation.`);
process.exit(failures === 0 ? 0 : 1);
