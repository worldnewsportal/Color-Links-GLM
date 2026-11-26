/* Color Link - Statistics screen (Phase 2). */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    function refresh() {
      var prog = CL.Progression;
      var stats = prog.getStats();
      document.getElementById('stat-completed').textContent = prog.completedCount();
      document.getElementById('stat-current').textContent = prog.currentLevel();
      document.getElementById('stat-coins').textContent = stats.coins;
      document.getElementById('stat-playtime').textContent = CL.Dialogs.formatTime(Math.floor(stats.playtimeMs / 1000));
      document.getElementById('stat-moves').textContent = stats.totalMoves;
      document.getElementById('stat-hints').textContent = stats.hintsUsed;
      document.getElementById('stat-sessions').textContent = stats.sessions;
      document.getElementById('stat-stars').textContent = prog.totalStars();
      document.getElementById('stat-attempts').textContent = stats.attempts;
      document.getElementById('stat-daily').textContent = stats.dailyCompleted;
      var chapters = CL.LevelManager.chapters();
      var done = 0;
      for (var c = 1; c <= chapters.length; c++) {
        var p = prog.chapterProgress(c);
        if (p.completed >= p.total) done++;
      }
      document.getElementById('stat-chapters').textContent = done + '/' + chapters.length;
      document.getElementById('stat-coins-earned').textContent = stats.coinsEarned;
    }
    return { refresh: refresh };
  }

  CL.StatsScreen = { init: init };
})();
