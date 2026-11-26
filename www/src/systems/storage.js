/* Color Link - Safe LocalStorage wrapper with in-memory fallback. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};
  var PREFIX = 'colorlink:';
  var memory = {};
  var usable = (function () {
    try {
      var k = PREFIX + '__probe__';
      globalThis.localStorage.setItem(k, '1');
      globalThis.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function key(k) { return PREFIX + k; }

  function get(name, fallback) {
    try {
      var raw = usable ? localStorage.getItem(key(name)) : memory[name];
      if (raw === null || raw === undefined) return fallback;
      var val = JSON.parse(raw);
      if (val && typeof val === 'object' && fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
        for (var k in fallback) {
          if (!(k in val)) val[k] = fallback[k];
        }
      }
      return val;
    } catch (e) {
      return fallback;
    }
  }

  function set(name, value) {
    try {
      var raw = JSON.stringify(value);
      if (usable) localStorage.setItem(key(name), raw);
      else memory[name] = raw;
      return true;
    } catch (e) {
      memory[name] = JSON.stringify(value);
      return false;
    }
  }

  function remove(name) {
    try {
      if (usable) localStorage.removeItem(key(name));
      delete memory[name];
    } catch (e) { /* ignore */ }
  }

  CL.Storage = {
    get: get,
    set: set,
    remove: remove,
    isPersistent: function () { return usable; }
  };
})();
