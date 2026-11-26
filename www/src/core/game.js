/* Color Link - Game controller: ties board, engine, input, renderer, hints. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function Game(canvas) {
    this.canvas = canvas;
    this.renderer = new CL.Renderer(canvas);
    this.board = null;
    this.level = null;
    this.moves = 0;
    this.startedAt = 0;
    this.elapsed = 0;
    this.timerId = null;
    this.undoStack = [];
    this.activeColor = -1;
    this.won = false;
    this.raf = null;
    this.handlers = {
      onStateChange: function () {},
      onWin: function () {}
    };
    var self = this;
    this.input = CL.InputManager.attach(canvas, {
      onDown: function (cell) { self.pointerDown(cell); },
      onMove: function (cell) { self.pointerMove(cell); },
      onUp: function () { self.pointerUp(); },
      onCancel: function () { self.pointerUp(); }
    }, function () { return self.renderer.metrics; });

    this.loop = this.loop.bind(this);
  }

  Game.prototype.load = function (levelId) {
    var level = CL.LevelManager.get(levelId);
    if (!level) return false;
    this.level = level;
    this.board = new CL.Board(level);
    this.moves = 0;
    this.undoStack = [];
    this.activeColor = -1;
    this.won = false;
    this.elapsed = 0;
    this.renderer.setGhost(null);
    this.renderer.particles.length = 0;
    this.renderer.layout(this.board);
    this.startTimer();
    this.renderer.ghost = null;
    this.startLoop();
    this.handlers.onStateChange(this.state());
    return true;
  };

  Game.prototype.on = function (name, fn) { this.handlers[name] = fn; };

  Game.prototype.startTimer = function () {
    var self = this;
    this.startedAt = Date.now();
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(function () {
      if (!self.won) {
        self.elapsed = Math.floor((Date.now() - self.startedAt) / 1000);
        self.handlers.onStateChange(self.state());
      }
    }, 1000);
  };

  Game.prototype.pointerDown = function (cell) {
    if (this.won || cell < 0) return;
    var board = this.board;
    var epColor = board.endpointColor(cell);
    var occ = board.cellColor(cell);
    var color = epColor !== -1 ? epColor : (occ !== -1 ? occ : -1);
    if (color === -1) return;
    CL.Audio.unlock();
    var snap = board.snapshot();
    var res = CL.PathEngine.startDraw(board, color, cell);
    if (res && res.changed) {
      this.undoStack.push({ snap: snap, color: color });
      this.activeColor = color;
      this.renderer.setGhost(null);
      this.renderer.draw(board);
      this.handlers.onStateChange(this.state());
    } else {
      this.activeColor = color;
    }
  };

  Game.prototype.pointerMove = function (cell) {
    if (this.won || this.activeColor < 0 || cell < 0) return;
    var res = CL.PathEngine.extendDraw(this.board, this.activeColor, cell);
    if (res && res.changed) {
      if (res.pushed) {
        this.moves++;
        CL.Progression.addStats('totalMoves', 1);
      }
      if (res.cut !== undefined) CL.Audio.play('pop');
      else CL.Audio.play('draw', this.moves);
      if (res.completedPath) CL.Audio.play('connect');
      this.vibrate(res.cut !== undefined ? 20 : 8);
      this.renderer.draw(this.board);
      this.handlers.onStateChange(this.state());
      if (this.board.isComplete()) this.win();
    }
  };

  Game.prototype.pointerUp = function () {
    this.activeColor = -1;
  };

  Game.prototype.vibrate = function (ms) {
    var s = CL.Progression.getSettings();
    if (s.vibration && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
  };

  Game.prototype.undo = function () {
    if (this.won || !this.undoStack.length) return false;
    var entry = this.undoStack.pop();
    this.board.restore(entry.snap);
    this.renderer.setGhost(null);
    CL.Audio.play('pop');
    this.renderer.draw(this.board);
    this.handlers.onStateChange(this.state());
    return true;
  };

  Game.prototype.restart = function () {
    if (this.level) this.load(this.level.id);
  };

  Game.prototype.hint = function () {
    if (this.won) return null;
    var left = CL.Hints.remaining(this.level.id);
    if (left <= 0) return { error: 'no-hints' };
    var hint = CL.Hints.getHint(this.board, this.level.id);
    if (!hint) return null;
    CL.Hints.useOne(this.level.id);
    this.renderer.setGhost(hint);
    CL.Audio.play('hint');
    this.vibrate(15);
    this.renderer.draw(this.board);
    return hint;
  };

  Game.prototype.win = function () {
    this.won = true;
    this.elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    var cells = [];
    for (var c = 0; c < this.board.pairCount; c++) {
      var path = this.board.paths[c];
      if (path) cells.push(path[0], path[path.length - 1]);
    }
    this.renderer.burst(cells, 36);
    CL.Audio.play('win');
    this.vibrate([30, 60, 30]);
    this.handlers.onStateChange(this.state());
    var self = this;
    setTimeout(function () { self.handlers.onWin(self.result()); }, 700);
  };

  Game.prototype.result = function () {
    return {
      levelId: this.level.id,
      moves: this.moves,
      timeSec: this.elapsed,
      hintUsed: CL.Hints.remaining(this.level.id) < CL.Hints.maxHints()
    };
  };

  Game.prototype.state = function () {
    return {
      moves: this.moves,
      timeSec: this.elapsed,
      connected: this.board ? this.board.connectedCount() : 0,
      pairCount: this.board ? this.board.pairCount : 0,
      won: this.won,
      canUndo: this.undoStack.length > 0
    };
  };

  Game.prototype.loop = function () {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.board) return;
    if (this.renderer.hasParticles()) {
      this.renderer.draw(this.board);
    } else if (this.won) {
      this.renderer.draw(this.board);
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  };

  Game.prototype.startLoop = function () {
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  };

  Game.prototype.stop = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  };

  Game.prototype.resize = function () {
    if (this.board) {
      this.renderer.layout(this.board);
      this.renderer.draw(this.board);
    }
  };

  CL.Game = Game;
})();
