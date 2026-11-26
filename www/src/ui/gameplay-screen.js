/* Color Link - Gameplay screen wiring (Phase 2): stars, coins, timers,
   daily flow, mechanic explanations, full-board chip. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var canvas = document.getElementById('board-canvas');
    var game = new CL.Game(canvas);
    var T = function (k) { return CL.I18N.t(k); };
    var currentLevel = null;
    var isDaily = false;

    var elMoves = document.getElementById('game-moves');
    var elTime = document.getElementById('game-time');
    var elTimeChip = document.getElementById('game-time-chip');
    var elConnected = document.getElementById('game-connected');
    var elRemainingChip = document.getElementById('game-remaining-chip');
    var elRemaining = document.getElementById('game-remaining');
    var elLevel = document.getElementById('game-level-label');
    var elHintCount = document.getElementById('hint-count');

    function fmt(sec) { return CL.Dialogs.formatTime(sec); }

    function mechanicKeys(level) {
      var keys = [];
      if (!level) return keys;
      if (level.timeLimit) keys.push('mech.timed');
      if (level.fullBoard) keys.push('mech.fullBoard');
      if (level.bridges && level.bridges.length) keys.push('mech.bridge');
      if (level.teleports && level.teleports.length) keys.push('mech.teleport');
      if (level.directionals && level.directionals.length) keys.push('mech.directional');
      if (level.restricted && level.restricted.length) keys.push('mech.restricted');
      if (level.locks && level.locks.length) keys.push('mech.lock');
      return keys;
    }

    function announceMechanics(level) {
      var prog = CL.Progression;
      var keys = mechanicKeys(level);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (prog.markMechanicSeen(key)) {
          CL.Dialogs.toast(T(key));
        }
      }
    }

    game.on('onStateChange', function (s) {
      elMoves.textContent = s.moves;
      elConnected.textContent = s.connected + '/' + s.pairCount;
      if (s.timeLeft !== null && s.timeLeft !== undefined) {
        elTimeChip.classList.add('timed-chip');
        elTime.textContent = fmt(s.timeLeft);
        elTimeChip.classList.toggle('time-low', s.timeLeft <= 10 && !s.won && !s.timedOut);
      } else {
        elTimeChip.classList.remove('timed-chip', 'time-low');
        elTime.textContent = fmt(s.timeSec);
      }
      if (s.remaining !== null && s.remaining !== undefined) {
        elRemainingChip.hidden = false;
        elRemaining.textContent = s.remaining;
      } else {
        elRemainingChip.hidden = true;
      }
      document.getElementById('btn-undo').classList.toggle('disabled', !s.canUndo);
    });

    game.on('onWin', function (result) {
      var prog = CL.Progression;
      var summary;
      var hasNext;
      if (isDaily) {
        var done = CL.Daily.complete();
        summary = { coinsEarned: done ? done.coinsEarned : 0, starGain: 0 };
        var newDaily = CL.Achievements.check();
        if (done && done.coinsEarned > 0) {
          CL.Dialogs.rewardToast(T('daily.completed'), done.coinsEarned);
        }
        for (var j = 0; j < newDaily.length; j++) {
          CL.Dialogs.rewardToast(T(newDaily[j].key), newDaily[j].reward);
        }
        hasNext = false;
      } else {
        summary = prog.completeLevel(result.levelId, {
          moves: result.moves,
          timeSec: result.timeSec
        });
        var newly = CL.Achievements.check();
        announceRewards(summary, newly);
        hasNext = CL.LevelManager.next(result.levelId) !== null;
      }
      CL.Dialogs.levelComplete(result, {
        summary: summary,
        onNext: !isDaily && hasNext ? function () { open(result.levelId + 1); } : null,
        onReplay: function () { open(result.level); },
        onMenu: function () { game.stop(); ctx.show(isDaily ? 'daily' : 'menu'); }
      });
      if (!isDaily && !hasNext) CL.Dialogs.toast(T('levels.cleared'));
    });

    function announceRewards(summary, newlyUnlocked) {
      if (summary.coinsEarned > 0) {
        CL.Dialogs.rewardToast(T('toast.reward'), summary.coinsEarned);
      }
      for (var i = 0; i < newlyUnlocked.length; i++) {
        var def = newlyUnlocked[i];
        CL.Dialogs.rewardToast(T(def.key), def.reward);
      }
    }

    game.on('onTimeout', function () {
      game.stop();
      CL.Dialogs.timeout({
        onRetry: function () { game.restart(); },
        onMenu: function () { ctx.show(isDaily ? 'daily' : 'menu'); }
      });
    });

    function open(idOrLevel) {
      var level = typeof idOrLevel === 'object' ? idOrLevel : CL.LevelManager.get(idOrLevel);
      if (!level) return;
      currentLevel = level;
      isDaily = !!level.daily;
      if (!isDaily) CL.Hints.reset(level.id);
      game.load(level);
      game.renderer.theme = document.documentElement.getAttribute('data-theme') || 'dark';
      elLevel.textContent = isDaily
        ? T('daily.title')
        : T('game.level') + ' ' + level.id;
      elHintCount.textContent = isDaily ? CL.Hints.maxHints() : CL.Hints.remaining(level.id);
      if (!isDaily) {
        CL.Progression.setLastPlayed(level.id);
        announceMechanics(level);
      }
      ctx.show('game');
      game.resize();
    }

    document.getElementById('game-back').addEventListener('click', function () {
      CL.Audio.play('tap');
      game.stop();
      ctx.show(isDaily ? 'daily' : 'menu');
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
      if (!res) {
        CL.Audio.play('error');
        CL.Dialogs.toast(T('toast.noHints'));
        return;
      }
      if (res.error === 'no-coins') {
        CL.Audio.play('error');
        CL.Dialogs.toast(T('toast.noCoins'));
        return;
      }
      if (res.hint) {
        if (!isDaily) elHintCount.textContent = CL.Hints.remaining(currentLevel.id);
        game.renderer.setGhost(res.hint);
        game.renderer.draw(game.board);
        setTimeout(function () {
          game.renderer.setGhost(null);
          game.renderer.draw(game.board);
        }, 2200);
        if (!res.free) CL.Dialogs.toast(T('toast.hintPaid'));
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
