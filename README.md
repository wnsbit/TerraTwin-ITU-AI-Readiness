# TerraTwin

**An AI readiness digital twin for sustainable agriculture in Jazan, Saudi Arabia.**

Built on Recommendation ITU-T Y.3172 · Submitted to the ITU AI Readiness Hackathon — Kingdom of Saudi Arabia

**Concept, design and development: Wanas Zakri (ونس زكري)**

---

## The problem

Most agricultural AI arrives at a farm as a finished recommendation: irrigate now, spray this, plant that. Two things go wrong with that.

First, the farm is usually not ready for it. There is no soil-moisture history, no connectivity in the field, no agreement about who owns the data. A model trained elsewhere is deployed onto a farm that cannot feed it or check it, and it fails quietly.

Second, the farmer has no safe way to test the advice. A wrong irrigation or fertilisation decision is not a bad output on a screen — it is a lost season on a smallholding that had one.

Jazan makes both problems sharp. The region runs from the hot, humid Tihama coast with saline groundwater, through the wadi farmland at Sabya and the Abu Arish plain, up to the terraces of Al-Reeth and Fifa where Khawlani coffee grows at 1,600 m. Five very different farming systems inside one administrative region, worked largely by smallholders.

## What TerraTwin does

TerraTwin sits one step before the AI recommendation, and one step around it.

1. **It measures whether the farm is ready.** A 19-question scorecard across five dimensions — Data, Infrastructure, Skills, Governance, Sandbox readiness — scored out of 100, with the weakest dimension surfaced as the priority gap.
2. **It lets the decision be rehearsed.** A season simulator where you choose the sub-region, the soil, the season and the weather pattern, plant a crop, and make one decision per week. Every decision is pushed through the full ITU-T Y.3172 pipeline and can be refused by the Policy node — and you watch that happen live.
3. **It runs the farm day to day.** A plant register with irrigation and fertilisation scheduling, a camera that diagnoses plant health, weather alerts tied to what is actually planted, a farmers' forum, and a local market.

The point of the combination: readiness is not a form you fill in, it is something the farm demonstrates by using the tool.

## Features

### Readiness scorecard
Nineteen questions across five weighted dimensions (Data 30, Infrastructure 20, Governance 20, Skills 15, Sandbox 15). Answers save as you go and feed the dashboard immediately. The weakest dimension is named as the priority gap.

### Decision sandbox
- 3 crops × 5 Jazan sub-regions × 11 soils × 4 seasons × 4 weather patterns
- Week-by-week simulation with health, growth, moisture, nutrients, pest pressure and soil salinity
- Actions: irrigate, fertilise, treat, inspect, hold — one per week
- A live Y.3172 pipeline trace lights up node by node on every decision, and shows the Policy node blocking a request when it violates a rule
- An optional agent that suggests one action, checked against the same nodes — the farmer still chooses

### Plant register
Register what is actually growing: crop, plot, planting date, photo, and an irrigation and fertilisation interval per plant. The app keeps the calendar, marks overdue items, and restarts the clock when you log an irrigation. Fifteen Jazan crops ship with sensible default intervals and water volumes.

### Plant doctor (AI camera)
Capture from the device camera or upload a photo. With a Google Gemini key the image goes to Gemini vision and returns species, life stage, a health score out of 100, a diagnosis and concrete steps for the week. With no key, an on-device colour analysis measures healthy green against chlorotic and necrotic tissue — coarser, but it runs with no network and no account. Scans attach to a registered plant, so a plant's health can be tracked over weeks.

### Weather alerts
A seven-day forecast for the chosen Jazan sub-region, read against what is planted. The engine raises alerts for heat stress above 42 °C, sharp day-to-day temperature swings, incoming rain worth skipping an irrigation for, humid spells that build fungal pressure, strong wind, and cold highland nights. Each alert carries the action, not only the number. One button pushes irrigation dates past a rain event and counts the litres saved.

### Season calendar and reminders
The current Tihama season, what is worth sowing in it, and every reminder — plant schedules plus the farmer's own notes — ordered by what is closest to falling behind.

### Farmers' forum
Posts in text, photo, or recorded voice note, tagged by subject, searchable, with likes and replies. Voice matters here: many of the most experienced growers in the region would rather talk than type. A diagnosis from the Plant doctor can be pushed straight into a draft post with the photo attached.

### Market
Seed, seedlings, plants, inputs and farm services priced in riyals, filtered by category, with each seller's own contact. Any account can publish a listing. Requests are recorded with the seller's number — nothing is charged inside the app.

### Farmy assistant
A retrieval assistant over a knowledge base of roughly 500 agricultural topics — crops, soils, water, pests, propagation, regional climate — plus the application itself and the Y.3172 standard. Works fully offline from the built-in corpus; with a Gemini key it answers through the model with the same corpus as grounding context.

## Architecture — ITU-T Y.3172

The application implements the Recommendation's clause 8.1 pipeline as running code rather than as a diagram in a document. Every sandbox decision traverses:

| Node | Y.3172 role | TerraTwin implementation |
|------|-------------|--------------------------|
| **SRC** | Data source | Farm profile, soil, season, weather pattern, plant state |
| **C** | Collector | Weekly vitals capture |
| **PP** | Pre-processor | Normalisation against crop envelopes |
| **M** | Model | Rule-based growth, stress and pest engine (prototype stage) |
| **P** | Policy | Rule checks that can refuse a decision before it reaches the plant |
| **D** | Distributor | Delivery of the outcome to the interface |
| **SINK** | Sink | Season log and run history |

