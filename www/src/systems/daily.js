/* Color Link - Daily challenges.
   One deterministic offline puzzle per calendar day (device-local date),
   generated at runtime with a seeded RNG and verified by the solver.
   One reward per day, duplicate-protected in the save. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var cache = {};

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function seedFor(key) {
    var parts = key.split('-');
    return (parseInt(parts[0], 10) * 10000) + (parseInt(parts[1], 10) * 100) + parseInt(parts[2], 10);
  }

  function shuffled(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function manhattan(w, a, b) {
    return Math.abs((a % w) - (b % w)) + Math.abs(((a / w) | 0) - ((b / w) | 0));
  }

  /* Deterministic 6x6 / 4-pair puzzle for a given date key. */
  function buildLevel(key) {
    if (cache[key]) return cache[key];
    var w = 6, h = 6, nPairs = 4;
    var base = seedFor(key);
    for (var offset = 0; offset < 60; offset++) {
      var rng = mulberry32(base * 31 + offset * 7 + 5);
      var cells = shuffled(rng, Array.from({ length: w * h }, function (_, i) { return i; }));
      var chosen = [];
      for (var i = 0; i < cells.length && chosen.length < nPairs * 2; i++) {
        var c = cells[i];
        var ok = true;
        for (var u = 0; u < chosen.length; u++) {
          if (manhattan(w, c, chosen[u]) < 2) { ok = false; break; }
        }
        if (ok) chosen.push(c);
      }
      if (chosen.length < nPairs * 2) continue;
      var pool = shuffled(rng, chosen);
      var pairs = [];
      var good = true;
      for (var p = 0; p < nPairs; p++) {
        var a = pool[2 * p], b = pool[2 * p + 1];
        if (manhattan(w, a, b) < 3) { good = false; break; }
        pairs.push([a % w, (a / w) | 0, b % w, (b / w) | 0]);
      }
      if (!good) continue;
      var level = { id: 'daily', w: w, h: h, pairs: pairs, difficulty: 'medium', daily: true, dateKey: key };
      var res = CL.Solver.solve(level, { nodeLimit: 600000 });
      if (!res.solved) continue;
      var opt = 0;
      for (var pi = 0; pi < res.paths.length; pi++) opt += res.paths[pi].length - 1;
      if (opt < 16) continue;
      level.solution = res.paths;
      var three = opt + 2;
      level.stars = { two: Math.max(three + 4, Math.round(opt * 1.75) + 4), three: three };
      level.difficulty = opt < 20 ? 'easy' : (opt < 27 ? 'medium' : 'hard');
      var v = CL.Solver.verifyPaths(level, res.paths);
      if (!v.ok) continue;
      cache[key] = level;
      return level;
    }
    return null;
  }

  function countdownMs() {
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return next.getTime() - now.getTime();
  }

  function today() {
    var key = dateKey();
    var level = buildLevel(key);
    return {
      key: key,
      level: level,
      completed: CL.Progression.dailyDone(key),
      reward: CL.Coins.DAILY_REWARD,
      countdownMs: countdownMs()
    };
  }

  function complete() {
    var info = today();
    if (!info.level) return null;
    return CL.Progression.completeDaily(info.key, CL.Coins.DAILY_REWARD);
  }

  CL.Daily = {
    dateKey: dateKey,
    today: today,
    complete: complete,
    countdownMs: countdownMs,
    buildLevel: buildLevel
  };
})();
