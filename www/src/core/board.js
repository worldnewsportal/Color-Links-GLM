/* Color Link - Core board state. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function Board(level) {
    this.level = level;
    this.w = level.w;
    this.h = level.h;
    var count = level.pairs.length;
    this.pairCount = count;
    this.paths = new Array(count).fill(null);
    this.blocked = new Uint8Array(this.w * this.h);
    var obstacles = level.obstacles || [];
    for (var i = 0; i < obstacles.length; i++) {
      this.blocked[obstacles[i][1] * this.w + obstacles[i][0]] = 1;
    }
    this.endpoints = [];
    for (var p = 0; p < count; p++) {
      var pair = level.pairs[p];
      this.endpoints.push([pair[1] * this.w + pair[0], pair[3] * this.w + pair[2]]);
    }
  }

  Board.prototype.idx = function (x, y) { return y * this.w + x; };
  Board.prototype.xy = function (i) { return [i % this.w, (i / this.w) | 0]; };

  Board.prototype.adjacent = function (a, b) {
    var ax = a % this.w, ay = (a / this.w) | 0;
    var bx = b % this.w, by = (b / this.w) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  };

  Board.prototype.isBlocked = function (i) { return this.blocked[i] === 1; };

  Board.prototype.endpointColor = function (i) {
    for (var c = 0; c < this.pairCount; c++) {
      if (this.endpoints[c][0] === i || this.endpoints[c][1] === i) return c;
    }
    return -1;
  };

  Board.prototype.cellColor = function (i) {
    for (var c = 0; c < this.pairCount; c++) {
      var path = this.paths[c];
      if (path && path.indexOf(i) !== -1) return c;
    }
    return -1;
  };

  Board.prototype.isConnected = function (c) {
    var path = this.paths[c];
    if (!path || path.length < 2) return false;
    var ends = this.endpoints[c];
    var first = path[0], last = path[path.length - 1];
    var okEnds = (first === ends[0] && last === ends[1]) || (first === ends[1] && last === ends[0]);
    if (!okEnds) return false;
    for (var k = 1; k < path.length; k++) {
      if (!this.adjacent(path[k - 1], path[k])) return false;
    }
    return true;
  };

  Board.prototype.connectedCount = function () {
    var n = 0;
    for (var c = 0; c < this.pairCount; c++) {
      if (this.isConnected(c)) n++;
    }
    return n;
  };

  Board.prototype.isComplete = function () {
    for (var c = 0; c < this.pairCount; c++) {
      if (!this.isConnected(c)) return false;
    }
    return true;
  };

  Board.prototype.snapshot = function () {
    var out = new Array(this.pairCount);
    for (var c = 0; c < this.pairCount; c++) {
      out[c] = this.paths[c] ? this.paths[c].slice() : null;
    }
    return out;
  };

  Board.prototype.restore = function (snap) {
    for (var c = 0; c < this.pairCount; c++) {
      this.paths[c] = snap[c] ? snap[c].slice() : null;
    }
  };

  Board.prototype.clearAll = function () {
    for (var c = 0; c < this.pairCount; c++) this.paths[c] = null;
  };

  Board.prototype.coveredCount = function () {
    var set = {};
    var n = 0;
    for (var c = 0; c < this.pairCount; c++) {
      var path = this.paths[c];
      if (!path) continue;
      for (var k = 0; k < path.length; k++) {
        if (!set[path[k]]) { set[path[k]] = 1; n++; }
      }
    }
    return n;
  };

  CL.Board = Board;
})();
