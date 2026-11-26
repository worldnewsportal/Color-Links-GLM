/* Color Link - Coin economy (virtual only; no purchases, no ads).
   Balance, history and duplicate-protected rewards live in the v2 save. */
(function () {
  'use strict';

  var CL = globalThis.ColorLink = globalThis.ColorLink || {};

  function balance() {
    return CL.Progression.getStats() ? CL.Progression._state().coins : 0;
  }

  function add(amount, type, label) {
    return CL.Progression.addCoins(amount, type, label);
  }

  function spend(amount, reason) {
    return CL.Progression.spendCoins(amount, reason);
  }

  function history() {
    return CL.Progression.coinHistory();
  }

  CL.Coins = {
    balance: balance,
    add: add,
    spend: spend,
    history: history,
    HINT_COST: 15,
    DAILY_REWARD: 100,
    CHAPTER_REWARD: 50,
    STAR_REWARD: 5
  };
})();
