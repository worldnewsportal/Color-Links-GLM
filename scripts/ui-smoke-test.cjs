/* UI integration test with jsdom: boots the real app, drives screens, plays
   levels (including a daily challenge), and verifies Phase 2 UI wiring. */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(path.join('/tmp/node_modules', 'jsdom'));

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'www/index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole()
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
  drawImage: noop, getImageData: () => ({ data: [] }), putImageData: noop
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
  'src/data/levels.js', 'src/data/levels2.js', 'src/core/mechanics.js',
  'src/core/solver.js', 'src/core/level-manager.js', 'src/systems/progression.js',
  'src/systems/coins.js', 'src/systems/daily.js', 'src/systems/achievements.js',
  'src/core/board.js', 'src/core/path-engine.js',
  'src/core/input-manager.js', 'src/core/renderer.js', 'src/systems/hints.js',
  'src/core/game.js', 'src/ui/dialogs.js', 'src/ui/main-menu.js',
  'src/ui/level-selection.js', 'src/ui/gameplay-screen.js', 'src/ui/settings-screen.js',
  'src/ui/stats-screen.js', 'src/ui/daily-screen.js', 'src/ui/achievements-screen.js',
  'src/main.js'
];
for (const f of SCRIPTS) {
  window.eval(fs.readFileSync(path.join(root, 'www', f), 'utf8'));
}

const doc = window.document;
const CL = window.ColorLink;

function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

// --- boot state
check('menu active after boot', doc.getElementById('screen-menu').classList.contains('active'));
check('progress rendered (130 levels)', doc.getElementById('menu-total').textContent === '130');
check('stars chip rendered', doc.getElementById('menu-stars').textContent === '0/390');
check('continue hidden when no progress', doc.getElementById('btn-continue').style.display === 'none');
check('daily badge hidden', doc.getElementById('daily-done-badge').hidden === true);

// --- level selection with chapters
click(doc.getElementById('btn-levels'));
check('levels screen active', doc.getElementById('screen-levels').classList.contains('active'));
let cards = doc.querySelectorAll('.level-card');
check('chapter 1 shows 26 cards', cards.length === 26);
check('card 1 unlocked, card 2 locked',
  !cards[0].classList.contains('locked') && cards[1].classList.contains('locked'));
check('chapter title rendered', doc.getElementById('chapter-title').textContent.length > 0);
check('chapter progress label', doc.getElementById('chapter-progress-label').textContent === '0/26');

// chapter navigation
click(doc.getElementById('chapter-next'));
cards = doc.querySelectorAll('.level-card');
check('chapter 2 shows 26 cards', cards.length === 26);
check('chapter 2 card locked', cards[0].classList.contains('locked'));
check('chapter nav prev enabled', doc.getElementById('chapter-prev').disabled === false);
click(doc.getElementById('chapter-prev'));
cards = doc.querySelectorAll('.level-card');
check('back to chapter 1', !cards[0].classList.contains('locked'));

// --- locked card rejected
click(cards[4]);
check('locked level not opened', doc.getElementById('screen-levels').classList.contains('active'));

// --- open level 1 via card
click(cards[0]);
check('game screen active', doc.getElementById('screen-game').classList.contains('active'));
check('level label set', doc.getElementById('game-level-label').textContent.includes('1'));

const game = CL.app.game;
check('board loaded 5x5 2 pairs', game.board.w === 5 && game.board.pairCount === 2);

// --- regression: opening a level must paint the canvas (load calls layout+draw)
let drawsOnLoad = 0;
const origDraw = game.renderer.draw.bind(game.renderer);
game.renderer.draw = function (b, o) { drawsOnLoad++; return origDraw(b, o); };
game.restart();
check('load paints board (no blank screen)', drawsOnLoad >= 1 && game.renderer.metrics && game.renderer.metrics.cell > 0);
game.renderer.draw = origDraw;

// --- draw a full solution for level 1 via synthetic pointer events
const canvas = doc.getElementById('board-canvas');
function fire(type, x, y, pointerId) {
  const e = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  e.pointerId = pointerId;
  e.pointerType = 'touch';
  canvas.dispatchEvent(e);
}
function cellEvent(type, idx, pointerId) {
  const m = game.renderer.metrics;
  const cx = m.ox + (idx % m.w) * m.cell + m.cell / 2;
  const cy = m.oy + ((idx / m.w) | 0) * m.cell + m.cell / 2;
  fire(type, cx, cy, pointerId);
}
function drawSolution(sol) {
  for (let c = 0; c < sol.length; c++) {
    cellEvent('pointerdown', sol[c][0], c + 1);
    for (let k = 1; k < sol[c].length; k++) cellEvent('pointermove', sol[c][k], c + 1);
    cellEvent('pointerup', sol[c][sol[c].length - 1], c + 1);
  }
}

