/* UI integration test with jsdom: boots the real app, drives screens & drawing. */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join('/tmp/node_modules', 'jsdom'));

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'www/index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: new (require(path.join('/tmp/node_modules', 'jsdom')).VirtualConsole)()
});
const { window } = dom;

// Canvas 2D stub (jsdom has no canvas implementation)
const noop = () => {};
const ctx2dStub = {
  canvas: null,
  clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
  moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
  fill: noop, stroke: noop, clip: noop, save: noop, restore: noop,
  setTransform: noop, transform: noop, translate: noop, rotate: noop, scale: noop,
  setLineDash: noop, createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
  globalAlpha: 1, shadowColor: '', shadowBlur: 0, font: '', textAlign: 'left', textBaseline: 'alphabetic',
  fillText: noop, strokeText: noop, measureText: () => ({ width: 0 }),
  drawImage: noop, getImageData: () => ({ data: [] }), putImageData: noop,
  setLineDash: noop
};
window.HTMLCanvasElement.prototype.getContext = function () {
  return Object.create(ctx2dStub);
};

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ ' + name); }
}

const SCRIPTS = [
  'src/systems/storage.js', 'src/systems/localization.js', 'src/systems/audio.js',
  'src/systems/progression.js', 'src/data/levels.js', 'src/core/solver.js',
  'src/core/level-manager.js', 'src/core/board.js', 'src/core/path-engine.js',
  'src/core/input-manager.js', 'src/core/renderer.js', 'src/systems/hints.js',
  'src/core/game.js', 'src/ui/dialogs.js', 'src/ui/main-menu.js',
  'src/ui/level-selection.js', 'src/ui/gameplay-screen.js', 'src/ui/settings-screen.js',
  'src/ui/stats-screen.js', 'src/main.js'
];
for (const f of SCRIPTS) {
  window.eval(fs.readFileSync(path.join(root, 'www', f), 'utf8'));
}

const doc = window.document;
const CL = window.ColorLink;

// --- boot state
check('menu active after boot', doc.getElementById('screen-menu').classList.contains('active'));
check('progress rendered', doc.getElementById('menu-total').textContent === '30');
check('continue hidden when no progress', doc.getElementById('btn-continue').style.display === 'none');

// --- level selection
doc.getElementById('btn-levels').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('levels screen active', doc.getElementById('screen-levels').classList.contains('active'));
const cards = doc.querySelectorAll('.level-card');
check('30 level cards', cards.length === 30);
check('card 1 unlocked, card 2 locked',
  !cards[0].classList.contains('locked') && cards[1].classList.contains('locked'));

// --- locked card rejected
cards[4].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('locked level not opened', doc.getElementById('screen-levels').classList.contains('active'));

