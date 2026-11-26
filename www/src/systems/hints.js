/* Color Link - Hint system (Phase 2).
   3 free hints per level, then hints cost coins. Hints always come from
   verified solutions (stored witness or solver); if no solution exists,
   nothing is consumed. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var MAX_HINTS = 3;

  function remainingKey(levelId) { return 'hints_left_' + levelId; }

  function remaining(levelId) {
    var v = CL.Storage.get(remainingKey(levelId), MAX_HINTS);
    return typeof v === 'number' ? v : 0;
  }

  function useOne(levelId) {
    var left = remaining(levelId);
    if (left <= 0) return 0;
    left--;
    CL.Storage.set(remainingKey(levelId), left);
    CL.Progression.addStats('hintsUsed', 1);
    return left;
  }

  function reset(levelId) {
    CL.Storage.set(remainingKey(levelId), MAX_HINTS);
  }

  function maxHints() { return MAX_HINTS; }

  function cost() { return CL.Coins ? CL.Coins.HINT_COST : 15; }

  /* Returns { color, cells } for the next useful connection, or null. */
  function getHint(board, levelId) {
    var solution = CL.LevelManager.solution(levelId);
    if (!solution) return null;

    var worst = -1, worstLen = -1;
    for (var c = 0; c < board.pairCount; c++) {
      if (board.isConnected(c)) continue;
      var solPath = solution[c];
      if (!solPath) continue;
      var cur = board.paths[c];
      var prefix = 0;
      if (cur && cur.length > 0) {
        if (cur[0] === solPath[0]) {
          while (prefix < cur.length && prefix < solPath.length && cur[prefix] === solPath[prefix]) prefix++;
          if (prefix < cur.length) prefix = 0;
        } else if (cur[0] === solPath[solPath.length - 1]) {
          while (prefix < cur.length && prefix < solPath.length &&
                 cur[prefix] === solPath[solPath.length - 1 - prefix]) prefix++;
          if (prefix < cur.length) prefix = 0;
        }
      }
      var remainingLen = solPath.length - prefix;
      if (remainingLen > worstLen) { worstLen = remainingLen; worst = c; }
    }
    if (worst === -1) return null;

    var path = solution[worst];
    var cur2 = board.paths[worst];
    var start = 1;
    if (cur2 && cur2.length > 0) {
      if (cur2[0] === path[0]) {
        var p1 = 0;
        while (p1 < cur2.length && p1 < path.length && cur2[p1] === path[p1]) p1++;
        if (p1 >= cur2.length) start = p1;
        else start = 1;
      } else if (cur2[0] === path[path.length - 1]) {
        var p2 = 0;
        while (p2 < cur2.length && p2 < path.length && cur2[p2] === path[path.length - 1 - p2]) p2++;
        if (p2 >= cur2.length) {
          var rev = path.slice().reverse();
          start = p2;
          return { color: worst, cells: rev.slice(start, Math.min(rev.length, start + 3)) };
        }
        start = 1;
      }
    }
    return { color: worst, cells: path.slice(start, Math.min(path.length, start + 3)) };
  }

  /* Full request flow: free allowance first, then coin cost.
     Returns:
       { hint: {color, cells}, free: bool }
       { error: 'no-coins' }  - free allowance spent, not enough coins
       null                   - no verified solution exists (nothing charged) */
  function requestHint(board, levelId) {
    var hint = getHint(board, levelId);
    if (!hint) return null;
    var left = remaining(levelId);
    if (left > 0) {
      useOne(levelId);
      return { hint: hint, free: true };
    }
    if (!CL.Progression.spendCoins(cost(), 'hint')) {
      return { error: 'no-coins' };
    }
    CL.Progression.addStats('hintsUsed', 1);
    return { hint: hint, free: false };
  }

  CL.Hints = {
    remaining: remaining,
    useOne: useOne,
    reset: reset,
    maxHints: maxHints,
    cost: cost,
    getHint: getHint,
    requestHint: requestHint
  };
})();
