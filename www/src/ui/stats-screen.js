/* Color Link - Statistics screen. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    function refresh() {
      var stats = CL.Progression.getStats();
      document.getElementById('stat-completed').textContent = CL.Progression.completedCount();
      document.getElementById('stat-current').textContent = CL.Progression.currentLevel();
      document.getElementById('stat-playtime').textContent = CL.Dialogs.formatTime(Math.floor(stats.playtimeMs / 1000));
      document.getElementById('stat-moves').textContent = stats.totalMoves;
      document.getElementById('stat-hints').textContent = stats.hintsUsed;
      document.getElementById('stat-sessions').textContent = stats.sessions;
    }
    return { refresh: refresh };
  }

  CL.StatsScreen = { init: init };
})();
