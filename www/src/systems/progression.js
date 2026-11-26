/* Color Link - Progression & settings persistence (save format v2).
   Migrates Phase 1 saves safely; never erases existing progress. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  var SAVE_KEY = 'progress_v2';
  var LEGACY_KEY = 'progress';
  var SAVE_VERSION = 2;
  var MAX_HISTORY = 60;

  var DEFAULTS = {
    version: SAVE_VERSION,
    settings: { sound: true, music: true, vibration: true, lang: 'ar', theme: 'dark' },
    unlocked: 1,
    lastPlayed: 0,
    completed: {},
    coins: 0,
    coinHistory: [],
    claimed: {},
    daily: { lastDate: null, completed: 0 },
    achievements: {},
    seenMechanics: {},
    stats: { playtimeMs: 0, hintsUsed: 0, totalMoves: 0, sessions: 0, attempts: 0, coinsEarned: 0, dailyCompleted: 0 }
  };

  var state = null;
  var listeners = [];

  function fresh() { return JSON.parse(JSON.stringify(DEFAULTS)); }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.version === SAVE_VERSION) {
      var base = fresh();
      for (var k in base) {
        if (raw[k] === undefined) continue;
        if (k === 'settings' || k === 'stats' || k === 'daily') {
          for (var sk in base[k]) {
            if (raw[k][sk] !== undefined) base[k][sk] = raw[k][sk];
          }
        } else {
          base[k] = raw[k];
        }
      }
      if (!Array.isArray(base.coinHistory)) base.coinHistory = [];
      if (typeof base.coins !== 'number' || base.coins < 0) base.coins = 0;
      return base;
    }
    return migrateLegacy(raw);
  }

  /* Phase 1 save -> v2. Progress is preserved, never erased. */
  function migrateLegacy(legacy) {
    var s = fresh();
    if (!legacy || typeof legacy !== 'object') return s;
    if (legacy.settings) {
      for (var k in s.settings) {
        if (legacy.settings[k] !== undefined) s.settings[k] = legacy.settings[k];
      }
    }
    s.unlocked = typeof legacy.unlocked === 'number' && legacy.unlocked > 0 ? legacy.unlocked : 1;
    s.lastPlayed = typeof legacy.lastPlayed === 'number' ? legacy.lastPlayed : 0;
    if (legacy.completed && typeof legacy.completed === 'object') {
      for (var id in legacy.completed) {
        var rec = legacy.completed[id];
        if (!rec || typeof rec !== 'object') continue;
        s.completed[id] = {
          timeSec: rec.timeSec || 0,
          moves: rec.moves || 0,
          date: rec.date || Date.now(),
          stars: 1
        };
      }
    }
    var legacyCoins = legacy.stats && typeof legacy.stats.coins === 'number' ? legacy.stats.coins : 0;
    s.coins = legacyCoins;
    s.stats.coinsEarned = legacyCoins;
    if (legacy.stats) {
      var map = { playtimeMs: 'playtimeMs', hintsUsed: 'hintsUsed', totalMoves: 'totalMoves', sessions: 'sessions' };
      for (var f in map) {
        if (typeof legacy.stats[f] === 'number') s.stats[f] = legacy.stats[f];
      }
    }
    return s;
  }

  function load() {
    var raw = CL.Storage.get(SAVE_KEY, null);
    var migrated = false;
    if (!raw) {
      var legacy = CL.Storage.get(LEGACY_KEY, null);
      if (legacy) {
        state = migrateLegacy(legacy);
        migrated = true;
      } else {
        state = fresh();
      }
    } else {
      state = sanitize(raw) || fresh();
    }
    for (var k in DEFAULTS) {
      if (!(k in state)) state[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
    }
    for (var st in DEFAULTS.stats) {
      if (!(st in state.stats)) state.stats[st] = DEFAULTS.stats[st];
    }
    for (var se in DEFAULTS.settings) {
      if (!(se in state.settings)) state.settings[se] = DEFAULTS.settings[se];
    }
    if (migrated) {
      CL.Storage.set(SAVE_KEY, state);
      CL.Storage.remove(LEGACY_KEY);
    }
  }

  function ensure() { if (!state) load(); }

  function save() {
    state.version = SAVE_VERSION;
    CL.Storage.set(SAVE_KEY, state);
    for (var i = 0; i < listeners.length; i++) listeners[i]();
  }

  function init() {
    if (!state) load();
    state.stats.sessions++;
    save();
  }

  function onChange(fn) { listeners.push(fn); }

  function totalLevels() { return CL.LevelManager.count(); }

  /* ----- chapters ----- */

  function chapterUnlocked(chapterId) {
    ensure();
    if (chapterId <= 1) return true;
    var chapterList = CL.LevelManager.chapters();
    var prev = chapterList[chapterId - 2];
    var def = chapterList[chapterId - 1];
    var done = 0;
    for (var id = prev.from; id <= prev.to; id++) {
      if (state.completed[id]) done++;
    }
    var pct = done / (prev.to - prev.from + 1);
    if (pct >= 0.8) return true;
    /* Preserve pre-Phase-2 access: legacy unlocks inside this chapter stay open. */
    return state.unlocked > def.from;
  }

  function isUnlocked(id) {
    ensure();
    if (id > state.unlocked) return false;
    return chapterUnlocked(CL.LevelManager.chapterOf(id).id);
  }

  function currentLevel() {
    ensure();
    var id = Math.min(state.unlocked, totalLevels());
    while (id > 1 && !isUnlocked(id)) id--;
    return id;
  }

  function lastPlayed() {
    ensure();
    return state.lastPlayed > 0 && isUnlocked(state.lastPlayed) ? state.lastPlayed : currentLevel();
  }

  /* ----- coins ----- */

  function recordHistory(type, label, amount) {
    state.coinHistory.unshift({ t: Date.now(), type: type, label: label, amount: amount });
    if (state.coinHistory.length > MAX_HISTORY) state.coinHistory.length = MAX_HISTORY;
  }

  function addCoins(amount, type, label) {
    ensure();
    amount = Math.max(0, Math.round(amount));
    if (!amount) return 0;
    state.coins += amount;
    state.stats.coinsEarned += amount;
    recordHistory(type, label, amount);
    save();
    return amount;
  }

  function spendCoins(amount, reason) {
    ensure();
    amount = Math.max(0, Math.round(amount));
    if (state.coins < amount) return false;
    state.coins -= amount;
    recordHistory('spend', reason || 'hint', -amount);
    save();
    return true;
  }

  function coinHistory() {
    ensure();
    return state.coinHistory.slice();
  }

  function hasClaimed(key) {
    ensure();
    return !!state.claimed[key];
  }

  function claimOnce(key, amount, type, label) {
    ensure();
    if (state.claimed[key]) return 0;
    state.claimed[key] = Date.now();
    return addCoins(amount, type, label);
  }

  /* ----- levels ----- */

  function checkChapterReward(id) {
    var chapter = CL.LevelManager.chapterOf(id);
    for (var lid = chapter.from; lid <= chapter.to; lid++) {
      if (!state.completed[lid]) return 0;
    }
    return claimOnce('chapter_' + chapter.id, 50, 'chapter', 'chapter_' + chapter.id);
  }

  /* record: { moves, timeSec }. Returns summary for UI feedback. */
  function completeLevel(id, record) {
    ensure();
    var prev = state.completed[id];
    var stars = CL.LevelManager.starsFor(id, record.moves);
    var prevStars = prev ? (prev.stars || 0) : 0;
    var newStars = Math.max(prevStars, stars);
    var better = !prev || record.moves < prev.moves || (record.moves === prev.moves && record.timeSec < prev.timeSec);
    state.completed[id] = {
      timeSec: prev ? Math.min(prev.timeSec, record.timeSec) : record.timeSec,
      moves: prev ? Math.min(prev.moves, record.moves) : record.moves,
      date: prev ? prev.date : Date.now(),
      stars: newStars
    };
    if (id >= state.unlocked && id < totalLevels()) state.unlocked = id + 1;
    state.lastPlayed = id;

    var coins = 0;
    if (!prev) {
      coins += claimOnce('level_' + id, 10, 'level', 'level_' + id);
    }
    var starGain = newStars - prevStars;
    if (starGain > 0) {
      coins += claimOnce('stars_' + id + '_' + newStars, starGain * 5, 'stars', 'stars_' + id);
    }
    coins += checkChapterReward(id);
    save();
    return { better: better, stars: newStars, starGain: starGain, coinsEarned: coins, firstTime: !prev };
  }

  function setLastPlayed(id) {
    ensure();
    state.lastPlayed = id;
    save();
  }

  function getBest(id) { ensure(); return state.completed[id] || null; }

  function stars(id) { ensure(); var b = state.completed[id]; return b ? (b.stars || 0) : 0; }

  function totalStars() {
    ensure();
    var n = 0;
    for (var id in state.completed) n += state.completed[id].stars || 0;
    return n;
  }

  function maxStars() { return totalLevels() * 3; }

  function completedCount() { ensure(); return Object.keys(state.completed).length; }

  function progressPct() {
    return Math.round((completedCount() / totalLevels()) * 100);
  }

  function chapterProgress(chapterId) {
    ensure();
    var chapterList = CL.LevelManager.chapters();
    var ch = chapterList[chapterId - 1];
    var done = 0, starsN = 0;
    var total = ch.to - ch.from + 1;
    for (var id = ch.from; id <= ch.to; id++) {
      var rec = state.completed[id];
      if (rec) { done++; starsN += rec.stars || 0; }
    }
    return {
      id: chapterId,
      key: ch.key,
      from: ch.from,
      to: ch.to,
      total: total,
      completed: done,
      stars: starsN,
      maxStars: total * 3,
      pct: Math.round((done / total) * 100),
      unlocked: chapterUnlocked(chapterId),
      rewardClaimed: !!state.claimed['chapter_' + chapterId]
    };
  }

  /* ----- daily ----- */

  function completeDaily(dateKey, amount) {
    ensure();
    var first = state.daily.lastDate !== dateKey;
    state.daily.lastDate = dateKey;
    if (first) {
      state.daily.completed++;
      state.stats.dailyCompleted++;
      var coins = claimOnce('daily_' + dateKey, amount || 100, 'daily', dateKey);
      save();
      return { first: true, coinsEarned: coins };
    }
    save();
    return { first: false, coinsEarned: 0 };
  }

  function dailyDone(dateKey) {
    ensure();
    return state.daily.lastDate === dateKey;
  }

  /* ----- achievements ----- */

  function unlockAchievement(id) {
    ensure();
    if (state.achievements[id]) return false;
    state.achievements[id] = { date: Date.now() };
    save();
    return true;
  }

  function achievementUnlocked(id) {
    ensure();
    return !!state.achievements[id];
  }

  function achievement(id) { ensure(); return state.achievements[id] || null; }

  function markMechanicSeen(key) {
    ensure();
    if (state.seenMechanics[key]) return false;
    state.seenMechanics[key] = true;
    save();
    return true;
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
    state = fresh();
    if (settings) state.settings = settings;
    save();
  }

  CL.Progression = {
    init: init,
    onChange: onChange,
    isUnlocked: isUnlocked,
    chapterUnlocked: chapterUnlocked,
    currentLevel: currentLevel,
    lastPlayed: lastPlayed,
    completeLevel: completeLevel,
    setLastPlayed: setLastPlayed,
    getBest: getBest,
    stars: stars,
    totalStars: totalStars,
    maxStars: maxStars,
    completedCount: completedCount,
    progressPct: progressPct,
    chapterProgress: chapterProgress,
    completeDaily: completeDaily,
    dailyDone: dailyDone,
    unlockAchievement: unlockAchievement,
    achievementUnlocked: achievementUnlocked,
    achievement: achievement,
    markMechanicSeen: markMechanicSeen,
    addCoins: addCoins,
    spendCoins: spendCoins,
    coinHistory: coinHistory,
    hasClaimed: hasClaimed,
    claimOnce: claimOnce,
    addPlaytime: addPlaytime,
    addStats: addStats,
    getStats: getStats,
    getSettings: getSettings,
    setSetting: setSetting,
    resetAll: resetAll,
    totalLevels: totalLevels,
    saveVersion: function () { return SAVE_VERSION; },
    _state: function () { return state; }
  };
})();
