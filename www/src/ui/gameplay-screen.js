/* Color Link - Gameplay screen wiring. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var canvas = document.getElementById('board-canvas');
    var game = new CL.Game(canvas);
    var T = function (k) { return CL.I18N.t(k); };
    var currentLevelId = 1;

    var elMoves = document.getElementById('game-moves');
    var elTime = document.getElementById('game-time');
    var elConnected = document.getElementById('game-connected');
    var elLevel = document.getElementById('game-level-label');
    var elHintCount = document.getElementById('hint-count');

    function fmt(sec) { return CL.Dialogs.formatTime(sec); }

    game.on('onStateChange', function (s) {
      elMoves.textContent = s.moves;
      elTime.textContent = fmt(s.timeSec);
      elConnected.textContent = s.connected + '/' + s.pairCount;
      elHintCount.textContent = CL.Hints.remaining(currentLevelId);
      document.getElementById('btn-undo').classList.toggle('disabled', !s.canUndo);
    });

    game.on('onWin', function (result) {
      var prog = CL.Progression;
      var isNewBest = prog.completeLevel(result.levelId, {
        moves: result.moves,
        timeSec: result.timeSec
      });
      var hasNext = CL.LevelManager.next(result.levelId) !== null;
      CL.Dialogs.levelComplete(result, {
        onNext: hasNext ? function () { open(result.levelId + 1); } : null,
        onReplay: function () { open(result.levelId); },
        onMenu: function () { game.stop(); ctx.show('menu'); }
      });
      if (!hasNext) CL.Dialogs.toast(T('levels.cleared'));
    });

    function open(levelId) {
      currentLevelId = levelId;
      CL.Hints.reset(levelId);
      game.load(levelId);
      game.renderer.theme = document.documentElement.getAttribute('data-theme') || 'dark';
      elLevel.textContent = T('game.level') + ' ' + levelId;
      elHintCount.textContent = CL.Hints.remaining(levelId);
      CL.Progression.setLastPlayed(levelId);
      ctx.show('game');
    }

    document.getElementById('game-back').addEventListener('click', function () {
      CL.Audio.play('tap');
      game.stop();
      ctx.show('menu');
    });
    document.getElementById('btn-undo').addEventListener('click', function () {
      CL.Audio.play('tap');
      game.undo();
    });
    document.getElementById('btn-restart').addEventListener('click', function () {
      CL.Audio.play('tap');
      game.restart();
    });
    document.getElementById('btn-hint').addEventListener('click', function () {
      var res = game.hint();
      if (res && res.error === 'no-hints') {
        CL.Audio.play('error');
        CL.Dialogs.toast(T('toast.noHints'));
      }
    });

    window.addEventListener('resize', function () { game.resize(); });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { game.resize(); }).observe(document.getElementById('board-wrap'));
    }

    return { open: open, game: game };
  }

  CL.GameplayScreen = { init: init };
})();
