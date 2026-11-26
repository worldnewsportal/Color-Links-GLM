/* Color Link - Special-tile mechanics (Phase 2).
   Parses a level into fast lookup tables shared by the solver, board,
   path engine, renderer and validator.

   Mechanics:
   - bridges:      cells that may host up to two different paths (a crossing).
   - teleports:    paired portal cells; entering one jumps to its twin.
   - directionals: any path on the cell must exit in the fixed direction.
   - restricted:   paths may not EXIT the cell in the listed directions.
   - locks:        cell opens only after the key color's pair is connected.
*/
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var DIR_ORDER = ['up', 'right', 'down', 'left'];
  var DIR_BIT = { up: 1, right: 2, down: 4, left: 8 };

  function Mechanics(level) {
    this.level = level;
    this.w = level.w;
    this.h = level.h;
    this.cells = level.w * level.h;
    this.twin = new Int32Array(this.cells).fill(-1);
    this.dirOf = new Int8Array(this.cells).fill(-1);
    this.restrictedMask = new Uint8Array(this.cells);
    this.lockKey = new Int8Array(this.cells).fill(-1);
    this.bridge = new Uint8Array(this.cells);

    var w = this.w;
    var i, t;
    var teleports = level.teleports || [];
    for (i = 0; i < teleports.length; i++) {
      t = teleports[i];
      var a = t[1] * w + t[0], b = t[3] * w + t[2];
      this.twin[a] = b;
      this.twin[b] = a;
    }
    var directionals = level.directionals || [];
    for (i = 0; i < directionals.length; i++) {
      var d = directionals[i];
      this.dirOf[d.cell[1] * w + d.cell[0]] = DIR_ORDER.indexOf(d.dir);
    }
    var restricted = level.restricted || [];
    for (i = 0; i < restricted.length; i++) {
      var r = restricted[i];
      var mask = 0;
      for (var k = 0; k < r.dirs.length; k++) mask |= DIR_BIT[r.dirs[k]];
      this.restrictedMask[r.cell[1] * w + r.cell[0]] = mask;
    }
    var locks = level.locks || [];
    for (i = 0; i < locks.length; i++) {
      var l = locks[i];
      this.lockKey[l.cell[1] * w + l.cell[0]] = l.color;
    }
    var bridges = level.bridges || [];
    for (i = 0; i < bridges.length; i++) {
      this.bridge[bridges[i][1] * w + bridges[i][0]] = 1;
    }

    var blockedCount = (level.obstacles || []).length;
    this.freeCells = this.cells - blockedCount;
  }

  /* Cell index after moving one step in a direction, or -1 out of bounds. */
  Mechanics.prototype.step = function (idx, dir) {
    var w = this.w, h = this.h;
    var x = idx % w, y = (idx / w) | 0;
    if (dir === 'up') return y > 0 ? idx - w : -1;
    if (dir === 'down') return y < h - 1 ? idx + w : -1;
    if (dir === 'left') return x > 0 ? idx - 1 : -1;
    if (dir === 'right') return x < w - 1 ? idx + 1 : -1;
    return -1;
  };

  Mechanics.prototype.stepByIndex = function (idx, dirIndex) {
    return this.step(idx, DIR_ORDER[dirIndex]);
  };

  /* Direction name needed to move from a to b (adjacent cells only). */
  Mechanics.prototype.dirBetween = function (a, b) {
    var w = this.w;
    if (b === a - w) return 'up';
    if (b === a + w) return 'down';
    if (b === a - 1 && a % w !== 0) return 'left';
    if (b === a + 1 && (a + 1) % w !== 0) return 'right';
    return null;
  };

  /* True when moving from `prev` onto `cell` is a teleport jump. */
  Mechanics.prototype.isJump = function (prev, cell) {
    var t = this.twin[cell];
    return t !== -1 && t !== prev;
  };

  /* Can a path of `color` enter `cell`? `keyPlaced` = key pair connected. */
  Mechanics.prototype.canEnter = function (cell, color, isBlocked, endpointColor, keyPlaced) {
    if (isBlocked(cell)) return false;
    var ep = endpointColor(cell);
    if (ep !== -1 && ep !== color) return false;
    var lock = this.lockKey[cell];
    if (lock !== -1 && !keyPlaced(lock)) return false;
    return true;
  };

  CL.Mechanics = Mechanics;
  CL.Mechanics.DIR_ORDER = DIR_ORDER;
  CL.Mechanics.DIR_BIT = DIR_BIT;
})();
