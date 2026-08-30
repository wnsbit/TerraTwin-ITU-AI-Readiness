/* ============================================================
   TerraTwin — Storage layer
   ------------------------------------------------------------
   All data lives in the browser's localStorage. This keeps the
   project a pure static site that runs in VS Code with no server,
   no database, and no API keys.

   IMPORTANT — read before using with real people:
   This is prototype-grade authentication. Passwords are hashed
   with a simple non-cryptographic digest so they are not stored
   in plain text, but localStorage is readable by any script on
   the page and offers no real protection. Do not put real
   credentials or real farm data in here. For production you
   would replace this file with calls to a real backend
   (e.g. Node + Express + PostgreSQL, or Firebase Auth).
   ============================================================ */

const Store = (() => {
  const KEY_USERS = "terratwin.users";
  const KEY_SESSION = "terratwin.session";
  const KEY_STATE = "terratwin.state.";
  const KEY_SETTINGS = "terratwin.settings";

  /* ---- helpers ---- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Store read failed for", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("Store write failed for", key, e);
      return false;
    }
  }

  /* Simple digest. NOT cryptographically secure — see notice above. */
  function digest(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 + c + i, 2654435761) >>> 0;
    }
    return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
  }

  function uid() {
    return "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- users ---- */
  function getUsers() {
    return read(KEY_USERS, []);
  }

  function findUser(email) {
    const target = String(email || "").trim().toLowerCase();
    return getUsers().find((u) => u.email === target) || null;
  }

  function createUser({ name, email, password, farmName, region }) {
    const users = getUsers();
    const clean = String(email).trim().toLowerCase();

    if (users.some((u) => u.email === clean)) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const user = {
      id: uid(),
      name: String(name).trim(),
      email: clean,
      passwordHash: digest(password + "::" + clean),
      farmName: String(farmName || "").trim() || "My farm",
      region: region || "Jazan",
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    if (!write(KEY_USERS, users)) {
      return { ok: false, error: "Could not save the account. Your browser storage may be full." };
    }
    return { ok: true, user };
  }

  function verifyUser(email, password) {
    const user = findUser(email);
    if (!user) return { ok: false, error: "No account found with that email." };
    if (user.passwordHash !== digest(password + "::" + user.email)) {
      return { ok: false, error: "That password does not match this account." };
    }
    return { ok: true, user };
  }

  /* ---- session ---- */
  function startSession(userId) {
    write(KEY_SESSION, { userId, startedAt: Date.now() });
  }

  function endSession() {
    localStorage.removeItem(KEY_SESSION);
  }

  function currentUser() {
    const s = read(KEY_SESSION, null);
    if (!s || !s.userId) return null;
    return getUsers().find((u) => u.id === s.userId) || null;
  }

  /* ---- per-user application state ---- */
  function defaultState() {
    return {
      readiness: {},           // questionId -> selected option index
      sandboxRuns: [],         // completed simulation runs
      bestGrowth: 0,
      chatHistory: [],
    };
  }

  function getState(userId) {
    return read(KEY_STATE + userId, defaultState());
  }

  function saveState(userId, state) {
    return write(KEY_STATE + userId, state);
  }

  function patchState(userId, patch) {
    const next = Object.assign(getState(userId), patch);
    saveState(userId, next);
    return next;
  }

  /* ---- settings (shared, e.g. optional API key) ---- */
  function getSettings() {
    return read(KEY_SETTINGS, { geminiKey: "", geminiModel: "gemini-2.0-flash" });
  }

  function saveSettings(patch) {
    const next = Object.assign(getSettings(), patch);
    write(KEY_SETTINGS, next);
    return next;
  }

  return {
    createUser,
    verifyUser,
    findUser,
    startSession,
    endSession,
    currentUser,
    getState,
    saveState,
    patchState,
    getSettings,
    saveSettings,
  };
})();
