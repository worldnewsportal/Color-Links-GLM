/* Color Link - Path drawing rules (Flow-style): extend, backtrack, cut, snap. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function startDraw(board, color, cell) {
    if (color < 0 || color >= board.pairCount) return null;
    if (board.isBlocked(cell)) return null;
    var ends = board.endpoints[color];
    var other = null;

    if (cell === ends[0] || cell === ends[1]) {
      board.paths[color] = [cell];
      return { changed: true, reset: color };
    }

    var path = board.paths[color];
    if (path) {
      var pos = path.indexOf(cell);
      if (pos !== -1) {
        if (pos === path.length - 1) return null;
        board.paths[color] = path.slice(0, pos + 1);
        return { changed: true, truncated: color };
      }
    }
    return null;
  }

  function extendDraw(board, color, cell) {
    var path = board.paths[color];
    if (!path || path.length === 0) return null;
    var last = path[path.length - 1];
    if (cell === last) return null;
    if (!board.adjacent(last, cell)) return null;
    if (board.isBlocked(cell)) return null;

    var ends = board.endpoints[color];
    var isOtherEnd = (cell === ends[0] || cell === ends[1]);

    if (!isOtherEnd) {
      var epColor = board.endpointColor(cell);
      if (epColor !== -1 && epColor !== color) return null;
    }

    var pos = path.indexOf(cell);
    if (pos !== -1) {
      if (pos === path.length - 2) {
        path.pop();
        return { changed: true, popped: true };
      }
      return null;
    }

    if (!isOtherEnd) {
      var occ = board.cellColor(cell);
      if (occ !== -1 && occ !== color) {
        var otherPath = board.paths[occ];
        var cutIdx = otherPath.indexOf(cell);
        board.paths[occ] = cutIdx > 0 ? otherPath.slice(0, cutIdx) : null;
        path.push(cell);
        return { changed: true, cut: occ, pushed: true };
      }
      if (occ === color) return null;
      path.push(cell);
      return { changed: true, pushed: true };
    }

    path.push(cell);
    var done = board.isConnected(color);
    return { changed: true, pushed: true, completedPath: done };
  }

  CL.PathEngine = {
    startDraw: startDraw,
    extendDraw: extendDraw
  };
})();
