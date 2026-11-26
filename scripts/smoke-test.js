/* Headless smoke tests for Color Link core logic. Run: node scripts/smoke-test.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { globalThis: {}, console, setTimeout, setInterval, clearInterval, clearTimeout, navigator: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);

const FILES = [
  'www/src/systems/storage.js',
  'www/src/systems/localization.js',
  'www/src/systems/audio.js',
  'www/src/systems/progression.js',
  'www/src/data/levels.js',
  'www/src/core/solver.js',
  'www/src/core/level-manager.js',
  'www/src/core/board.js',
  'www/src/core/path-engine.js',
  'www/src/systems/hints.js',
  'www/src/core/game.js'
];
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}

const CL = ctx.ColorLink;
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ ' + name); }
}

// --- storage fallback
CL.Storage.set('t1', { a: 1 });
check('storage set/get', CL.Storage.get('t1', null).a === 1);
check('storage fallback default', CL.Storage.get('missing', { b: 7 }).b === 7);

// --- i18n
CL.I18N.setLanguage('ar');
check('i18n ar', CL.I18N.t('menu.play') === 'العب');
CL.I18N.setLanguage('en');
check('i18n en fallback', CL.I18N.t('nonexistent.key') === 'nonexistent.key');

// --- level validation
for (const level of CL.LevelManager.all()) {
  const v = CL.LevelManager.validate(level);
  check(`L${level.id} structural validation`, v.ok);
  check(`L${level.id} solvable`, CL.LevelManager.isSolvable(level));
}

// --- solving + playing via path engine completes every level
for (const level of CL.LevelManager.all()) {
  const solution = CL.LevelManager.solution(level.id);
  check(`L${level.id} has cached solution`, !!solution);
  const board = new CL.Board(level);
  for (let c = 0; c < board.pairCount; c++) {
    const solPath = solution[c];
    let r = CL.PathEngine.startDraw(board, c, solPath[0]);
    check(`L${level.id} c${c} startDraw`, !!r);
    for (let k = 1; k < solPath.length; k++) {
      const res = CL.PathEngine.extendDraw(board, c, solPath[k]);
      check(`L${level.id} c${c} step ${k}`, !!res && res.changed);
    }
  }
  check(`L${level.id} complete after applying solution`, board.isComplete());
}

// --- path collision: drawing through another path cuts it
const cutLevel = { w: 5, h: 5, pairs: [[0, 1, 4, 1], [0, 3, 4, 3]] };
{
  const b = new CL.Board(cutLevel);
  CL.PathEngine.startDraw(b, 1, b.endpoints[1][0]);
  for (let x = 1; x <= 4; x++) CL.PathEngine.extendDraw(b, 1, b.idx(x, 3));
  check('blue connected', b.isConnected(1));
  CL.PathEngine.startDraw(b, 0, b.endpoints[0][0]);
  for (let x = 1; x <= 4; x++) CL.PathEngine.extendDraw(b, 0, b.idx(x, 1));
  check('red connected straight', b.isConnected(0));
  // grab red mid-path, then drag it down through blue's row
  const grab = CL.PathEngine.startDraw(b, 0, b.idx(2, 1));
  check('red re-grabbed mid-path', !!grab && grab.changed && b.paths[0].length === 3);
  const r1 = CL.PathEngine.extendDraw(b, 0, b.idx(2, 2));
  check('red enters free cell', !!r1 && r1.changed);
  const r2 = CL.PathEngine.extendDraw(b, 0, b.idx(2, 3));
  check('red cuts blue path', !!r2 && r2.cut === 1);
  check('blue truncated not cleared', Array.isArray(b.paths[1]) && b.paths[1].length === 2);
  check('red not complete after cut', !b.isComplete());
}

// --- cannot enter another color's endpoint or a blocked cell
{
  const b = new CL.Board({ w: 5, h: 5, pairs: [[0, 1, 4, 1], [0, 3, 4, 3]], obstacles: [[2, 2]] });
  CL.PathEngine.startDraw(b, 0, b.endpoints[0][0]);
  CL.PathEngine.extendDraw(b, 0, b.idx(1, 1));
  CL.PathEngine.extendDraw(b, 0, b.idx(1, 2));
  const r = CL.PathEngine.extendDraw(b, 0, b.idx(2, 2));
  check('blocked cell rejected', !r);
  check('red path intact after blocked attempt', b.paths[0].length === 3);
  CL.PathEngine.startDraw(b, 1, b.endpoints[1][0]);
  CL.PathEngine.extendDraw(b, 1, b.idx(0, 2));
  const r2 = CL.PathEngine.extendDraw(b, 1, b.idx(0, 1));
  check("other color's endpoint rejected", !r2);
}

// --- backtrack pops
{
  const b = new CL.Board(cutLevel);
  CL.PathEngine.startDraw(b, 0, b.endpoints[0][0]);
  CL.PathEngine.extendDraw(b, 0, b.idx(1, 1));
  CL.PathEngine.extendDraw(b, 0, b.idx(2, 1));
  check('path length 3', b.paths[0].length === 3);
  const r = CL.PathEngine.extendDraw(b, 0, b.idx(1, 1));
  check('backtrack pops', !!r && r.popped && b.paths[0].length === 2);
}

// --- undo snapshots restore state
{
  const b = new CL.Board(cutLevel);
  const snap = b.snapshot();
  CL.PathEngine.startDraw(b, 0, b.endpoints[0][0]);
  CL.PathEngine.extendDraw(b, 0, b.idx(1, 1));
  CL.PathEngine.extendDraw(b, 0, b.idx(2, 1));
  check('mutated', b.paths[0] && b.paths[0].length === 3);
  b.restore(snap);
  check('restore clears paths', b.paths[0] === null && b.paths[1] === null);
}

// --- hint system
{
  const levelId = 3;
  const board = new CL.Board(CL.LevelManager.get(levelId));
  check('hints start at 3', CL.Hints.remaining(levelId) === 3);
  const hint = CL.Hints.getHint(board, levelId);
  check('hint produced', !!hint && hint.cells.length >= 1 && hint.cells.length <= 3);
  const left = CL.Hints.useOne(levelId);
  check('hint decremented', left === 2);
  CL.Hints.reset(levelId);
  check('hint reset', CL.Hints.remaining(levelId) === 3);
}

// --- progression
{
  const prog = CL.Progression;
  prog.init();
  check('unlocked starts at 1', prog.isUnlocked(1) && !prog.isUnlocked(2));
  prog.completeLevel(1, { moves: 10, timeSec: 30 });
  check('level 2 unlocked', prog.isUnlocked(2));
  check('best recorded', prog.getBest(1).moves === 10);
  prog.completeLevel(1, { moves: 5, timeSec: 20 });
  check('best improved', prog.getBest(1).moves === 5 && prog.getBest(1).timeSec === 20);
  prog.completeLevel(2, { moves: 9, timeSec: 15 });
  check('unlocked advances', prog.isUnlocked(3));
  prog.resetAll();
  check('reset restores defaults', prog.completedCount() === 0 && prog.currentLevel() === 1);
}

// --- level manager integrity
check('30 levels', CL.LevelManager.count() === 30);
check('ids sequential', CL.LevelManager.all().every((l, i) => l.id === i + 1));
check('next(1) = 2', CL.LevelManager.next(1) === 2);
check('next(30) = null', CL.LevelManager.next(30) === null);

console.log(`\nSmoke tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
