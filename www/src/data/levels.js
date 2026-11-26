/* Color Link - Level data (Phase 1: 30 predefined, solver-verified levels).
   Pair format: [x1, y1, x2, y2]. Obstacles: [[x, y], ...].
   Every entry in this file is verified by `npm run validate`. */
(function () {
  'use strict';

  var LEVELS = [
    { id: 1,  w: 5, h: 5, pairs: [[0, 1, 4, 1], [0, 3, 4, 3]], difficulty: 'easy' },
    { id: 2,  w: 5, h: 5, pairs: [[0, 0, 0, 4], [4, 0, 4, 4]], difficulty: 'easy' },
    { id: 3,  w: 5, h: 5, pairs: [[0, 2, 2, 0], [4, 2, 2, 4]], difficulty: 'easy' },
    { id: 4,  w: 5, h: 5, pairs: [[2, 0, 2, 3], [0, 2, 4, 2]], difficulty: 'easy' },
    { id: 5,  w: 5, h: 5, pairs: [[0, 0, 3, 1], [4, 0, 1, 4]], difficulty: 'easy' },
    { id: 6,  w: 5, h: 5, pairs: [[0, 0, 4, 0], [0, 4, 4, 4], [2, 1, 2, 3]], difficulty: 'easy' },
    { id: 7,  w: 5, h: 5, pairs: [[0, 1, 4, 1], [0, 3, 4, 3], [2, 0, 2, 2]], difficulty: 'easy' },
    { id: 8,  w: 5, h: 5, pairs: [[0, 0, 3, 1], [0, 2, 4, 1], [4, 4, 0, 4]], difficulty: 'medium' },
    { id: 9,  w: 5, h: 5, pairs: [[0, 0, 2, 2], [4, 0, 4, 4], [0, 4, 2, 1]], difficulty: 'medium' },
    { id: 10, w: 5, h: 5, pairs: [[1, 0, 3, 2], [3, 0, 1, 2], [0, 4, 4, 4]], difficulty: 'medium' },
    { id: 11, w: 6, h: 6, pairs: [[3, 3, 5, 5], [1, 0, 4, 0], [0, 0, 5, 2], [1, 3, 1, 1]], difficulty: 'medium' },
    { id: 12, w: 6, h: 6, pairs: [[5, 0, 5, 4], [0, 2, 0, 0], [4, 4, 1, 2], [1, 4, 1, 0]], difficulty: 'medium' },
    { id: 13, w: 6, h: 6, pairs: [[1, 2, 3, 3], [3, 4, 4, 1], [3, 1, 5, 5], [0, 3, 1, 5]], difficulty: 'medium' },
    { id: 14, w: 6, h: 6, pairs: [[4, 0, 2, 1], [2, 2, 0, 0], [3, 5, 0, 5], [3, 3, 1, 0]], difficulty: 'medium' },
    { id: 15, w: 6, h: 6, pairs: [[4, 2, 3, 4], [2, 3, 1, 5], [2, 1, 5, 3], [5, 4, 3, 5], [3, 3, 1, 0]], difficulty: 'medium' },
    { id: 16, w: 6, h: 6, pairs: [[4, 2, 4, 0], [2, 0, 3, 5], [0, 0, 2, 5], [3, 0, 2, 3], [4, 4, 3, 2]], difficulty: 'medium' },
    { id: 17, w: 6, h: 6, pairs: [[4, 2, 2, 5], [5, 4, 3, 5], [1, 4, 5, 3], [0, 3, 0, 4], [3, 1, 3, 3]], difficulty: 'medium' },
    { id: 18, w: 6, h: 6, pairs: [[0, 2, 1, 2], [0, 1, 1, 4], [5, 3, 3, 1], [2, 4, 0, 4], [5, 0, 4, 4]], difficulty: 'medium' },
    { id: 19, w: 7, h: 7, pairs: [[2, 3, 3, 4], [4, 2, 4, 0], [0, 4, 2, 2], [5, 2, 0, 1], [0, 3, 0, 2]], difficulty: 'hard' },
    { id: 20, w: 7, h: 7, pairs: [[2, 2, 3, 4], [0, 3, 1, 4], [2, 1, 4, 5], [4, 1, 0, 2], [5, 0, 0, 4]], difficulty: 'hard' },
      { id: 21, w: 7, h: 7, pairs: [[3, 2, 0, 1], [3, 6, 1, 6], [6, 1, 2, 5], [4, 1, 1, 4], [4, 3, 1, 2]], difficulty: 'hard', obstacles: [[1, 0], [0, 5]] },
    { id: 22, w: 7, h: 7, pairs: [[3, 3, 0, 3], [5, 1, 3, 1], [3, 6, 1, 3], [6, 4, 2, 2], [4, 4, 4, 3]], difficulty: 'hard', obstacles: [[4, 6], [0, 0]] },
      { id: 23, w: 7, h: 7, pairs: [[1, 2, 2, 0], [1, 5, 6, 5], [4, 4, 2, 4], [4, 0, 3, 1], [5, 6, 6, 2]], difficulty: 'hard', obstacles: [[0, 1], [4, 2]] },
    { id: 24, w: 7, h: 7, pairs: [[5, 0, 6, 0], [0, 0, 5, 4], [1, 2, 4, 1], [0, 6, 1, 6], [6, 5, 4, 4], [4, 5, 2, 4]], difficulty: 'hard' },
    { id: 25, w: 7, h: 7, pairs: [[6, 0, 2, 2], [5, 6, 3, 6], [4, 1, 5, 2], [5, 5, 6, 4], [3, 1, 3, 0], [3, 4, 2, 0]], difficulty: 'hard' },
    { id: 26, w: 8, h: 8, pairs: [[5, 2, 1, 1], [6, 7, 3, 0], [5, 4, 3, 6], [1, 5, 3, 5], [6, 3, 3, 7], [4, 2, 0, 1]], difficulty: 'hard' },
    { id: 27, w: 8, h: 8, pairs: [[1, 5, 0, 6], [3, 6, 3, 0], [4, 2, 0, 1], [6, 0, 6, 6], [2, 6, 3, 3], [7, 7, 6, 5]], difficulty: 'hard' },
    { id: 28, w: 8, h: 8, pairs: [[1, 7, 0, 2], [4, 2, 3, 7], [4, 7, 7, 1], [2, 5, 5, 2], [5, 1, 0, 1], [6, 0, 6, 3]], difficulty: 'hard', obstacles: [[5, 5], [7, 5]] },
    { id: 29, w: 8, h: 8, pairs: [[1, 6, 1, 5], [5, 3, 1, 1], [7, 0, 5, 6], [3, 0, 5, 1], [4, 2, 5, 5], [4, 0, 6, 1]], difficulty: 'hard', obstacles: [[2, 4], [5, 7]] },
    { id: 30, w: 8, h: 8, pairs: [[6, 2, 1, 0], [7, 5, 5, 1], [3, 1, 2, 4], [1, 3, 4, 7], [0, 5, 0, 2], [7, 3, 7, 1]], difficulty: 'hard', obstacles: [[6, 6], [3, 3], [0, 7]] }
  ];

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  CL.LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LEVELS;
  }
})();