const sol = CL.LevelManager.solution(1);
drawSolution(sol);

check('level completed via touch', game.board.isComplete());
check('moves counted', game.moves > 0);

// wait for win dialog
setTimeout(() => {
  const overlay = doc.querySelector('.win-overlay');
  check('win dialog shown', !!overlay);
  check('win dialog shows 3 lit stars', overlay.querySelectorAll('.win-star-lit').length === 3);
  check('win dialog shows coins earned', !!overlay.querySelector('.win-coins'));
  check('progress saved v2: level 2 unlocked', CL.Progression.isUnlocked(2));
  check('completed count 1', CL.Progression.completedCount() === 1);
  check('stars recorded', CL.Progression.totalStars() === 3);
  const stored = JSON.parse(window.localStorage.getItem('colorlink:progress_v2'));
  check('localStorage v2 persisted', stored && stored.version === 2 && stored.unlocked === 2 && stored.completed['1']);
  check('coins earned: level 10 + stars 15 + ach 20', stored.coins === 45);

  // achievements screen reflects first unlock
  CL.app.ctx.show('achievements');
  check('achievements screen active', doc.getElementById('screen-achievements').classList.contains('active'));
  const achCards = doc.querySelectorAll('.ach-card');
  check('7 achievement cards', achCards.length === 7);
  check('first achievement unlocked', achCards[0].classList.contains('unlocked'));
  check('achievement progress bar rendered', !!achCards[2].querySelector('.progress-fill'));

  // next level button
  CL.app.ctx.show('game');
  const btns = [...overlay.querySelectorAll('.dialog-actions .btn')];
  const nextBtn = btns.find(b => b.textContent === 'Next Level' || b.textContent === 'المستوى التالي');
  check('next button present', !!nextBtn);
  click(nextBtn);
  setTimeout(() => {
    check('advanced to level 2', doc.getElementById('game-level-label').textContent.includes('2'));
    check('board is level 2', game.board.level.id === 2);

    // undo + restart
    click(doc.getElementById('btn-restart'));
    check('restart cleared board', !game.board.isComplete() && game.board.paths.every(p => p === null));

    // back to menu
    click(doc.getElementById('game-back'));
    check('back to menu', doc.getElementById('screen-menu').classList.contains('active'));
    check('continue visible after progress', doc.getElementById('btn-continue').style.display !== 'none');
    check('menu stars chip updated', doc.getElementById('menu-stars').textContent === '3/390');

    // --- daily challenge flow
    click(doc.getElementById('btn-daily'));
    check('daily screen active', doc.getElementById('screen-daily').classList.contains('active'));
    const daily = CL.Daily.today();
    check('daily level built', !!daily.level && daily.level.daily === true);
    check('daily reward displayed', doc.getElementById('daily-reward').textContent === '100');
    check('countdown format', /^\d{2}:\d{2}:\d{2}$/.test(doc.getElementById('daily-countdown').textContent));
    check('difficulty label rendered', doc.getElementById('daily-difficulty').textContent.length > 0);
    check('start button enabled', doc.getElementById('btn-start-daily').disabled === false);

    click(doc.getElementById('btn-start-daily'));
    check('daily level opened', doc.getElementById('screen-game').classList.contains('active'));
    check('daily board loaded', game.board.level.id === 'daily' && game.board.pairCount === 4);

    drawSolution(daily.level.solution);
    setTimeout(() => {
      check('daily completed via touch', game.board.isComplete());
      const dailyOverlay = doc.querySelector('.win-overlay');
      check('daily win dialog shown', !!dailyOverlay);
      check('daily reward claimed once', CL.Progression.dailyDone(daily.key));
      const storedDaily = JSON.parse(window.localStorage.getItem('colorlink:progress_v2'));
      check('daily coins added (+100)', storedDaily.coins === 145);
      check('daily claim registry set', !!storedDaily.claimed['daily_' + daily.key]);

      // duplicate protection: completing again must not re-reward
      const before = CL.Progression._state().coins;
      CL.Progression.completeDaily(daily.key, 100);
      check('duplicate daily claim rejected', CL.Progression._state().coins === before);

      // close the daily win dialog via its Menu button (returns to daily screen)
      const dailyBtns = [...dailyOverlay.querySelectorAll('.dialog-actions .btn')];
      click(dailyBtns[dailyBtns.length - 1]);
      check('back to daily screen', doc.getElementById('screen-daily').classList.contains('active'));
      check('daily completed indicator shown', doc.getElementById('daily-completed-label').hidden === false);
      CL.app.ctx.show('menu');
      check('daily badge visible in menu', doc.getElementById('daily-done-badge').hidden === false);

      // --- settings
      CL.app.ctx.show('menu');
      click(doc.getElementById('btn-settings'));
      check('settings screen active', doc.getElementById('screen-settings').classList.contains('active'));
      const sound = doc.getElementById('set-sound');
      sound.checked = false;
      sound.dispatchEvent(new window.Event('change', { bubbles: true }));
      check('sound off persisted', CL.Progression.getSettings().sound === false);

      const arBtn = doc.querySelector('#set-language button[data-value="ar"]');
      click(arBtn);
      check('rtl applied', doc.documentElement.getAttribute('dir') === 'rtl');
      check('arabic string', doc.querySelector('[data-i18n="menu.play"]').textContent === 'العب');
      check('arabic daily key', CL.I18N.t('menu.daily') === 'التحديات اليومية');

      const lightBtn = doc.querySelector('#set-theme button[data-value="light"]');
      click(lightBtn);
      check('light theme applied', doc.documentElement.getAttribute('data-theme') === 'light');

      // --- stats screen (Phase 2 fields)
      click(doc.querySelector('#screen-settings .back'));
      click(doc.getElementById('btn-stats'));
      check('stats screen active', doc.getElementById('screen-stats').classList.contains('active'));
      check('stats stars displayed', doc.getElementById('stat-stars').textContent === '3');
      check('stats attempts numeric', !isNaN(parseInt(doc.getElementById('stat-attempts').textContent)));
      check('stats daily completed', doc.getElementById('stat-daily').textContent === '1');
      check('stats chapters displayed', doc.getElementById('stat-chapters').textContent.includes('/'));
      check('stats coins earned', parseInt(doc.getElementById('stat-coins-earned').textContent) > 0);
      check('sessions displayed numerically', !isNaN(parseInt(doc.getElementById('stat-sessions').textContent)));

      // --- hint flow on level 1 (free allowance then paid)
      click(doc.querySelector('#screen-stats .back'));
      CL.app.ctx.openGame(1);
      const hintBtn = doc.getElementById('btn-hint');
      click(hintBtn);
      check('hint ghost set', !!game.renderer.ghost);
      check('hints remaining decremented', CL.Hints.remaining(1) === 2);

      // --- timed level HUD
      const timedLevel = CL.LevelManager.all().find(l => l.timeLimit);
      check('timed level exists', !!timedLevel);
      CL.app.ctx.openGame(timedLevel.id);
      check('timed chip active', doc.getElementById('game-time-chip').classList.contains('timed-chip'));
      check('time left shown', doc.getElementById('game-time').textContent !== '00:00');

      // --- reset progress with confirmation
      CL.app.ctx.show('menu');
      click(doc.getElementById('btn-settings'));
      click(doc.getElementById('btn-reset'));
      setTimeout(() => {
        const confirmOverlay = doc.querySelector('.overlay');
        check('reset confirm dialog shown', !!confirmOverlay);
        const cBtns = confirmOverlay.querySelectorAll('.dialog-actions .btn');
        click(cBtns[cBtns.length - 1]);
        setTimeout(() => {
          check('progress reset', CL.Progression.completedCount() === 0 && CL.Progression.currentLevel() === 1);
          const stored2 = JSON.parse(window.localStorage.getItem('colorlink:progress_v2'));
          check('reset persisted', stored2.unlocked === 1);
          check('settings survive reset', CL.Progression.getSettings().lang === 'ar');

          console.log(`\nUI tests: ${passed} passed, ${failed} failed`);
          process.exit(failed ? 1 : 0);
        }, 400);
      }, 400);
    }, 1200);
  }, 1000);
}, 1200);
