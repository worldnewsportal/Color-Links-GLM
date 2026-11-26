/* Color Link - Level manager (Phase 2): merged level sets, chapters,
   star criteria, deep validation with witness verification. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var levels = (CL.LEVELS || []).concat(CL.LEVELS2 || []);
  var cache = {};
  var solutionCache = {};
  var starsCache = {};
  var validCache = {};

  var CHAPTERS = [
    { id: 1, key: 'chapter.1', from: 1, to: 26 },
    { id: 2, key: 'chapter.2', from: 27, to: 52 },
    { id: 3, key: 'chapter.3', from: 53, to: 78 },
    { id: 4, key: 'chapter.4', from: 79, to: 104 },
    { id: 5, key: 'chapter.5', from: 105, to: 130 }
  ];

  function all() { return levels; }

  function count() { return levels.length; }

  function get(id) {
    if (cache[id]) return cache[id];
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].id === id) {
        cache[id] = levels[i];
        return levels[i];
      }
    }
    return null;
  }

  function next(id) {
    var n = get(id + 1);
    return n ? n.id : null;
  }

  function difficulty(id) {
    var lvl = get(id);
    return lvl ? lvl.difficulty : 'easy';
  }

  function chapterOf(id) {
    for (var i = CHAPTERS.length - 1; i >= 0; i--) {
      if (id >= CHAPTERS[i].from) return CHAPTERS[i];
    }
    return CHAPTERS[0];
  }

  function chapters() { return CHAPTERS; }

  function chapterLevels(chapterId) {
    var ch = CHAPTERS[chapterId - 1];
    var out = [];
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].id >= ch.from && levels[i].id <= ch.to) out.push(levels[i]);
    }
    return out;
  }

  /* Star criteria (move thresholds). Generated levels carry their own;
     Phase 1 levels derive them lazily from the verified solution. */
  function starCriteria(id) {
    if (starsCache[id]) return starsCache[id];
    var lvl = get(id);
    if (!lvl) return null;
    if (lvl.stars && lvl.stars.two && lvl.stars.three) {
      starsCache[id] = lvl.stars;
      return lvl.stars;
    }
    var sol = solution(id);
    if (!sol) return null;
    var opt = 0;
    for (var i = 0; i < sol.length; i++) {
      if (sol[i]) opt += sol[i].length - 1;
    }
    var three = opt + 2;
    var two = Math.max(three + 4, Math.round(opt * 1.75) + 4);
    starsCache[id] = { two: two, three: three };
    return starsCache[id];
  }

  function starsFor(id, moves) {
    var crit = starCriteria(id);
    if (!crit) return 1;
    if (moves <= crit.three) return 3;
    if (moves <= crit.two) return 2;
    return 1;
  }

  function isCellFreeOf(level, idx, x, y) {
    var w = level.w, h = level.h;
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    for (var p = 0; p < level.pairs.length; p++) {
      var pair = level.pairs[p];
      if ((pair[0] === x && pair[1] === y) || (pair[2] === x && pair[3] === y)) return false;
    }
    var obstacles = level.obstacles || [];
    for (var o = 0; o < obstacles.length; o++) {
      if (obstacles[o][0] === x && obstacles[o][1] === y) return false;
    }
    return true;
  }

  function validate(level) {
    var key = level && level.id;
    if (key && validCache[key]) return validCache[key];
    var errors = [];
    if (!level || typeof level !== 'object') return { ok: false, errors: ['not an object'] };
    var w = level.w, h = level.h;
    if (!Number.isInteger(w) || w < 4 || w > 12) errors.push('bad width');
    if (!Number.isInteger(h) || h < 4 || h > 12) errors.push('bad height');
    if (!Array.isArray(level.pairs) || level.pairs.length < 1 || level.pairs.length > 8) {
      errors.push('bad pair count');
      return { ok: false, errors: errors };
    }
    var seen = {};
    var obstacles = level.obstacles || [];
    for (var o = 0; o < obstacles.length; o++) {
      var ox = obstacles[o][0], oy = obstacles[o][1];
      if (ox < 0 || oy < 0 || ox >= w || oy >= h) errors.push('obstacle out of bounds');
      else seen[oy * w + ox] = 'obstacle';
    }
    for (var p = 0; p < level.pairs.length; p++) {
      var pair = level.pairs[p];
      if (!Array.isArray(pair) || pair.length !== 4) { errors.push('bad pair format'); continue; }
      var cells = [];
      for (var e = 0; e < 4; e += 2) {
        var x = pair[e], y = pair[e + 1];
        if (x < 0 || y < 0 || x >= w || y >= h) { errors.push('endpoint out of bounds'); continue; }
        var idx = y * w + x;
        if (seen[idx]) errors.push('cell overlap at ' + x + ',' + y);
        seen[idx] = 'endpoint';
        cells.push(idx);
      }
      if (cells.length === 2 && cells[0] === cells[1]) errors.push('pair endpoints identical');
      if (cells.length === 2) {
        var ax = cells[0] % w, ay = (cells[0] / w) | 0;
        var bx = cells[1] % w, by = (cells[1] / w) | 0;
        if (Math.abs(ax - bx) + Math.abs(ay - by) < 1) errors.push('pair endpoints identical');
      }
    }
    var i, item, cx, cy, cidx;
    var bridges = level.bridges || [];
    for (i = 0; i < bridges.length; i++) {
      cx = bridges[i][0]; cy = bridges[i][1];
      if (!isCellFreeOf(level, cx + cy * w, cx, cy)) errors.push('bridge on occupied cell');
      else seen[cy * w + cx] = 'bridge';
    }
    var teleports = level.teleports || [];
    for (i = 0; i < teleports.length; i++) {
      var t = teleports[i];
      var a = [t[0], t[1]], b = [t[2], t[3]];
      if (a[0] === b[0] && a[1] === b[1]) { errors.push('teleport twins identical'); continue; }
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 2) errors.push('teleport twins adjacent');
      var ta = t[1] * w + t[0], tb = t[3] * w + t[2];
      if (!isCellFreeOf(level, ta, a[0], a[1]) || !isCellFreeOf(level, tb, b[0], b[1])) {
        errors.push('teleport on occupied cell');
        continue;
      }
      if (seen[ta] || seen[tb]) errors.push('teleport overlaps another tile');
      seen[ta] = 'teleport';
      seen[tb] = 'teleport';
    }
    var directionals = level.directionals || [];
    for (i = 0; i < directionals.length; i++) {
      item = directionals[i];
      cx = item.cell[0]; cy = item.cell[1];
      cidx = cy * w + cx;
      if (!isCellFreeOf(level, cidx, cx, cy)) { errors.push('directional on occupied cell'); continue; }
      if (CL.Mechanics.DIR_ORDER.indexOf(item.dir) === -1) { errors.push('bad directional dir'); continue; }
      if (seen[cidx]) errors.push('directional overlaps another tile');
      seen[cidx] = 'directional';
    }
    var restricted = level.restricted || [];
    for (i = 0; i < restricted.length; i++) {
      item = restricted[i];
      cx = item.cell[0]; cy = item.cell[1];
      cidx = cy * w + cx;
      if (!isCellFreeOf(level, cidx, cx, cy)) { errors.push('restricted on occupied cell'); continue; }
      if (!Array.isArray(item.dirs) || !item.dirs.length) { errors.push('bad restricted dirs'); continue; }
      for (var d = 0; d < item.dirs.length; d++) {
        if (CL.Mechanics.DIR_ORDER.indexOf(item.dirs[d]) === -1) errors.push('bad restricted dir');
      }
      if (item.dirs.length >= 4) errors.push('restricted forbids all exits');
      if (seen[cidx]) errors.push('restricted overlaps another tile');
      seen[cidx] = 'restricted';
    }
    var locks = level.locks || [];
    for (i = 0; i < locks.length; i++) {
      item = locks[i];
      cx = item.cell[0]; cy = item.cell[1];
      cidx = cy * w + cx;
      if (!isCellFreeOf(level, cidx, cx, cy)) { errors.push('lock on occupied cell'); continue; }
      if (!Number.isInteger(item.color) || item.color < 0 || item.color >= level.pairs.length) {
        errors.push('bad lock color');
        continue;
      }
      if (seen[cidx]) errors.push('lock overlaps another tile');
      seen[cidx] = 'lock';
    }
    if (level.timeLimit !== undefined && (!Number.isInteger(level.timeLimit) || level.timeLimit < 15)) {
      errors.push('bad timeLimit');
    }
    if (level.stars && (!Number.isInteger(level.stars.two) || !Number.isInteger(level.stars.three) || level.stars.three >= level.stars.two)) {
      errors.push('bad star criteria');
    }

    /* Witness verification: a stored solution must itself be valid. */
    if (Array.isArray(level.solution)) {
      var v = CL.Solver.verifyPaths(level, level.solution);
      if (!v.ok) errors.push.apply(errors, v.errors);
    }

    var result = { ok: errors.length === 0, errors: errors };
    if (key) validCache[key] = result;
    return result;
  }

  function isSolvable(level) {
    if (Array.isArray(level.solution)) {
      var v = CL.Solver.verifyPaths(level, level.solution);
      return v.ok;
    }
    var res = CL.Solver.solve(level, { nodeLimit: 4000000 });
    return res.solved;
  }

  /* Verified solution: stored witness first, solver otherwise. */
  function solution(id) {
    if (solutionCache[id] !== undefined) return solutionCache[id];
    var level = get(id);
    if (!level) return null;
    if (Array.isArray(level.solution)) {
      var v = CL.Solver.verifyPaths(level, level.solution);
      solutionCache[id] = v.ok ? level.solution : null;
      return solutionCache[id];
    }
    var res = CL.Solver.solve(level, { nodeLimit: 4000000 });
    solutionCache[id] = res.solved ? res.paths : null;
    return solutionCache[id];
  }

  CL.LevelManager = {
    all: all,
    count: count,
    get: get,
    next: next,
    difficulty: difficulty,
    chapterOf: chapterOf,
    chapters: chapters,
    chapterLevels: chapterLevels,
    starCriteria: starCriteria,
    starsFor: starsFor,
    validate: validate,
    isSolvable: isSolvable,
    solution: solution
  };
})();
