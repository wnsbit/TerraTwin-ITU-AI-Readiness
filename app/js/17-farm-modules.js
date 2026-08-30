/* ============================================================
   TerraTwin — Farm modules
   ------------------------------------------------------------
   Farm operations layer: the plant register
   with irrigation and fertilisation scheduling, the Gemini
   vision plant doctor, the weather-swing alert engine, the
   Tihama season calendar, the farmers' forum (text, photo and
   voice), and the local market.

   The module attaches itself after the original application
   controller has booted, so nothing in the existing code needed
   to be rewritten — the views, the styles and the storage layer
   are all reused as they are.
   ============================================================ */

const FarmModules = (() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  let user = null;
  let state = null;

  /* ---------------- storage ---------------- */

  const COMMUNITY_KEY = "terratwin.community";

  function readCommunity() {
    try {
      const raw = localStorage.getItem(COMMUNITY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage disabled — fall through to seeds */ }
    const seeded = { posts: seedPosts(), listings: seedListings() };
    writeCommunity(seeded);
    return seeded;
  }

  function writeCommunity(data) {
    try {
      localStorage.setItem(COMMUNITY_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Community store write failed", e);
    }
    return data;
  }

  function loadState() {
    state = Store.getState(user.id);
    if (!Array.isArray(state.plants)) state.plants = [];
    if (!Array.isArray(state.tasks)) state.tasks = [];
    if (!Array.isArray(state.scans)) state.scans = [];
    if (!Array.isArray(state.orders)) state.orders = [];
    if (typeof state.waterSaved !== "number") state.waterSaved = 0;
    return state;
  }

  function save() {
    Store.patchState(user.id, {
      plants: state.plants,
      tasks: state.tasks,
      scans: state.scans,
      orders: state.orders,
      waterSaved: state.waterSaved,
    });
  }

  /* ---------------- small helpers ---------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function uid(p) {
    return (p || "x") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  const DAY = 86400000;

  function today0() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dayDiff(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - today0()) / DAY);
  }

  function whenLabel(iso) {
    const n = dayDiff(iso);
    if (n === null) return "—";
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n === -1) return "1 day late";
    if (n < 0) return Math.abs(n) + " days late";
    return "in " + n + " days";
  }

  function shortDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function ago(iso) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const h = Math.round(mins / 60);
    if (h < 24) return h + "h ago";
    const d = Math.round(h / 24);
    if (d < 30) return d + "d ago";
    return shortDate(iso);
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2)
      .map((w) => w[0]).join("").toUpperCase();
  }

  function readFileAsDataURL(file, maxSide) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("Could not read that file."));
      fr.onload = () => {
        if (!maxSide || !/^data:image\//.test(fr.result)) return resolve(fr.result);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => resolve(fr.result);
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ============================================================
     PLANT CATALOGUE — what a Jazan farm actually grows
     ============================================================ */

  const PLANT_TYPES = [
    { id: "mango",    name: "Mango",            ar: "مانجو",   glyph: "🥭", water: 4,  fert: 45, litres: 180,
      seasons: ["spring", "summer"], note: "Coastal and wadi land. Flowers in winter, fruits through summer." },
    { id: "coffee",   name: "Khawlani coffee",  ar: "بن خولاني", glyph: "☕", water: 5,  fert: 60, litres: 90,
      seasons: ["spring", "autumn"], note: "Highland terraces above 900 m. Needs shade and steady moisture." },
    { id: "banana",   name: "Banana",           ar: "موز",     glyph: "🍌", water: 2,  fert: 30, litres: 220,
      seasons: ["spring", "summer", "autumn"], note: "Heavy feeder and heavy drinker — wadi silt is ideal." },
    { id: "papaya",   name: "Papaya",           ar: "بابايا",  glyph: "🫒", water: 3,  fert: 30, litres: 120,
      seasons: ["spring", "autumn"], note: "Fast to fruit, intolerant of waterlogged roots." },
    { id: "sorghum",  name: "Sorghum",          ar: "ذرة رفيعة", glyph: "🌾", water: 6,  fert: 40, litres: 70,
      seasons: ["summer", "autumn"], note: "The traditional Tihama field crop — drought-hardy once established." },
    { id: "sesame",   name: "Sesame",           ar: "سمسم",    glyph: "🌱", water: 7,  fert: 45, litres: 60,
      seasons: ["summer"], note: "Sown into residual moisture, low water demand, sensitive to waterlogging." },
    { id: "millet",   name: "Pearl millet",     ar: "دخن",     glyph: "🌾", water: 7,  fert: 45, litres: 55,
      seasons: ["summer", "autumn"], note: "Tolerates heat and poor soils better than almost anything else." },
    { id: "datepalm", name: "Date palm",        ar: "نخيل",    glyph: "🌴", water: 7,  fert: 90, litres: 300,
      seasons: ["spring"], note: "Deep-rooted and salt-tolerant. Water long and infrequently." },
    { id: "lime",     name: "Lime / citrus",    ar: "ليمون",   glyph: "🍋", water: 4,  fert: 45, litres: 140,
      seasons: ["spring", "autumn"], note: "Watch for salinity burn on leaf tips in coastal soils." },
    { id: "guava",    name: "Guava",            ar: "جوافة",   glyph: "🍐", water: 4,  fert: 45, litres: 130,
      seasons: ["spring", "autumn"], note: "Reliable and forgiving — good first tree for a new plot." },
    { id: "tomato",   name: "Tomato",           ar: "طماطم",   glyph: "🍅", water: 2,  fert: 21, litres: 45,
      seasons: ["autumn", "winter"], note: "Winter crop on the coast — summer heat aborts the flowers." },
    { id: "okra",     name: "Okra",             ar: "بامية",   glyph: "🌶", water: 3,  fert: 25, litres: 50,
      seasons: ["spring", "summer"], note: "Loves the heat. Pick every other day or the pods turn woody." },
    { id: "cucumber", name: "Cucumber",         ar: "خيار",    glyph: "🥒", water: 2,  fert: 21, litres: 55,
      seasons: ["autumn", "winter"], note: "Shallow-rooted — small, frequent irrigation beats a weekly flood." },
    { id: "alfalfa",  name: "Alfalfa / fodder", ar: "برسيم",   glyph: "🍀", water: 4,  fert: 40, litres: 200,
      seasons: ["winter", "spring"], note: "Cut every 25–30 days. The biggest water user on most farms." },
    { id: "other",    name: "Something else",   ar: "أخرى",    glyph: "🪴", water: 4,  fert: 30, litres: 100,
      seasons: ["spring", "summer", "autumn", "winter"], note: "Set your own irrigation rhythm below." },
  ];

  function typeOf(id) {
    return PLANT_TYPES.find((t) => t.id === id) || PLANT_TYPES[PLANT_TYPES.length - 1];
  }

  /* ============================================================
     PLANTS — register, schedule, log
     ============================================================ */

  function nextDue(plant, kind) {
    const every = kind === "water" ? plant.waterEvery : plant.fertEvery;
    const last = kind === "water" ? plant.lastWatered : plant.lastFert;
    const base = last ? new Date(last) : new Date(plant.planted || Date.now());
    const skip = kind === "water" ? (plant.waterSkipDays || 0) : 0;
    return new Date(base.getTime() + (Number(every) + skip) * DAY).toISOString();
  }

  function plantTasks() {
    const out = [];
    state.plants.forEach((p) => {
      out.push({
        id: p.id + ":water",
        plantId: p.id,
        kind: "water",
        title: "Irrigate " + p.name,
        sub: typeOf(p.type).name + (p.plot ? " · " + p.plot : ""),
        due: nextDue(p, "water"),
      });
      out.push({
        id: p.id + ":fert",
        plantId: p.id,
        kind: "fert",
        title: "Fertilise " + p.name,
        sub: typeOf(p.type).name + (p.plot ? " · " + p.plot : ""),
        due: nextDue(p, "fert"),
      });
    });
    return out;
  }

  function allTasks() {
    const custom = state.tasks.map((t) => ({
      id: t.id, kind: t.kind || "custom", title: t.title, sub: t.sub || "Your reminder",
      due: t.due, custom: true, done: t.done,
    }));
    return plantTasks().concat(custom).sort((a, b) => new Date(a.due) - new Date(b.due));
  }

  function dueCounts() {
    let due = 0, late = 0;
    allTasks().forEach((t) => {
      if (t.done) return;
      const n = dayDiff(t.due);
      if (n < 0) late++;
      else if (n === 0) due++;
    });
    return { due, late };
  }

  function renderPlants() {
    const grid = $("#plant-grid");
    const c = dueCounts();
    $("#pl-count").textContent = state.plants.length;
    $("#pl-due").textContent = c.due;
    $("#pl-late").textContent = c.late;
    $("#pl-saved").innerHTML = Math.round(state.waterSaved) + '<span class="unit"> L</span>';

    if (!state.plants.length) {
      grid.innerHTML =
        '<div class="card panel"><p class="empty-note" style="padding:0;">' +
        "Nothing registered yet. Add your first plant above — the moment you do, its " +
        "irrigation and fertilisation dates start appearing in the calendar, on the " +
        "dashboard, and in the weather alerts." +
        "</p></div>";
      return;
    }

    grid.innerHTML = state.plants.map((p) => {
      const t = typeOf(p.type);
      const age = p.planted ? Math.max(0, Math.round((Date.now() - new Date(p.planted)) / DAY)) : null;
      const wd = dayDiff(nextDue(p, "water"));
      const fd = dayDiff(nextDue(p, "fert"));
      const cls = (n) => (n < 0 ? "late" : n === 0 ? "due" : "");
      const lastScan = (p.scans && p.scans.length) ? p.scans[p.scans.length - 1] : null;

      return (
        '<div class="card plant-card" data-plant="' + p.id + '">' +
          '<div class="plant-photo">' +
            (p.photo
              ? '<img src="' + p.photo + '" alt="" />'
              : '<span class="glyph">' + t.glyph + "</span>") +
          "</div>" +
          '<div class="plant-body">' +
            '<div class="plant-name">' + esc(p.name) + "</div>" +
            '<div class="plant-meta">' + esc(t.name) + " · " + esc(t.ar) +
              (p.plot ? " · " + esc(p.plot) : "") +
              (age !== null ? " · day " + age : "") +
            "</div>" +

            '<div class="due-row ' + cls(wd) + '">' +
              '<span class="due-ico">💧</span><span>Irrigation</span>' +
              '<span class="due-when">' + whenLabel(nextDue(p, "water")) + "</span>" +
            "</div>" +
            '<div class="due-row ' + cls(fd) + '">' +
              '<span class="due-ico">🌾</span><span>Fertiliser</span>' +
              '<span class="due-when">' + whenLabel(nextDue(p, "fert")) + "</span>" +
            "</div>" +

            (lastScan
              ? '<div class="due-row"><span class="due-ico">🔬</span><span>' +
                esc(lastScan.status) + '</span><span class="due-when">' + ago(lastScan.at) + "</span></div>"
              : "") +

            (p.note ? '<p class="empty-note" style="padding:8px 0 0;">' + esc(p.note) + "</p>" : "") +

            '<div class="plant-actions">' +
              '<button class="btn btn-primary" data-act="water">Watered</button>' +
              '<button class="btn btn-secondary" data-act="fert">Fertilised</button>' +
              '<button class="btn btn-ghost" data-act="scan">Scan</button>' +
              '<button class="btn btn-ghost" data-act="del">Remove</button>' +
            "</div>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function wirePlants() {
    const typeSel = $("#pl-type");
    typeSel.innerHTML = PLANT_TYPES
      .map((t) => '<option value="' + t.id + '">' + esc(t.name) + " — " + esc(t.ar) + "</option>")
      .join("");

    typeSel.addEventListener("change", () => {
      const t = typeOf(typeSel.value);
      $("#pl-water").value = t.water;
      $("#pl-fert").value = t.fert;
    });

    $("#pl-date").valueAsDate = new Date();

    let photoData = null;
    $("#pl-photo-btn").addEventListener("click", () => $("#pl-photo").click());
    $("#pl-photo").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      photoData = await readFileAsDataURL(f, 640);
      $("#pl-photo-name").textContent = "Photo attached";
    });

    $("#pl-add").addEventListener("click", () => {
      const name = $("#pl-name").value.trim();
      if (!name) { toast("Give the plant a name first."); return; }

      state.plants.push({
        id: uid("p"),
        name: name,
        type: $("#pl-type").value,
        plot: $("#pl-plot").value.trim(),
        planted: $("#pl-date").value || new Date().toISOString().slice(0, 10),
        waterEvery: Math.max(1, Number($("#pl-water").value) || 3),
        fertEvery: Math.max(1, Number($("#pl-fert").value) || 30),
        lastWatered: null,
        lastFert: null,
        waterSkipDays: 0,
        note: $("#pl-note").value.trim(),
        photo: photoData,
        scans: [],
      });
      save();

      $("#pl-name").value = "";
      $("#pl-plot").value = "";
      $("#pl-note").value = "";
      $("#pl-photo-name").textContent = "";
      photoData = null;

      renderPlants();
      renderCalendar();
      renderFarmToday();
      refreshBadges();
      toast("Plant added — its schedule is now running.");
    });

    $("#plant-grid").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const card = btn.closest("[data-plant]");
      const p = state.plants.find((x) => x.id === card.dataset.plant);
      if (!p) return;

      const act = btn.dataset.act;
      if (act === "water") {
        p.lastWatered = new Date().toISOString();
        p.waterSkipDays = 0;
        toast("Irrigation logged for " + p.name + ".");
      } else if (act === "fert") {
        p.lastFert = new Date().toISOString();
        toast("Fertilisation logged for " + p.name + ".");
      } else if (act === "scan") {
        scanTarget = p.id;
        goView("doctor");
        toast("Scanning for " + p.name + " — capture or upload a photo.");
        return;
      } else if (act === "del") {
        if (!confirm("Remove " + p.name + " and its scan history?")) return;
        state.plants = state.plants.filter((x) => x.id !== p.id);
        toast("Plant removed.");
      }

      save();
      renderPlants();
      renderCalendar();
      renderFarmToday();
      refreshBadges();
    });
  }

  /* ============================================================
     PLANT DOCTOR — Gemini vision, with an offline fallback
     ============================================================ */

  let stream = null;
  let lastShot = null;
  let scanTarget = null;

  function camStage() { return $("#cam-stage"); }

  function showPlaceholder() {
    camStage().innerHTML =
      '<div class="cam-placeholder" id="cam-placeholder"><span class="big">🌿</span>' +
      "Start the camera, or upload a photo from your phone.<br />" +
      "Nothing is stored anywhere but this browser.</div>" +
      '<div class="scan-scanline"></div>';
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.srcObject = stream;
      camStage().innerHTML = "";
      camStage().appendChild(v);
      camStage().insertAdjacentHTML("beforeend", '<div class="scan-scanline"></div>');
      $("#cam-shot").classList.remove("hidden");
      $("#cam-start").classList.add("hidden");
    } catch (err) {
      toast("Camera unavailable here — upload a photo instead.");
      camStage().innerHTML =
        '<div class="cam-placeholder"><span class="big">📵</span>' +
        "The browser refused camera access.<br />Serve the file over http/https, or just upload a photo." +
        "</div><div class=\"scan-scanline\"></div>";
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function captureFrame() {
    const v = camStage().querySelector("video");
    if (!v) return null;
    const c = document.createElement("canvas");
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  }

  function showShot(dataUrl) {
    camStage().innerHTML =
      '<img class="shot" src="' + dataUrl + '" alt="Captured plant photo" />' +
      '<div class="scan-scanline"></div>';
    $("#cam-shot").classList.add("hidden");
    $("#cam-start").classList.add("hidden");
    $("#cam-again").classList.remove("hidden");
  }

  /* --- offline vision: leaf colour statistics --- */
  function localVision(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = 120;
        c.height = Math.max(1, Math.round((img.height / img.width) * 120));
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;

        let green = 0, yellow = 0, brown = 0, dark = 0, total = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          total++;
          if (g > r + 12 && g > b + 12) green++;
          else if (r > 140 && g > 120 && b < 110) yellow++;
          else if (r > 70 && r < 165 && g > 40 && g < 125 && b < 90) brown++;
          else if (r < 60 && g < 60 && b < 60) dark++;
        }

        const gp = green / total, yp = yellow / total, bp = brown / total;
        const health = Math.max(5, Math.min(98, Math.round(gp * 130 - yp * 55 - bp * 70 + 22)));

        let status = "Healthy", diagnosis, actions;
        if (health >= 72) {
          status = "Healthy";
          diagnosis = "Leaf colour is dominated by chlorophyll green with little discolouration. Canopy looks well fed and adequately watered.";
          actions = ["Keep the current irrigation interval", "Photograph the same leaf weekly to track any drift", "Check the underside of leaves for early pest eggs"];
        } else if (health >= 48) {
          status = "Mild stress";
          diagnosis = "Noticeable yellowing across the sampled area. In Jazan conditions that usually reads as nitrogen shortage, irrigation water high in salts, or heat stress at midday.";
          actions = ["Leach the root zone with one long irrigation to move salts down", "Apply a light nitrogen dose and re-check in ten days", "Shade or mulch the root zone if midday temperatures are above 40 °C"];
        } else {
          status = "Distressed";
          diagnosis = "Substantial browning and necrotic tissue in the sampled area — leaf scorch, advanced salinity damage, or a fungal or boring pest that is already established.";
          actions = ["Remove and destroy the worst-affected leaves and fallen material", "Inspect the trunk base and roots for rot or borer holes", "Post the photo to the forum — someone nearby has likely seen this exact thing"];
        }

        resolve({
          species: "Not identified offline",
          arabic: "",
          stage: "Unknown without the vision model",
          health: health,
          status: status,
          diagnosis: diagnosis,
          causes: ["Colour analysis only — no species model running locally"],
          actions: actions,
          confidence: "Low — colour heuristic",
          mode: "Local vision",
        });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function geminiVision(dataUrl) {
    const cfg = Store.getSettings();
    if (!cfg.geminiKey || !cfg.geminiKey.trim()) return null;

    const model = cfg.geminiModel || "gemini-2.0-flash";
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + encodeURIComponent(cfg.geminiKey);

    const b64 = dataUrl.split(",")[1];
    const prompt =
      "You are an agronomist working in Jazan, Saudi Arabia — hot humid Tihama coast, " +
      "highland terraces at Fifa and Al-Reeth, saline irrigation water in coastal soils. " +
      "Look at this plant photo and reply with JSON only, no markdown fence, no commentary, " +
      'using exactly these keys: {"species": string, "arabic": string, "stage": string, ' +
      '"health": number 0-100, "status": one of "Healthy"|"Mild stress"|"Distressed"|"Critical", ' +
      '"diagnosis": string, "causes": string[], "actions": string[], "confidence": string}. ' +
      "Write actions as concrete steps a smallholder can take this week with what is available locally. " +
      "If the image is not a plant, say so in diagnosis and set health to 0.";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inline_data: { mime_type: "image/jpeg", data: b64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 900 },
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err.error && err.error.message ? " — " + err.error.message : "";
      } catch (e) { /* body not JSON */ }
      throw new Error("Gemini vision failed (" + res.status + ")" + detail);
    }

    const data = await res.json();
    const parts = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts;
    const text = (parts || []).map((p) => p.text || "").join("").trim();
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    } catch (e) {
      throw new Error("The vision model did not return readable JSON.");
    }
    parsed.mode = "Gemini · " + model;
    return parsed;
  }

  function renderDiagnosis(r) {
    const pill = $("#diag-mode");
    const body = $("#diag-body");

    if (!r) {
      pill.textContent = "Waiting";
      pill.className = "status-pill mid";
      return;
    }

    const band = r.health >= 72 ? "high" : r.health >= 45 ? "mid" : "low";
    pill.textContent = r.mode;
    pill.className = "status-pill " + (r.mode.indexOf("Gemini") === 0 ? "high" : "mid");

    body.innerHTML =
      '<div class="diag-head">' +
        '<span class="status-pill ' + band + '">' + esc(r.status) + "</span>" +
        '<span class="diag-verdict">' + esc(r.species || "Unidentified") +
        (r.arabic ? ' <span class="ar">' + esc(r.arabic) + "</span>" : "") + "</span>" +
      "</div>" +

      '<div class="bar" style="margin-bottom:14px;"><div class="bar-fill ' + band +
        '" style="width:' + Math.max(0, Math.min(100, r.health)) + '%"></div></div>' +

      '<div class="diag-line"><span class="k">Health</span><span class="v">' + Math.round(r.health) + " / 100</span></div>" +
      '<div class="diag-line"><span class="k">Life stage</span><span class="v">' + esc(r.stage || "—") + "</span></div>" +
      '<div class="diag-line"><span class="k">Confidence</span><span class="v">' + esc(r.confidence || "—") + "</span></div>" +

      '<p class="empty-note" style="padding:13px 0 0;">' + esc(r.diagnosis) + "</p>" +

      (Array.isArray(r.causes) && r.causes.length
        ? '<div class="tagline-row">' + r.causes.slice(0, 5)
            .map((c) => '<span class="tag-pill">' + esc(c) + "</span>").join("") + "</div>"
        : "") +

      "<h4 style=\"margin:16px 0 4px;font-family:var(--display);font-size:14px;color:var(--forest);\">Do this week</h4>" +
      '<ol class="diag-steps">' +
        (Array.isArray(r.actions) ? r.actions : []).map((a) => "<li>" + esc(a) + "</li>").join("") +
      "</ol>" +

      '<div class="tool-row" style="margin:14px 0 0;">' +
        '<button class="btn btn-ghost" id="diag-ask" type="button">Ask the forum</button>' +
        (state.plants.length
          ? '<button class="btn btn-secondary" id="diag-attach" type="button">Save to a plant</button>'
          : "") +
      "</div>";

    const askBtn = $("#diag-ask");
    if (askBtn) {
      askBtn.addEventListener("click", () => {
        goView("forum");
        $("#post-text").value =
          "Plant doctor read this as: " + r.status + " — " + (r.species || "unidentified") +
          ". " + (r.diagnosis || "") + "\n\nHas anyone seen this on their farm?";
        if (lastShot) setPostImage(lastShot);
        toast("Draft ready — add anything you want and post it.");
      });
    }

    const attachBtn = $("#diag-attach");
    if (attachBtn) {
      attachBtn.addEventListener("click", () => {
        const names = state.plants.map((p, i) => (i + 1) + ") " + p.name).join("\n");
        const pick = prompt("Save this scan to which plant?\n\n" + names, "1");
        const idx = Number(pick) - 1;
        const p = state.plants[idx];
        if (!p) return;
        p.scans = p.scans || [];
        p.scans.push({ at: new Date().toISOString(), status: r.status, health: r.health, species: r.species });
        save();
        renderPlants();
        toast("Scan saved to " + p.name + ".");
      });
    }
  }

  async function analyse(dataUrl) {
    lastShot = dataUrl;
    showShot(dataUrl);
    camStage().classList.add("scanning");
    $("#diag-mode").textContent = "Analysing…";
    $("#diag-mode").className = "status-pill mid";
    $("#diag-body").innerHTML = '<p class="empty-note">Reading the image…</p>';

    let result = null;
    try {
      result = await geminiVision(dataUrl);
    } catch (err) {
      toast(err.message);
    }
    if (!result) result = await localVision(dataUrl);

    camStage().classList.remove("scanning");
    if (!result) {
      $("#diag-body").innerHTML = '<p class="empty-note">That image could not be read. Try another photo.</p>';
      return;
    }

    const record = {
      id: uid("s"),
      at: new Date().toISOString(),
      img: dataUrl,
      species: result.species,
      status: result.status,
      health: result.health,
      mode: result.mode,
      full: result,
    };
    state.scans.unshift(record);
    state.scans = state.scans.slice(0, 12);

    if (scanTarget) {
      const p = state.plants.find((x) => x.id === scanTarget);
      if (p) {
        p.scans = p.scans || [];
        p.scans.push({ at: record.at, status: result.status, health: result.health, species: result.species });
        toast("Scan saved to " + p.name + ".");
      }
      scanTarget = null;
    }

    save();
    renderDiagnosis(result);
    renderScanHistory();
    renderPlants();
  }

  function renderScanHistory() {
    const el = $("#scan-history");
    $("#scan-count").textContent = state.scans.length + (state.scans.length === 1 ? " scan" : " scans");
    if (!state.scans.length) {
      el.innerHTML = '<p class="empty-note" style="grid-column:1/-1;">Past scans collect here so you can watch a plant improve — or not — week by week.</p>';
      return;
    }
    el.innerHTML = state.scans.map((s) =>
      '<button class="scan-thumb" type="button" data-scan="' + s.id + '">' +
        '<img src="' + s.img + '" alt="" />' +
        '<div class="st-body">' +
          '<div class="st-name">' + esc(s.status) + "</div>" +
          '<div class="st-when">' + esc(s.species || "—") + " · " + ago(s.at) + "</div>" +
        "</div>" +
      "</button>"
    ).join("");
  }

  function wireDoctor() {
    $("#cam-start").addEventListener("click", startCamera);

    $("#cam-shot").addEventListener("click", () => {
      const shot = captureFrame();
      if (!shot) { toast("No camera frame to capture."); return; }
      stopCamera();
      analyse(shot);
    });

    $("#cam-upload-btn").addEventListener("click", () => $("#cam-upload").click());
    $("#cam-upload").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      stopCamera();
      const url = await readFileAsDataURL(f, 720);
      analyse(url);
      e.target.value = "";
    });

    $("#cam-again").addEventListener("click", () => {
      lastShot = null;
      showPlaceholder();
      $("#cam-again").classList.add("hidden");
      $("#cam-start").classList.remove("hidden");
    });

    $("#scan-history").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-scan]");
      if (!btn) return;
      const s = state.scans.find((x) => x.id === btn.dataset.scan);
      if (!s) return;
      showShot(s.img);
      lastShot = s.img;
      renderDiagnosis(s.full);
    });
  }

  /* ============================================================
     WEATHER — forecast, swing detection, irrigation impact
     ============================================================ */

  const WX_SITES = {
    tihama:   { lat: 16.889, lon: 42.551, label: "Jazan city · Tihama coast" },
    sabya:    { lat: 17.149, lon: 42.625, label: "Sabya · wadi farmland" },
    abuarish: { lat: 16.968, lon: 42.832, label: "Abu Arish · inland plain" },
    reeth:    { lat: 17.295, lon: 43.049, label: "Al-Reeth · foothill terraces" },
    fifa:     { lat: 17.267, lon: 43.107, label: "Fifa · highland terraces" },
  };

  const WX_CODES = {
    0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
    45: ["Fog", "🌫"], 48: ["Fog", "🌫"], 51: ["Light drizzle", "🌦"], 53: ["Drizzle", "🌦"],
    55: ["Drizzle", "🌦"], 61: ["Light rain", "🌧"], 63: ["Rain", "🌧"], 65: ["Heavy rain", "⛈"],
    80: ["Showers", "🌦"], 81: ["Showers", "🌧"], 82: ["Heavy showers", "⛈"],
    95: ["Thunderstorm", "⛈"], 96: ["Thunderstorm", "⛈"], 99: ["Thunderstorm", "⛈"],
  };

  let wxSite = "tihama";
  let wxDays = [];
  let wxSource = "";

  async function loadWeather() {
    const site = WX_SITES[wxSite];
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + site.lat +
      "&longitude=" + site.lon +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum," +
      "precipitation_probability_max,wind_speed_10m_max&hourly=relative_humidity_2m" +
      "&timezone=Asia%2FRiyadh&forecast_days=7";

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("forecast unavailable");
      const d = await res.json();
      const hum = dailyHumidity(d.hourly);
      wxDays = d.daily.time.map((t, i) => ({
        date: t,
        code: d.daily.weather_code[i],
        max: d.daily.temperature_2m_max[i],
        min: d.daily.temperature_2m_min[i],
        rain: d.daily.precipitation_sum[i],
        rainProb: d.daily.precipitation_probability_max[i],
        wind: d.daily.wind_speed_10m_max[i],
        humidity: hum[i] != null ? hum[i] : 55,
      }));
      wxSource = "Live · Open-Meteo";
    } catch (e) {
      wxDays = simulateWeather();
      wxSource = "Offline model — no network";
    }
    return wxDays;
  }

  function dailyHumidity(hourly) {
    if (!hourly || !hourly.time) return [];
    const buckets = {};
    hourly.time.forEach((t, i) => {
      const day = t.slice(0, 10);
      (buckets[day] = buckets[day] || []).push(hourly.relative_humidity_2m[i]);
    });
    return Object.keys(buckets).sort().map((k) => {
      const arr = buckets[k];
      return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    });
  }

  /* Deterministic stand-in so the alert engine still demonstrates
     itself with no network — seeded off the date and the site. */
  function simulateWeather() {
    const region = Sandbox.REGIONS.find((r) => r.id === wxSite) || Sandbox.REGIONS[0];
    const season = Sandbox.currentSeason();
    const out = [];
    let seed = wxSite.length * 97 + new Date().getDate() * 13;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };
    for (let i = 0; i < 7; i++) {
      const r = rnd();
      const base = region.baseTemp + season.tempShift;
      const max = Math.round(base + (r - 0.45) * 9);
      const wet = r > (season.id === "summer" ? 0.86 : 0.72);
      const code = wet ? (r > 0.95 ? 95 : 61) : r > 0.5 ? 1 : 0;
      out.push({
        date: new Date(Date.now() + i * DAY).toISOString().slice(0, 10),
        code: code,
        max: max,
        min: Math.round(max - 9 - rnd() * 4),
        rain: wet ? Math.round(r * 18) : 0,
        rainProb: wet ? Math.round(55 + r * 40) : Math.round(r * 25),
        wind: Math.round(8 + rnd() * 32),
        humidity: Math.round(45 + region.humidLean * 6 + rnd() * 30),
      });
    }
    return out;
  }

  function weatherAlerts() {
    const a = [];
    if (!wxDays.length) return a;

    const d0 = wxDays[0];

    // heat
    const hot = wxDays.find((d) => d.max >= 42);
    if (hot) {
      a.push({ sev: "severe", ico: "🥵", title: "Heat stress warning — " + Math.round(hot.max) + " °C on " + shortDate(hot.date),
        text: "Above 42 °C, transpiration outruns what most root systems can supply, and flowering crops abort their fruit set.",
        advice: "Irrigate before sunrise, not at midday. Shade young seedlings and keep mulch over the root zone." });
    } else if (wxDays.some((d) => d.max >= 38)) {
      a.push({ sev: "warn", ico: "🌡", title: "Hot week ahead",
        text: "Daytime highs stay near 38 °C. Water demand rises roughly a fifth over a normal week.",
        advice: "Shorten the irrigation interval by a day for shallow-rooted crops." });
    }

    // temperature swing — the core weather-instability alert
    for (let i = 1; i < wxDays.length; i++) {
      const delta = wxDays[i].max - wxDays[i - 1].max;
      if (Math.abs(delta) >= 6) {
        a.push({ sev: "warn", ico: "📉", title: "Sharp temperature swing on " + shortDate(wxDays[i].date),
          text: Math.abs(Math.round(delta)) + " °C " + (delta > 0 ? "jump" : "drop") +
            " in a single day. Sudden swings crack fruit skin, shock transplants, and set off flower drop.",
          advice: delta > 0
            ? "Bring irrigation forward a day and hold off on transplanting until it settles."
            : "Delay spraying and fertilising until temperatures stabilise — uptake drops with the soil temperature." });
        break;
      }
    }

    // rain
    const rainDay = wxDays.find((d) => d.rain >= 4 || d.rainProb >= 60);
    if (rainDay) {
      a.push({ sev: "calm", ico: "🌧", title: "Rain expected " + shortDate(rainDay.date) +
          " — " + Math.round(rainDay.rain) + " mm, " + Math.round(rainDay.rainProb) + "% chance",
        text: "Free irrigation, if you let it do the work. Ten millimetres over a plot is roughly ten litres per square metre.",
        advice: "Skip the irrigation scheduled around that date — the app can push your dates forward for you below.",
        rain: rainDay });
    }

    // fungal pressure
    const muggy = wxDays.filter((d) => d.humidity >= 70 && d.max >= 28);
    if (muggy.length >= 2) {
      a.push({ sev: "warn", ico: "🍄", title: "Fungal pressure building",
        text: muggy.length + " humid days above 70% with warm nights. Powdery mildew, anthracnose on mango, and sigatoka on banana all move in these conditions.",
        advice: "Open the canopy, water at the root rather than over the leaves, and inspect the underside of leaves twice this week." });
    }

    // wind and dust
    const windy = wxDays.find((d) => d.wind >= 35);
    if (windy) {
      a.push({ sev: "warn", ico: "💨", title: "Strong wind " + shortDate(windy.date) + " — " + Math.round(windy.wind) + " km/h",
        text: "Enough to strip blossom, tear banana leaves, and carry spray off target.",
        advice: "Stake young trees, secure shade netting, and postpone any spraying to a calmer day." });
    }

    // cold nights in the highlands
    const cold = wxDays.find((d) => d.min <= 12);
    if (cold && (wxSite === "fifa" || wxSite === "reeth")) {
      a.push({ sev: "warn", ico: "🌙", title: "Cold night " + shortDate(cold.date) + " — down to " + Math.round(cold.min) + " °C",
        text: "Cool enough to slow coffee cherry development and stress heat-loving vegetables on the terraces.",
        advice: "Irrigate in the afternoon so the wet soil holds warmth overnight." });
    }

    if (!a.length) {
      a.push({ sev: "calm", ico: "✅", title: "Nothing unusual this week",
        text: "Temperature, humidity and wind all sit inside the normal band for " +
          WX_SITES[wxSite].label + " at this time of year.",
        advice: "Stay on your current irrigation rhythm." });
    }

    // day-zero context always last so it reads as a footnote
    a.push({ sev: "calm", ico: "📍", title: "Today at " + WX_SITES[wxSite].label,
      text: Math.round(d0.max) + " °C high, " + Math.round(d0.min) + " °C low, " +
        Math.round(d0.humidity) + "% humidity, wind to " + Math.round(d0.wind) + " km/h.",
      advice: "" });

    return a;
  }

  function renderWeather() {
    const strip = $("#wx-strip");
    $("#wx-place").textContent = WX_SITES[wxSite].label;
    $("#wx-source").textContent = wxSource;

    strip.innerHTML = wxDays.map((d, i) => {
      const code = WX_CODES[d.code] || ["—", "🌤"];
      const day = new Date(d.date).toLocaleDateString("en-GB", { weekday: "short" });
      return (
        '<div class="wx-day' + (i === 0 ? " today" : "") + '">' +
          '<div class="wd">' + (i === 0 ? "Today" : day) + "</div>" +
          '<div class="wi">' + code[1] + "</div>" +
          '<div class="wt">' + Math.round(d.max) + "°</div>" +
          '<div class="wl">' + Math.round(d.min) + "° · " + esc(code[0]) + "</div>" +
          '<div class="wr">' + Math.round(d.humidity) + "% rh" +
            (d.rain >= 1 ? " · " + Math.round(d.rain) + "mm" : "") + "</div>" +
        "</div>"
      );
    }).join("");

    const alerts = weatherAlerts();
    $("#wx-alerts").innerHTML = alerts.map((a) =>
      '<div class="alert-card ' + (a.sev === "severe" ? "severe" : a.sev === "calm" ? "calm" : "") + '">' +
        '<span class="a-ico">' + a.ico + "</span>" +
        "<div>" +
          '<div class="a-title">' + esc(a.title) + "</div>" +
          '<div class="a-text">' + esc(a.text) + "</div>" +
          (a.advice ? '<span class="a-advice">→ ' + esc(a.advice) + "</span>" : "") +
        "</div>" +
      "</div>"
    ).join("");

    renderWeatherImpact(alerts);
  }

  function renderWeatherImpact(alerts) {
    const el = $("#wx-impact");
    if (!state.plants.length) {
      el.innerHTML = '<p class="empty-note" style="padding-top:0;">Register your plants and this panel turns the forecast into specific instructions — which plot to water early, which irrigation to skip, which spray to postpone.</p>';
      return;
    }

    const rainAlert = alerts.find((a) => a.rain);
    const rows = state.plants.map((p) => {
      const t = typeOf(p.type);
      const wd = dayDiff(nextDue(p, "water"));
      let line;
      if (rainAlert && wd >= 0 && wd <= 3) {
        line = "Irrigation " + whenLabel(nextDue(p, "water")) + ", but " +
          Math.round(rainAlert.rain.rain) + " mm of rain is forecast — worth skipping.";
      } else if (wd < 0) {
        line = "Irrigation is " + Math.abs(wd) + " day" + (Math.abs(wd) === 1 ? "" : "s") + " overdue.";
      } else {
        line = "Next irrigation " + whenLabel(nextDue(p, "water")) + " · about " + t.litres + " L.";
      }
      return (
        '<div class="task-item' + (wd < 0 ? " late" : wd === 0 ? " due" : "") + '">' +
          '<span class="t-ico">' + t.glyph + "</span>" +
          '<span class="t-body"><span class="t-title">' + esc(p.name) + "</span>" +
          '<span class="t-sub">' + esc(line) + "</span></span>" +
        "</div>"
      );
    }).join("");

    el.innerHTML = rows +
      (rainAlert
        ? '<div class="tool-row" style="margin:14px 0 0;">' +
            '<button class="btn btn-primary" id="wx-apply" type="button">Push irrigation past the rain</button>' +
          "</div>"
        : "");

    const apply = $("#wx-apply");
    if (apply) {
      apply.addEventListener("click", () => {
        let saved = 0;
        state.plants.forEach((p) => {
          const wd = dayDiff(nextDue(p, "water"));
          if (wd >= 0 && wd <= 3) {
            p.waterSkipDays = (p.waterSkipDays || 0) + 3;
            saved += typeOf(p.type).litres;
          }
        });
        state.waterSaved += saved;
        save();
        renderWeather();
        renderPlants();
        renderCalendar();
        renderFarmToday();
        refreshBadges();
        toast(saved ? "Irrigation pushed back — about " + saved + " L saved." : "Nothing scheduled inside the rain window.");
      });
    }
  }

  function wireWeather() {
    const sel = $("#wx-region");
    sel.innerHTML = Object.keys(WX_SITES)
      .map((k) => '<option value="' + k + '">' + esc(WX_SITES[k].label) + "</option>").join("");
    sel.value = wxSite;

    sel.addEventListener("change", async () => {
      wxSite = sel.value;
      $("#wx-strip").innerHTML = '<p class="empty-note">Loading…</p>';
      await loadWeather();
      renderWeather();
      renderFarmToday();
    });

    $("#wx-refresh").addEventListener("click", async () => {
      await loadWeather();
      renderWeather();
      toast("Forecast refreshed.");
    });
  }

  /* ============================================================
     SEASONS & REMINDERS
     ============================================================ */

  function renderCalendar() {
    const season = Sandbox.currentSeason();
    const band = $("#season-band");
    band.innerHTML =
      '<span class="sb-ico">' + season.icon + "</span>" +
      "<div><h3>" + esc(season.label) + " — " + esc(season.arabic) + "</h3>" +
      "<p>" + esc(season.note) + " " +
      "In the Tihama calendar this is when planting decisions for the next three months get made.</p></div>";

    $("#cal-season-name").textContent = season.label + " sowing window";

    const now = PLANT_TYPES.filter((t) => t.id !== "other" && t.seasons.indexOf(season.id) !== -1);
    $("#crop-cal").innerHTML = now.map((t) =>
      '<div class="cal-crop">' +
        '<div class="cc-name">' + t.glyph + " " + esc(t.name) + ' <span class="ar">' + esc(t.ar) + "</span></div>" +
        '<div class="cc-note">' + esc(t.note) + "</div>" +
        '<div class="cc-note" style="color:var(--moss);margin-top:5px;">Irrigate about every ' +
          t.water + " days · roughly " + t.litres + " L per irrigation</div>" +
      "</div>"
    ).join("");

    const tasks = allTasks();
    const c = dueCounts();
    $("#task-summary").textContent = c.late
      ? c.late + " overdue · " + c.due + " due today"
      : c.due + " due today";

    const list = $("#task-list");
    if (!tasks.length) {
      list.innerHTML = '<p class="empty-note" style="padding-top:0;">No reminders yet. Add a plant, or write your own reminder below.</p>';
      return;
    }

    list.innerHTML = tasks.slice(0, 14).map((t) => {
      const n = dayDiff(t.due);
      const cls = t.done ? "done" : n < 0 ? "late" : n === 0 ? "due" : "";
      const ico = t.kind === "water" ? "💧" : t.kind === "fert" ? "🌾" : "📌";
      return (
        '<div class="task-item ' + cls + '" data-task="' + esc(t.id) + '" data-kind="' + t.kind + '">' +
          '<span class="t-ico">' + ico + "</span>" +
          '<span class="t-body"><span class="t-title">' + esc(t.title) + "</span>" +
          '<span class="t-sub">' + esc(t.sub) + " · " + shortDate(t.due) + "</span></span>" +
          '<span class="t-when">' + whenLabel(t.due) + "</span>" +
          '<button class="btn btn-ghost" data-done="1" style="padding:6px 11px;font-size:11.5px;">Done</button>' +
        "</div>"
      );
    }).join("");
  }

  function wireCalendar() {
    $("#task-date").valueAsDate = new Date();

    $("#task-add").addEventListener("click", () => {
      const title = $("#task-title").value.trim();
      if (!title) { toast("Write the reminder first."); return; }
      state.tasks.push({
        id: uid("t"),
        title: title,
        sub: "Your reminder",
        kind: "custom",
        due: $("#task-date").value || new Date().toISOString().slice(0, 10),
        done: false,
      });
      save();
      $("#task-title").value = "";
      renderCalendar();
      renderFarmToday();
      refreshBadges();
      toast("Reminder added.");
    });

    $("#task-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-done]");
      if (!btn) return;
      const row = btn.closest("[data-task]");
      const id = row.dataset.task;
      const kind = row.dataset.kind;

      if (kind === "custom") {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        toast("Reminder cleared.");
      } else {
        const pid = id.split(":")[0];
        const p = state.plants.find((x) => x.id === pid);
        if (p) {
          if (kind === "water") { p.lastWatered = new Date().toISOString(); p.waterSkipDays = 0; }
          else p.lastFert = new Date().toISOString();
          toast("Logged for " + p.name + ".");
        }
      }

      save();
      renderCalendar();
      renderPlants();
      renderFarmToday();
      refreshBadges();
    });
  }

  /* ============================================================
     FORUM — text, photo and voice
     ============================================================ */

  const TAGS = [
    { id: "question", label: "Question · سؤال" },
    { id: "pest", label: "Pest & disease · آفات" },
    { id: "water", label: "Water & soil · ري وتربة" },
    { id: "harvest", label: "Harvest · حصاد" },
    { id: "market", label: "Prices · أسعار" },
    { id: "tip", label: "Tip · نصيحة" },
  ];

  function seedPosts() {
    const h = (n) => new Date(Date.now() - n * 3600000).toISOString();
    return [
      { id: uid("post"), author: "Salem Al-Faifi", farm: "Fifa terraces", at: h(3), tag: "pest",
        text: "Black spreading spots on my mango leaves after the humid week, and some young fruit is dropping. Anthracnose? I have not sprayed anything yet this season.",
        img: null, audio: null, likes: ["seed1", "seed2"],
        replies: [
          { who: "Ibrahim Madkhali", at: h(2), text: "Looks like it. Open the canopy first — most of it is trapped humidity. Copper spray after the fruit drop stops, not during." },
          { who: "Noura Hakami", at: h(1), text: "Same thing on my trees in Sabya last August. Clearing the fallen fruit off the ground made the biggest difference." },
        ] },
      { id: uid("post"), author: "Ahmed Aqeeli", farm: "Abu Arish plain", at: h(9), tag: "water",
        text: "White crust forming on the soil surface in the corner of the plot nearest the well. Salinity, or fertiliser residue? Water tested a while back at around 2.1 dS/m.",
        img: null, audio: null, likes: ["seed3"],
        replies: [
          { who: "Yahya Mashhour", at: h(7), text: "At 2.1 that is salt. One long leaching irrigation moves it below the root zone — short daily watering just keeps concentrating it at the top." },
        ] },
      { id: uid("post"), author: "Mariam Sharahili", farm: "Wadi Sabya", at: h(26), tag: "tip",
        text: "For anyone growing sorghum on the plain: sowing about ten days after the first proper wadi flow gave me a noticeably better stand than sowing on the calendar date. The seedbed moisture is what matters, not the month.",
        img: null, audio: null, likes: ["seed1", "seed4", "seed5"], replies: [] },
      { id: uid("post"), author: "Fatimah Najmi", farm: "Jazan coast", at: h(38), tag: "harvest",
        text: "Papaya finished early this year — about three weeks ahead of last season. Anyone else on the coast seeing the same? Trying to work out whether it was the heat in spring or my irrigation change.",
        img: null, audio: null, likes: ["seed2"],
        replies: [
          { who: "Salem Al-Faifi", at: h(30), text: "Mine too, and I changed nothing. Put it down to the spring heat." },
        ] },
      { id: uid("post"), author: "Khalid Daghriri", farm: "Al-Reeth", at: h(52), tag: "question",
        text: "First year with Khawlani coffee on the middle terraces. How much shade do the seedlings actually need in the first summer — full cover, or half?",
        img: null, audio: null, likes: ["seed1"],
        replies: [
          { who: "Salem Al-Faifi", at: h(48), text: "Half. Under full cover they stretch and go weak. Old growers here use scattered acacia rather than solid netting." },
        ] },
    ];
  }

  let postImage = null;
  let postAudio = null;
  let recorder = null;
  let recChunks = [];
  let recTimer = null;
  let forumFilter = "all";
  let forumQuery = "";

  function setPostImage(dataUrl) {
    postImage = dataUrl;
    renderAttachments();
  }

  function renderAttachments() {
    const el = $("#post-attach");
    el.innerHTML =
      (postImage ? '<img src="' + postImage + '" alt="attachment" />' : "") +
      (postAudio ? '<audio controls src="' + postAudio + '"></audio>' : "") +
      (postImage || postAudio
        ? '<button class="btn btn-ghost" id="attach-clear" type="button" style="padding:6px 12px;font-size:12px;">Remove</button>'
        : "");

    const clear = $("#attach-clear");
    if (clear) {
      clear.addEventListener("click", () => {
        postImage = null;
        postAudio = null;
        renderAttachments();
      });
    }
  }

  async function startRecording() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(s);
      recChunks = [];
      recorder.ondataavailable = (e) => recChunks.push(e.data);
      recorder.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks, { type: recorder.mimeType || "audio/webm" });
        const fr = new FileReader();
        fr.onload = () => { postAudio = fr.result; renderAttachments(); };
        fr.readAsDataURL(blob);
      };
      recorder.start();

      const started = Date.now();
      $("#rec-row").classList.remove("hidden");
      recTimer = setInterval(() => {
        const s2 = Math.floor((Date.now() - started) / 1000);
        $("#rec-time").textContent =
          String(Math.floor(s2 / 60)).padStart(2, "0") + ":" + String(s2 % 60).padStart(2, "0");
        if (s2 >= 120) stopRecording();
      }, 500);
    } catch (err) {
      toast("Microphone unavailable — you can attach an audio file instead.");
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "audio/*";
      inp.addEventListener("change", async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        postAudio = await readFileAsDataURL(f);
        renderAttachments();
      });
      inp.click();
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    clearInterval(recTimer);
    $("#rec-row").classList.add("hidden");
    $("#rec-time").textContent = "00:00";
  }

  function renderForum() {
    const data = readCommunity();
    const feed = $("#forum-feed");

    $("#forum-as").textContent = "Posting as " + user.name;

    $("#forum-filters").innerHTML =
      '<button class="f-chip' + (forumFilter === "all" ? " sel" : "") + '" data-tag="all" type="button">All</button>' +
      TAGS.map((t) =>
        '<button class="f-chip' + (forumFilter === t.id ? " sel" : "") + '" data-tag="' + t.id + '" type="button">' +
        esc(t.label) + "</button>").join("");

    const q = forumQuery.toLowerCase();
    const posts = data.posts
      .filter((p) => forumFilter === "all" || p.tag === forumFilter)
      .filter((p) => !q || (p.text + " " + p.author).toLowerCase().indexOf(q) !== -1)
      .sort((a, b) => new Date(b.at) - new Date(a.at));

    if (!posts.length) {
      feed.innerHTML = '<p class="empty-note" style="padding:22px;">Nothing here yet under this filter. Be the first to post.</p>';
    } else {
      feed.innerHTML = posts.map((p) => {
        const tag = TAGS.find((t) => t.id === p.tag);
        const liked = (p.likes || []).indexOf(user.id) !== -1;
        return (
          '<div class="post" data-post="' + p.id + '">' +
            '<div class="post-head">' +
              '<div class="post-avatar">' + esc(initials(p.author)) + "</div>" +
              "<div><div class=\"post-who\">" + esc(p.author) +
                (p.farm ? ' <span class="ar">· ' + esc(p.farm) + "</span>" : "") + "</div>" +
                '<div class="post-when">' + ago(p.at) + (tag ? " · " + esc(tag.label) : "") + "</div>" +
              "</div>" +
            "</div>" +

            '<div class="post-text">' + esc(p.text) + "</div>" +

            (p.img || p.audio
              ? '<div class="post-media">' +
                  (p.img ? '<img src="' + p.img + '" alt="attached photo" />' : "") +
                  (p.audio ? '<audio controls src="' + p.audio + '"></audio>' : "") +
                "</div>"
              : "") +

            '<div class="post-bar">' +
              '<button class="post-act' + (liked ? " on" : "") + '" data-like="1" type="button">👍 ' +
                (p.likes || []).length + "</button>" +
              '<button class="post-act" data-replytoggle="1" type="button">💬 ' +
                (p.replies || []).length + " repl" + ((p.replies || []).length === 1 ? "y" : "ies") + "</button>" +
              (p.author === user.name
                ? '<button class="post-act" data-del="1" type="button">Delete</button>'
                : "") +
            "</div>" +

            '<div class="replies' + ((p.replies || []).length ? "" : " hidden") + '">' +
              (p.replies || []).map((r) =>
                '<div class="reply"><strong>' + esc(r.who) + "</strong> · " + ago(r.at) +
                "<br />" + esc(r.text) + "</div>").join("") +
              '<div class="reply-row">' +
                '<input type="text" placeholder="Write a reply…" data-replyinput="1" />' +
                '<button class="btn btn-secondary" data-reply="1" type="button" style="padding:8px 14px;font-size:12px;">Reply</button>' +
              "</div>" +
            "</div>" +
          "</div>"
        );
      }).join("");
    }

    // most active
    const counts = {};
    data.posts.forEach((p) => {
      counts[p.author] = (counts[p.author] || 0) + 1;
      (p.replies || []).forEach((r) => { counts[r.who] = (counts[r.who] || 0) + 1; });
    });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
    $("#forum-top").innerHTML = top.map((name, i) =>
      '<div class="top-farmer"><span class="rank">' + (i + 1) + "</span>" +
      '<span class="tf-name">' + esc(name) + "</span>" +
      '<span class="tf-count">' + counts[name] + "</span></div>").join("") ||
      '<p class="empty-note">No contributions yet.</p>';
  }

  function wireForum() {
    $("#post-tag").innerHTML = TAGS
      .map((t) => '<option value="' + t.id + '">' + esc(t.label) + "</option>").join("");

    $("#post-photo-btn").addEventListener("click", () => $("#post-photo").click());
    $("#post-photo").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      setPostImage(await readFileAsDataURL(f, 900));
      e.target.value = "";
    });

    $("#post-rec").addEventListener("click", startRecording);
    $("#rec-stop").addEventListener("click", stopRecording);

    $("#post-send").addEventListener("click", () => {
      const text = $("#post-text").value.trim();
      if (!text && !postImage && !postAudio) { toast("Write something, or attach a photo or voice note."); return; }

      const data = readCommunity();
      data.posts.unshift({
        id: uid("post"),
        author: user.name,
        farm: user.farmName,
        at: new Date().toISOString(),
        tag: $("#post-tag").value,
        text: text,
        img: postImage,
        audio: postAudio,
        likes: [],
        replies: [],
      });
      writeCommunity(data);

      $("#post-text").value = "";
      postImage = null;
      postAudio = null;
      renderAttachments();
      renderForum();
      toast("Posted to the forum.");
    });

    $("#forum-filters").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-tag]");
      if (!chip) return;
      forumFilter = chip.dataset.tag;
      renderForum();
    });

    $("#forum-search").addEventListener("input", (e) => {
      forumQuery = e.target.value.trim();
      renderForum();
    });

    $("#forum-feed").addEventListener("click", (e) => {
      const postEl = e.target.closest("[data-post]");
      if (!postEl) return;
      const data = readCommunity();
      const p = data.posts.find((x) => x.id === postEl.dataset.post);
      if (!p) return;

      if (e.target.closest("[data-like]")) {
        p.likes = p.likes || [];
        const i = p.likes.indexOf(user.id);
        if (i === -1) p.likes.push(user.id); else p.likes.splice(i, 1);
        writeCommunity(data);
        renderForum();
      } else if (e.target.closest("[data-replytoggle]")) {
        postEl.querySelector(".replies").classList.toggle("hidden");
      } else if (e.target.closest("[data-reply]")) {
        const input = postEl.querySelector("[data-replyinput]");
        const text = input.value.trim();
        if (!text) return;
        p.replies = p.replies || [];
        p.replies.push({ who: user.name, at: new Date().toISOString(), text: text });
        writeCommunity(data);
        renderForum();
        toast("Reply added.");
      } else if (e.target.closest("[data-del]")) {
        if (!confirm("Delete this post?")) return;
        data.posts = data.posts.filter((x) => x.id !== p.id);
        writeCommunity(data);
        renderForum();
      }
    });
  }

  /* ============================================================
     MARKET
     ============================================================ */

  const CATS = [
    { id: "seeds", label: "Seeds · بذور", glyph: "🌰" },
    { id: "seedlings", label: "Seedlings · شتلات", glyph: "🌱" },
    { id: "plants", label: "Plants · نباتات", glyph: "🪴" },
    { id: "inputs", label: "Inputs & tools · مستلزمات", glyph: "🧰" },
    { id: "services", label: "Services · خدمات", glyph: "🚜" },
    { id: "produce", label: "Harvest · محصول", glyph: "🧺" },
  ];

  function seedListings() {
    const d = (n) => new Date(Date.now() - n * 86400000).toISOString();
    return [
      { id: uid("l"), title: "Khawlani coffee seedlings", cat: "seedlings", price: 45, unit: "seedling",
        seller: "Fifa Terrace Nursery", loc: "Fifa", phone: "0555 000 111", at: d(1), glyph: "☕",
        desc: "Eight-month seedlings from mother trees on the upper terraces. Hardened off outdoors, ready for the shade of an established plot." },
      { id: uid("l"), title: "Local sorghum seed — Tihama landrace", cat: "seeds", price: 22, unit: "kg",
        seller: "Sabya Seed Co-op", loc: "Sabya", phone: "0555 000 222", at: d(2), glyph: "🌾",
        desc: "Cleaned and graded seed of the local landrace, saved from last season's crop on the wadi floodplain. Germination tested at 92%." },
      { id: uid("l"), title: "Grafted mango — Zebda and Kent", cat: "seedlings", price: 85, unit: "tree",
        seller: "Abu Arish Nursery", loc: "Abu Arish", phone: "0555 000 333", at: d(3), glyph: "🥭",
        desc: "Two-year grafted trees in 20 L bags. Delivery to any farm in the region for orders of ten or more." },
      { id: uid("l"), title: "Sesame seed, cleaned", cat: "seeds", price: 30, unit: "kg",
        seller: "Ahmed Aqeeli", loc: "Abu Arish", phone: "0555 000 444", at: d(4), glyph: "🌱",
        desc: "Own-farm seed from the last summer sowing. Low water crop, good on residual moisture after the wadi flow." },
      { id: uid("l"), title: "Drip irrigation kit — one dunam", cat: "inputs", price: 480, unit: "kit",
        seller: "Jazan Agri Supply", loc: "Jazan city", phone: "0555 000 555", at: d(5), glyph: "💧",
        desc: "Mainline, laterals, pressure-compensating emitters at 40 cm, filter and fittings. Cuts water use on tree crops by roughly a third against flood irrigation." },
      { id: uid("l"), title: "Soil and water salinity test", cat: "services", price: 120, unit: "sample",
        seller: "Tihama Soil Lab", loc: "Jazan city", phone: "0555 000 666", at: d(6), glyph: "🧪",
        desc: "Electrical conductivity, pH, sodium adsorption ratio and a written irrigation recommendation for your specific crop. Results in three days." },
      { id: uid("l"), title: "Tractor and plough — by the day", cat: "services", price: 650, unit: "day",
        seller: "Salem Al-Faifi", loc: "Sabya", phone: "0555 000 777", at: d(7), glyph: "🚜",
        desc: "Land preparation, ploughing and levelling, operator included. Book at least a week ahead in the pre-sowing period." },
      { id: uid("l"), title: "Date palm offshoots — Sukkari", cat: "plants", price: 260, unit: "offshoot",
        seller: "Al-Ahsa Palm Trading", loc: "Delivered to Jazan", phone: "0555 000 888", at: d(9), glyph: "🌴",
        desc: "Rooted offshoots, salt-tolerant and established. Delivery arranged monthly to the Jazan region." },
      { id: uid("l"), title: "Composted manure, aged six months", cat: "inputs", price: 18, unit: "sack",
        seller: "Wadi Sabya Livestock", loc: "Sabya", phone: "0555 000 999", at: d(11), glyph: "🧱",
        desc: "Fully composted, no fresh smell, screened. Bulk pricing from fifty sacks with delivery." },
      { id: uid("l"), title: "Fresh Jazan mango — Zebda", cat: "produce", price: 14, unit: "kg",
        seller: "Mariam Sharahili", loc: "Wadi Sabya", phone: "0555 001 000", at: d(1), glyph: "🥭",
        desc: "Picked to order from a mature block. Farm collection or delivery inside Jazan city." },
      { id: uid("l"), title: "Beekeeping — hive placement", cat: "services", price: 300, unit: "season",
        seller: "Al-Reeth Apiaries", loc: "Al-Reeth", phone: "0555 001 111", at: d(13), glyph: "🐝",
        desc: "Hives placed on your land for the flowering season. Pollination for your trees, and a share of the honey for you." },
      { id: uid("l"), title: "Shade netting, 50% — 4 m roll", cat: "inputs", price: 95, unit: "roll",
        seller: "Jazan Agri Supply", loc: "Jazan city", phone: "0555 001 222", at: d(15), glyph: "🕸",
        desc: "UV-stabilised netting for seedling protection through the summer peak. Sold by the ten-metre roll." },
    ];
  }

  let mkFilter = "all";
  let mkQuery = "";
  let mkSort = "new";
  let mkPhoto = null;

  function renderMarket() {
    const data = readCommunity();

    $("#mk-filters").innerHTML =
      '<button class="f-chip' + (mkFilter === "all" ? " sel" : "") + '" data-cat="all" type="button">Everything</button>' +
      CATS.map((c) =>
        '<button class="f-chip' + (mkFilter === c.id ? " sel" : "") + '" data-cat="' + c.id + '" type="button">' +
        c.glyph + " " + esc(c.label) + "</button>").join("");

    const q = mkQuery.toLowerCase();
    let items = data.listings
      .filter((l) => mkFilter === "all" || l.cat === mkFilter)
      .filter((l) => !q || (l.title + " " + l.desc + " " + l.seller).toLowerCase().indexOf(q) !== -1);

    if (mkSort === "low") items.sort((a, b) => a.price - b.price);
    else if (mkSort === "high") items.sort((a, b) => b.price - a.price);
    else items.sort((a, b) => new Date(b.at) - new Date(a.at));

    const grid = $("#market-grid");
    grid.innerHTML = items.length
      ? items.map((l) =>
          '<div class="card listing" data-listing="' + l.id + '">' +
            '<div class="listing-photo">' +
              (l.img ? '<img src="' + l.img + '" alt="" />' : (l.glyph || "🪴")) +
            "</div>" +
            '<div class="listing-body">' +
              '<div class="listing-title">' + esc(l.title) + "</div>" +
              '<div class="listing-seller">' + esc(l.seller) + " · " + esc(l.loc) + "</div>" +
              '<div class="listing-desc">' + esc(l.desc) + "</div>" +
              '<div class="listing-foot">' +
                '<span class="price">' + l.price + ' <span class="per">SAR / ' + esc(l.unit) + "</span></span>" +
                '<button class="btn btn-primary" data-order="1" type="button">Request</button>' +
              "</div>" +
            "</div>" +
          "</div>"
        ).join("")
      : '<div class="card panel"><p class="empty-note" style="padding:0;">No listings match that. Try another category, or list the thing yourself.</p></div>';

    $("#mk-orders").innerHTML = state.orders.length
      ? state.orders.slice().reverse().map((o) =>
          '<div class="log-item good"><span class="log-week">' + shortDate(o.at) + "</span>" +
          "<span><strong>" + esc(o.title) + "</strong> from " + esc(o.seller) +
          " — " + o.qty + " × " + o.price + " SAR = " + (o.qty * o.price) +
          " SAR. Contact " + esc(o.phone) + ".</span></div>").join("")
      : '<p class="empty-note" style="padding:0;">No requests yet. Requesting an item saves the seller\'s contact here — nothing is charged, the deal is between the two of you.</p>';
  }

  function wireMarket() {
    $("#mk-cat").innerHTML = CATS
      .map((c) => '<option value="' + c.id + '">' + esc(c.label) + "</option>").join("");

    $("#mk-filters").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (!chip) return;
      mkFilter = chip.dataset.cat;
      renderMarket();
    });

    $("#mk-search").addEventListener("input", (e) => { mkQuery = e.target.value.trim(); renderMarket(); });
    $("#mk-sort").addEventListener("change", (e) => { mkSort = e.target.value; renderMarket(); });

    $("#mk-sell-toggle").addEventListener("click", () => {
      $("#mk-sell-card").classList.toggle("hidden");
    });

    $("#mk-photo-btn").addEventListener("click", () => $("#mk-photo").click());
    $("#mk-photo").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      mkPhoto = await readFileAsDataURL(f, 720);
      $("#mk-photo-name").textContent = "Photo attached";
    });

    $("#mk-publish").addEventListener("click", () => {
      const title = $("#mk-title").value.trim();
      const price = Number($("#mk-price").value);
      if (!title || !price) { toast("A listing needs a title and a price."); return; }

      const data = readCommunity();
      const cat = CATS.find((c) => c.id === $("#mk-cat").value);
      data.listings.unshift({
        id: uid("l"),
        title: title,
        cat: cat.id,
        price: price,
        unit: $("#mk-unit").value.trim() || "unit",
        seller: user.farmName || user.name,
        loc: $("#mk-loc").value.trim() || user.region,
        phone: $("#mk-phone").value.trim() || "—",
        desc: $("#mk-desc").value.trim(),
        img: mkPhoto,
        glyph: cat.glyph,
        at: new Date().toISOString(),
      });
      writeCommunity(data);

      $("#mk-title").value = "";
      $("#mk-price").value = "";
      $("#mk-unit").value = "";
      $("#mk-desc").value = "";
      $("#mk-photo-name").textContent = "";
      mkPhoto = null;
      $("#mk-sell-card").classList.add("hidden");

      renderMarket();
      toast("Listing published.");
    });

    $("#market-grid").addEventListener("click", (e) => {
      if (!e.target.closest("[data-order]")) return;
      const card = e.target.closest("[data-listing]");
      const data = readCommunity();
      const l = data.listings.find((x) => x.id === card.dataset.listing);
      if (!l) return;

      const qty = Number(prompt("How many " + l.unit + "s of " + l.title + "?", "1"));
      if (!qty || qty < 1) return;

      state.orders.push({
        at: new Date().toISOString(),
        title: l.title,
        seller: l.seller,
        phone: l.phone,
        price: l.price,
        qty: qty,
      });
      save();
      renderMarket();
      toast("Request saved — contact " + l.seller + " on " + l.phone + ".");
    });
  }

  /* ============================================================
     DASHBOARD STRIP — today on the farm
     ============================================================ */

  function renderFarmToday() {
    const el = $("#farm-today");
    if (!el) return;

    const tasks = allTasks().filter((t) => !t.done && dayDiff(t.due) <= 1).slice(0, 5);
    const alerts = wxDays.length ? weatherAlerts().filter((a) => a.sev !== "calm").slice(0, 2) : [];

    const taskHtml = tasks.length
      ? tasks.map((t) => {
          const n = dayDiff(t.due);
          const ico = t.kind === "water" ? "💧" : t.kind === "fert" ? "🌾" : "📌";
          return '<div class="task-item ' + (n < 0 ? "late" : "due") + '">' +
            '<span class="t-ico">' + ico + "</span>" +
            '<span class="t-body"><span class="t-title">' + esc(t.title) + "</span>" +
            '<span class="t-sub">' + esc(t.sub) + "</span></span>" +
            '<span class="t-when">' + whenLabel(t.due) + "</span></div>";
        }).join("")
      : '<p class="empty-note" style="padding:0 0 6px;">Nothing due in the next day. ' +
        (state.plants.length ? "The schedule is clear." : "Register your plants to start the schedule.") + "</p>";

    const alertHtml = alerts.length
      ? alerts.map((a) =>
          '<div class="alert-card ' + (a.sev === "severe" ? "severe" : "") + '">' +
            '<span class="a-ico">' + a.ico + "</span><div>" +
            '<div class="a-title">' + esc(a.title) + "</div>" +
            '<div class="a-text">' + esc(a.text) + "</div></div></div>").join("")
      : '<p class="empty-note" style="padding:0 0 6px;">No weather warnings for ' +
        esc(WX_SITES[wxSite].label) + " this week.</p>";

    el.innerHTML =
      '<div class="grid-2" style="margin-top:16px;">' +
        '<div class="card panel"><div class="panel-head"><h3>Due now</h3>' +
          '<button class="btn btn-ghost" data-goto="calendar" type="button" style="padding:7px 14px;font-size:12.5px;">All reminders</button>' +
        "</div>" + taskHtml + "</div>" +
        '<div class="card panel"><div class="panel-head"><h3>Weather watch</h3>' +
          '<button class="btn btn-ghost" data-goto="weather" type="button" style="padding:7px 14px;font-size:12.5px;">Forecast</button>' +
        "</div>" + alertHtml + "</div>" +
      "</div>";

    el.querySelectorAll("[data-goto]").forEach((b) => {
      b.addEventListener("click", () => goView(b.dataset.goto));
    });
  }

  /* ============================================================
     WIRING
     ============================================================ */

  function goView(id) {
    const nav = document.querySelector('.nav-item[data-view="' + id + '"]');
    if (nav) nav.click();
  }

  function refreshBadges() {
    const c = dueCounts();
    const total = c.due + c.late;
    const calBadge = document.querySelector('.nav-item[data-view="calendar"] .badge');
    if (calBadge) {
      calBadge.textContent = total > 9 ? "9+" : total;
      calBadge.classList.toggle("on", total > 0);
    }
    const wxBadge = document.querySelector('.nav-item[data-view="weather"] .badge');
    if (wxBadge) {
      const n = wxDays.length ? weatherAlerts().filter((a) => a.sev !== "calm").length : 0;
      wxBadge.textContent = n;
      wxBadge.classList.toggle("on", n > 0);
    }
  }

  function renderTeam() {
    const el = $("#team-list");
    if (!el) return;
    const team = [
      { name: "Wanas Zakri", ar: "ونس زكري", role: "Idea, design and development — sole author" },
    ];
    el.innerHTML = team.map((m) =>
      '<div class="member"><span class="m-av">' + esc(initials(m.name)) + "</span>" +
      '<span><span class="m-name">' + esc(m.name) + ' <span class="ar">' + esc(m.ar) + "</span></span>" +
      '<span class="m-role">' + esc(m.role) + "</span></span></div>").join("");
  }

  async function mount() {
    user = Store.currentUser();
    if (!user) return;
    loadState();

    wirePlants();
    wireDoctor();
    wireWeather();
    wireCalendar();
    wireForum();
    wireMarket();

    renderPlants();
    renderScanHistory();
    renderCalendar();
    renderForum();
    renderMarket();
    renderTeam();
    renderFarmToday();

    // re-render on navigation so nothing goes stale between views
    $$(".nav-item").forEach((n) => {
      n.addEventListener("click", () => {
        const v = n.dataset.view;
        if (v === "plants") renderPlants();
        else if (v === "calendar") renderCalendar();
        else if (v === "forum") renderForum();
        else if (v === "market") renderMarket();
        else if (v === "weather") renderWeather();
        else if (v === "dashboard") renderFarmToday();
        else if (v === "doctor") renderScanHistory();
      });
    });

    await loadWeather();
    renderWeather();
    renderFarmToday();
    refreshBadges();

    // one nudge on load if something is genuinely wrong outside
    const severe = weatherAlerts().find((a) => a.sev === "severe");
    const c = dueCounts();
    if (severe) setTimeout(() => toast(severe.title), 1400);
    else if (c.late) setTimeout(() => toast(c.late + " irrigation or fertiliser task overdue."), 1400);
  }

  return { mount: mount, goView: goView };
})();

/* Attach after the original controller boots — the existing app is
   untouched; this only runs once it has finished setting itself up. */
(function () {
  const orig = window.__bootApp;
  window.__bootApp = function () {
    orig.apply(this, arguments);
    try {
      FarmModules.mount();
    } catch (err) {
      console.error("Farm modules failed to mount", err);
    }
  };
})();
