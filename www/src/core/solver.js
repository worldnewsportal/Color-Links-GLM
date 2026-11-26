/* Color Link - Flow solver (shared by runtime hints and the level validator). */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function buildMask(level) {
    var w = level.w, h = level.h;
    var blocked = new Uint8Array(w * h);
    var reserved = new Int8Array(w * h).fill(-1);
    var obstacles = level.obstacles || [];
    for (var i = 0; i < obstacles.length; i++) {
      blocked[obstacles[i][1] * w + obstacles[i][0]] = 1;
    }
    for (var p = 0; p < level.pairs.length; p++) {
      var pair = level.pairs[p];
      reserved[pair[1] * w + pair[0]] = p;
      reserved[pair[3] * w + pair[2]] = p;
    }
    return { blocked: blocked, reserved: reserved };
  }

  function solve(level, opts) {
    opts = opts || {};
    var nodeLimit = opts.nodeLimit || 4000000;
    var w = level.w, h = level.h;
    var mask = buildMask(level);
    var blocked = mask.blocked, reserved = mask.reserved;
    var pairs = level.pairs;
    var count = pairs.length;
    var cells = w * h;

    var owner = new Int8Array(cells).fill(-1);
    var startIdx = new Int32Array(count), goalIdx = new Int32Array(count);
    for (var p = 0; p < count; p++) {
      startIdx[p] = pairs[p][1] * w + pairs[p][0];
      goalIdx[p] = pairs[p][3] * w + pairs[p][2];
      owner[startIdx[p]] = p;
      owner[goalIdx[p]] = p;
    }

    var nodes = 0;
    var aborted = false;
    var result = null;
    var placed = new Uint8Array(count);
    var paths = [];

    function freeCell(cell, color) {
      if (blocked[cell]) return false;
      return owner[cell] === -1 || owner[cell] === color;
    }

    function reachable(color) {
      var from = startIdx[color], to = goalIdx[color];
      var queue = new Int32Array(cells);
      var seen = new Uint8Array(cells);
      var head = 0, tail = 0;
      queue[tail++] = from;
      seen[from] = 1;
      while (head < tail) {
        var cell = queue[head++];
        if (cell === to) return true;
        var x = cell % w, y = (cell / w) | 0;
        if (x > 0 && !seen[cell - 1] && freeCell(cell - 1, color)) { seen[cell - 1] = 1; queue[tail++] = cell - 1; }
        if (x < w - 1 && !seen[cell + 1] && freeCell(cell + 1, color)) { seen[cell + 1] = 1; queue[tail++] = cell + 1; }
        if (y > 0 && !seen[cell - w] && freeCell(cell - w, color)) { seen[cell - w] = 1; queue[tail++] = cell - w; }
        if (y < h - 1 && !seen[cell + w] && freeCell(cell + w, color)) { seen[cell + w] = 1; queue[tail++] = cell + w; }
      }
      return false;
    }

    function pickNextPair() {
      var best = -1, bestScore = Infinity;
      for (var c = 0; c < count; c++) {
        if (placed[c]) continue;
        var options = 0;
        var ends = [startIdx[c], goalIdx[c]];
        for (var e = 0; e < 2; e++) {
          var cell = ends[e];
          var x = cell % w, y = (cell / w) | 0;
          if (x > 0 && freeCell(cell - 1, c)) options++;
          if (x < w - 1 && freeCell(cell + 1, c)) options++;
          if (y > 0 && freeCell(cell - w, c)) options++;
          if (y < h - 1 && freeCell(cell + w, c)) options++;
        }
        var dist = Math.abs(pairs[c][0] - pairs[c][2]) + Math.abs(pairs[c][1] - pairs[c][3]);
        var score = options * 1000 + dist;
        if (score < bestScore) { bestScore = score; best = c; }
      }
      return best;
    }

    function enumerate(color, current, visited, path, goal, emit) {
      if (nodes++ > nodeLimit) { aborted = true; return false; }
      var gx = goal % w, gy = (goal / w) | 0;
      var x = current % w, y = (current / w) | 0;
      var cand = [];
      if (x > 0) cand.push(cell_score(x - 1, y));
      if (x < w - 1) cand.push(cell_score(x + 1, y));
      if (y > 0) cand.push(cell_score(x, y - 1));
      if (y < h - 1) cand.push(cell_score(x, y + 1));

      function cell_score(nx, ny) {
        var cell = ny * w + nx;
        var d = Math.abs(nx - gx) + Math.abs(ny - gy);
        return { cell: cell, d: d };
      }

      cand.sort(function (a, b) { return a.d - b.d; });

      for (var n = 0; n < cand.length; n++) {
        var cell = cand[n].cell;
        if (visited[cell]) continue;
        if (cell === goal) {
          path.push(goal);
          if (emit()) return true;
          path.pop();
          if (aborted) return false;
          continue;
        }
        if (!freeCell(cell, color)) continue;
        visited[cell] = 1;
        path.push(cell);
        if (enumerate(color, cell, visited, path, goal, emit)) return true;
        path.pop();
        visited[cell] = 0;
        if (aborted) return false;
      }
      return false;
    }

    function tryNext() {
      if (aborted) return false;
      var color = pickNextPair();
      if (color === -1) return true;
      if (!reachable(color)) return false;
      var visited = new Uint8Array(cells);
      visited[startIdx[color]] = 1;
      var path = [startIdx[color]];
      var emit = function () {
        for (var k = 0; k < path.length; k++) owner[path[k]] = color;
        paths[color] = path.slice();
        placed[color] = 1;
        if (tryNext()) return true;
        placed[color] = 0;
        delete paths[color];
        for (var k2 = 0; k2 < path.length; k2++) {
          if (path[k2] !== startIdx[color] && path[k2] !== goalIdx[color]) owner[path[k2]] = -1;
        }
        return false;
      };
      return enumerate(color, startIdx[color], visited, path, goalIdx[color], emit);
    }

    var solved = false;
    try { solved = tryNext() && !aborted; } catch (e) { solved = false; }
    var out = null;
    if (solved) {
      out = [];
      for (var i = 0; i < count; i++) out.push(paths[i] || null);
    }
    return { solved: solved, paths: out, nodes: nodes, aborted: aborted };
  }

  CL.Solver = {
    solve: solve,
    buildMask: buildMask
  };
})();
