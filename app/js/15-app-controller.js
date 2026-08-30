/* ============================================================
   TerraTwin — Application controller
   ============================================================ */

window.__bootApp = function () {
  "use strict";

  /* ---------------- session guard ---------------- */
  const user = Store.currentUser();
  if (!user) {
    TT.showAuth();
    return;
  }

  let state = Store.getState(user.id);

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ---------------- identity ---------------- */
  function initials(name) {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  $("#user-avatar").textContent = initials(user.name);
  $("#user-name").textContent = user.name;
  $("#user-farm").textContent = user.farmName + " · " + user.region;
  $("#greet-name").textContent = user.name.split(" ")[0];
  $("#greet-farm").textContent = user.farmName;

  $("#logout").addEventListener("click", () => {
    Store.endSession();
    window.location.reload();
  });

  /* ---------------- routing ---------------- */
  function go(viewId) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + viewId));
    $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === viewId));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (viewId === "dashboard") renderDashboard();
  }

  $$(".nav-item").forEach((n) => {
    n.addEventListener("click", () => go(n.dataset.view));
  });

  $$("[data-goto]").forEach((b) => {
    b.addEventListener("click", () => go(b.dataset.goto));
  });

  /* ============================================================
     READINESS SCORECARD
     ============================================================ */

  function computeReadiness() {
    const byDim = {};
    KB.dimensions.forEach((d) => (byDim[d.id] = { ...d, actual: 0, answered: 0, total: 0 }));

    KB.questions.forEach((q) => {
      byDim[q.dim].total++;
      const sel = state.readiness[q.id];
      if (sel !== undefined && q.opts[sel]) {
        byDim[q.dim].actual += q.opts[sel].pts;
        byDim[q.dim].answered++;
      }
    });

    const dims = KB.dimensions.map((d) => {
      const b = byDim[d.id];
      const pct = b.max ? b.actual / b.max : 0;
      return { ...b, pct, status: KB.statusFor(pct) };
    });

    const actual = dims.reduce((s, d) => s + d.actual, 0);
    const max = dims.reduce((s, d) => s + d.max, 0);
    const answered = dims.reduce((s, d) => s + d.answered, 0);
    const totalQ = KB.questions.length;
    const pct = max ? actual / max : 0;

    return { dims, actual, max, pct, answered, totalQ, status: KB.overallStatus(pct) };
  }

  function renderScorecard() {
    const wrap = $("#scorecard-body");
    wrap.innerHTML = KB.dimensions
      .map((dim) => {
        const qs = KB.questions.filter((q) => q.dim === dim.id);
        return `
          <div class="dim-section">
            <div class="dim-section-head">
              <h4>${dim.name}</h4>
              <span class="eyebrow">max ${dim.max}</span>
            </div>
            <p style="font-size:12.5px;color:var(--ink-soft);margin-bottom:2px;">${dim.blurb}</p>
            ${qs
              .map(
                (q) => `
              <div class="q-block">
                <div class="q-text">${q.text}</div>
                <div class="q-opts" data-q="${q.id}">
                  ${q.opts
                    .map(
                      (o, i) =>
                        `<button class="q-opt${state.readiness[q.id] === i ? " sel" : ""}" data-i="${i}" type="button">${o.label}</button>`
                    )
                    .join("")}
                </div>
              </div>`
              )
              .join("")}
          </div>`;
      })
      .join("");

    wrap.querySelectorAll(".q-opts").forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = e.target.closest(".q-opt");
        if (!btn) return;
        const qid = group.dataset.q;
        const idx = Number(btn.dataset.i);
        state.readiness[qid] = idx;
        Store.patchState(user.id, { readiness: state.readiness });
        group.querySelectorAll(".q-opt").forEach((b) => b.classList.toggle("sel", b === btn));
        renderScoreSummary();
      });
    });

    renderScoreSummary();
  }

  function renderScoreSummary() {
    const r = computeReadiness();

    $("#sc-total").innerHTML = `${r.actual}<span class="unit"> / ${r.max}</span>`;
    $("#sc-status").textContent = r.status.label;
    $("#sc-status").className = "status-pill " + r.status.cls;
    $("#sc-progress").textContent = `${r.answered} of ${r.totalQ} questions answered`;

    $("#sc-dims").innerHTML = r.dims
      .map(
        (d) => `
      <div class="dim">
        <div class="dim-top">
          <span class="dim-name">${d.name}</span>
          <span class="dim-score">${d.actual} / ${d.max}</span>
        </div>
        <div class="bar"><div class="bar-fill ${d.status.cls}" style="width:${(d.pct * 100).toFixed(1)}%"></div></div>
      </div>`
      )
      .join("");
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */

  function renderDashboard() {
    state = Store.getState(user.id);
    const r = computeReadiness();

    $("#dash-score").innerHTML = `${r.actual}<span class="unit"> / 100</span>`;
    $("#dash-status").textContent = r.status.label;
    $("#dash-status").className = "status-pill " + r.status.cls;
    $("#dash-answered").textContent = `${r.answered} of ${r.totalQ} answered`;

    $("#dash-runs").textContent = state.sandboxRuns.length;
    $("#dash-best").innerHTML = `${Math.round(state.bestGrowth)}<span class="unit">%</span>`;

    const weakest = [...r.dims].sort((a, b) => a.pct - b.pct)[0];
    $("#dash-gap").textContent = r.answered === 0 ? "Not assessed yet" : weakest.name;
    $("#dash-gap-sub").textContent =
      r.answered === 0
        ? "Complete the assessment to see your weakest dimension."
        : `${weakest.actual} of ${weakest.max} — ${weakest.blurb}`;

    $("#dash-dims").innerHTML = r.dims
      .map(
        (d) => `
      <div class="dim">
        <div class="dim-top">
          <span class="dim-name">${d.name}</span>
          <span class="dim-score">${d.actual} / ${d.max}</span>
        </div>
        <div class="bar"><div class="bar-fill ${d.status.cls}" style="width:${(d.pct * 100).toFixed(1)}%"></div></div>
      </div>`
      )
      .join("");

    // recent runs
    const runs = state.sandboxRuns.slice(-5).reverse();
    $("#dash-runs-list").innerHTML = runs.length
      ? runs
          .map(
            (run) => `
        <div class="log-item ${run.win ? "good" : "bad"}">
          <span class="log-week">W${run.weeks}</span>
          <span><strong>${run.crop}</strong>${run.region ? ` in ${run.region}${run.season ? `, ${run.season.toLowerCase()}` : ""}` : ""} —
          ${run.win ? "harvest reached" : "failed"} at
          ${Math.round(run.growth)}% growth, ${Math.round(run.health)}% health.
          ${run.blocked} policy block${run.blocked === 1 ? "" : "s"}${run.fit !== undefined ? `, site fit ${run.fit}/100` : ""}.</span>
        </div>`
          )
          .join("")
      : '<p style="font-size:13px;color:var(--ink-soft);">No sandbox runs yet. Open the Sandbox and plant something.</p>';
  }

  /* ============================================================
     SANDBOX
     ============================================================ */

  let selectedCrop = "coffee";
  let selectedRegion = Sandbox.REGIONS[0].id;
  let selectedSoil = Sandbox.soilsFor(selectedRegion)[0].id;
  let selectedSeason = Sandbox.currentSeason().id;
  let selectedPattern = Sandbox.PATTERNS[0].id;
  let busy = false;

  function renderSetupPickers() {
    // region
    $("#region-picker").innerHTML = Sandbox.REGIONS
      .map(
        (r) => `
      <button class="crop-opt${r.id === selectedRegion ? " sel" : ""}" data-region="${r.id}" type="button">
        <span class="opt-name">${r.label}</span>
        <span class="opt-sub">${r.sub}</span>
      </button>`
      )
      .join("");

    $("#region-picker").querySelectorAll("[data-region]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRegion = btn.dataset.region;
        const soils = Sandbox.soilsFor(selectedRegion);
        if (!soils.some((sl) => sl.id === selectedSoil)) selectedSoil = soils[0].id;
        renderSetupPickers();
        renderFit();
      });
    });

    // soil (depends on region)
    const soils = Sandbox.soilsFor(selectedRegion);
    $("#soil-picker").innerHTML = soils
      .map(
        (sl) => `
      <button class="crop-opt${sl.id === selectedSoil ? " sel" : ""}" data-soil="${sl.id}" type="button">
        <span class="opt-name">${sl.label}</span>
        <span class="opt-sub">${sl.note}</span>
      </button>`
      )
      .join("");

    $("#soil-picker").querySelectorAll("[data-soil]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSoil = btn.dataset.soil;
        renderSetupPickers();
        renderFit();
      });
    });

    // season — chosen by the player, one of the four
    $("#season-picker").innerHTML = Sandbox.SEASONS
      .map(
        (sn) => `
      <button class="crop-opt${sn.id === selectedSeason ? " sel" : ""}" data-season="${sn.id}" type="button">
        <span class="opt-name">${sn.icon} ${sn.label} (${sn.arabic})</span>
        <span class="opt-sub">${sn.note}</span>
      </button>`
      )
      .join("");

    $("#season-picker").querySelectorAll("[data-season]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedSeason = btn.dataset.season;
        renderSetupPickers();
        renderFit();
      });
    });

    // weather pattern — the character of the year
    $("#pattern-picker").innerHTML = Sandbox.PATTERNS
      .map(
        (p) => `
      <button class="crop-opt${p.id === selectedPattern ? " sel" : ""}" data-pattern="${p.id}" type="button">
        <span class="opt-name">${p.icon} ${p.label}</span>
        <span class="opt-sub">${p.note}</span>
      </button>`
      )
      .join("");

    $("#pattern-picker").querySelectorAll("[data-pattern]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedPattern = btn.dataset.pattern;
        renderSetupPickers();
        renderFit();
      });
    });

    // resulting site climate readout
    const season = Sandbox.SEASONS.find((sn) => sn.id === selectedSeason) || Sandbox.SEASONS[0];
    const pattern = Sandbox.PATTERNS.find((p) => p.id === selectedPattern) || Sandbox.PATTERNS[0];
    const region = Sandbox.REGIONS.find((r) => r.id === selectedRegion);
    const climate = KB.regionClimate && KB.regionClimate[region.climateKey];
    const meanTemp = Math.round(region.baseTemp + season.tempShift + pattern.tempShift);
    const today = Sandbox.currentSeason();
    const offSeason = today.id !== season.id
      ? ` You're simulating out of calendar order — it is ${today.label.toLowerCase()} today.`
      : "";

    $("#season-readout").innerHTML = `
      <span class="season-ico">${season.icon}</span>
      <span>
        <span class="season-name">${region.label} · ${season.label} (${season.arabic}) · ${pattern.label} · ~${meanTemp}°C</span>
        <span class="season-note">${region.desc}${climate ? ` Regional norms: ${climate.summerMax}°C in summer, ${climate.winterMin}°C in winter, ${climate.humidity} humidity, ${climate.rain} rainfall.` : ""}${offSeason}</span>
      </span>`;
  }

  function renderFit() {
    const el = $("#fit-readout");
    if (!el) return;
    const s = Sandbox.state();
    const fit = s
      ? s.fit
      : Sandbox.suitability(selectedCrop, selectedRegion, selectedSeason, selectedPattern);

    el.className = "fit-readout " + fit.band;
    el.innerHTML = `
      <span class="fit-score">${fit.score}</span>
      <span>
        <span class="fit-verdict">${fit.verdict}</span>
        <span class="fit-why">${
          fit.reasons.length
            ? fit.reasons.join("; ") + "."
            : `Mean ${fit.temp}°C sits inside this crop's comfortable range.`
        }</span>
      </span>`;
  }

  function renderCropPicker() {
    $("#crop-picker").innerHTML = Object.entries(KB.crops)
      .map(
        ([id, c]) => `
      <button class="crop-opt${id === selectedCrop ? " sel" : ""}" data-crop="${id}" type="button">
        <img src="${c.seed}" alt="" />
        <span>${c.name.split(" ")[0]}</span>
      </button>`
      )
      .join("");

    $("#crop-picker").querySelectorAll(".crop-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedCrop = btn.dataset.crop;
        renderCropPicker();
        $("#crop-note").textContent = KB.crops[selectedCrop].note;
        renderFit();
      });
    });

    $("#crop-note").textContent = KB.crops[selectedCrop].note;
    renderFit();
  }

  function vitalColor(v, good) {
    if (good) return "var(--moss)";
    return v > 60 ? "var(--berry)" : v > 35 ? "var(--husk)" : "var(--moss)";
  }

  function renderSandbox() {
    const s = Sandbox.state();
    const stage = $("#stage-scene");
    const floor = $("#stage-floor");

    // lock the setup card once a run is underway — region/soil are chosen before planting only
    $("#setup-card").querySelectorAll("button").forEach((b) => (b.disabled = !!s));
    $("#setup-card").classList.toggle("locked", !!s);

    if (!s) {
      $("#stage-week").textContent = "Not started";
      $("#stage-crop").textContent = "Choose a crop";
      $("#weather-chip").classList.add("hidden");
      stage.innerHTML = `
        <div class="stage-empty">
          <img src="data:image/png;base64,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" alt="" style="width:230px;margin:0 auto 18px;opacity:.55;" />
          <p>The soil is prepared. Choose your region, soil, season and weather pattern above, pick a crop, and plant the seed to begin a simulated season.</p>
        </div>`;
      $("#vitals-card").classList.add("hidden");
      floor.innerHTML = "";
      $("#outcome-slot").innerHTML = "";
      $("#action-list").querySelectorAll("button").forEach((b) => (b.disabled = true));
      $("#btn-plant").disabled = false;
      $("#btn-reset").classList.add("hidden");
      renderLog();
      renderWeekNote();
      renderFit();
      return;
    }

    $("#stage-week").textContent = `Week ${s.week} of ${s.crop.weeks}`;
    $("#stage-crop").textContent = `${s.crop.name} — ${s.region.label}, ${s.season.label.toLowerCase()}`;
    $("#weather-chip").classList.remove("hidden");
    $("#weather-chip").innerHTML = `${s.weather.icon} ${s.weather.label} · ${s.temp}°C`;

    const art = Sandbox.currentArtwork();
    stage.innerHTML = `
      <div class="bowl-wrap">
        <img class="bowl" src="data:image/png;base64,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" alt="" />
        <div class="plant-slot ${art.cls}">
          <img src="${art.src}" alt="${art.alt}" />
        </div>
      </div>`;

    $("#vitals-card").classList.remove("hidden");
    const [lo, hi] = s.crop.idealMoisture;
    const moistOk = s.moisture >= lo && s.moisture <= hi;

    $("#vitals-sub").textContent =
      `Week ${s.week} of ${s.crop.weeks} · ${s.crop.name} · target moisture ${lo}–${hi}%`;

    floor.innerHTML = `
      ${vital("Health", s.health, s.health > 55 ? "var(--moss)" : s.health > 30 ? "var(--husk)" : "var(--berry)")}
      ${vital("Growth", s.growth, "var(--leaf)")}
      ${vital("Moisture", s.moisture, moistOk ? "var(--moss)" : "var(--husk)")}
      ${vital("Nutrients", s.nutrients, s.nutrients > 30 ? "var(--moss)" : "var(--husk)")}
      ${vital("Pest pressure", s.pest, vitalColor(s.pest))}
      ${vital("Soil salinity", s.salinity, vitalColor(s.salinity))}
    `;

    // actions
    const disabled = s.finished || busy;
    $("#action-list").querySelectorAll("button").forEach((b) => (b.disabled = disabled));
    $("#btn-plant").disabled = true;
    $("#btn-reset").classList.remove("hidden");

    // outcome
    if (s.finished && s.outcome) {
      const o = s.outcome;
      $("#outcome-slot").innerHTML = `
        <div class="outcome ${o.win ? "win" : "lose"}">
          <img src="${o.win ? s.crop.healthy : s.crop.dead}" alt="" />
          <div>
            <h3>${o.title}</h3>
            <p>${o.text}</p>
          </div>
        </div>`;
    } else {
      $("#outcome-slot").innerHTML = "";
    }

    renderLog();
    renderWeekNote();
    renderFit();
  }

  function vital(name, value, color) {
    const v = Math.max(0, Math.min(100, value));
    return `
      <div class="vital">
        <div class="vital-top">
          <span class="vital-name">${name}</span>
          <span class="vital-val">${Math.round(v)}%</span>
        </div>
        <div class="vital-bar">
          <div class="vital-fill" style="width:${v}%;background:${color}"></div>
        </div>
      </div>`;
  }

  function renderLog() {
    const s = Sandbox.state();
    const el = $("#sandbox-log");
    if (!s || !s.log.length) {
      el.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">Decisions and weekly outcomes will appear here.</p>';
      return;
    }
    el.innerHTML = s.log
      .map(
        (l) => `
      <div class="log-item ${l.kind}">
        <span class="log-week">W${l.week}</span>
        <span>${l.text}</span>
      </div>`
      )
      .join("");
  }

  /* wiring */
  $("#btn-plant").addEventListener("click", () => {
    const s = Sandbox.start(selectedCrop, {
      region: selectedRegion,
      soil: selectedSoil,
      season: selectedSeason,
      pattern: selectedPattern,
    });
    renderSandbox();
    toast(
      s && s.fit.band === "poor"
        ? `Seed planted — site suitability only ${s.fit.score}/100.`
        : "Seed planted. Make your first decision."
    );
  });

  $("#btn-reset").addEventListener("click", () => {
    Sandbox.reset();
    Pipeline.idle();
    renderSandbox();
  });

  function renderWeekNote() {
    const s = Sandbox.state();
    const el = $("#week-note");
    const act = $("#action-note");

    if (!s || !s.weekNote) {
      el.classList.add("hidden");
      el.innerHTML = "";
      act.classList.add("hidden");
      act.innerHTML = "";
      return;
    }

    el.classList.remove("hidden");
    el.innerHTML =
      `<span class="note-ico">\u{1F4CC}</span><span>${s.weekNote.text}` +
      (s.weekNote.outlook && !s.finished
        ? `<span class="note-outlook">${s.weekNote.outlook}</span>`
        : "") +
      `</span>`;

    // the standing note left by whatever you did this week — it sits here
    // until the next decision closes the week out
    if (!s.actionNote) {
      act.classList.add("hidden");
      act.innerHTML = "";
      return;
    }

    const blocked = s.actionNote.kind === "blocked";
    act.className = "week-note action-note" + (blocked ? " blocked" : "");
    act.innerHTML =
      `<span class="note-ico">${blocked ? "\u{1F6D1}" : "\u{1F4DD}"}</span>` +
      `<span><span class="note-title">Week ${s.actionNote.week} — ${s.actionNote.title}</span>` +
      `${s.actionNote.text}</span>`;
  }

  $("#action-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn || btn.disabled) return;
    Sandbox.decide(btn.dataset.action);
  });

  $("#agent-suggest-btn").addEventListener("click", () => {
    const pick = Sandbox.suggest();
    $("#action-list")
      .querySelectorAll("button[data-action]")
      .forEach((b) => (b.style.boxShadow = ""));
    if (!pick) {
      toast("Agent: nothing to suggest right now.");
      return;
    }
    const target = $(`#action-list button[data-action="${pick.action}"]`);
    if (target) target.style.boxShadow = "0 0 0 2px #2C5F2D inset";
    toast(`Agent suggests: ${pick.label} — ${pick.reason}`);
  });

  Sandbox.on("change", renderSandbox);

  Sandbox.on("busy", (b) => {
    busy = b;
    const s = Sandbox.state();
    const disabled = b || !s || s.finished;
    $("#action-list").querySelectorAll("button").forEach((x) => (x.disabled = disabled));
  });

  Sandbox.on("finished", (s) => {
    const run = {
      crop: s.crop.name,
      weeks: s.week,
      growth: s.growth,
      health: s.health,
      win: s.outcome.win,
      blocked: s.blockedCount,
      region: s.region.label,
      soil: s.soil.label,
      season: s.season.label,
      pattern: s.pattern.label,
      fit: s.fit.score,
      water: s.waterUsed,
      at: new Date().toISOString(),
    };
    state = Store.getState(user.id);
    state.sandboxRuns.push(run);
    state.bestGrowth = Math.max(state.bestGrowth || 0, s.growth);
    Store.saveState(user.id, state);
    toast(s.outcome.win ? "Harvest reached." : "Run ended — try a different decision.");
  });

  /* ============================================================
     Y.3172 MAPPING
     ============================================================ */

  function renderMapping() {
    const rows = KB.pipeline
      .map(
        (n) => `
      <tr>
        <td><code>${n.code}</code><br /><span style="font-size:11.5px;color:var(--ink-faint);">${n.role}</span></td>
        <td>${n.standard}</td>
        <td>${n.terratwin}</td>
        <td style="font-size:12px;color:var(--ink-soft);">${n.output}</td>
      </tr>`
      )
      .join("");

    const orch = KB.orchestration
      .map(
        (n) => `
      <tr>
        <td><code>${n.code}</code><br /><span style="font-size:11.5px;color:var(--ink-faint);">${n.role}</span></td>
        <td>${n.standard}</td>
        <td>${n.terratwin}</td>
        <td style="font-size:12px;color:var(--ink-soft);">—</td>
      </tr>`
      )
      .join("");

    $("#mapping-table").innerHTML = `
      <thead>
        <tr>
          <th style="width:15%">Node</th>
          <th style="width:28%">Y.3172 definition</th>
          <th style="width:42%">TerraTwin implementation</th>
          <th style="width:15%">Output</th>
        </tr>
      </thead>
      <tbody>${rows}${orch}</tbody>`;
  }

  /* ============================================================
     REFERENCES
     ============================================================ */

  function renderReferences() {
    $("#refs-list").innerHTML = KB.references
      .map(
        (r) => `
      <div class="ref">
        <div class="ref-name">${r.name}</div>
        <div class="ref-meta">${r.org} · ${r.cat}</div>
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:5px;">${r.why}</p>
        <a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.url}</a>
      </div>`
      )
      .join("");
  }

  /* ============================================================
     SETTINGS
     ============================================================ */

  function renderSettings() {
    const cfg = Store.getSettings();
    $("#set-key").value = cfg.geminiKey || "";
    $("#set-model").value = cfg.geminiModel || "gemini-2.0-flash";
    updateKeyStatus();
  }

  function updateKeyStatus() {
    const cfg = Store.getSettings();
    const el = $("#key-status");
    if (cfg.geminiKey && cfg.geminiKey.trim()) {
      el.textContent = "Connected";
      el.className = "status-pill high";
    } else {
      el.textContent = "Local mode";
      el.className = "status-pill mid";
    }
  }

  $("#set-save").addEventListener("click", () => {
    Store.saveSettings({
      geminiKey: $("#set-key").value.trim(),
      geminiModel: $("#set-model").value.trim() || "gemini-2.0-flash",
    });
    updateKeyStatus();
    toast("Assistant settings saved.");
  });

  $("#set-clear").addEventListener("click", () => {
    Store.saveSettings({ geminiKey: "" });
    $("#set-key").value = "";
    updateKeyStatus();
    toast("API key removed from this browser.");
  });

  $("#set-reset-data").addEventListener("click", () => {
    if (!confirm("This clears your plants, reminders, scans, orders, readiness answers, sandbox history, and chat for this account. Continue?")) return;
    Store.saveState(user.id, {
      readiness: {}, sandboxRuns: [], bestGrowth: 0, chatHistory: [],
      plants: [], tasks: [], scans: [], orders: [], waterSaved: 0,
    });
    toast("Your data has been cleared.");
    setTimeout(() => window.location.reload(), 700);
  });

  /* ============================================================
     INIT
     ============================================================ */

  Pipeline.mount("#pipe-track", "#pipe-readout");
  renderSetupPickers();
  renderCropPicker();
  renderScorecard();
  renderMapping();
  renderReferences();
  renderSettings();
  renderSandbox();
  renderDashboard();
  Assistant.mount(user);

  go("dashboard");
};
