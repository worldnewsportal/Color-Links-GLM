/* Color Link - EN/AR localization with RTL support. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var STRINGS = {
    en: {
      appName: 'COLOR LINK',
      tagline: 'Connect the colors',
      'menu.play': 'PLAY',
      'menu.continue': 'Continue',
      'menu.levels': 'Levels',
      'menu.settings': 'Settings',
      'menu.stats': 'Statistics',
      'menu.progress': 'Progress',
      'menu.currentLevel': 'Level',
      'menu.completed': 'completed',
      'menu.enjoy': 'Enjoy the game!',
      'levels.title': 'Select Level',
      'levels.locked': 'Locked',
      'difficulty.easy': 'Easy',
      'difficulty.medium': 'Medium',
      'difficulty.hard': 'Hard',
      'game.moves': 'Moves',
      'game.time': 'Time',
      'game.connected': 'Connected',
      'game.hintText': 'Drag between matching dots to connect them',
      'game.level': 'Level',
      'win.title': 'Well done!',
      'win.perfect': 'Perfect!',
      'win.moves': 'Moves',
      'win.time': 'Time',
      'win.next': 'Next Level',
      'win.replay': 'Replay',
      'win.menu': 'Menu',
      'settings.title': 'Settings',
      'settings.sound': 'Sound effects',
      'settings.music': 'Background music',
      'settings.vibration': 'Vibration',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'settings.reset': 'Reset progress',
      'reset.title': 'Reset Progress?',
      'reset.message': 'All completed levels, records and statistics will be permanently deleted. This cannot be undone.',
      'reset.done': 'Progress has been reset',
      'common.cancel': 'Cancel',
      'common.confirm': 'Reset',
      'common.on': 'On',
      'common.off': 'Off',
      'stats.title': 'Statistics',
      'stats.completed': 'Levels completed',
      'stats.current': 'Current level',
      'stats.playtime': 'Total playtime',
      'stats.moves': 'Total moves',
      'stats.hints': 'Hints used',
      'stats.sessions': 'Sessions',
      'stats.coins': 'Coins',
      'levels.cleared': 'All levels completed!',
      'toast.noHints': 'No hints left for this level'
    },
    ar: {
      appName: 'كولور لينك',
      tagline: 'وصّل الألوان',
      'menu.play': 'العب',
      'menu.continue': 'متابعة',
      'menu.levels': 'المستويات',
      'menu.settings': 'الإعدادات',
      'menu.stats': 'الإحصائيات',
      'menu.progress': 'التقدّم',
      'menu.enjoy': 'استمتع باللعبة!',
      'menu.currentLevel': 'المستوى',
      'menu.completed': 'مكتمل',
      'levels.title': 'اختر المستوى',
      'levels.locked': 'مقفل',
      'difficulty.easy': 'سهل',
      'difficulty.medium': 'متوسط',
      'difficulty.hard': 'صعب',
      'game.moves': 'الحركات',
      'game.time': 'الوقت',
      'game.connected': 'متصلة',
      'game.hintText': 'اسحب بين النقطتين المتشابهتين لتوصيلهما',
      'game.level': 'المستوى',
      'win.title': 'أحسنت!',
      'win.perfect': 'ممتاز!',
      'win.moves': 'الحركات',
      'win.time': 'الوقت',
      'win.next': 'المستوى التالي',
      'win.replay': 'إعادة',
      'win.menu': 'القائمة',
      'settings.title': 'الإعدادات',
      'settings.sound': 'المؤثرات الصوتية',
      'settings.music': 'الموسيقى',
      'settings.vibration': 'الاهتزاز',
      'settings.language': 'اللغة',
      'settings.theme': 'المظهر',
      'settings.reset': 'إعادة تعيين التقدّم',
      'reset.title': 'إعادة تعيين التقدّم؟',
      'reset.message': 'سيتم حذف جميع المستويات المكتملة والأرقام القياسية والإحصائيات نهائياً. لا يمكن التراجع عن هذا الإجراء.',
      'reset.done': 'تمت إعادة التعيين',
      'common.cancel': 'إلغاء',
      'common.confirm': 'إعادة تعيين',
      'common.on': 'مفعل',
      'common.off': 'معطل',
      'stats.title': 'الإحصائيات',
      'stats.completed': 'مستويات مكتملة',
      'stats.current': 'المستوى الحالي',
      'stats.playtime': 'إجمالي وقت اللعب',
      'stats.moves': 'إجمالي الحركات',
      'stats.hints': 'التلميحات المستخدمة',
      'stats.sessions': 'الجلسات',
      'stats.coins': 'العملات',
      'levels.cleared': 'أكملت جميع المستويات!',
      'toast.noHints': 'لا توجد تلميحات متبقية لهذا المستوى'
    }
  };

  var current = 'en';

  function t(key) {
    var dict = STRINGS[current] || STRINGS.en;
    return dict[key] !== undefined ? dict[key] : (STRINGS.en[key] !== undefined ? STRINGS.en[key] : key);
  }

  function language() { return current; }

  function setLanguage(lang) {
    current = STRINGS[lang] ? lang : 'en';
    if (typeof document !== 'undefined') {
      var html = document.documentElement;
      html.setAttribute('lang', current);
      html.setAttribute('dir', current === 'ar' ? 'rtl' : 'ltr');
      applyToDOM();
    }
    return current;
  }

  function applyToDOM() {
    if (typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.textContent = t(el.getAttribute('data-i18n'));
    }
  }

  CL.I18N = {
    t: t,
    setLanguage: setLanguage,
    language: language,
    applyToDOM: applyToDOM,
    strings: STRINGS
  };
})();
