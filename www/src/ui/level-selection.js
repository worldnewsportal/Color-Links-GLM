/* Color Link - Level selection screen. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var grid = document.getElementById('levels-grid');
    var chip = document.getElementById('levels-progress-chip');
    var T = function (k) { return CL.I18N.t(k); };

    function build() {
      grid.innerHTML = '';
      var prog = CL.Progression;
      chip.textContent = prog.completedCount() + '/' + prog.totalLevels();
      var levels = CL.LevelManager.all();
      levels.forEach(function (level) {
        var unlocked = prog.isUnlocked(level.id);
        var best = prog.getBest(level.id);
        var card = document.createElement('button');
        card.className = 'level-card' +
          (unlocked ? '' : ' locked') +
          (best ? ' completed' : '') +
          (level.id === prog.currentLevel() && !best ? ' current' : '');
        var num = document.createElement('span');
        num.className = 'level-num';
        num.textContent = level.id;
        var diff = document.createElement('span');
        diff.className = 'level-diff diff-' + level.difficulty;
        diff.textContent = T('difficulty.' + level.difficulty);
        var foot = document.createElement('span');
        foot.className = 'level-foot';
        if (best) {
          foot.innerHTML = '<svg viewBox="0 0 24 24" class="ic small"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>' +
            CL.Dialogs.formatTime(best.timeSec);
        } else if (unlocked) {
          foot.textContent = level.pairs.length + '×';
        } else {
          foot.innerHTML = '<svg viewBox="0 0 24 24" class="ic small"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7z" fill="currentColor"/></svg>';
        }
        card.appendChild(num);
        card.appendChild(diff);
        card.appendChild(foot);
        card.addEventListener('click', function () {
          if (!unlocked) {
            CL.Audio.play('error');
            card.classList.add('shake');
            setTimeout(function () { card.classList.remove('shake'); }, 400);
            return;
          }
          CL.Audio.play('tap');
          ctx.openGame(level.id);
        });
        grid.appendChild(card);
      });
    }

    return { build: build };
  }

  CL.LevelSelection = { init: init };
})();
