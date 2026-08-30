/* ============================================================
   TerraTwin — standalone single-file router
   ------------------------------------------------------------
   The emailed build has no server and no second page, so the
   sign-in screen and the application live in the same document
   and this swaps between them. Nothing else about the app
   changes: same markup, same styles, same logic.
   ============================================================ */
const TT = (() => {
  let booted = false;
  function showApp() {
    document.getElementById("page-auth").style.display = "none";
    document.getElementById("page-app").style.display = "";
    document.body.classList.remove("auth-body");
    if (!booted) { booted = true; window.__bootApp(); }
    window.scrollTo(0, 0);
  }
  function showAuth() {
    document.getElementById("page-app").style.display = "none";
    document.getElementById("page-auth").style.display = "";
    document.body.classList.add("auth-body");
  }
  return { showApp, showAuth };
})();
