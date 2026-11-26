/* Color Link - Settings screen. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var T = function (k) { return CL.I18N.t(k); };
    var elSound = document.getElementById('set-sound');
    var elMusic = document.getElementById('set-music');
    var elVib = document.getElementById('set-vibration');
    var segLang = document.getElementById('set-language');
    var segTheme = document.getElementById('set-theme');

    function syncSeg(seg, value) {
      var buttons = seg.querySelectorAll('button');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', buttons[i].getAttribute('data-value') === value);
      }
    }

    function refresh() {
      var s = CL.Progression.getSettings();
      elSound.checked = s.sound;
      elMusic.checked = s.music;
      elVib.checked = s.vibration;
      syncSeg(segLang, s.lang);
      syncSeg(segTheme, s.theme);
    }

    elSound.addEventListener('change', function () {
      CL.Progression.setSetting('sound', elSound.checked);
      CL.Audio.setSound(elSound.checked);
      if (elSound.checked) CL.Audio.play('tap');
    });
    elMusic.addEventListener('change', function () {
      CL.Progression.setSetting('music', elMusic.checked);
      CL.Audio.setMusic(elMusic.checked);
    });
    elVib.addEventListener('change', function () {
      CL.Progression.setSetting('vibration', elVib.checked);
      if (elVib.checked && navigator.vibrate) {
        try { navigator.vibrate(30); } catch (e) { /* ignore */ }
      }
    });
    segLang.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      CL.Audio.play('tap');
      var lang = btn.getAttribute('data-value');
      CL.Progression.setSetting('lang', lang);
      CL.I18N.setLanguage(lang);
      refresh();
    });
    segTheme.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      CL.Audio.play('tap');
      var theme = btn.getAttribute('data-value');
      CL.Progression.setSetting('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      ctx.applyThemeToRenderer(theme);
      refresh();
    });

    document.getElementById('btn-reset').addEventListener('click', function () {
      CL.Audio.play('tap');
      CL.Dialogs.confirm({
        title: T('reset.title'),
        message: T('reset.message'),
        okText: T('common.confirm'),
        cancelText: T('common.cancel'),
        danger: true
      }).then(function (yes) {
        if (!yes) return;
        CL.Progression.resetAll();
        var s = CL.Progression.getSettings();
        CL.Audio.setSound(s.sound);
        CL.Audio.setMusic(s.music);
        document.documentElement.setAttribute('data-theme', s.theme);
        CL.I18N.setLanguage(s.lang);
        ctx.applyThemeToRenderer(s.theme);
        ctx.refreshAll();
        CL.Dialogs.toast(T('reset.done'));
        CL.Audio.play('tap');
      });
    });

    return { refresh: refresh };
  }

  CL.SettingsScreen = { init: init };
})();
