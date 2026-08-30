/* ============================================================
   TerraTwin — Sandbox (digital twin simulation)
   ------------------------------------------------------------
   A rule-based crop model. The player makes one decision per
   week; each decision is pushed through the Y.3172 pipeline,
   checked by the Policy node, and then applied to plant state.

   This is the ML Sandbox from Y.3172 clause 8.1, made playable:
   the decision is evaluated in an isolated environment before
   it would ever be recommended for a real field.

   Setup order — region -> soil -> season -> weather pattern ->
   crop. Site is chosen before seed, the way a real planting
   decision is made: you cannot move the land, so the land
   decides what is sensible to plant in it.
   ============================================================ */

const Sandbox = (() => {
  /* ---------------- weather ----------------
     tempDelta shifts the week's temperature away from the
     seasonal norm; dry is net moisture loss; humid feeds pest
     and disease pressure.
     ============================================================ */
  const WEATHERS = [
    { id: "clear",  label: "Clear",     icon: "☀️",     dry: 3,   humid: 0, tempDelta: 1,  note: "Warm and dry." },
    { id: "hot",    label: "Hot spell", icon: "\u{1F525}",        dry: 8,   humid: 0, tempDelta: 5,  note: "High evaporation this week." },
    { id: "humid",  label: "Humid",     icon: "\u{1F32B}️",  dry: 0,   humid: 3, tempDelta: 1,  note: "Humidity favours pests and disease." },
    { id: "rain",   label: "Rain",      icon: "\u{1F327}️",  dry: -15, humid: 2, tempDelta: -3, note: "Rainfall added moisture to the soil." },
    { id: "cloud",  label: "Overcast",  icon: "☁️",     dry: 2,   humid: 1, tempDelta: -1, note: "Mild week, little water loss." },
  ];

  /* ---------------- farm setup: region, soil, season, pattern ----------------
     All four are chosen by the player before planting. Region and
     soil set the physical site; season and weather pattern set the
     climate the season will be played under. Week-to-week weather
     is still rolled by the model — a farmer picks when to plant,
     not what the sky does on a given Tuesday.
     ============================================================ */

  const REGIONS = [
    {
      id: "tihama",
      label: "Tihama Coast",
      sub: "Jazan lowlands · ~20 m",
      climateKey: "jazan",
      elevation: 20,
      baseTemp: 33,          // mean daytime temperature before season shift
      humidLean: 3,          // added weight for humid/hot weather
      rainLean: 0,
      desc: "Hot, humid Red Sea coastal plain. Sandy, fast-draining soils — mango and banana country.",
    },
    {
      id: "sabya",
      label: "Wadi Sabya",
      sub: "Jazan valley farmland · ~120 m",
      climateKey: "jazan",
      elevation: 120,
      baseTemp: 32,
      humidLean: 1,
      rainLean: 1,
      desc: "Seasonal wadi floodplain fed by highland runoff. The most fertile farmland in the region.",
    },
    {
      id: "abuarish",
      label: "Abu Arish Plains",
      sub: "Jazan inland plains · ~90 m",
      climateKey: "jazan",
      elevation: 90,
      baseTemp: 33,
      humidLean: 1,
      rainLean: 0,
      desc: "Open inland plain between the coast and the foothills. Heavier soils, irrigated field cropping.",
    },
    {
      id: "reeth",
      label: "Al-Reeth Foothills",
      sub: "Jazan mountain terraces · ~900 m",
      climateKey: "jazanhi",
      elevation: 900,
      baseTemp: 28,
      humidLean: 1,
      rainLean: 2,
      desc: "Terraced middle slopes between plain and peak. Cooler nights, monsoon-tail rain in late summer.",
    },
    {
      id: "fifa",
      label: "Fifa Highlands",
      sub: "Jazan mountains · ~1600 m",
      climateKey: "jazanhi",
      elevation: 1600,
      baseTemp: 24,
      humidLean: 0,
      rainLean: 3,
      desc: "Cool terraced peaks above the Tihama plain. Rocky terrace soils — home of Khawlani coffee.",
    },
  ];

  /* drain: how fast water leaves · retain: how much irrigation is held
     fert: baseline fertility · salt: salinity/runoff risk */
  const SOILS = {
    tihama: [
      { id: "sandy",    label: "Sandy coastal soil", drain: 1.25, retain: 0.85, fert: 0.85, salt: 0.12,
        note: "Drains fast — needs more frequent water, but rarely waterlogs." },
      { id: "alluvial", label: "Alluvial plain soil", drain: 1.0,  retain: 1.0,  fert: 1.0,  salt: 0.06,
        note: "Balanced texture and moderate fertility, typical of the coastal plain." },
      { id: "saline",   label: "Saline coastal flat", drain: 1.1,  retain: 0.9,  fert: 0.75, salt: 0.3,
        note: "Near the shore — salt builds up unless leaching irrigation keeps it moving down." },
    ],
    sabya: [
      { id: "silt",   label: "Wadi silt loam",   drain: 0.95, retain: 1.1,  fert: 1.2,  salt: 0.04,
        note: "Deep flood-deposited silt — the richest soil in Jazan, holds water evenly." },
      { id: "gravel", label: "Wadi gravel bed",  drain: 1.35, retain: 0.75, fert: 0.8,  salt: 0.05,
        note: "Coarse channel deposits. Excellent drainage, very poor at holding water." },
    ],
    abuarish: [
      { id: "clay",      label: "Heavy plain clay", drain: 0.7,  retain: 1.25, fert: 1.05, salt: 0.1,
        note: "Holds water a long time — cracks when dry and waterlogs when over-irrigated." },
      { id: "sandyloam", label: "Sandy loam",       drain: 1.05, retain: 0.95, fert: 0.95, salt: 0.07,
        note: "Easy-working plain soil, forgiving of irrigation mistakes." },
    ],
    reeth: [
      { id: "terracefoot", label: "Terrace foot soil", drain: 0.9,  retain: 1.1,  fert: 1.05, salt: 0.05,
        note: "Soil that has crept down the slope and settled — deeper and richer than the terraces above." },
      { id: "stony",       label: "Stony slope soil",  drain: 1.15, retain: 0.85, fert: 0.85, salt: 0.05,
        note: "Thin and stone-heavy. Warms fast, dries fast, and needs careful little-and-often watering." },
    ],
    fifa: [
      { id: "terrace", label: "Rocky terrace soil", drain: 0.85, retain: 1.15, fert: 0.9, salt: 0.05,
        note: "Holds moisture well on the slope, but shallow — nutrients wash out in heavy rain." },
      { id: "loam",    label: "Highland loam",      drain: 0.9,  retain: 1.1,  fert: 1.15, salt: 0.03,
        note: "Fertile, well-structured mountain soil." },
    ],
  };

  const SEASONS = [
    { id: "winter", label: "Winter", arabic: "Shita’", icon: "❄️", months: [12, 1, 2],
      pestBias: -0.04, rainBias: 3, tempShift: -6,
      note: "Cooler and wetter — lower pest pressure, some drought relief." },
    { id: "spring", label: "Spring", arabic: "Rabee‘", icon: "\u{1F33F}", months: [3, 4, 5],
      pestBias: 0, rainBias: 1, tempShift: 0,
      note: "Mild transition season, moderate conditions." },
    { id: "summer", label: "Summer", arabic: "Sayf", icon: "☀️", months: [6, 7, 8],
      pestBias: 0.05, rainBias: -2, tempShift: 6,
      note: "Hottest and driest — highest water demand and pest activity." },
    { id: "autumn", label: "Autumn", arabic: "Khareef", icon: "\u{1F342}", months: [9, 10, 11],
      pestBias: 0.02, rainBias: 1, tempShift: 1,
      note: "Cooling down, with occasional monsoon-tail rain in the highlands." },
  ];

  /* Weather patterns — the character of the year you plant into.
     The weekly weather is still rolled, but the odds are bent. */
  const PATTERNS = [
    { id: "normal", label: "Normal year", icon: "\u{1F324}️",
      rainBias: 0, dryBias: 0, humidBias: 0, tempShift: 0,
      note: "Typical conditions for the season you picked." },
    { id: "dry", label: "Dry year", icon: "\u{1F3DC}️",
      rainBias: -3, dryBias: 3, humidBias: -1, tempShift: 2,
      note: "Drought year — little rain, high evaporation, irrigation timing decides the harvest." },
    { id: "wet", label: "Wet year", icon: "\u{1F326}️",
      rainBias: 3, dryBias: -2, humidBias: 1, tempShift: -2,
      note: "Heavy rainfall — free water, but waterlogging and nutrient washout are the real risk." },
    { id: "humid", label: "Humid year", icon: "\u{1F32B}️",
      rainBias: 1, dryBias: -1, humidBias: 3, tempShift: 1,
      note: "Muggy year — moisture holds, but pest and fungal pressure runs high all season." },
  ];

  /* Crop climate envelopes used by the suitability check. Chill is
     not modelled at week scale; heat and cold are. */
  const CROP_ENVELOPE = {
    coffee: { climateKey: "coffee", idealTemp: [18, 28], heatMax: 32, coldMin: 8,
              likes: ["fifa", "reeth"], dislikes: ["tihama", "abuarish", "sabya"] },
    mango:  { climateKey: "mango",  idealTemp: [24, 36], heatMax: 45, coldMin: 12,
              likes: ["tihama", "sabya", "abuarish"], dislikes: ["fifa"] },
    corn:   { climateKey: "maize",  idealTemp: [20, 32], heatMax: 38, coldMin: 10,
              likes: ["sabya", "abuarish", "reeth"], dislikes: [] },
  };

  function currentSeason() {
    const m = new Date().getMonth() + 1;
    return SEASONS.find((sn) => sn.months.includes(m)) || SEASONS[0];
  }

  function soilsFor(regionId) {
    return SOILS[regionId] || SOILS.tihama;
  }

  function envelopeFor(cropId) {
    return CROP_ENVELOPE[cropId] || CROP_ENVELOPE.corn;
  }

  /* ---------------- site suitability ----------------
     Scores a crop against a region + season before planting.
     This is the sandbox telling you, honestly, whether the plan
     is sensible — not stopping you from trying it.
     ============================================================ */
  function suitability(cropId, regionId, seasonId, patternId) {
    const env = envelopeFor(cropId);
    const region = REGIONS.find((r) => r.id === regionId) || REGIONS[0];
    const season = SEASONS.find((sn) => sn.id === seasonId) || SEASONS[0];
    const pattern = PATTERNS.find((p) => p.id === patternId) || PATTERNS[0];
    const crop = (typeof KB !== "undefined" && KB.crops[cropId]) || null;

    const temp = region.baseTemp + season.tempShift + pattern.tempShift;
    const [lo, hi] = env.idealTemp;

    let score = 100;
    const reasons = [];

    if (temp > env.heatMax) {
      score -= 42;
      reasons.push(`mean ${Math.round(temp)}°C is above the ${env.heatMax}°C ceiling for this crop`);
    } else if (temp > hi) {
      score -= 22;
      reasons.push(`running warm at ~${Math.round(temp)}°C, above the ideal ${lo}–${hi}°C band`);
    } else if (temp < env.coldMin) {
      score -= 35;
      reasons.push(`mean ${Math.round(temp)}°C is too cold for growth`);
    } else if (temp < lo) {
      score -= 14;
      reasons.push(`cool at ~${Math.round(temp)}°C, below the ideal ${lo}–${hi}°C band`);
    }

    // the "right region" bonus only counts when the temperature is
    // actually inside the crop's band — the right place at the wrong
    // time of year is still the wrong plan
    const inBand = temp >= lo && temp <= hi;
    if (env.likes.indexOf(region.id) !== -1 && inBand) {
      score += 8;
      reasons.push(`${region.label} is established growing country for this crop`);
    }
    if (env.dislikes.indexOf(region.id) !== -1) {
      score -= 28;
      reasons.push(`${region.label} is outside this crop's normal range`);
    }

    if (pattern.id === "dry" && crop && crop.thirst >= 13) {
      score -= 10;
      reasons.push("a thirsty crop in a drought year needs near-perfect irrigation timing");
    }
    if (pattern.id === "humid" && crop && crop.pestProne >= 0.26) {
      score -= 10;
      reasons.push("a pest-prone crop in a humid year will need active monitoring");
    }

    score = Math.max(0, Math.min(100, score));
    const band = score >= 80 ? "good" : score >= 50 ? "fair" : "poor";
    const verdict =
      band === "good" ? "Well matched to this site and season."
      : band === "fair" ? "Workable, but this pairing will be demanding."
      : "Poorly matched — expect stress from the first week.";

    return { score, band, verdict, reasons, temp: Math.round(temp) };
  }

  /* Policy constants — these are the governance rules the P node enforces */
  const MIN_IRRIGATION_GAP = 1;   // weeks that must pass between irrigations
  const FERTILISER_CEILING = 3;   // applications allowed per season
  const TREAT_COOLDOWN = 2;       // weeks between pesticide applications
  const PRE_HARVEST_INTERVAL = 1; // no spraying within this many weeks of harvest

  let s = null;      // current run state
  let listeners = {};

  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
  }

  function emit(evt, payload) {
    (listeners[evt] || []).forEach((fn) => fn(payload));
  }

  /* ---------------- lifecycle ---------------- */

  function start(cropId, setup) {
    const crop = KB.crops[cropId];
    if (!crop) return null;

    setup = setup || {};
    const region = REGIONS.find((r) => r.id === setup.region) || REGIONS[0];
    const soilList = soilsFor(region.id);
    const soil = soilList.find((sl) => sl.id === setup.soil) || soilList[0];
    const season = SEASONS.find((sn) => sn.id === setup.season) || currentSeason();
    const pattern = PATTERNS.find((p) => p.id === setup.pattern) || PATTERNS[0];
    const fit = suitability(cropId, region.id, season.id, pattern.id);

    s = {
      cropId,
      crop,
      env: envelopeFor(cropId),
      week: 0,
      stage: "seed",          // seed -> sprout -> growing -> done
      moisture: 55,
      nutrients: Math.round(50 * soil.fert),
      pest: 8,
      health: 70,
      growth: 0,
      salinity: Math.round(soil.salt * 40),
      temp: region.baseTemp + season.tempShift + pattern.tempShift,
      lastIrrigationWeek: -5,
      lastTreatWeek: -5,
      fertiliserUsed: 0,
      waterUsed: 0,
      weather: WEATHERS[0],
      forecast: null,
      region,
      soil,
      season,
      pattern,
      fit,
      weekNote: null,
      actionNote: null,
      log: [],
      finished: false,
      outcome: null,
      blockedCount: 0,
    };

    pushLog(
      0,
      `Seed planted in ${region.label} (${region.sub.split(" · ")[0]}) on ${soil.label.toLowerCase()}, ` +
      `${season.label.toLowerCase()} in a ${pattern.label.toLowerCase()}. ${crop.name} needs ${crop.weeks} weeks to reach harvest.`,
      "good"
    );
    pushLog(0, `Site check — suitability ${fit.score}/100. ${fit.verdict}`,
      fit.band === "good" ? "good" : fit.band === "fair" ? "warn" : "bad");

    rollWeather();
    s.weekNote = buildWeekNote();
    emit("change", s);
    return s;
  }

  function reset() {
    s = null;
    emit("change", null);
  }

  function state() {
    return s;
  }

  /* ---------------- weather engine ---------------- */

  function weatherBag() {
    let bag = ["clear", "clear", "hot", "hot", "humid", "humid", "cloud", "cloud", "rain"];
    if (!s) return bag;

    // region lean: coast runs hotter and more humid, highlands cooler and wetter
    for (let i = 0; i < (s.region.humidLean || 0); i++) bag.push("humid", "hot");
    for (let i = 0; i < (s.region.rainLean || 0); i++) bag.push("rain", "cloud");

    // season lean
    const rainBias = (s.season.rainBias || 0) + (s.pattern.rainBias || 0);
    if (rainBias > 0) for (let i = 0; i < rainBias; i++) bag.push("rain", "cloud");
    else if (rainBias < 0) for (let i = 0; i < -rainBias; i++) bag.push("hot", "clear");

    // chosen pattern lean
    for (let i = 0; i < (s.pattern.dryBias || 0); i++) bag.push("hot", "clear");
    for (let i = 0; i < (s.pattern.humidBias || 0); i++) bag.push("humid");

    // a wet or humid year should not be able to roll away all its rain
    if (s.pattern.id === "dry") bag = bag.filter((w, i) => !(w === "rain" && i % 2 === 0));

    return bag;
  }

  function drawWeather() {
    const bag = weatherBag();
    const pick = bag[Math.floor(Math.random() * bag.length)];
    return WEATHERS.find((w) => w.id === pick) || WEATHERS[0];
  }

  /* The forecast is generated one week ahead and shown to the player.
     It is deliberately imperfect: 70% of the time it is what actually
     happens, otherwise the week is re-rolled. A digital twin that
     promised a perfect forecast would be lying. */
  function rollWeather() {
    if (!s) return;
    if (s.forecast && Math.random() < 0.7) {
      s.weather = s.forecast;
    } else {
      s.weather = drawWeather();
    }
    s.forecast = drawWeather();
    s.temp = Math.round(
      s.region.baseTemp + s.season.tempShift + s.pattern.tempShift + s.weather.tempDelta
    );
  }

  function forecastTemp() {
    if (!s || !s.forecast) return null;
    return Math.round(
      s.region.baseTemp + s.season.tempShift + s.pattern.tempShift + s.forecast.tempDelta
    );
  }

  function pushLog(week, text, kind) {
    if (!s) return;
    s.log.unshift({ week, text, kind: kind || "" });
    if (s.log.length > 40) s.log.pop();
  }

  /* ---------------- the P node ---------------- */
  /*
    Returns null if the action is allowed, or a { reason } object
    if governance/safety rules block it. This is the single place
    where policy is enforced, mirroring Y.3172's Policy node.
  */
  function policyCheck(action) {
    if (action === "water") {
      const gap = s.week - s.lastIrrigationWeek;
      if (gap < MIN_IRRIGATION_GAP) {
        return { reason: `blocked — minimum ${MIN_IRRIGATION_GAP}-week interval between irrigations not met. Water-efficiency rule.` };
      }
      if (s.moisture > 88) {
        return { reason: "blocked — soil is already saturated. Irrigating now risks waterlogging and root stress." };
      }
      // forecast-aware: don't irrigate into confirmed rain unless the crop is genuinely dry
      const [lo] = s.crop.idealMoisture;
      if (s.forecast && s.forecast.id === "rain" && s.moisture > lo) {
        return { reason: "blocked — rain is forecast next week and moisture is already inside the target band. Irrigating now would waste water." };
      }
    }

    if (action === "fertilise") {
      if (s.fertiliserUsed >= FERTILISER_CEILING) {
        return { reason: `blocked — seasonal ceiling of ${FERTILISER_CEILING} applications reached. No yield benefit above this, and runoff risk.` };
      }
      if (s.nutrients > 82) {
        return { reason: "blocked — nutrient level is already high. Further application would stress the roots." };
      }
      if (s.moisture < 25) {
        return { reason: "blocked — soil is too dry to fertilise. Applying now would scorch the roots and salt the soil. Irrigate first." };
      }
      if (s.salinity > 70) {
        return { reason: "blocked — soil salinity is critical. Adding fertiliser salts now would push the root zone past tolerance." };
      }
    }

    if (action === "treat") {
      if (s.pest < 20) {
        return { reason: "blocked — pest pressure is below the treatment threshold. Unnecessary spraying is discouraged." };
      }
      const since = s.week - s.lastTreatWeek;
      if (since < TREAT_COOLDOWN) {
        return { reason: `blocked — ${TREAT_COOLDOWN}-week re-entry interval between treatments not met. Repeat spraying breeds resistance.` };
      }
      if (s.crop.weeks - s.week <= PRE_HARVEST_INTERVAL) {
        return { reason: "blocked — inside the pre-harvest interval. Residue would still be on the crop at harvest." };
      }
      if (s.forecast && s.forecast.id === "rain") {
        return { reason: "blocked — rain is forecast next week. The treatment would wash off and run into the watercourse." };
      }
    }

    return null;
  }

  /* ---------------- the M node ---------------- */
  /*
    The "model": given current state and a proposed action,
    predict the effect. Rule-based at prototype stage, but now
    site-aware — the same action reads differently on sand,
    clay and terrace soil.
  */
  function irrigationGain() {
    // heavy soils accept less per pass; sandy soils take it but lose it fast
    return 30 * (s.soil.retain || 1);
  }

  function modelPredict(action) {
    const [lo, hi] = s.crop.idealMoisture;

    if (action === "water") {
      const after = Math.min(100, s.moisture + irrigationGain());
      return {
        summary: `moisture ${Math.round(s.moisture)}% → ${Math.round(after)}% on ${s.soil.label.toLowerCase()}, target band ${lo}–${hi}%`,
        recommend: s.moisture < hi,
      };
    }
    if (action === "fertilise") {
      const gain = Math.round(28 * (s.soil.fert || 1));
      return {
        summary: `nutrients ${Math.round(s.nutrients)}% → ${Math.round(Math.min(100, s.nutrients + gain))}%, application ${s.fertiliserUsed + 1} of ${FERTILISER_CEILING}`,
        recommend: s.nutrients < 60,
      };
    }
    if (action === "treat") {
      return {
        summary: `pest pressure ${Math.round(s.pest)}% → ${Math.round(Math.max(0, s.pest - 32))}%`,
        recommend: s.pest > 30,
      };
    }
    if (action === "inspect") {
      return {
        summary: `reading state — moisture ${Math.round(s.moisture)}%, nutrients ${Math.round(s.nutrients)}%, pest ${Math.round(s.pest)}%, soil temp ${s.temp}°C`,
        recommend: true,
      };
    }
    return { summary: "holding — no intervention this week", recommend: true };
  }

  /* ---------------- apply a decision ---------------- */

  const ACTION_LABELS = {
    water: "irrigate",
    fertilise: "apply fertiliser",
    treat: "treat for pests",
    inspect: "inspect the plant",
    wait: "hold — no action",
  };

  function buildTrace(action, prediction, blocked) {
    const steps = [
      { code: "SRC", text: `farm state read — week ${s.week + 1}, ${s.weather.label.toLowerCase()}, ${s.temp}°C, ${s.region.label}` },
      { code: "C",   text: `observations collected into the farm profile (${s.soil.label.toLowerCase()}, ${s.season.label.toLowerCase()})` },
      { code: "PP",  text: "values normalised for the model" },
      { code: "M",   text: `predicted — ${prediction.summary}` },
    ];

    if (blocked) {
      steps.push({ code: "P", text: `${ACTION_LABELS[action]} ${blocked.reason}`, blocked: true });
      return steps;
    }

    steps.push({ code: "P", text: `${ACTION_LABELS[action]} passed governance and safety checks` });
    steps.push({ code: "D", text: "approved recommendation routed to the farm view" });
    steps.push({ code: "SINK", text: `${ACTION_LABELS[action]} applied to the plant` });
    return steps;
  }

  async function decide(action) {
    if (!s || s.finished) return;

    // a new decision closes the previous week's note
    s.actionNote = null;

    const prediction = modelPredict(action);
    const blocked = policyCheck(action);
    const trace = buildTrace(action, prediction, blocked);

    emit("busy", true);
    await Pipeline.run(trace);
    emit("busy", false);

    if (blocked) {
      s.blockedCount++;
      pushLog(s.week + 1, `Policy node blocked the request: ${blocked.reason}`, "warn");
      s.actionNote = {
        week: s.week,
        kind: "blocked",
        title: `Request refused — ${ACTION_LABELS[action]}`,
        text: `${blocked.reason.replace(/^blocked — /, "")} The week has not advanced; choose another action.`,
      };
      s.weekNote = buildWeekNote();
      emit("change", s);
      return;
    }

    // --- apply the approved action ---
    const before = { moisture: s.moisture, nutrients: s.nutrients, pest: s.pest };
    let applied;

    if (action === "water") {
      const gain = irrigationGain();
      s.moisture = Math.min(100, s.moisture + gain);
      s.lastIrrigationWeek = s.week;
      s.waterUsed++;
      // irrigation leaches salt down, a little
      s.salinity = Math.max(0, s.salinity - 6);
      applied = {
        title: "Irrigated this week",
        text: `Moisture ${Math.round(before.moisture)}% → ${Math.round(s.moisture)}% ` +
              `(${s.soil.label.toLowerCase()} holds ×${(s.soil.retain || 1).toFixed(2)}). ` +
              `Leaching pulled salinity down to ${Math.round(s.salinity)}%. ` +
              `Irrigation ${s.waterUsed} this run — next one allowed from week ${s.week + 1 + MIN_IRRIGATION_GAP}.`,
      };
      pushLog(s.week + 1, `Irrigated. Soil moisture now ${Math.round(s.moisture)}%.`, "good");
    } else if (action === "fertilise") {
      const gain = 28 * (s.soil.fert || 1);
      s.nutrients = Math.min(100, s.nutrients + gain);
      s.fertiliserUsed++;
      s.salinity = Math.min(100, s.salinity + 7 + (s.soil.salt || 0) * 20);
      applied = {
        title: "Fertiliser applied this week",
        text: `Nutrients ${Math.round(before.nutrients)}% → ${Math.round(s.nutrients)}%. ` +
              `Application ${s.fertiliserUsed} of ${FERTILISER_CEILING} for the season — ` +
              `${FERTILISER_CEILING - s.fertiliserUsed} left. Salinity rose to ${Math.round(s.salinity)}%; ` +
              `irrigation will leach it back down.`,
      };
      pushLog(s.week + 1, `Fertiliser applied (${s.fertiliserUsed} of ${FERTILISER_CEILING} this season).`, "good");
    } else if (action === "treat") {
      s.pest = Math.max(0, s.pest - 32);
      s.lastTreatWeek = s.week;
      applied = {
        title: "Treated for pests this week",
        text: `Pest pressure ${Math.round(before.pest)}% → ${Math.round(s.pest)}%. ` +
              `Re-entry interval in force — no further treatment until week ${s.week + 1 + TREAT_COOLDOWN}, ` +
              `and none at all inside the last ${PRE_HARVEST_INTERVAL} week before harvest.`,
      };
      pushLog(s.week + 1, `Treated for pests. Pressure down to ${Math.round(s.pest)}%.`, "good");
    } else if (action === "inspect") {
      applied = {
        title: "Inspected this week",
        text: `Moisture ${Math.round(s.moisture)}%, nutrients ${Math.round(s.nutrients)}%, ` +
              `pest pressure ${Math.round(s.pest)}%, salinity ${Math.round(s.salinity)}%, air ${s.temp}°C. ` +
              `Inspection costs a week but changes nothing in the soil.`,
      };
      pushLog(s.week + 1, `Inspected: moisture ${Math.round(s.moisture)}%, nutrients ${Math.round(s.nutrients)}%, pest pressure ${Math.round(s.pest)}%.`, "");
    } else {
      applied = {
        title: "Held this week",
        text: "No intervention. The plant was left to the weather — sometimes the right call, sometimes the expensive one.",
      };
      pushLog(s.week + 1, "Held — no intervention this week.", "");
    }

    advanceWeek();

    // the note stays up for the whole of the week that follows the action
    s.actionNote = {
      week: s.week,
      kind: "applied",
      title: applied.title,
      text: applied.text,
    };
    s.weekNote = buildWeekNote();
    emit("change", s);
  }

  /* ---------------- weekly advisory note ----------------
     A short, standing note that reflects the current week's
     conditions. It stays on screen until the next decision is
     made (i.e. until the week turns over), the way a field note
     would sit on a clipboard for the rest of the week.
     ============================================================ */
  function buildWeekNote() {
    if (!s) return null;
    const [lo, hi] = s.crop.idealMoisture;
    const tips = [];

    if (s.moisture < lo - 8) tips.push("moisture is well below the ideal band — irrigation is worth prioritising");
    else if (s.moisture < lo) tips.push("moisture is a little under the ideal band");
    else if (s.moisture > hi + 8) tips.push("soil is over-saturated — hold off on watering");
    else if (s.moisture > hi) tips.push("soil is on the wet side this week");

    if (s.nutrients < 25) tips.push("nutrients are running low");
    if (s.pest > 45) tips.push("pest pressure is high — treatment is worth considering");
    else if (s.pest > 30) tips.push("pest pressure is climbing");

    if (s.salinity > 60) tips.push("salinity is building in the root zone — a leaching irrigation would help");
    if (s.temp > s.env.heatMax) tips.push(`${s.temp}°C is above this crop's heat ceiling — expect heat stress`);
    else if (s.temp < s.env.coldMin) tips.push(`${s.temp}°C is below the growth threshold — development will stall`);

    const text = tips.length
      ? `This week: ${tips.join("; ")}.`
      : "This week: conditions look steady — no urgent action needed.";

    const ft = forecastTemp();
    const outlook = s.forecast
      ? `Next week's outlook: ${s.forecast.label.toLowerCase()}, around ${ft}°C. Forecasts are indicative, not certain.`
      : null;

    return { week: s.week, text, outlook };
  }

  /* ---------------- weekly tick ---------------- */

  function advanceWeek() {
    s.week++;

    const crop = s.crop;
    const [lo, hi] = crop.idealMoisture;
    const soil = s.soil;

    // --- evapotranspiration: thirst scaled by soil drainage, weather and heat ---
    const heatFactor = 1 + Math.max(0, s.temp - 30) * 0.035;
    const et = crop.thirst * (soil.drain || 1) * heatFactor + s.weather.dry;
    s.moisture = Math.max(0, Math.min(100, s.moisture - et));

    // --- nutrients drawn down; poor and shallow soils lose more, rain washes more out ---
    let nutrientLoss = 5 / (soil.fert || 1);
    if (s.weather.id === "rain") nutrientLoss += 2 * (soil.drain || 1);
    s.nutrients = Math.max(0, s.nutrients - nutrientLoss);

    // --- salinity: evaporation concentrates salts, rain and high moisture flush them ---
    if (s.weather.id === "rain") s.salinity = Math.max(0, s.salinity - 8);
    else s.salinity = Math.min(100, s.salinity + (soil.salt || 0) * 8 + Math.max(0, s.temp - 34) * 0.4);

    // --- pest pressure: humid weather, humid region, season and year pattern all feed it ---
    const pestChance =
      crop.pestProne +
      s.weather.humid * 0.06 +
      (s.season.pestBias || 0) +
      (s.region.humidLean || 0) * 0.018 +
      (s.pattern.humidBias || 0) * 0.02;

    if (Math.random() < pestChance) {
      s.pest = Math.min(100, s.pest + 11 + s.weather.humid * 2);
    } else {
      s.pest = Math.min(100, s.pest + 3);
    }

    // --- health response ---
    let delta = 0;
    const notes = [];

    if (s.moisture < lo - 12) {
      delta -= 11;
      notes.push("severe drought stress");
    } else if (s.moisture < lo) {
      delta -= 5;
      notes.push("mild water stress");
    } else if (s.moisture > hi + 12) {
      // heavy soils punish over-watering harder, sandy soils shrug it off
      const wetPenalty = (soil.drain || 1) < 0.9 ? 12 : 9;
      delta -= wetPenalty;
      notes.push("waterlogging");
    } else if (s.moisture > hi) {
      delta -= 3;
      notes.push("soil a little too wet");
    } else {
      delta += 8;
    }

    if (s.nutrients < 20) {
      delta -= 6;
      notes.push("nutrient deficiency");
    } else if (s.nutrients > 40) {
      delta += 3;
    }

    if (s.pest > 55) {
      delta -= 10;
      notes.push("heavy pest damage");
    } else if (s.pest > 35) {
      delta -= 4;
      notes.push("pest pressure rising");
    }

    // temperature stress against the crop's own envelope
    const env = s.env;
    if (s.temp > env.heatMax + 4) {
      delta -= 9;
      notes.push(`heat stress at ${s.temp}°C`);
    } else if (s.temp > env.heatMax) {
      delta -= 4;
      notes.push(`running hot at ${s.temp}°C`);
    } else if (s.temp < env.coldMin - 4) {
      delta -= 7;
      notes.push(`cold stress at ${s.temp}°C`);
    } else if (s.temp < env.coldMin) {
      delta -= 3;
      notes.push(`cool at ${s.temp}°C`);
    }

    // salinity stress
    if (s.salinity > 75) {
      delta -= 7;
      notes.push("salt stress in the root zone");
    } else if (s.salinity > 55) {
      delta -= 3;
      notes.push("salinity rising");
    }

    s.health = Math.max(0, Math.min(100, s.health + delta));

    // growth accrues while healthy, scaled by how well the site suits the crop
    if (s.health > 40) {
      const fitFactor = 0.6 + (s.fit.score / 100) * 0.5;   // 0.6x on a bad site, 1.1x on a good one
      const tempFactor = s.temp > env.idealTemp[1] || s.temp < env.idealTemp[0] ? 0.85 : 1;
      s.growth = Math.min(
        100,
        s.growth + (100 / crop.weeks) * (s.health / 100) * 1.25 * fitFactor * tempFactor
      );
    }

    // stage transitions
    if (s.stage === "seed" && s.week >= 1) s.stage = "sprout";
    if (s.stage === "sprout" && s.growth > 18) s.stage = "growing";

    // weekly narrative
    const weatherNote = `${s.weather.icon} ${s.weather.note} ${s.temp}°C.`;
    if (notes.length) {
      pushLog(s.week, `${weatherNote} Health ${Math.round(s.health)}% — ${notes.join(", ")}.`,
        s.health < 35 ? "bad" : "warn");
    } else {
      pushLog(s.week, `${weatherNote} Health ${Math.round(s.health)}% — growing well.`, "good");
    }

    rollWeather();
    checkEnd();
  }

  function checkEnd() {
    if (s.health <= 0) {
      s.finished = true;
      s.stage = "dead";
      s.outcome = {
        win: false,
        title: "The crop did not survive",
        text: `Health reached zero in week ${s.week} on ${s.soil.label.toLowerCase()} in ${s.region.label}, ` +
              `${s.season.label.toLowerCase()} of a ${s.pattern.label.toLowerCase()}. ` +
              `In the sandbox this costs nothing — that is the point. Change one variable — the site, the season, or one decision — and run it again.`,
      };
      pushLog(s.week, "The plant died. Run ended.", "bad");
      emit("finished", s);
      return;
    }

    if (s.week >= s.crop.weeks) {
      s.finished = true;
      const good = s.health >= 55 && s.growth >= 60;
      s.stage = good ? "growing" : (s.health < 30 ? "dead" : "growing");
      s.outcome = good
        ? {
            win: true,
            title: "Harvest reached",
            text: `${s.crop.name} finished at ${Math.round(s.growth)}% growth and ${Math.round(s.health)}% health in ` +
                  `${s.region.label}, on ${s.waterUsed} irrigation${s.waterUsed === 1 ? "" : "s"} and ` +
                  `${s.fertiliserUsed} fertiliser application${s.fertiliserUsed === 1 ? "" : "s"}, with ` +
                  `${s.blockedCount} request${s.blockedCount === 1 ? "" : "s"} stopped by the Policy node.`,
          }
        : {
            win: false,
            title: "Weak harvest",
            text: `The season ended at ${Math.round(s.growth)}% growth and ${Math.round(s.health)}% health — below a viable harvest. ` +
                  `Site suitability was ${s.fit.score}/100. The log shows where the stress built up.`,
          };
      pushLog(s.week, s.outcome.title + ".", good ? "good" : "warn");
      emit("finished", s);
    }
  }

  /* ---------------- visuals ---------------- */

  function currentArtwork() {
    if (!s) return null;
    const c = s.crop;
    if (s.stage === "dead") return { src: c.dead, cls: "", alt: `A withered ${c.name} plant` };
    if (s.stage === "seed") return { src: c.seed, cls: "seed-stage", alt: `A ${c.name} seed in the soil` };
    if (s.stage === "sprout") return { src: c.healthy, cls: "sprouting", alt: `A ${c.name} seedling` };
    return { src: c.healthy, cls: "", alt: `A healthy ${c.name} plant` };
  }

  /* ---------------- the agent ----------------
     A small, human-in-the-loop suggestion layer. It does not act on
     its own: it evaluates every legal action through the same M
     (modelPredict) and P (policyCheck) nodes already used by a real
     decision, scores the candidates that policy allows by how far
     the matching vital is out of its ideal band, and returns the
     single best recommendation with a plain-language reason. The
     farmer still has to click a button — this only points at one.
     ============================================================ */
  function suggest() {
    if (!s || s.finished) return null;
    const [lo, hi] = s.crop.idealMoisture;
    const candidates = ["water", "fertilise", "treat", "inspect", "wait"];
    let best = null;
    let bestScore = -Infinity;

    for (const action of candidates) {
      const blocked = policyCheck(action);
      if (blocked) continue;
      const prediction = modelPredict(action);

      let score;
      if (action === "water") score = Math.max(0, lo - s.moisture) + Math.max(0, s.moisture - hi) * 0.5;
      else if (action === "fertilise") score = Math.max(0, 60 - s.nutrients) * 0.8;
      else if (action === "treat") score = Math.max(0, s.pest - 30) * 1.1;
      else if (action === "inspect") score = 5;
      else score = 1; // "wait" — lowest priority unless nothing else is warranted

      if (!prediction.recommend && action !== "inspect" && action !== "wait") score -= 50;
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }

    if (!best) {
      return {
        action: "wait",
        label: ACTION_LABELS.wait,
        reason: "every other action is currently blocked by the Policy node — holding is the only option this week.",
      };
    }

    const reasonMap = {
      water: `moisture is ${Math.round(s.moisture)}% against a ${lo}-${hi}% target — irrigation closes the biggest gap.`,
      fertilise: `nutrients are ${Math.round(s.nutrients)}% — fertilising now addresses the largest shortfall.`,
      treat: `pest pressure is ${Math.round(s.pest)}%, above the treatment threshold — acting now limits spread.`,
      inspect: "vitals are within range — inspecting costs a week but confirms nothing is urgent.",
      wait: "vitals are within range and no rule is being triggered — holding is the lowest-risk option this week.",
    };
    return { action: best, label: ACTION_LABELS[best], reason: reasonMap[best] };
  }

  return {
    start,
    reset,
    state,
    decide,
    suggest,
    on,
    currentArtwork,
    WEATHERS,
    FERTILISER_CEILING,
    TREAT_COOLDOWN,
    REGIONS,
    SOILS,
    SEASONS,
    PATTERNS,
    soilsFor,
    currentSeason,
    suitability,
    forecastTemp,
  };
})();
