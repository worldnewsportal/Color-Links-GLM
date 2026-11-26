/* Color Link - WebAudio SFX + ambient music, no audio files needed. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var ctx = null;
  var master = null;
  var sfxGain = null;
  var musicGain = null;
  var musicTimer = null;
  var musicStep = 0;
  var soundOn = true;
  var musicOn = true;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }
      return true;
    }
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, gain, dest, when, slideTo) {
    if (!ctx) return;
    var t0 = when || ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  var sfx = {
    tap: function () { tone(520, 0.08, 'triangle', 0.5); },
    draw: function (n) {
      var f = 300 + Math.min(n || 0, 12) * 28;
      tone(f, 0.05, 'sine', 0.25);
    },
    pop: function () { tone(360, 0.06, 'sine', 0.3, null, null, 240); },
    connect: function () {
      tone(523, 0.12, 'triangle', 0.4);
      tone(784, 0.16, 'triangle', 0.3, null, ctx ? ctx.currentTime + 0.07 : 0);
    },
    win: function () {
      if (!ctx) return;
      var base = ctx.currentTime;
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.22, 'triangle', 0.4, null, base + i * 0.09);
      });
      tone(1319, 0.4, 'sine', 0.25, null, base + 0.36);
    },
    error: function () { tone(220, 0.15, 'square', 0.18, null, null, 160); },
    hint: function () { tone(880, 0.12, 'sine', 0.3, null, null, 1175); }
  };

  function play(name, arg) {
    if (!soundOn || !ensure()) return;
    if (sfx[name]) sfx[name](arg);
  }

  var SCALE = [262, 294, 330, 392, 440, 523, 587, 659];
  var PATTERN = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 5, 4, 2, 0];

  function musicTick() {
    if (!ctx || !musicOn) return;
    var note = SCALE[PATTERN[musicStep % PATTERN.length]];
    tone(note / 2, 1.4, 'sine', 0.35, musicGain);
    tone(note, 1.1, 'triangle', 0.2, musicGain);
    if (musicStep % 4 === 0) tone(note / 4, 1.8, 'sine', 0.4, musicGain);
    musicStep++;
  }

  function startMusic() {
    if (!musicOn || !ensure() || musicTimer) return;
    musicTick();
    musicTimer = setInterval(musicTick, 950);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setSound(on) { soundOn = !!on; }
  function setMusic(on) {
    musicOn = !!on;
    if (musicOn) startMusic();
    else stopMusic();
  }
  function unlock() { ensure(); }

  CL.Audio = {
    play: play,
    unlock: unlock,
    setSound: setSound,
    setMusic: setMusic,
    startMusic: startMusic,
    stopMusic: stopMusic
  };
})();
