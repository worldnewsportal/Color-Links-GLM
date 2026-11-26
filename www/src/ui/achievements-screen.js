/* Color Link - Achievements screen. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var ICONS = {
    link: '<svg viewBox="0 0 24 24" class="ic"><path d="M8 12h8v2H8zm3-7h2v4h-2zm0 10h2v4h-2zM3 9h4v6H3zm14 0h4v6h-4zM5 11h2v2H5zm12 0h2v2h-2z" fill="currentColor"/></svg>',
    grid: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 4h7v7H4zm9 0h7v7h-7zm-9 9h7v7H4zm9 0h7v7h-7z" fill="currentColor"/></svg>',
    star: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z" fill="currentColor"/></svg>',
    clock: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 10.6 4 2.3-1 1.7-5-2.9V6h2v6.6z" fill="currentColor"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" class="ic"><path d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16v2h3v3H8v-3h3v-2a6 6 0 0 1-3.4-3A5 5 0 0 1 3 8V5h3V3zm-1 4v1a3 3 0 0 0 2 2.8V7H5zm14 0h-2v3.8A3 3 0 0 0 19 8V7z" fill="currentColor"/></svg>'
  };

  function init(ctx) {
    var list = document.getElementById('achievements-list');
    var T = function (k) { return CL.I18N.t(k); };

    function build() {
      var items = CL.Achievements.all();
      list.innerHTML = '';
      items.forEach(function (a) {
        var pct = Math.min(100, Math.round((a.value / a.target) * 100));
        var card = document.createElement('div');
        card.className = 'ach-card card' + (a.unlocked ? ' unlocked' : '');
        card.innerHTML =
          '<span class="ach-icon">' + (ICONS[a.icon] || ICONS.star) + '</span>' +
          '<div class="ach-body">' +
            '<div class="ach-head"><b>' + T(a.key) + '</b>' +
            '<span class="ach-reward"><svg viewBox="0 0 24 24" class="ic xsmall"><circle cx="12" cy="12" r="10" fill="#FFD700" stroke="#F5A300" stroke-width="2"/></svg>+' + a.reward + '</span></div>' +
            '<p class="ach-desc">' + T('ach.desc.' + a.id) + '</p>' +
            '<div class="ach-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="ach-count">' + a.value + '/' + a.target + '</span></div>' +
          '</div>' +
          '<span class="ach-state">' + (a.unlocked
            ? '<svg viewBox="0 0 24 24" class="ic"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="#4caf50"/></svg>'
            : '<svg viewBox="0 0 24 24" class="ic"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7z" fill="currentColor"/></svg>') + '</span>';
        list.appendChild(card);
      });
    }

    return { build: build };
  }

  CL.AchievementsScreen = { init: init };
})();
