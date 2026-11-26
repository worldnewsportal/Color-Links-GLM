/* Color Link - Level manager with structural validation. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var levels = CL.LEVELS || [];
  var cache = {};
  var solutionCache = {};

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

  function validate(level) {
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
    return { ok: errors.length === 0, errors: errors };
  }

  function isSolvable(level) {
    var res = CL.Solver.solve(level, { nodeLimit: 4000000 });
    return res.solved;
  }

  function solution(id) {
    if (solutionCache[id] !== undefined) return solutionCache[id];
    var level = get(id);
    if (!level) return null;
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
    validate: validate,
    isSolvable: isSolvable,
    solution: solution
  };
})();
