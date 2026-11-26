/* Color Link - Path drawing rules (Phase 2): extend, backtrack, cut,
   snap, bridge coexist, teleport jumps, directional/restricted tiles,
   locked cells. */
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
    var prev = path.length > 1 ? path[path.length - 2] : -1;
    var mech = board.mech;
    if (cell === last) return null;

    var isJump = false;
    var twin = mech.twin[last];
    if (twin !== -1 && prev !== twin) {
      /* Standing on a portal entered by adjacency: must jump to twin. */
      if (cell !== twin) return null;
      isJump = true;
    } else {
      if (!board.adjacent(last, cell)) return null;
      /* Directional tile: exit direction is forced. */
      var forced = mech.dirOf[last];
      if (forced !== -1 && mech.stepByIndex(last, forced) !== cell) return null;
      /* Restricted tile: exit direction forbidden. */
      var banned = mech.restrictedMask[last];
      if (banned) {
        var dirName = mech.dirBetween(last, cell);
        if (dirName && (banned & CL.Mechanics.DIR_BIT[dirName])) return null;
      }
    }

    if (board.isBlocked(cell)) return null;
    if (!board.canEnter(cell, color)) return null;

    var ends = board.endpoints[color];
    var isOtherEnd = (cell === ends[0] || cell === ends[1]);

    if (!isOtherEnd) {
      var epColor = board.endpointColor(cell);
      if (epColor !== -1 && epColor !== color) return null;
    }

    var pos = path.indexOf(cell);
    if (pos !== -1) {
      if (pos === path.length - 2 && !isJump) {
        path.pop();
        return { changed: true, popped: true };
      }
      return null;
    }

    if (!isOtherEnd) {
      var occ = board.occupancy(cell);
      var others = occ.filter(function (c) { return c !== color; });
      if (others.length > 0) {
        if (mech.bridge[cell] && occ.length < 2) {
          /* Bridge: coexist with the other color. */
          path.push(cell);
          return { changed: true, pushed: true, bridge: true, jumped: isJump };
        }
        var occColor = others[0];
        var otherPath = board.paths[occColor];
        var cutIdx = otherPath.indexOf(cell);
        board.paths[occColor] = cutIdx > 0 ? otherPath.slice(0, cutIdx) : null;
        path.push(cell);
        return { changed: true, cut: occColor, pushed: true, jumped: isJump };
      }
      path.push(cell);
      return { changed: true, pushed: true, jumped: isJump };
    }

    path.push(cell);
    var done = board.isConnected(color);
    return { changed: true, pushed: true, completedPath: done, jumped: isJump };
  }

  CL.PathEngine = {
    startDraw: startDraw,
    extendDraw: extendDraw
  };
})();
