/* Color Link - Progression & settings persistence. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var DEFAULTS = {
    settings: { sound: true, music: true, vibration: true, lang: 'en', theme: 'dark' },
    unlocked: 1,
    lastPlayed: 0,
    completed: {},
    stats: { playtimeMs: 0, hintsUsed: 0, totalMoves: 0, sessions: 0 }
  };

  var state = null;
  var listeners = [];

  function load() {
    state = CL.Storage.get('progress', JSON.parse(JSON.stringify(DEFAULTS)));
    for (var k in DEFAULTS) {
      if (!(k in state)) state[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
    }
    for (var s in DEFAULTS.settings) {
      if (!(s in state.settings)) state.settings[s] = DEFAULTS.settings[s];
    }
  }

  function ensure() { if (!state) load(); }

  function save() {
    CL.Storage.set('progress', state);
    for (var i = 0; i < listeners.length; i++) listeners[i]();
  }

  function init() {
    if (!state) load();
    state.stats.sessions++;
    save();
  }

  function onChange(fn) { listeners.push(fn); }

  function totalLevels() { return CL.LevelManager.count(); }

  function isUnlocked(id) { ensure(); return id <= state.unlocked; }

  function currentLevel() { ensure(); return Math.min(state.unlocked, totalLevels()); }

  function lastPlayed() {
    ensure();
    return state.lastPlayed > 0 && isUnlocked(state.lastPlayed) ? state.lastPlayed : currentLevel();
  }

  function completeLevel(id, record) {
    ensure();
    var prev = state.completed[id];
    var better = !prev || record.moves < prev.moves || (record.moves === prev.moves && record.timeSec < prev.timeSec);
    state.completed[id] = {
      timeSec: prev ? Math.min(prev.timeSec, record.timeSec) : record.timeSec,
      moves: prev ? Math.min(prev.moves, record.moves) : record.moves,
      date: Date.now()
    };
    if (id >= state.unlocked && id < totalLevels()) state.unlocked = id + 1;
    state.lastPlayed = id;
    save();
    return better;
  }

  function setLastPlayed(id) {
    ensure();
    state.lastPlayed = id;
    save();
  }

  function getBest(id) { ensure(); return state.completed[id] || null; }

  function completedCount() { ensure(); return Object.keys(state.completed).length; }

  function progressPct() {
    return Math.round((completedCount() / totalLevels()) * 100);
  }

  function addPlaytime(ms) {
    ensure();
    state.stats.playtimeMs += ms;
    save();
  }

  function addStats(field, n) {
    ensure();
    if (field in state.stats) state.stats[field] += n;
    save();
  }

  function getStats() { ensure(); return state.stats; }

  function getSettings() { ensure(); return state.settings; }

  function setSetting(key, value) {
    ensure();
    state.settings[key] = value;
    save();
  }

  function resetAll() {
    var settings = state ? JSON.parse(JSON.stringify(state.settings)) : null;
    state = JSON.parse(JSON.stringify(DEFAULTS));
    if (settings) state.settings = settings;
    save();
  }

  CL.Progression = {
    init: init,
    onChange: onChange,
    isUnlocked: isUnlocked,
    currentLevel: currentLevel,
    lastPlayed: lastPlayed,
    completeLevel: completeLevel,
    setLastPlayed: setLastPlayed,
    getBest: getBest,
    completedCount: completedCount,
    progressPct: progressPct,
    addPlaytime: addPlaytime,
    addStats: addStats,
    getStats: getStats,
    getSettings: getSettings,
    setSetting: setSetting,
    resetAll: resetAll,
    totalLevels: totalLevels,
    _state: function () { return state; }
  };
})();
