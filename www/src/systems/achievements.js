/* Color Link - Achievements.
   Progress is derived from real save data; rewards are duplicate-protected
   via the claimed registry. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var DEFS = [
    { id: 'first_connection', key: 'ach.firstConnection', icon: 'link', target: 1, reward: 20 },
    { id: 'puzzle_beginner', key: 'ach.beginner', icon: 'grid', target: 10, reward: 30 },
    { id: 'puzzle_expert', key: 'ach.expert', icon: 'grid', target: 50, reward: 60 },
    { id: 'perfect_player', key: 'ach.perfect', icon: 'star', target: 10, reward: 40 },
    { id: 'speed_solver', key: 'ach.speed', icon: 'clock', target: 1, reward: 30 },
    { id: 'master_connector', key: 'ach.master', icon: 'trophy', target: 1, reward: 50 },
    { id: 'star_collector', key: 'ach.stars', icon: 'star', target: 100, reward: 80 }
  ];

  function completedWithStars(n) {
    var completed = CL.Progression._state().completed;
    var count = 0;
    for (var id in completed) {
      if ((completed[id].stars || 0) >= n) count++;
    }
    return count;
  }

  function chaptersCompleted() {
    var chapters = CL.LevelManager.chapters();
    var n = 0;
    for (var c = 1; c <= chapters.length; c++) {
      var p = CL.Progression.chapterProgress(c);
      if (p.completed >= p.total) n++;
    }
    return n;
  }

  function timedCompleted() {
    var completed = CL.Progression._state().completed;
    var count = 0;
    for (var id in completed) {
      var lvl = CL.LevelManager.get(parseInt(id, 10));
      if (lvl && lvl.timeLimit) count++;
    }
    return count;
  }

  function progressValue(def) {
    switch (def.id) {
      case 'first_connection':
      case 'puzzle_beginner':
      case 'puzzle_expert':
        return CL.Progression.completedCount();
      case 'perfect_player':
        return completedWithStars(3);
      case 'speed_solver':
        return timedCompleted();
      case 'master_connector':
        return chaptersCompleted();
      case 'star_collector':
        return CL.Progression.totalStars();
      default:
        return 0;
    }
  }

  /* Returns array of newly unlocked achievement defs. */
  function check() {
    var newly = [];
    for (var i = 0; i < DEFS.length; i++) {
      var def = DEFS[i];
      if (CL.Progression.achievementUnlocked(def.id)) continue;
      if (progressValue(def) >= def.target) {
        CL.Progression.unlockAchievement(def.id);
        CL.Progression.claimOnce('ach_' + def.id, def.reward, 'achievement', def.id);
        newly.push(def);
      }
    }
    return newly;
  }

  function all() {
    return DEFS.map(function (def) {
      var value = Math.min(progressValue(def), def.target);
      return {
        id: def.id,
        key: def.key,
        icon: def.icon,
        target: def.target,
        reward: def.reward,
        value: value,
        unlocked: CL.Progression.achievementUnlocked(def.id)
      };
    });
  }

  CL.Achievements = {
    all: all,
    check: check,
    progressValue: progressValue
  };
})();