Plus the MLFO orchestration nodes and the ML Sandbox, which the whole simulator is an instance of.

**Prototype disclosure:** the Model node is rule-based, not a trained statistical or deep-learning model. All farm figures are illustrative. No accuracy or production-readiness claims are made.

## Technology

- Single-file HTML, CSS and vanilla JavaScript — no framework, no build step, no server
- `localStorage` for accounts, farm state and community content
- Google Gemini API (optional, user-supplied key) for the vision diagnosis and the assistant
- Open-Meteo for live forecasts, with a deterministic offline climate model as fallback
- `getUserMedia` and `MediaRecorder` for the camera and voice notes

## Running it

Open `index.html` in any modern browser. Nothing else is required.

Two features need a secure context — the camera and the microphone — so for those, serve the folder rather than opening the file directly:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Photo upload and audio-file attachment work either way.

To enable Gemini: **Settings → Google Gemini API key**, paste a key from Google AI Studio. The key is stored only in that browser and is never committed to the repository.

## Demo video

The complete narrated prototype walkthrough is included at [`demo/TerraTwin_Demo_Video.mp4`](demo/TerraTwin_Demo_Video.mp4). It runs for 4 minutes 52 seconds and covers the readiness assessment, dashboard, Y.3172-aligned decision sandbox, farm management modules, Plant Doctor, weather alerts, farmer community, local market, and Farmy assistant. The English narration script is included beside it.

## Security note

Authentication in this build is prototype-grade. Passwords are hashed with a simple non-cryptographic digest so they are not stored in plain text, but `localStorage` is readable by any script on the page and offers no real protection. Do not enter a real password or real farm data. A production version would replace the storage layer with a proper backend.

## References

The standards, policies and data services the project is built on are listed inside the application under **References**, each linking to a primary source: ITU-T Y.3172, Y.3174, Y.3176 and Y.3181; the ITU AI Readiness Hackathon and AI for Good; SDAIA's National Strategy for Data and AI, AI governance regulations and the PDPL; MEWA, the Reef programme, the Agricultural Development Fund, GASTAT and Vision 2030; the Saudi Green Initiative; FAO and AQUASTAT, ICBA, ICARDA and KAUST; UNESCO's inscription of Khawlani coffee cultivation; and the Open-Meteo and Gemini API documentation.

## Author

**Wanas Zakri — ونس زكري**
Management Information Systems, Jazan University
Concept, design and development.

---

## نبذة بالعربية

**TerraTwin** منصة تقيس جاهزية المزرعة للذكاء الاصطناعي قبل أن يُطبَّق عليها، وتتيح تجربة قرار الري أو التسميد أو المكافحة داخل بيئة محاكاة آمنة قبل تطبيقه على المحصول الحقيقي — مبنية على التوصية ITU-T Y.3172 ومصمّمة لمزارع منطقة جازان: ساحل تهامة، وادي صبيا، سهل أبو عريش، ومدرجات الريث وفيفا.

تشمل: بطاقة تقييم الجاهزية (١٩ سؤالاً / ١٠٠ درجة)، محاكي موسم زراعي كامل، سجل النباتات بجدول ري وتسميد، كاميرا ذكاء اصطناعي تشخّص حالة النبتة، تنبيهات تقلبات الطقس، منتدى للمزارعين بالنص والصور والتسجيلات الصوتية، ومتجر محلي للبذور والشتلات والخدمات.

فكرة وتصميم وتطوير: **ونس زكري**

---

## What is in this repository

| Path | What it is |
|---|---|
| `index.html` | The complete application as a single file — this is what GitHub Pages serves. |
| `app/` | The same application as an editable project: `index.html`, four stylesheets, nineteen numbered JavaScript modules. See `app/HOW-TO-RUN.md`. |
| `docs/TerraTwin_Application_Explanation.docx` | The AI Application Explanation submitted to the hackathon. |
| `docs/TerraTwin_Knowledge_Base_500_v3.pdf` | Knowledge base contribution — 505 public sources with clickable links (Part A: 83 policy and standards · Part B: 422 agricultural and technical). |
| `docs/TerraTwin_Knowledge_Base_500.docx` | The same knowledge base, editable. |
| `docs/TerraTwin_AI_Readiness_Scorecard.xlsx` | The scoring workbook with live formulas. |
| `docs/TerraTwin_Pitch_Deck.pptx` | 13-slide presentation with speaker notes. |
| `docs/TerraTwin_Project_Explanation.docx` | Extended narrative project document. |
| `docs/TerraTwin_ITU_Final_Technical_Report.pdf` | Final five-page ITU technical report. |
| `docs/TerraTwin_ITU_Final_Technical_Report.docx` | Editable version of the final technical report. |
| `docs/SUBMISSION_CHECKLIST.txt` | Final requirement-by-requirement submission checklist. |
| `demo/TerraTwin_Demo_Video.mp4` | Narrated 4:52 prototype demonstration video. |
| `demo/TerraTwin_Demo_Video_Script_EN.txt` | English demo narration and recording sequence. |

## Live application

Once GitHub Pages is enabled on this repository, the application runs at the
Pages URL for this repo. Served over https, the Plant Doctor camera and the forum
voice recorder both work.
