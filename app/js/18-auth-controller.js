/* ============================================================
   TerraTwin — Auth screen controller
   Handles the sign in / create account tabs and form submission.
   ============================================================ */

(function () {
  "use strict";

  // Already signed in? Go straight to the app.
  if (Store.currentUser()) {
    TT.showApp();
    return;
  }

  const tabSignIn = document.getElementById("tab-signin");
  const tabSignUp = document.getElementById("tab-signup");
  const formSignIn = document.getElementById("form-signin");
  const formSignUp = document.getElementById("form-signup");
  const msg = document.getElementById("auth-msg");

  function say(text, kind) {
    msg.textContent = text;
    msg.className = "auth-msg " + (kind || "error");
  }

  function clearMsg() {
    msg.textContent = "";
    msg.className = "auth-msg";
  }

  function showTab(which) {
    const signIn = which === "signin";
    tabSignIn.setAttribute("aria-selected", String(signIn));
    tabSignUp.setAttribute("aria-selected", String(!signIn));
    formSignIn.classList.toggle("hidden", !signIn);
    formSignUp.classList.toggle("hidden", signIn);
    clearMsg();
  }

  tabSignIn.addEventListener("click", () => showTab("signin"));
  tabSignUp.addEventListener("click", () => showTab("signup"));

  /* ---------- Create account ---------- */
  formSignUp.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMsg();

    const name = document.getElementById("su-name").value.trim();
    const email = document.getElementById("su-email").value.trim();
    const farmName = document.getElementById("su-farm").value.trim();
    const region = document.getElementById("su-region").value;
    const pw = document.getElementById("su-pw").value;
    const pw2 = document.getElementById("su-pw2").value;

    if (name.length < 2) return say("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Enter a valid email address.");
    if (pw.length < 8) return say("Use a password of at least 8 characters.");
    if (pw !== pw2) return say("The two passwords do not match.");

    const res = Store.createUser({ name, email, password: pw, farmName, region });
    if (!res.ok) return say(res.error);

    Store.startSession(res.user.id);
    say("Account created. Opening TerraTwin\u2026", "ok");
    setTimeout(() => TT.showApp(), 600);
  });

  /* ---------- Sign in ---------- */
  formSignIn.addEventListener("submit", (e) => {
    e.preventDefault();
    clearMsg();

    const email = document.getElementById("si-email").value.trim();
    const pw = document.getElementById("si-pw").value;

    if (!email || !pw) return say("Enter your email and password.");

    const res = Store.verifyUser(email, pw);
    if (!res.ok) return say(res.error);

    Store.startSession(res.user.id);
    say("Signed in. Opening TerraTwin\u2026", "ok");
    setTimeout(() => TT.showApp(), 450);
  });

  /* ---------- Demo account shortcut ---------- */
  document.getElementById("demo-link").addEventListener("click", (e) => {
    e.preventDefault();
    const email = "demo@terratwin.sa";
    let res = Store.verifyUser(email, "terratwin2026");
    if (!res.ok) {
      const made = Store.createUser({
        name: "Demo Reviewer",
        email,
        password: "terratwin2026",
        farmName: "Jazan Highland Coffee Farm",
        region: "Jazan",
      });
      if (!made.ok) return say(made.error);
      res = { ok: true, user: made.user };
    }
    Store.startSession(res.user.id);
    say("Opening the demo farm\u2026", "ok");
    setTimeout(() => TT.showApp(), 450);
  });
})();
