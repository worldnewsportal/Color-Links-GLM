/* Color Link - Daily challenge screen: countdown, preview, start. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var elDate = document.getElementById('daily-date-label');
    var elDiff = document.getElementById('daily-difficulty');
    var elReward = document.getElementById('daily-reward');
    var elCountdown = document.getElementById('daily-countdown');
    var elCompleted = document.getElementById('daily-completed-label');
    var btnStart = document.getElementById('btn-start-daily');
    var canvas = document.getElementById('daily-canvas');
    var T = function (k) { return CL.I18N.t(k); };
    var tickId = null;

    function fmtCountdown(ms) {
      var s = Math.max(0, Math.floor(ms / 1000));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function drawPreview(level) {
      if (!level || typeof CL.Renderer !== 'function') return;
      var renderer = new CL.Renderer(canvas);
      var board = new CL.Board(level);
      var solution = level.solution;
      if (solution) {
        for (var c = 0; c < solution.length; c++) {
          board.paths[c] = solution[c] ? solution[c].slice() : null;
        }
      }
      renderer.layout(board);
      renderer.draw(board);
    }

    function refresh() {
      var info = CL.Daily.today();
      elReward.textContent = info.reward;
      if (!info.level) {
        elDate.textContent = '—';
        elDiff.textContent = '—';
        elCountdown.textContent = '--:--:--';
        elCompleted.hidden = false;
        elCompleted.querySelector('span').textContent = T('daily.unavailable');
        btnStart.disabled = true;
        btnStart.classList.add('disabled');
        return;
      }
      btnStart.disabled = false;
      btnStart.classList.remove('disabled');
      var months = {
        en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      };
      var lang = CL.I18N.language();
      var now = new Date();
      elDate.textContent = now.getDate() + ' ' + months[lang][now.getMonth()];
      elDiff.textContent = T('difficulty.' + info.level.difficulty);
      elCompleted.hidden = !info.completed;
      drawPreview(info.level);
    }

    function startTick() {
      if (tickId) clearInterval(tickId);
      tickId = setInterval(function () {
        if (!document.getElementById('screen-daily').classList.contains('active')) {
          clearInterval(tickId);
          tickId = null;
          return;
        }
        elCountdown.textContent = fmtCountdown(CL.Daily.countdownMs());
      }, 1000);
      elCountdown.textContent = fmtCountdown(CL.Daily.countdownMs());
    }

    btnStart.addEventListener('click', function () {
      if (btnStart.disabled) return;
      CL.Audio.play('tap');
      var info = CL.Daily.today();
      if (!info.level) return;
      ctx.openDailyLevel(info.level);
    });

    return { refresh: refresh, startTick: startTick };
  }

  CL.DailyScreen = { init: init };
})();
