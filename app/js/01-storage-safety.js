/* ============================================================
   TerraTwin — storage safety net (standalone build only)
   ------------------------------------------------------------
   The app stores accounts and progress in localStorage. A file
   opened straight from an email attachment, or a browser in
   private mode, can have localStorage switched off — which would
   otherwise make the sign-up form fail with a storage error.
   If that happens we install an in-memory stand-in so the app
   still runs end to end; only persistence between sessions is
   lost, and the user is told so on the sign-in screen.
   ============================================================ */
(function () {
  var ok = false;
  try {
    var k = "__tt_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    ok = true;
  } catch (e) { ok = false; }

  window.TT_STORAGE_PERSISTS = ok;
  if (ok) return;

  var mem = {};
  var shim = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = {}; },
    key: function (i) { return Object.keys(mem)[i] || null; },
    get length() { return Object.keys(mem).length; },
  };
  try {
    Object.defineProperty(window, "localStorage", { value: shim, configurable: true });
  } catch (e) {
    window.localStorage = shim;
  }
})();
