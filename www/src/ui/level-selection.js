/* Color Link - Level selection with chapter navigation. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function init(ctx) {
    var grid = document.getElementById('levels-grid');
    var chip = document.getElementById('levels-progress-chip');
    var elTitle = document.getElementById('chapter-title');
    var elDesc = document.getElementById('chapter-desc');
    var elStars = document.getElementById('chapter-stars').querySelector('b');
    var elFill = document.getElementById('chapter-progress-fill');
    var elLabel = document.getElementById('chapter-progress-label');
    var btnPrev = document.getElementById('chapter-prev');
    var btnNext = document.getElementById('chapter-next');
    var T = function (k) { return CL.I18N.t(k); };
    var currentChapter = 1;

    function starRow(n) {
      var row = document.createElement('span');
      row.className = 'level-stars';
      for (var i = 0; i < 3; i++) {
        row.innerHTML += '<svg viewBox="0 0 24 24" class="ic xsmall"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z"' +
          (i < n ? ' fill="#FFD700"' : ' fill="#b9a5d6" opacity="0.5"') + '/></svg>';
      }
      return row;
    }

    function build() {
      var prog = CL.Progression;
      var ch = CL.Progression.chapterProgress(currentChapter);
      var chapters = CL.LevelManager.chapters();
      var meta = chapters[currentChapter - 1];
      var unlocked = prog.chapterUnlocked(currentChapter);

      chip.textContent = prog.completedCount() + '/' + prog.totalLevels();
      elTitle.textContent = T(meta.key) + ' \u00b7 ' + ch.from + '-' + ch.to;
      elDesc.textContent = unlocked ? T('chapter.desc.' + currentChapter) : T('levels.chapterLocked');
      elStars.textContent = ch.stars + '/' + ch.maxStars;
      elFill.style.width = ch.pct + '%';
      elLabel.textContent = ch.completed + '/' + ch.total;
      btnPrev.disabled = currentChapter <= 1;
      btnNext.disabled = currentChapter >= chapters.length;
      btnPrev.classList.toggle('disabled', btnPrev.disabled);
      btnNext.classList.toggle('disabled', btnNext.disabled);

      grid.innerHTML = '';
      var levels = CL.LevelManager.chapterLevels(currentChapter);
      levels.forEach(function (level) {
        var canPlay = unlocked && prog.isUnlocked(level.id);
        var best = prog.getBest(level.id);
        var stars = prog.stars(level.id);
        var card = document.createElement('button');
        card.className = 'level-card' +
          (canPlay ? '' : ' locked') +
          (best ? ' completed' : '') +
          (level.id === prog.currentLevel() && !best && canPlay ? ' current' : '');
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
        } else if (canPlay) {
          foot.textContent = level.pairs.length + '\u00d7';
        } else {
          foot.innerHTML = '<svg viewBox="0 0 24 24" class="ic small"><path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7z" fill="currentColor"/></svg>';
        }
        card.appendChild(num);
        card.appendChild(diff);
        if (best) card.appendChild(starRow(stars));
        card.appendChild(foot);
        card.addEventListener('click', function () {
          if (!canPlay) {
            CL.Audio.play('error');
            card.classList.add('shake');
            setTimeout(function () { card.classList.remove('shake'); }, 400);
            if (!unlocked) CL.Dialogs.toast(T('toast.lockedChapter'));
            return;
          }
          CL.Audio.play('tap');
          ctx.openGame(level.id);
        });
        grid.appendChild(card);
      });
    }

    btnPrev.addEventListener('click', function () {
      if (currentChapter <= 1) return;
      CL.Audio.play('tap');
      currentChapter--;
      build();
    });
    btnNext.addEventListener('click', function () {
      if (currentChapter >= CL.LevelManager.chapters().length) return;
      CL.Audio.play('tap');
      currentChapter++;
      build();
    });

    function openAt(chapterId) {
      currentChapter = Math.min(Math.max(1, chapterId || 1), CL.LevelManager.chapters().length);
      build();
    }

    return { build: build, openAt: openAt, chapter: function () { return currentChapter; } };
  }

  CL.LevelSelection = { init: init };
})();
