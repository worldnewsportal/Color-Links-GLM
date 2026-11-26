/* Color Link - Bootstrap & router. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var SCREENS = ['menu', 'levels', 'game', 'settings', 'stats'];
  var refreshers = {};

  function show(name) {
    for (var i = 0; i < SCREENS.length; i++) {
      var el = document.getElementById('screen-' + SCREENS[i]);
      if (el) el.classList.toggle('active', SCREENS[i] === name);
    }
    if (name === 'levels' && refreshers.levels) refreshers.levels.build();
    if (name === 'stats' && refreshers.stats) refreshers.stats.refresh();
    if (name === 'menu' && refreshers.menu) refreshers.menu.refresh();
  }

  function applyThemeToRenderer(theme) {
    if (CL.app && CL.app.game && CL.app.game.renderer) {
      CL.app.game.renderer.theme = theme;
      if (CL.app.game.board) CL.app.game.renderer.draw(CL.app.game.board);
    }
  }

  function refreshAll() {
    if (refreshers.menu) refreshers.menu.refresh();
    if (refreshers.levels) refreshers.levels.build();
    if (refreshers.stats) refreshers.stats.refresh();
    if (refreshers.settings) refreshers.settings.refresh();
  }

  function boot() {
    var prog = CL.Progression;
    prog.init();

    var s = prog.getSettings();
    document.documentElement.setAttribute('data-theme', s.theme);
    CL.I18N.setLanguage(s.lang);
    CL.Audio.setSound(s.sound);
    CL.Audio.setMusic(s.music);

    var ctx = {
      show: show,
      applyThemeToRenderer: applyThemeToRenderer,
      refreshAll: refreshAll,
      openGame: function (levelId) {
        CL.app.gameplay.open(levelId);
      }
    };

    document.addEventListener('pointerdown', function onFirst() {
      CL.Audio.unlock();
      var cur = CL.Progression.getSettings();
      if (cur.music) CL.Audio.startMusic();
      document.removeEventListener('pointerdown', onFirst);
    });

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        CL.Audio.play('tap');
        show(btn.getAttribute('data-nav'));
      });
    });

    document.addEventListener('contextmenu', function (e) {
      if (e.target && e.target.closest && e.target.closest('#board-canvas')) e.preventDefault();
    });

    refreshers.menu = CL.MainMenu.init(ctx);
    refreshers.levels = CL.LevelSelection.init(ctx);
    var gameplay = CL.GameplayScreen.init(ctx);
    refreshers.settings = CL.SettingsScreen.init(ctx);
    refreshers.stats = CL.StatsScreen.init(ctx);

    CL.app = { ctx: ctx, gameplay: gameplay, game: gameplay.game };

    var lastTick = Date.now();
    setInterval(function () {
      var now = Date.now();
      prog.addPlaytime(now - lastTick);
      lastTick = now;
    }, 30000);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        CL.Audio.stopMusic();
        var now = Date.now();
        prog.addPlaytime(now - lastTick);
        lastTick = now;
      } else {
        var cur = CL.Progression.getSettings();
        if (cur.music) CL.Audio.startMusic();
      }
    });

    show('menu');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})();
