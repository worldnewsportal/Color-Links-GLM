/* Color Link - Main menu screen. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var T = function (k) { return CL.I18N.t(k); };

    function refresh() {
      var prog = CL.Progression;
      document.getElementById('menu-coins').textContent = CL.Coins.balance();
      document.getElementById('menu-stars').textContent = prog.totalStars() + '/' + prog.maxStars();
      document.getElementById('menu-current-level').textContent = prog.currentLevel();
      document.getElementById('menu-completed').textContent = prog.completedCount();
      document.getElementById('menu-total').textContent = prog.totalLevels();
      var pct = prog.progressPct();
      document.getElementById('menu-progress-pct').textContent = pct + '%';
      document.getElementById('menu-progress-fill').style.width = pct + '%';
      var s = prog.getSettings();
      updateSoundIcon(s.sound);
      updateThemeIcon(s.theme);
      var btnContinue = document.getElementById('btn-continue');
      btnContinue.style.display = prog.completedCount() > 0 ? '' : 'none';
      var dailyDone = prog.dailyDone(CL.Daily.dateKey());
      document.getElementById('daily-done-badge').hidden = !dailyDone;
    }

    function updateSoundIcon(on) {
      var btn = document.getElementById('menu-sound');
      btn.innerHTML = on
        ? '<svg viewBox="0 0 24 24" class="ic"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" class="ic"><path d="M3 9v6h4l5 5V4L7 9H3zm18.5 3-2.3-2.3-1.4 1.4 2.3 2.3-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3 2.3-2.3-1.4-1.4z" fill="currentColor" transform="translate(-4 0)"/></svg>';
      btn.classList.toggle('muted', !on);
    }

    function updateThemeIcon(theme) {
      var btn = document.getElementById('menu-theme');
      btn.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4A7 7 0 0 1 11.4 3H12z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" class="ic"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0l1 3h-2l1-3zm0 22-.1-3h2.1L12 24zM2 11h3v2H2zm17 0h3v2h-3zM4.2 5.6 6.3 7.7 4.9 9.1 2.8 7zM17.7 16.3l2.1 2.1-1.4 1.4-2.1-2.1zM5.6 19.8l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z" fill="currentColor"/></svg>';
    }

    document.getElementById('btn-play').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.openGame(CL.Progression.currentLevel());
    });
    document.getElementById('btn-continue').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.openGame(CL.Progression.lastPlayed());
    });
    document.getElementById('btn-levels').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.openLevels();
    });
    document.getElementById('btn-daily').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.show('daily');
    });
    document.getElementById('btn-achievements').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.show('achievements');
    });
    document.getElementById('btn-stats').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.show('stats');
    });
    document.getElementById('btn-settings').addEventListener('click', function () {
      CL.Audio.play('tap');
      ctx.show('settings');
    });
    document.getElementById('menu-sound').addEventListener('click', function () {
      var s = CL.Progression.getSettings();
      var on = !s.sound;
      CL.Progression.setSetting('sound', on);
      CL.Audio.setSound(on);
      if (on) CL.Audio.play('tap');
      updateSoundIcon(on);
    });
    document.getElementById('menu-theme').addEventListener('click', function () {
      CL.Audio.play('tap');
      var s = CL.Progression.getSettings();
      var theme = s.theme === 'dark' ? 'light' : 'dark';
      CL.Progression.setSetting('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      ctx.applyThemeToRenderer(theme);
      updateThemeIcon(theme);
    });

    CL.Progression.onChange(refresh);
    refresh();
    return { refresh: refresh };
  }

  CL.MainMenu = { init: init };
})();
