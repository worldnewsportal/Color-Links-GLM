/* Validates every Color Link level with the shared solver. Run: node scripts/validate-levels.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { globalThis: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'www/src/core/solver.js'), 'utf8'), ctx);
const levelsSrc = fs.readFileSync(path.join(root, 'www/src/data/levels.js'), 'utf8');
const levels = vm.runInContext(levelsSrc + '\n;typeof ColorLink !== "undefined" ? ColorLink.LEVELS : COLORLINK_LEVELS;', ctx);

let failures = 0;
for (const level of levels) {
  const res = ctx.globalThis.ColorLink
    ? ctx.globalThis.ColorLink.Solver.solve(level)
    : ctx.ColorLink.Solver.solve(level);
  const status = res.solved ? 'OK  ' : 'FAIL';
  if (!res.solved) failures++;
  console.log(`${status} L${String(level.id).padStart(2, '0')} ${level.w}x${level.h} pairs=${level.pairs.length} obstacles=${(level.obstacles || []).length} nodes=${res.nodes}${res.aborted ? ' (aborted)' : ''}`);
}
console.log(failures === 0 ? `\nAll ${levels.length} levels verified solvable.` : `\n${failures} level(s) FAILED validation.`);
process.exit(failures === 0 ? 0 : 1);
