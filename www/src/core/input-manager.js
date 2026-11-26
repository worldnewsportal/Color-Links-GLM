/* Color Link - Unified pointer/touch input with multi-touch guard. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function attach(canvas, handlers, getMetrics) {
    var activePointer = null;
    var lastCell = -1;

    function cellFromEvent(e) {
      var metrics = getMetrics();
      if (!metrics || !metrics.cell) return -1;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left - metrics.ox;
      var y = e.clientY - rect.top - metrics.oy;
      if (x < 0 || y < 0) return -1;
      var cx = Math.floor(x / metrics.cell);
      var cy = Math.floor(y / metrics.cell);
      if (cx < 0 || cy < 0 || cx >= metrics.w || cy >= metrics.h) return -1;
      return cy * metrics.w + cx;
    }

    function down(e) {
      if (activePointer !== null) return;
      activePointer = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older WebView */ }
      e.preventDefault();
      lastCell = cellFromEvent(e);
      if (handlers.onDown) handlers.onDown(lastCell);
    }

    function move(e) {
      if (activePointer === null || e.pointerId !== activePointer) return;
      e.preventDefault();
      var cell = cellFromEvent(e);
      if (cell !== lastCell) {
        lastCell = cell;
        if (handlers.onMove) handlers.onMove(cell);
      }
    }

    function up(e) {
      if (activePointer === null || e.pointerId !== activePointer) return;
      activePointer = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      if (handlers.onUp) handlers.onUp(cellFromEvent(e));
    }

    function cancel(e) {
      if (activePointer === null || e.pointerId !== activePointer) return;
      activePointer = null;
      if (handlers.onCancel) handlers.onCancel();
    }

    canvas.addEventListener('pointerdown', down, { passive: false });
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', cancel, { passive: false });
    canvas.addEventListener('pointerleave', function (e) {
      if (activePointer !== null && e.pointerId === activePointer) {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
      }
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });

    return {
      detach: function () {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', cancel);
      },
      isActive: function () { return activePointer !== null; }
    };
  }

  CL.InputManager = { attach: attach };
})();
