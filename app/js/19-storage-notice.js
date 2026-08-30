/* If storage is unavailable, say so plainly on the sign-in screen. */
(function () {
  if (window.TT_STORAGE_PERSISTS) return;
  document.addEventListener("DOMContentLoaded", function () {
    var note = document.querySelector("#page-auth .auth-note");
    if (!note) return;
    var p = document.createElement("strong");
    p.style.display = "block";
    p.style.marginTop = "10px";
    p.textContent = "Note: this browser has storage switched off, so your account and " +
      "sandbox runs will not be kept after you close the tab. Everything still works for this session.";
    note.appendChild(p);
  });
})();
