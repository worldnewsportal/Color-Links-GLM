/* Color Link - Modal dialogs, level-complete overlay, toasts. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var T = function (k) { return CL.I18N.t(k); };

  function buildOverlay(className) {
    var root = document.getElementById('dialog-root');
    var overlay = document.createElement('div');
    overlay.className = 'overlay' + (className ? ' ' + className : '');
    var card = document.createElement('div');
    card.className = 'dialog card';
    overlay.appendChild(card);
    root.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('show'); });
    return { overlay: overlay, card: card };
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('show');
    setTimeout(function () { overlay.remove(); }, 220);
  }

  function confirm(opts) {
    return new Promise(function (resolve) {
      var built = buildOverlay();
      var card = built.card;
      var h = document.createElement('h3');
      h.textContent = opts.title;
      var p = document.createElement('p');
      p.className = 'dialog-msg';
      p.textContent = opts.message;
      var row = document.createElement('div');
      row.className = 'dialog-actions';
      var cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost';
      cancel.textContent = opts.cancelText || T('common.cancel');
      var ok = document.createElement('button');
      ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      ok.textContent = opts.okText || T('common.confirm');
      row.appendChild(cancel);
      row.appendChild(ok);
      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(row);
      function done(val) {
        built.overlay.removeEventListener('click', onBackdrop);
        closeOverlay(built.overlay);
        resolve(val);
      }
      function onBackdrop(e) {
        if (e.target === built.overlay) done(false);
      }
      built.overlay.addEventListener('click', onBackdrop);
      cancel.addEventListener('click', function () { CL.Audio.play('tap'); done(false); });
      ok.addEventListener('click', function () { CL.Audio.play('tap'); done(true); });
    });
  }

  function starSvg(dim) {
    return '<svg viewBox="0 0 24 24" class="ic"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"' +
      (dim ? ' fill="#9e9e9e" opacity="0.45"' : ' fill="#FFD700" class="win-star-lit"') + '/></svg>';
  }

  function levelComplete(result, actions) {
    var built = buildOverlay('win-overlay');
    var card = built.card;
    var T2 = CL.I18N.t;

    var earned = result.stars || 1;
    var stars = document.createElement('div');
    stars.className = 'win-stars';
    stars.innerHTML =
      starSvg(earned < 1) + starSvg(earned < 2) + starSvg(earned < 3);
    var h = document.createElement('h3');
    h.className = 'win-title';
    h.textContent = earned >= 3 ? T2('win.perfect') : T2('win.title');
    var sub = document.createElement('p');
    sub.className = 'win-sub';
    sub.textContent = T2('game.level') + ' ' + result.levelId;

    var row = document.createElement('div');
    row.className = 'win-stats';
    var mv = document.createElement('div');
    mv.className = 'win-stat';
    mv.innerHTML = '<b>' + result.moves + '</b><span>' + T2('win.moves') + '</span>';
    var tm = document.createElement('div');
    tm.className = 'win-stat';
    tm.innerHTML = '<b>' + formatTime(result.timeSec) + '</b><span>' + T2('win.time') + '</span>';
    row.appendChild(mv);
    row.appendChild(tm);

    var summary = actions.summary || null;

    var actionsRow = document.createElement('div');
    actionsRow.className = 'dialog-actions';

    function btn(label, cls, fn) {
      var b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = label;
      b.addEventListener('click', function () { CL.Audio.play('tap'); closeOverlay(built.overlay); fn(); });
      return b;
    }

    if (actions.onNext) actionsRow.appendChild(btn(T2('win.next'), 'btn-primary', actions.onNext));
    actionsRow.appendChild(btn(T2('win.replay'), 'btn-secondary', actions.onReplay));
    actionsRow.appendChild(btn(T2('win.menu'), 'btn-ghost', actions.onMenu));

    card.appendChild(stars);
    card.appendChild(h);
    card.appendChild(sub);
    if (summary && summary.coinsEarned > 0) {
      var coinsLine = document.createElement('div');
      coinsLine.className = 'win-coins';
      coinsLine.innerHTML =
        '<svg viewBox="0 0 24 24" class="ic small"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#F5A300" stroke-width="2"/></svg>' +
        '<b>+' + summary.coinsEarned + '</b><span>' + T2('win.coins') + '</span>';
      card.appendChild(coinsLine);
    }
    card.appendChild(row);
    card.appendChild(actionsRow);
  }

  function timeout(actions) {
    var built = buildOverlay();
    var card = built.card;
    var h = document.createElement('h3');
    h.textContent = T('game.timeoutTitle');
    var p = document.createElement('p');
    p.className = 'dialog-msg';
    p.textContent = T('game.timeoutMessage');
    var row = document.createElement('div');
    row.className = 'dialog-actions';
    var menu = document.createElement('button');
    menu.className = 'btn btn-ghost';
    menu.textContent = T('win.menu');
    var retry = document.createElement('button');
    retry.className = 'btn btn-primary';
    retry.textContent = T('game.retry');
    row.appendChild(menu);
    row.appendChild(retry);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(row);
    function close() { closeOverlay(built.overlay); }
    menu.addEventListener('click', function () { CL.Audio.play('tap'); close(); actions.onMenu(); });
    retry.addEventListener('click', function () { CL.Audio.play('tap'); close(); actions.onRetry(); });
  }

  function rewardToast(message, coins) {
    var root = document.getElementById('dialog-root');
    var el = document.createElement('div');
    el.className = 'toast toast-reward';
    el.innerHTML =
      '<svg viewBox="0 0 24 24" class="ic small"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#F5A300" stroke-width="2"/></svg>' +
      '<span>' + message + '</span>' +
      (coins ? '<b>+' + coins + '</b>' : '');
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 2600);
  }

  function toast(message) {
    var root = document.getElementById('dialog-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    root.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, 2200);
  }

  function formatTime(sec) {
    sec = Math.max(0, sec | 0);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  CL.Dialogs = {
    confirm: confirm,
    levelComplete: levelComplete,
    timeout: timeout,
    toast: toast,
    rewardToast: rewardToast,
    formatTime: formatTime
  };
})();
