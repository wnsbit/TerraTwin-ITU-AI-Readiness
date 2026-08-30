/* ============================================================
   TerraTwin — Farmy, the farming assistant
   ------------------------------------------------------------
   Farmy is a friendly chatbot (robot in a farmer's hat). It
   answers from the project knowledge base in knowledge-base.js,
   which now covers the Y.3172 standard, the app itself, AND
   general + Saudi agriculture (irrigation, crops, soil, pests,
   food security, research bodies, and more).

   Two modes:

   1. Local (default). Retrieval over KB.corpus by keyword
      scoring. No network, no API key, works offline. Every
      answer names the entry it came from.

   2. Gemini (optional). If the user pastes their own Google
      Gemini API key in Settings, questions go to Google's
      endpoint with the KB supplied as grounding context. The
      key lives only in this browser and is never bundled.
   ============================================================ */

const Assistant = (() => {
  let bodyEl, inputEl, panelEl, chipsEl;
  let user = null;
  let history = [];

  const FARMY_SRC = "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkZhcm15LCBhIHJvYm90IGluIGEgZmFybWVyJ3MgaGF0Ij4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZmFybXktYm9keSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZmFlODYiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNDA5MTZjIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJmYXJteS1oYXQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZWNjZTgwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Q5YTYzZiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3QgeD0iMjkiIHk9IjM4IiB3aWR0aD0iNDIiIGhlaWdodD0iMzYiIHJ4PSIxMiIgZmlsbD0idXJsKCNmYXJteS1ib2R5KSIgc3Ryb2tlPSIjMmY2YTRkIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8Y2lyY2xlIGN4PSIyOSIgY3k9IjU2IiByPSIzLjQiIGZpbGw9IiMzNTdhNTkiLz4KICA8Y2lyY2xlIGN4PSI3MSIgY3k9IjU2IiByPSIzLjQiIGZpbGw9IiMzNTdhNTkiLz4KICA8cmVjdCB4PSIzNSIgeT0iNDkiIHdpZHRoPSIzMCIgaGVpZ2h0PSIxOCIgcng9IjgiIGZpbGw9IiNmNmYxZTQiLz4KICA8Y2lyY2xlIGN4PSI0NCIgY3k9IjU4IiByPSIzLjQiIGZpbGw9IiMxYjQzMzIiLz4KICA8Y2lyY2xlIGN4PSI1NiIgY3k9IjU4IiByPSIzLjQiIGZpbGw9IiMxYjQzMzIiLz4KICA8Y2lyY2xlIGN4PSI0NS4yIiBjeT0iNTYuOCIgcj0iMS4xIiBmaWxsPSIjZmZmIi8+CiAgPGNpcmNsZSBjeD0iNTcuMiIgY3k9IjU2LjgiIHI9IjEuMSIgZmlsbD0iI2ZmZiIvPgogIDxwYXRoIGQ9Ik00NCA2Mi41IFE1MCA2Ni41IDU2IDYyLjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzQwOTE2YyIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8bGluZSB4MT0iNTAiIHkxPSIzMCIgeDI9IjUwIiB5Mj0iMjQiIHN0cm9rZT0iIzJmNmE0ZCIgc3Ryb2tlLXdpZHRoPSIyLjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjUwIiBjeT0iMjIuNSIgcj0iMi44IiBmaWxsPSIjYzQ2MjVhIi8+CiAgPGVsbGlwc2UgY3g9IjUwIiBjeT0iMzciIHJ4PSIzMyIgcnk9IjcuNSIgZmlsbD0idXJsKCNmYXJteS1oYXQpIiBzdHJva2U9IiNiNTg0MmYiIHN0cm9rZS13aWR0aD0iMS42Ii8+CiAgPHBhdGggZD0iTTM2IDM3IFEzNiAyNCA1MCAyNCBRNjQgMjQgNjQgMzcgWiIgZmlsbD0idXJsKCNmYXJteS1oYXQpIiBzdHJva2U9IiNiNTg0MmYiIHN0cm9rZS13aWR0aD0iMS42Ii8+CiAgPHBhdGggZD0iTTM2LjUgMzYgUTUwIDQwIDYzLjUgMzYgTDYzIDMxIFE1MCAzNSAzNyAzMSBaIiBmaWxsPSIjNDA5MTZjIi8+CiAgPHBhdGggZD0iTTIyIDM3IFE1MCA0MyA3OCAzNyIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjU4NDJmIiBzdHJva2Utd2lkdGg9IjAuOCIgb3BhY2l0eT0iMC41NSIvPgogIDxwYXRoIGQ9Ik00MSAzNCBRNTAgMzcgNTkgMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2I1ODQyZiIgc3Ryb2tlLXdpZHRoPSIwLjgiIG9wYWNpdHk9IjAuNSIvPgogIDxwYXRoIGQ9Ik02MCAzMCBRNjcgMjYgNjkgMzEgUTY0IDM0IDYwIDMwIFoiIGZpbGw9IiM3YzlhNWUiIHN0cm9rZT0iIzVhN2E0NCIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPgo=";

  const STOP = new Set([
    "the","a","an","is","are","was","were","do","does","did","of","to","in","on",
    "for","and","or","it","this","that","with","how","what","why","when","can",
    "i","you","my","me","should","would","about","tell","explain","please","hey",
    "hi","hello","there","some","give","get","know","need","want","could","which",
    "your","our","us","we","they","them","he","she","at","be","have","has",
  ]);

  /* ---------------- small talk ---------------- */

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function smallTalk(q) {
    const t = q.toLowerCase().trim().replace(/[!.,?]+$/, "");

    // greetings
    if (/^(hi|hey|hello|hiya|yo|howdy|hallo|salam|salaam|assalam(u alaikum)?|marhaba|ahlan|good (morning|evening|afternoon|day))\b/.test(t) && t.length < 32) {
      return pick([
        "Hey there! I'm Farmy \u{1F33E} doing great, thanks. How can I help you today \u2014 something about your farm, a crop, or the app?",
        "Hi! \u{1F33E} Good to see you. What can I help you with \u2014 irrigation, soil, a specific crop, maybe the sandbox?",
        "Hello! I'm Farmy, your farming buddy. What's on your mind today?",
      ]);
    }

    // how are you
    if (/(how are you|how('?s| is) it going|how do you do|how are things|how you doing|hows things|what'?s up|whats up|how's your day)/.test(t)) {
      return pick([
        "I'm doing great, thanks for asking! \u{1F33E} Always happy to talk farming. How can I help you today?",
        "I'm good! Ready to dig into any farming question you've got. What can I do for you?",
        "Doing well, thank you! \u{1F60A} What would you like to know \u2014 crops, soil, water, or the app?",
      ]);
    }

    // who / what are you
    if (/(who are you|what are you|your name|tell me about yourself|what can you do|what do you do|how can you help)/.test(t)) {
      return "I'm Farmy, the assistant built into TerraTwin \u{1F33E} Think of me as a friendly farming helper. I can talk about pretty much any crop, fruit, tree, vegetable, or soil in Saudi Arabia and the Middle East, plus water and irrigation solutions, pests, and food security. I also know this app inside out \u2014 the readiness score, the sandbox, and how it maps to the ITU-T Y.3172 standard. What would you like to explore?";
    }

    // thanks
    if (/(thank|thanks|thx|shukran|shukraan|appreciate|great help|helpful|nice one|good job|well done|perfect|awesome|amazing)/.test(t) && t.length < 45) {
      return pick([
        "You're very welcome! \u{1F33E} Ask me anything else whenever you like.",
        "Happy to help! Let me know if there's anything else \u2014 a crop, your soil, the sandbox, whatever comes up.",
        "Anytime! That's what I'm here for. \u{1F60A}",
      ]);
    }

    // casual weather
    if (/(nice (day|weather)|how'?s the weather|beautiful day)/.test(t) && t.length < 40) {
      return "I hope it's good growing weather where you are! \u2600\uFE0F Speaking of which \u2014 want tips on managing heat or water for your crops?";
    }

    // short affirmatives
    if (/^(ok|okay|k|cool|nice|great|good|alright|sure|fine|yep|yeah|yes)$/.test(t)) {
      return pick([
        "\u{1F44D} What would you like to know?",
        "Great \u2014 ask me anything about farming or the app.",
        "\u{1F33E} Go ahead, what's your question?",
      ]);
    }

    // are you human / AI
    if (/(are you (human|real|a robot|an ai|a bot)|are you alive)/.test(t)) {
      return "Ha, I'm an AI assistant \u2014 a friendly one, in a farmer's hat \u{1F33E} I don't have a real farm of my own, but I've got a big knowledge base about farming in Saudi Arabia and the Middle East. What can I help you grow?";
    }

    // goodbye
    if (/(bye|goodbye|see you|see ya|later|ma'?a salama|maa salama|take care|good night|goodnight)/.test(t) && t.length < 28) {
      return pick([
        "Take care out there! \u{1F33E} Come back anytime you've got a farming question.",
        "See you later \u2014 happy farming! \u{1F60A}",
        "Goodbye for now! Wishing you healthy crops and good rain. \u{1F327}\uFE0F",
      ]);
    }

    // sorry
    if (/^(sorry|my bad|oops|apologies)/.test(t) && t.length < 30) {
      return "No worries at all! \u{1F60A} What can I help you with?";
    }

    // affection
    if (/(i (love|like) you|you'?re (the best|great|awesome|amazing|cool))/.test(t)) {
      return "Aw, thank you! \u{1F33E} I really enjoy helping out. Now \u2014 what farming question can I tackle for you?";
    }

    return null;
  }

  /* ---------------- local retrieval ---------------- */

  function score(query, entry) {
    const q = query.toLowerCase();
    const words = q.split(/[^a-z0-9.]+/).filter((w) => w && !STOP.has(w));
    let total = 0;

    entry.k.forEach((key) => {
      if (q.includes(key)) total += key.includes(" ") ? 12 : 8;
      words.forEach((w) => {
        if (key === w) total += 6;
        else if (w.length > 3 && key.includes(w)) total += 2;
        else if (key.length > 3 && w.includes(key)) total += 2;
      });
    });

    const title = (entry.title || "").toLowerCase();
    words.forEach((w) => {
      if (w.length > 3 && title.includes(w)) total += 3;
      if (w.length > 4 && entry.a.toLowerCase().includes(w)) total += 1;
    });

    // strong bonus when the query closely matches a whole keyword phrase,
    // so specific symptom entries outrank general ones
    entry.k.forEach((key) => {
      if (key.includes(" ") && q.includes(key)) total += 10;
    });

    return total;
  }

  function retrieve(query) {
    const ranked = KB.corpus
      .map((e) => ({ e, sc: score(query, e) }))
      .filter((r) => r.sc > 4)
      .sort((a, b) => b.sc - a.sc);
    return ranked;
  }

  /* ---------------- climate matching ---------------- */

  // words -> crop keys in KB.cropClimate
  const CROP_WORDS = {
    apple: "apple", apples: "apple", tuffah: "apple",
    pear: "pear", pears: "pear", kummathra: "pear",
    quince: "quince", safarjal: "quince",
    cherry: "cherry", cherries: "cherry", karaz: "cherry",
    apricot: "apricot", apricots: "apricot", mishmish: "apricot",
    peach: "peach", peaches: "peach", khoukh: "peach",
    nectarine: "nectarine",
    plum: "plum", plums: "plum", barquq: "plum",
    almond: "almond", almonds: "almond", loz: "almond",
    pistachio: "pistachio", pistachios: "pistachio", fustuq: "pistachio",
    walnut: "walnut", walnuts: "walnut", jawz: "walnut",
    pecan: "pecan", hazelnut: "hazelnut",
    grape: "grape", grapes: "grape", vine: "grape", inab: "grape", enab: "grape",
    fig: "fig", figs: "fig", teen: "fig",
    pomegranate: "pomegranate", rumman: "pomegranate",
    olive: "olive", olives: "olive", zaytun: "olive", zaytoon: "olive",
    date: "date", dates: "date", "date palm": "date", tamr: "date", nakhl: "date",
    ajwa: "date", sukkari: "date", khalas: "date", barhi: "date",
    citrus: "citrus", orange: "citrus", oranges: "citrus", burtuqal: "citrus",
    mandarin: "citrus", tangerine: "citrus", clementine: "citrus", grapefruit: "citrus", pomelo: "citrus",
    lemon: "lemon", lemons: "lemon", lime: "lemon", limes: "lemon", laymun: "lemon",
    mango: "mango", mangoes: "mango", mangos: "mango",
    banana: "banana", bananas: "banana", mawz: "banana", plantain: "banana",
    guava: "guava", jawafa: "guava",
    papaya: "papaya", babaya: "papaya",
    coffee: "coffee", bunn: "coffee", arabica: "coffee", khawlani: "coffee",
    avocado: "avocado", avocados: "avocado",
    pineapple: "pineapple", ananas: "pineapple",
    lychee: "lychee", longan: "lychee", rambutan: "lychee",
    coconut: "coconut", narjeel: "coconut",
    persimmon: "persimmon", kaki: "persimmon",
    loquat: "loquat", askedinya: "loquat",
    mulberry: "mulberry", toot: "mulberry",
    "prickly pear": "prickly_pear", cactus: "prickly_pear", "cactus pear": "prickly_pear", sabbar: "prickly_pear",
    sidr: "sidr", jujube: "sidr", nabk: "sidr", lote: "sidr",
    moringa: "moringa", drumstick: "moringa",
    strawberry: "strawberry", strawberries: "strawberry", farawla: "strawberry",
    kiwi: "kiwi", kiwifruit: "kiwi",
    blueberry: "blueberry", blueberries: "blueberry",
    watermelon: "watermelon", battikh: "watermelon", habhab: "watermelon",
    melon: "melon", melons: "melon", cantaloupe: "melon", shammam: "melon",
    tomato: "tomato", tomatoes: "tomato", tamatim: "tomato",
    cucumber: "cucumber", cucumbers: "cucumber", khiyar: "cucumber",
    pepper: "pepper", peppers: "pepper", capsicum: "pepper", chili: "pepper", filfil: "pepper",
    eggplant: "eggplant", aubergine: "eggplant", badhinjan: "eggplant",
    okra: "okra", bamia: "okra", bamya: "okra",
    lettuce: "lettuce", khass: "lettuce",
    cabbage: "cabbage", malfouf: "cabbage", cauliflower: "cabbage", broccoli: "cabbage",
    potato: "potato", potatoes: "potato", batata: "potato",
    onion: "onion", onions: "onion", basal: "onion", garlic: "onion",
    carrot: "carrot", carrots: "carrot", jazar: "carrot",
    wheat: "wheat", qamh: "wheat",
    barley: "barley", shair: "barley",
    sorghum: "sorghum", dhura: "sorghum",
    millet: "millet", dukhn: "millet",
    maize: "maize", corn: "maize",
    rice: "rice", ruz: "rice",
    alfalfa: "alfalfa", lucerne: "alfalfa", barseem: "alfalfa",
    quinoa: "quinoa",
    sesame: "sesame", simsim: "sesame",
    rose: "rose", roses: "rose", ward: "rose",
  };

  // words -> region keys in KB.regionClimate
  const REGION_WORDS = {
    riyadh: "riyadh", najd: "riyadh", "al kharj": "riyadh", kharj: "riyadh",
    qassim: "qassim", buraidah: "qassim", unaizah: "qassim", gassim: "qassim",
    hail: "hail", "ha'il": "hail",
    jouf: "jouf", "al-jouf": "jouf", "al jouf": "jouf", sakaka: "jouf",
    tabuk: "tabuk", neom: "tabuk",
    "northern borders": "northern", arar: "northern",
    asir: "asir", aseer: "asir", abha: "asir", "khamis mushait": "asir", sarawat: "asir",
    baha: "baha", "al-baha": "baha", "al baha": "baha",
    taif: "taif",
    makkah: "makkah", mecca: "makkah", jeddah: "makkah",
    madinah: "madinah", medina: "madinah",
    jazan: "jazan", jizan: "jazan", gizan: "jazan", tihama: "jazan",
    "jazan mountains": "jazanhi", "jazan highlands": "jazanhi", fifa: "jazanhi",
    faifa: "jazanhi", dhraizan: "jazanhi", "bani malik": "jazanhi",
    eastern: "eastern", "eastern province": "eastern", ahsa: "eastern",
    "al-ahsa": "eastern", "al ahsa": "eastern", hofuf: "eastern", dammam: "eastern", khobar: "eastern",
    najran: "najran",
  };

  function findKey(text, map) {
    // prefer longer multi-word keys first
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const w of keys) {
      const re = new RegExp("\\b" + w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\b");
      if (re.test(text)) return map[w];
    }
    return null;
  }

  function climateMatch(query) {
    const t = query.toLowerCase();
    // only trigger on grow/plant/survive-type questions
    if (!/(grow|plant|cultivat|survive|stand|handle|thrive|possible|can i (have|get)|suitable|suited|able to)/.test(t)) return null;

    const cropKey = findKey(t, CROP_WORDS);
    const regionKey = findKey(t, REGION_WORDS);
    if (!cropKey || !regionKey) return null;

    const res = KB.canGrow(cropKey, regionKey);
    if (!res) return null;
    return { text: res.text, src: "Climate match \u00b7 " + KB.regionClimate[regionKey].name };
  }

  /* "What can I grow in Riyadh?" — recommend crops for a region */
  function regionRecommend(query) {
    const t = query.toLowerCase();
    if (!/(what|which).*(grow|plant|crop|suit|best)|recommend|suggest|good crops/.test(t)) return null;

    const regionKey = findKey(t, REGION_WORDS);
    if (!regionKey) return null;
    if (findKey(t, CROP_WORDS)) return null; // a named crop is climateMatch's job

    const r = KB.regionClimate[regionKey];
    const good = [], protectedOnly = [];

    Object.keys(KB.cropClimate).forEach((ck) => {
      const res = KB.canGrow(ck, regionKey);
      if (!res) return;
      if (res.verdict === "yes") good.push(KB.cropClimate[ck].name);
      else if (res.verdict === "greenhouse") protectedOnly.push(KB.cropClimate[ck].name);
    });

    const list = (a, n) => a.slice(0, n).join(", ");
    return {
      text:
        `${r.name} (${r.label}) has ${r.note}, with summers to about ${r.summerMax}\u00b0C, winter lows near ${r.winterMin}\u00b0C, and roughly ${r.chillHours} winter chill hours.\n\n` +
        (good.length
          ? `Grows well outdoors: ${list(good, 14)}${good.length > 14 ? ", and more" : ""}.\n\n`
          : "Few crops suit open-field growing here without protection.\n\n") +
        (protectedOnly.length ? `Needs a greenhouse or the cool season: ${list(protectedOnly, 8)}.\n\n` : "") +
        "Ask me about any specific crop and I'll explain the reasoning.",
      src: "Climate match \u00b7 " + r.name,
    };
  }

  /* "Compare drip and sprinkler" */
  function comparison(query) {
    const t = query.toLowerCase();
    if (!/(compare|difference between|\bvs\b|versus|better than)/.test(t)) return null;
    const hits = retrieve(query);
    if (hits.length < 2) return null;
    const a = hits[0].e, b = hits[1].e;
    if (a.title === b.title) return null;
    return { text: `${a.title}\n${a.a}\n\n${b.title}\n${b.a}`, src: a.title + " \u00b7 " + b.title };
  }

  /* "What topics do you know?" */
  function capabilities(query) {
    const t = query.toLowerCase();
    if (!/(what.*(topics|subjects).*(know|cover)|what can you (tell|help).*(about|with)|list.*topics|how much do you know)/.test(t)) return null;
    return {
      text:
        `I cover around ${KB.corpus.length} topics, including:\n\n` +
        "\u2022 Crops \u2014 fruits, nuts, vegetables, herbs, cereals, fodder\n" +
        "\u2022 Trees \u2014 desert natives, orchards, windbreaks, ornamentals\n" +
        "\u2022 All 13 Saudi regions and their sub-areas\n" +
        "\u2022 Soils \u2014 sandy, clay, saline, sodic, calcareous, desert\n" +
        "\u2022 Water \u2014 drip, scheduling, salinity, harvesting, desalination\n" +
        "\u2022 Pests, diseases, nutrition, and symptom diagnosis\n" +
        "\u2022 Plant care \u2014 planting, pruning, grafting, propagation\n" +
        "\u2022 Livestock, bees, and aquaculture\n" +
        "\u2022 Technology, economics, policy, and this app's Y.3172 design\n\n" +
        "I can also judge crop-region fit \u2014 try \u201ccan apple grow in Riyadh?\u201d",
      src: null,
    };
  }

  function localAnswer(query) {
    // 1. small talk
    const chat = smallTalk(query);
    if (chat) return { text: chat, src: null };

    const q = query.toLowerCase();

    // 2. capability / topic questions
    const cap = capabilities(query);
    if (cap) return cap;

    // 3. climate-match: "can X grow in Y?"
    const climate = climateMatch(query);
    if (climate) return climate;

    // 4. region recommendation: "what can I grow in Y?"
    const rec = regionRecommend(query);
    if (rec) return rec;

    // 5. comparison: "difference between X and Y"
    const cmp = comparison(query);
    if (cmp) return cmp;

    // 6. live sandbox state
    const st = Sandbox.state && Sandbox.state();
    if (st && /(my|current).*(plant|crop|health|state|farm)|how.*(doing|going)|status/.test(q)) {
      const [lo, hi] = st.crop.idealMoisture;
      let advice;
      if (st.finished) {
        advice = st.outcome && st.outcome.win
          ? "This run is finished \u2014 you reached harvest. Reset to try another crop or strategy."
          : "This run has ended. Reset and try adjusting one decision \u2014 the season log shows where stress built up.";
      } else if (st.moisture < lo) {
        advice = "Moisture is below the ideal band \u2014 irrigation is the priority this week.";
      } else if (st.pest > 40) {
        advice = "Pest pressure is high enough to cost health. Consider treating, or inspect first to confirm.";
      } else if (st.moisture > hi) {
        advice = "Soil is wetter than ideal \u2014 hold off on watering to avoid waterlogging.";
      } else {
        advice = "Nothing urgent \u2014 holding is a perfectly good move when the vitals are in range.";
      }
      return {
        text:
          `Your ${st.crop.name} is in week ${st.week} of ${st.crop.weeks}.\n\n` +
          `Health ${Math.round(st.health)}%  \u00b7  Growth ${Math.round(st.growth)}%\n` +
          `Moisture ${Math.round(st.moisture)}% (ideal ${lo}\u2013${hi}%)\n` +
          `Nutrients ${Math.round(st.nutrients)}%  \u00b7  Pest pressure ${Math.round(st.pest)}%\n\n` +
          advice,
        src: "Live sandbox state",
      };
    }

    // 7. knowledge retrieval
    const hits = retrieve(query);

    if (!hits.length) {
      return {
        text: pick([
          "Hmm, I'm not sure I have a good answer for that one. \u{1F914} I'm best with farming topics \u2014 crops and fruits (dates, citrus, olives, mango, grapes\u2026), vegetables, soils (sandy, clay, saline, calcareous), water and irrigation, pests, and food security \u2014 plus this app and the Y.3172 standard. Want to try rephrasing, or ask me about one of those?",
          "That's a little outside what I know! I stick to farming \u2014 crops, trees, soils, water, pests \u2014 and this app. Try me on a specific crop or soil type, or ask about the sandbox or readiness score. \u{1F33E}",
        ]),
        src: null,
      };
    }

    // If the top hit is clearly dominant, answer with it alone.
    // If two hits are close, combine them for a fuller answer.
    const top = hits[0];
    const second = hits[1];
    const combine = second && second.sc >= top.sc * 0.6 && second.e.title !== top.e.title;

    if (combine) {
      return {
        text: top.e.a + "\n\n" + second.e.a,
        src: top.e.title + " \u00b7 " + second.e.title,
      };
    }
    return { text: top.e.a, src: top.e.title };
  }

  /* ---------------- Gemini ---------------- */

  function groundingContext() {
    const pipe = KB.pipeline
      .map((n) => `${n.code} (${n.role}): ${n.standard} In TerraTwin: ${n.terratwin}`)
      .join("\n");
    const orch = KB.orchestration
      .map((n) => `${n.code}: ${n.standard} In TerraTwin: ${n.terratwin}`)
      .join("\n");
    const dims = KB.dimensions.map((d) => `${d.name} (max ${d.max}): ${d.blurb}`).join("\n");
    const facts = KB.corpus.map((c) => `${c.title}: ${c.a}`).join("\n\n");
    const refs = KB.references.map((r) => `${r.name} \u2014 ${r.org} \u2014 ${r.url}`).join("\n");

    const regions = Object.values(KB.regionClimate)
      .map((r) => `${r.name} (${r.label}): summer up to ~${r.summerMax}\u00b0C, winter low ~${r.winterMin}\u00b0C, ~${r.chillHours} chill hours, ${r.humidity} humidity. ${r.note}.`)
      .join("\n");
    const crops = Object.values(KB.cropClimate)
      .map((c) => `${c.name}: needs ~${c.chill} winter chill hours, tolerates open-field heat to ~${c.heatMax}\u00b0C. ${c.note}.`)
      .join("\n");

    return (
      "You are Farmy, a friendly farming assistant inside TerraTwin \u2014 an AI readiness digital twin for sustainable agriculture in Jazan, Saudi Arabia, created by Wanas Zakri for the ITU AI Readiness Hackathon, built for the ITU AI Readiness Hackathon. You are depicted as a cheerful robot in a straw farmer's hat.\n\n" +
      "Answer from the knowledge below. You may cover farming in general and Saudi-specific farming, plus this app and the ITU-T Y.3172 standard. If a question falls outside farming, agriculture, water, food security, or this app, gently steer back. If the answer is not in your knowledge, say so plainly rather than inventing facts or statistics. Keep answers friendly and concise \u2014 three or four sentences unless asked for more.\n\n" +
      "=== ITU-T Y.3172 PIPELINE ===\n" + pipe + "\n" + orch +
      "\n\n=== READINESS DIMENSIONS (100 points total) ===\n" + dims +
      "\n\n=== SAUDI REGION CLIMATES ===\n" + regions +
      "\n\n=== CROP CLIMATE NEEDS (for judging if a crop suits a region) ===\n" + crops +
      "\n\n=== KNOWLEDGE BASE (app + farming) ===\n" + facts +
      "\n\n=== OFFICIAL REFERENCES ===\n" + refs
    );
  }

  async function geminiAnswer(query) {
    const cfg = Store.getSettings();
    const model = cfg.geminiModel || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.geminiKey)}`;

    const recent = history.slice(-6).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: groundingContext() }] },
        contents: [...recent, { role: "user", parts: [{ text: query }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const err = await res.json();
        detail = err.error && err.error.message ? " \u2014 " + err.error.message : "";
      } catch (e) { /* body not JSON */ }
      throw new Error(`Gemini request failed (${res.status})${detail}`);
    }

    const data = await res.json();
    const parts =
      data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts;
    const text = (parts || []).map((p) => p.text || "").join("").trim();
    if (!text) throw new Error("Gemini returned an empty response.");
    return { text, src: `Gemini \u00b7 ${model}` };
  }

  /* ---------------- UI ---------------- */

  function bubble(text, who, src) {
    // bot messages get a Farmy avatar beside them
    if (who === "bot") {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "8px";
      row.style.alignItems = "flex-end";
      row.style.alignSelf = "flex-start";
      row.style.maxWidth = "92%";

      const av = document.createElement("img");
      av.src = FARMY_SRC;
      av.className = "msg-avatar";
      av.alt = "Farmy";

      const el = document.createElement("div");
      el.className = "msg bot";
      el.textContent = text;
      if (src) {
        const s = document.createElement("span");
        s.className = "msg-src";
        s.textContent = "Source: " + src;
        el.appendChild(s);
      }
      row.appendChild(av);
      row.appendChild(el);
      bodyEl.appendChild(row);
    } else {
      const el = document.createElement("div");
      el.className = "msg " + who;
      el.textContent = text;
      bodyEl.appendChild(el);
    }
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function typing() {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "flex-end";
    row.style.alignSelf = "flex-start";

    const av = document.createElement("img");
    av.src = FARMY_SRC;
    av.className = "msg-avatar";
    av.alt = "";

    const el = document.createElement("div");
    el.className = "typing";
    el.innerHTML = "<span></span><span></span><span></span>";

    row.appendChild(av);
    row.appendChild(el);
    bodyEl.appendChild(row);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return row;
  }

  async function send(text) {
    const q = String(text || "").trim();
    if (!q) return;

    bubble(q, "user");
    history.push({ role: "user", text: q });
    inputEl.value = "";
    if (chipsEl) chipsEl.classList.add("hidden");

    const dots = typing();
    const cfg = Store.getSettings();
    const useGemini = !!(cfg.geminiKey && cfg.geminiKey.trim());

    let result;
    try {
      if (useGemini) {
        result = await geminiAnswer(q);
      } else {
        await new Promise((r) => setTimeout(r, 280));
        result = localAnswer(q);
      }
    } catch (err) {
      dots.remove();
      bubble(
        "That request to Gemini didn't go through: " + err.message +
        "\n\nNo problem \u2014 here's what I have from my own knowledge base.",
        "sys"
      );
      result = localAnswer(q);
      bubble(result.text, "bot", result.src);
      history.push({ role: "bot", text: result.text });
      persist();
      return;
    }

    dots.remove();
    bubble(result.text, "bot", result.src);
    history.push({ role: "bot", text: result.text });
    persist();
  }

  function persist() {
    if (!user) return;
    Store.patchState(user.id, { chatHistory: history.slice(-40) });
  }

  function greet() {
    const cfg = Store.getSettings();
    const mode = cfg.geminiKey ? "Gemini is connected, so my answers will be extra detailed." : "";
    bubble(
      `Hi${user ? " " + user.name.split(" ")[0] : ""}, I'm Farmy! \u{1F33E}\n\nI'm your farming assistant \u2014 ask me about any crop, fruit, tree, or vegetable in Saudi Arabia and the Middle East, about your soil, water and irrigation, pests, or this app and the Y.3172 standard. ${mode}\n\nWhat can I help you with today?`,
      "bot"
    );
  }

  function mount(currentUser) {
    user = currentUser;
    panelEl = document.getElementById("chat-panel");
    bodyEl = document.getElementById("chat-body");
    inputEl = document.getElementById("chat-input");
    chipsEl = document.getElementById("chat-chips");

    const saved = Store.getState(user.id).chatHistory || [];
    if (saved.length) {
      history = saved;
      saved.forEach((m) => bubble(m.text, m.role === "user" ? "user" : "bot"));
    } else {
      greet();
    }

    document.getElementById("chat-fab").addEventListener("click", toggle);
    document.getElementById("chat-close").addEventListener("click", toggle);
    document.getElementById("chat-send").addEventListener("click", () => send(inputEl.value));

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send(inputEl.value);
    });

    if (chipsEl) {
      chipsEl.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => send(chip.textContent));
      });
    }
  }

  function toggle() {
    panelEl.classList.toggle("open");
    if (panelEl.classList.contains("open")) {
      setTimeout(() => inputEl.focus(), 120);
    }
  }

  function open() {
    if (!panelEl.classList.contains("open")) toggle();
  }

  return { mount, send, open };
})();