// --- open level 1 via card
cards[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('game screen active', doc.getElementById('screen-game').classList.contains('active'));
check('level label set', doc.getElementById('game-level-label').textContent.includes('1'));

const game = CL.app.game;
check('board loaded 5x5 2 pairs', game.board.w === 5 && game.board.pairCount === 2);

// --- draw a full solution for level 1 via synthetic pointer events
const canvas = doc.getElementById('board-canvas');
const m = game.renderer.metrics;
function fire(type, x, y, pointerId) {
  const e = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  e.pointerId = pointerId;
  e.pointerType = 'touch';
  canvas.dispatchEvent(e);
}
function cellEvent(type, idx, pointerId) {
  const cx = m.ox + (idx % m.w) * m.cell + m.cell / 2;
  const cy = m.oy + ((idx / m.w) | 0) * m.cell + m.cell / 2;
  fire(type, cx, cy, pointerId);
}

const sol = CL.LevelManager.solution(1);
cellEvent('pointerdown', sol[0][0], 1);
for (let k = 1; k < sol[0].length; k++) cellEvent('pointermove', sol[0][k], 1);
cellEvent('pointerup', sol[0][sol[0].length - 1], 1);
cellEvent('pointerdown', sol[1][0], 2);
for (let k = 1; k < sol[1].length; k++) cellEvent('pointermove', sol[1][k], 2);
cellEvent('pointerup', sol[1][sol[1].length - 1], 2);

check('level completed via touch', game.board.isComplete());
check('moves counted', game.moves > 0);

// wait for win dialog
setTimeout(() => {
  const overlay = doc.querySelector('.win-overlay');
  check('win dialog shown', !!overlay);
  check('progress saved: level 2 unlocked', CL.Progression.isUnlocked(2));
  check('completed count 1', CL.Progression.completedCount() === 1);
  const stored = JSON.parse(window.localStorage.getItem('colorlink:progress'));
  check('localStorage persisted', stored && stored.unlocked === 2 && stored.completed['1']);

  // next level button
  const btns = [...overlay.querySelectorAll('.dialog-actions .btn')];
  const nextBtn = btns.find(b => b.textContent === 'Next Level');
  check('next button present', !!nextBtn);
  nextBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  setTimeout(() => {
    check('advanced to level 2', doc.getElementById('game-level-label').textContent.includes('2'));
    check('board is level 2', game.board.level.id === 2);

    // undo + restart
    doc.getElementById('btn-restart').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('restart cleared board', !game.board.isComplete() && game.board.paths.every(p => p === null));

    // back to menu
    doc.getElementById('game-back').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('back to menu', doc.getElementById('screen-menu').classList.contains('active'));
    check('continue visible after progress', doc.getElementById('btn-continue').style.display !== 'none');

    // --- settings
    doc.getElementById('btn-settings').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('settings screen active', doc.getElementById('screen-settings').classList.contains('active'));
    const sound = doc.getElementById('set-sound');
    sound.checked = false;
    sound.dispatchEvent(new window.Event('change', { bubbles: true }));
    check('sound off persisted', CL.Progression.getSettings().sound === false);

    const arBtn = doc.querySelector('#set-language button[data-value="ar"]');
    arBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('rtl applied', doc.documentElement.getAttribute('dir') === 'rtl');
    check('arabic string', doc.querySelector('[data-i18n="menu.play"]').textContent === 'العب');

    const lightBtn = doc.querySelector('#set-theme button[data-value="light"]');
    lightBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('light theme applied', doc.documentElement.getAttribute('data-theme') === 'light');

    // reset progress with confirmation
    doc.getElementById('btn-reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    setTimeout(() => {
      const confirmOverlay = doc.querySelector('.overlay');
      check('reset confirm dialog shown', !!confirmOverlay);
      const cBtns = confirmOverlay.querySelectorAll('.dialog-actions .btn');
      cBtns[cBtns.length - 1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      setTimeout(() => {
        check('progress reset', CL.Progression.completedCount() === 0 && CL.Progression.currentLevel() === 1);
        const stored2 = JSON.parse(window.localStorage.getItem('colorlink:progress'));
        check('reset persisted', stored2.unlocked === 1);
        check('settings survive reset', CL.Progression.getSettings().lang === 'ar');

        // --- stats screen
        doc.querySelector('#screen-settings .back').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        doc.getElementById('btn-stats').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        check('stats screen active', doc.getElementById('screen-stats').classList.contains('active'));
        check('sessions displayed numerically', !isNaN(parseInt(doc.getElementById('stat-sessions').textContent)));

        // --- hint on level 1
        doc.querySelector('#screen-stats .back').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        CL.app.ctx.openGame(1);
        const hintBtn = doc.getElementById('btn-hint');
        hintBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
        check('hint ghost set', !!game.renderer.ghost);
        check('hints remaining decremented', window.ColorLink.Hints.remaining(1) === 2);

        console.log(`\nUI tests: ${passed} passed, ${failed} failed`);
        process.exit(failed ? 1 : 0);
      }, 400);
    }, 400);
  }, 1000);
}, 1200);
