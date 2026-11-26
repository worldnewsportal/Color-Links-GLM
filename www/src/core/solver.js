/* Color Link - Flow solver (Phase 2).
   Supports obstacles, bridges (max two colors per cell), teleport jumps,
   directional tiles, restricted exits, locked cells (key-pair order
   dependency) and full-board goals. Shared by runtime hints, the level
   validator and the level generator. */
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
    var requireFullBoard = !!opts.fullBoard;
    var w = level.w, h = level.h;
    var mask = buildMask(level);
    var blocked = mask.blocked, reserved = mask.reserved;
    var pairs = level.pairs;
    var count = pairs.length;
    var cells = w * h;
    var mech = new CL.Mechanics(level);

    var occA = new Int8Array(cells).fill(-1);
    var occB = new Int8Array(cells).fill(-1);
    var startIdx = new Int32Array(count), goalIdx = new Int32Array(count);
    for (var p = 0; p < count; p++) {
      startIdx[p] = pairs[p][1] * w + pairs[p][0];
      goalIdx[p] = pairs[p][3] * w + pairs[p][2];
      occA[startIdx[p]] = p;
      occA[goalIdx[p]] = p;
    }

    var nodes = 0;
    var aborted = false;
    /* Pair-order search matters only when locked cells create order
       dependencies; otherwise always drawing the most-constrained pair
       first is complete and far faster. */
    var hasLocks = !!(level.locks && level.locks.length);
    var placed = new Uint8Array(count);
    var paths = [];
    var freeTarget = mech.freeCells;

    function freeCell(cell, color) {
      if (blocked[cell]) return false;
      var ep = reserved[cell];
      if (ep !== -1 && ep !== color) return false;
      var lock = mech.lockKey[cell];
      if (lock !== -1 && !placed[lock]) return false;
      var a = occA[cell];
      if (a === -1) return true;
      if (a === color) return true;
      if (mech.bridge[cell] && occB[cell] === -1) return true;
      return false;
    }

    function coveredCount() {
      var n = 0;
      for (var i = 0; i < cells; i++) {
        if (blocked[i]) continue;
        if (occA[i] !== -1 || occB[i] !== -1) n++;
      }
      return n;
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
        var i;
        if (x > 0 && !seen[cell - 1] && freeCell(cell - 1, color)) { seen[cell - 1] = 1; queue[tail++] = cell - 1; }
        if (x < w - 1 && !seen[cell + 1] && freeCell(cell + 1, color)) { seen[cell + 1] = 1; queue[tail++] = cell + 1; }
        if (y > 0 && !seen[cell - w] && freeCell(cell - w, color)) { seen[cell - w] = 1; queue[tail++] = cell - w; }
        if (y < h - 1 && !seen[cell + w] && freeCell(cell + w, color)) { seen[cell + w] = 1; queue[tail++] = cell + w; }
        var twin = mech.twin[cell];
        if (twin !== -1 && !seen[twin] && freeCell(twin, color)) { seen[twin] = 1; queue[tail++] = twin; }
        if (mech.dirOf[cell] !== -1) {
          i = mech.stepByIndex(cell, mech.dirOf[cell]);
          if (i !== -1 && !seen[i] && freeCell(i, color)) { seen[i] = 1; queue[tail++] = i; }
        }
      }
      return false;
    }

    /* Candidates from `current` (entered from `prev`): teleport jumps,
       directional-forced exits and restricted-exit filtering applied. */
    function candidates(color, prev, current) {
      var out = [];
      var twin = mech.twin[current];
      if (twin !== -1 && twin !== prev) {
        out.push({ cell: twin, jump: true });
        return out;
      }
      var forced = mech.dirOf[current];
      var list = [];
      if (forced !== -1) {
        var only = mech.stepByIndex(current, forced);
        if (only !== -1) list.push(only);
      } else {
        var x = current % w, y = (current / w) | 0;
        if (x > 0) list.push(current - 1);
        if (x < w - 1) list.push(current + 1);
        if (y > 0) list.push(current - w);
        if (y < h - 1) list.push(current + w);
      }
      var banned = mech.restrictedMask[current];
      for (var i = 0; i < list.length; i++) {
        var cell = list[i];
        if (banned) {
          var dir = mech.dirBetween(current, cell);
          if (dir && (banned & CL.Mechanics.DIR_BIT[dir])) continue;
        }
        out.push({ cell: cell, jump: false });
      }
      return out;
    }

    function orderedUnplaced() {
      var list = [];
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
          var twin = mech.twin[cell];
          if (twin !== -1 && freeCell(twin, c)) options++;
        }
        var dist = Math.abs(pairs[c][0] - pairs[c][2]) + Math.abs(pairs[c][1] - pairs[c][3]);
        list.push({ color: c, score: options * 1000 + dist });
      }
      list.sort(function (a, b) { return a.score - b.score; });
      return list;
    }

    function enumerate(color, prev, current, visited, path, goal, emit) {
      if (nodes++ > nodeLimit) { aborted = true; return false; }
      var gx = goal % w, gy = (goal / w) | 0;
      var cand = candidates(color, prev, current);
      var scored = [];
      for (var n = 0; n < cand.length; n++) {
        var cell = cand[n].cell;
        var d = cand[n].jump ? 1 : Math.abs((cell % w) - gx) + Math.abs(((cell / w) | 0) - gy);
        scored.push({ cell: cell, jump: cand[n].jump, d: d });
      }
      scored.sort(function (a, b) { return a.d - b.d; });

      for (var i = 0; i < scored.length; i++) {
        var c = scored[i].cell;
        if (visited[c]) continue;
        if (c === goal) {
          path.push(goal);
          if (emit()) return true;
          path.pop();
          if (aborted) return false;
          continue;
        }
        if (!freeCell(c, color)) continue;
        visited[c] = 1;
        path.push(c);
        if (enumerate(color, current, c, visited, path, goal, emit)) return true;
        path.pop();
        visited[c] = 0;
        if (aborted) return false;
      }
      return false;
    }

    function commit(color, path) {
      for (var k = 0; k < path.length; k++) {
        var cell = path[k];
        if (cell === startIdx[color] || cell === goalIdx[color]) continue;
        if (occA[cell] === -1) occA[cell] = color;
        else occB[cell] = color;
      }
      paths[color] = path.slice();
      placed[color] = 1;
    }

    function uncommit(color, path) {
      for (var k = 0; k < path.length; k++) {
        var cell = path[k];
        if (cell === startIdx[color] || cell === goalIdx[color]) continue;
        if (occB[cell] === color) occB[cell] = -1;
        else if (occA[cell] === color) occA[cell] = -1;
      }
      placed[color] = 0;
      delete paths[color];
    }

    function tryNext() {
      if (aborted) return false;
      var order = orderedUnplaced();
      if (order.length === 0) {
        if (requireFullBoard && coveredCount() !== freeTarget) return false;
        return true;
      }
      if (!hasLocks) {
        return drawPair(order[0].color);
      }
      for (var i = 0; i < order.length; i++) {
        if (drawPair(order[i].color)) return true;
      }
      return false;
    }

    function drawPair(color) {
      if (aborted) return false;
      if (!reachable(color)) return false;
      var visited = new Uint8Array(cells);
      visited[startIdx[color]] = 1;
      var path = [startIdx[color]];
      var emit = function () {
        commit(color, path);
        if (tryNext()) return true;
        uncommit(color, path);
        return false;
      };
      return enumerate(color, -1, startIdx[color], visited, path, goalIdx[color], emit);
    }

    var solved = false;
    try { solved = tryNext() && !aborted; } catch (e) { solved = false; }
    var out = null;
    if (solved) {
      out = [];
      for (var i2 = 0; i2 < count; i2++) out.push(paths[i2] || null);
    }
    return { solved: solved, paths: out, nodes: nodes, aborted: aborted };
  }

  /* Independent rule-checker: verifies that `paths` is a valid solution
     for `level` (connectivity, collisions, special-tile rules, locks,
     full-board coverage). Used to verify stored witness solutions. */
  function verifyPaths(level, paths) {
    var w = level.w, h = level.h;
    var cells = w * h;
    var mech = new CL.Mechanics(level);
    var mask = buildMask(level);
    var blocked = mask.blocked;
    var errors = [];
    if (!Array.isArray(paths) || paths.length !== level.pairs.length) {
      return { ok: false, errors: ['paths array mismatch'] };
    }
    var occA = new Int8Array(cells).fill(-1);
    var occB = new Int8Array(cells).fill(-1);
    var connected = [];

    for (var pe = 0; pe < level.pairs.length; pe++) {
      occA[level.pairs[pe][1] * w + level.pairs[pe][0]] = pe;
      occA[level.pairs[pe][3] * w + level.pairs[pe][2]] = pe;
    }

    for (var p = 0; p < level.pairs.length; p++) {
      var path = paths[p];
      var pair = level.pairs[p];
      var s = pair[1] * w + pair[0], g = pair[3] * w + pair[2];
      if (!path || path.length < 2) { errors.push('pair ' + p + ': path too short'); connected.push(false); continue; }
      var okEnds = (path[0] === s && path[path.length - 1] === g) || (path[0] === g && path[path.length - 1] === s);
      if (!okEnds) errors.push('pair ' + p + ': wrong endpoints');
      var ok = true;
      for (var k = 0; k < path.length; k++) {
        var cell = path[k];
        if (cell < 0 || cell >= cells) { errors.push('pair ' + p + ': cell out of bounds'); ok = false; break; }
        if (blocked[cell]) { errors.push('pair ' + p + ': path through obstacle'); ok = false; break; }
        if (k > 0) {
          var prev = path[k - 1];
          var isJump = mech.twin[prev] !== -1 && mech.twin[prev] === cell && mech.twin[cell] === prev;
          if (!isJump && !adjacent(w, h, prev, cell)) { errors.push('pair ' + p + ': non-adjacent step at ' + k); ok = false; break; }
          if (isJump && prev === path[k - 2]) { errors.push('pair ' + p + ': illegal double jump'); ok = false; break; }
          var dirOfPrev = mech.dirOf[prev];
          if (dirOfPrev !== -1) {
            var expected = mech.stepByIndex(prev, dirOfPrev);
            if (expected !== cell) { errors.push('pair ' + p + ': directional violated'); ok = false; break; }
          }
          var banned = mech.restrictedMask[prev];
          if (banned) {
            var dirName = mech.dirBetween(prev, cell);
            if (!isJump && dirName && (banned & CL.Mechanics.DIR_BIT[dirName])) { errors.push('pair ' + p + ': restricted exit violated'); ok = false; break; }
          }
        }
        if (mech.twin[cell] !== -1 && k > 0 && k < path.length - 1) {
          var after = path[k + 1];
          if (after !== mech.twin[cell] && path[k - 1] !== mech.twin[cell]) {
            errors.push('pair ' + p + ': portal must jump to twin');
            ok = false; break;
          }
        }
      }
      connected.push(ok && okEnds);
      if (!ok) continue;

      for (var k2 = 0; k2 < path.length; k2++) {
        var c2 = path[k2];
        if (c2 === s || c2 === g) continue;
        if (occA[c2] === -1) occA[c2] = p;
        else if (occB[c2] === -1) {
          if (!mech.bridge[c2]) { errors.push('cell ' + c2 + ' shared without bridge'); break; }
          occB[c2] = p;
        } else {
          errors.push('cell ' + c2 + ' over-occupied');
          break;
        }
      }
    }

    if (level.locks) {
      for (var li = 0; li < level.locks.length; li++) {
        var lock = level.locks[li];
        var lockCell = lock.cell[1] * w + lock.cell[0];
        if (!connected[lock.color]) errors.push('lock at ' + lockCell + ' never opened');
      }
    }

    if (level.fullBoard) {
      var covered = 0;
      for (var i = 0; i < cells; i++) {
        if (blocked[i]) continue;
        if (occA[i] !== -1 || occB[i] !== -1) covered++;
      }
      if (covered !== mech.freeCells) errors.push('full board not covered: ' + covered + '/' + mech.freeCells);
    }

    var seen = {};
    for (var pi = 0; pi < paths.length; pi++) {
      if (!paths[pi]) continue;
      for (var ki = 0; ki < paths[pi].length; ki++) {
        var key = pi + ':' + paths[pi][ki];
        if (seen[key]) errors.push('pair ' + pi + ' revisits cell ' + paths[pi][ki]);
        seen[key] = 1;
      }
    }

    return { ok: errors.length === 0, errors: errors, connected: connected };
  }

  function adjacent(w, h, a, b) {
    var ax = a % w, ay = (a / w) | 0;
    var bx = b % w, by = (b / w) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  CL.Solver = {
    solve: solve,
    buildMask: buildMask,
    verifyPaths: verifyPaths
  };
})();
