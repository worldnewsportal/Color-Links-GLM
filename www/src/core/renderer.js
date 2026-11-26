/* Color Link - Canvas board renderer with DPR scaling and effects. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var COLORS = ['#F44336', '#2196F3', '#FFD54F', '#4CAF50', '#AB47BC', '#FF9800'];
  var GLOW = ['#C62828', '#1565C0', '#F9A825', '#2E7D32', '#7B1FA2', '#E65100'];
  var CELL = '#4a148c';
  var CELL_EDGE = 'rgba(255,255,255,0.10)';

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.metrics = null;
    this.theme = 'dark';
    this.particles = [];
    this.ghost = null;
    this.winPulse = 0;
    this.onFrame = null;
  }

  Renderer.prototype.layout = function (board) {
    var wrap = this.canvas.parentElement;
    var availW = wrap.clientWidth;
    var availH = wrap.clientHeight;
    var dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5);
    var pad = 8;
    var size = Math.max(120, Math.min(availW - pad * 2, availH - pad * 2, 520));
    var cell = Math.floor(size / Math.max(board.w, board.h));
    var bw = cell * board.w;
    var bh = cell * board.h;
    var ox = Math.floor((availW - bw) / 2);
    var oy = Math.floor((availH - bh) / 2);
    this.canvas.width = Math.round(availW * dpr);
    this.canvas.height = Math.round(availH * dpr);
    this.canvas.style.width = availW + 'px';
    this.canvas.style.height = availH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.metrics = { cell: cell, ox: ox, oy: oy, w: board.w, h: board.h, bw: bw, bh: bh };
  };

  Renderer.prototype.cellCenter = function (idx) {
    var m = this.metrics;
    var x = idx % m.w, y = (idx / m.w) | 0;
    return [m.ox + x * m.cell + m.cell / 2, m.oy + y * m.cell + m.cell / 2];
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Renderer.prototype.draw = function (board, opts) {
    opts = opts || {};
    var ctx = this.ctx;
    var m = this.metrics;
    if (!m) return;
    var cell = m.cell;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = 'rgba(50, 12, 95, 0.30)';
    roundRect(ctx, m.ox - cell * 0.12, m.oy - cell * 0.12, m.bw + cell * 0.24, m.bh + cell * 0.24, cell * 0.3);
    ctx.fill();

    for (var yy = 0; yy < m.h; yy++) {
      for (var xx = 0; xx < m.w; xx++) {
        var idx = yy * m.w + xx;
        var px = m.ox + xx * cell, py = m.oy + yy * cell;
        if (board.isBlocked(idx)) {
          ctx.fillStyle = 'rgba(20, 4, 45, 0.92)';
          roundRect(ctx, px + 2, py + 2, cell - 4, cell - 4, cell * 0.16);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth = Math.max(2, cell * 0.06);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px + cell * 0.3, py + cell * 0.3);
          ctx.lineTo(px + cell * 0.7, py + cell * 0.7);
          ctx.moveTo(px + cell * 0.7, py + cell * 0.3);
          ctx.lineTo(px + cell * 0.3, py + cell * 0.7);
          ctx.stroke();
          continue;
        }
        ctx.fillStyle = CELL;
        roundRect(ctx, px + 2, py + 2, cell - 4, cell - 4, cell * 0.16);
        ctx.fill();
        ctx.strokeStyle = CELL_EDGE;
        ctx.lineWidth = 1;
        roundRect(ctx, px + 2.5, py + 2.5, cell - 5, cell - 5, cell * 0.15);
        ctx.stroke();
      }
    }

    if (this.ghost) this.drawGhost(board, ctx, m, cell);

    for (var c = 0; c < board.pairCount; c++) {
      var path = board.paths[c];
      if (!path || path.length < 1) continue;
      var color = COLORS[c % COLORS.length];
      var connected = board.isConnected(c);
      ctx.save();
      if (connected) {
        ctx.shadowColor = GLOW[c % GLOW.length];
        ctx.shadowBlur = cell * 0.45;
      }
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = cell * 0.42;
      ctx.beginPath();
      for (var k = 0; k < path.length; k++) {
        var pt = this.cellCenter(path[k]);
        if (k === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      }
      if (path.length === 1) ctx.lineTo(pt[0] + 0.01, pt[1]);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = cell * 0.13;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var k2 = 0; k2 < path.length; k2++) {
        var pt2 = this.cellCenter(path[k2]);
        if (k2 === 0) ctx.moveTo(pt2[0], pt2[1]);
        else ctx.lineTo(pt2[0], pt2[1]);
      }
      if (path.length === 1) ctx.lineTo(pt2[0] + 0.01, pt2[1]);
      ctx.stroke();

      for (var e = 0; e < 2; e++) {
        var endIdx = board.endpoints[c][e];
        var isInPath = path.indexOf(endIdx) !== -1;
        var cpt = this.cellCenter(endIdx);
        var r = cell * (isInPath ? 0.3 : 0.27);
        ctx.save();
        ctx.shadowColor = GLOW[c % GLOW.length];
        ctx.shadowBlur = cell * 0.5;
        ctx.fillStyle = isInPath ? '#FFFFFF' : COLORS[c % COLORS.length];
        ctx.beginPath();
        ctx.arc(cpt[0], cpt[1], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(2, cell * 0.055);
        ctx.beginPath();
        ctx.arc(cpt[0], cpt[1], r, 0, Math.PI * 2);
        ctx.stroke();
        if (isInPath) {
          ctx.fillStyle = COLORS[c % COLORS.length];
          ctx.beginPath();
          ctx.arc(cpt[0], cpt[1], r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    this.drawParticles(ctx);
  };

  Renderer.prototype.drawGhost = function (board, ctx, m, cell) {
    var ghost = this.ghost;
    var color = COLORS[ghost.color % COLORS.length];
    ctx.save();
    ctx.setLineDash([cell * 0.16, cell * 0.14]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = cell * 0.18;
    ctx.beginPath();
    for (var i = 0; i < ghost.cells.length; i++) {
      var pt = this.cellCenter(ghost.cells[i]);
      if (i === 0) ctx.moveTo(pt[0], pt[1]);
      else ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
    ctx.restore();
  };

  Renderer.prototype.setGhost = function (ghost) { this.ghost = ghost; };

  Renderer.prototype.burst = function (cells, count) {
    var m = this.metrics;
    if (!m) return;
    for (var i = 0; i < (count || 40); i++) {
      var cell = cells[Math.floor(Math.random() * cells.length)];
      var pt = this.cellCenter(cell);
      this.particles.push({
        x: pt[0], y: pt[1],
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.8) * 5.5,
        life: 1,
        size: 3 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }
  };

  Renderer.prototype.drawParticles = function (ctx) {
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.016;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.hasParticles = function () { return this.particles.length > 0; };

  CL.Renderer = Renderer;
  CL.Renderer.PALETTE = COLORS;
})();
