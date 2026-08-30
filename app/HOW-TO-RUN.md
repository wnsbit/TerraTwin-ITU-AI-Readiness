# Running TerraTwin in VS Code

## 1. Open the folder
`File → Open Folder…` and choose the `TerraTwin` folder (not a single file).

## 2. Install Live Server
Open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`), search for **Live Server**
by Ritwick Dey, and install it. VS Code will also suggest it automatically — the
recommendation is already in `.vscode/extensions.json`.

## 3. Run
Right-click `index.html` → **Open with Live Server**, or click **Go Live** in the blue
status bar at the bottom. The app opens at `http://127.0.0.1:5500`.

Serving it this way (rather than double-clicking the file) matters: the browser only
grants camera and microphone access over `http://localhost` or `https`, so the Plant
doctor camera and the forum voice notes work here and not from `file://`.

## 4. Optional — connect Gemini
In the app: **Settings → Google Gemini API key**. Paste a key from Google AI Studio.
It is stored in that browser only and never written into any file in this project.

## Project structure

```
TerraTwin/
├── index.html                  the whole interface: sign-in screen + application
├── css/
│   ├── base.css                design tokens, reset, buttons, cards
│   ├── auth.css                sign-in / create-account screen
│   ├── app.css                 sidebar, dashboard, scorecard, sandbox, assistant
│   └── farm-modules.css        plants, plant doctor, weather, forum, market
├── js/
│   ├── 01-storage-safety.js    in-memory fallback when localStorage is blocked
│   ├── 02-store.js             accounts, sessions, per-user state
│   ├── 03-router.js            swaps between the auth screen and the app
│   ├── 04-knowledge-base.js    Y.3172 pipeline map, rubric, crops, references
│   ├── 05-11 kb-*.js           the agricultural knowledge corpus (~500 topics)
│   ├── 12-pipeline-y3172.js    the animated pipeline trace
│   ├── 13-sandbox.js           the season simulation engine
│   ├── 14-assistant-farmy.js   the retrieval assistant + Gemini text calls
│   ├── 15-app-controller.js    dashboard, scorecard, sandbox, mapping, settings
│   ├── 16-kb-farm-operations.js knowledge entries for the farm modules
│   ├── 17-farm-modules.js      plants, camera, weather, calendar, forum, market
│   ├── 18-auth-controller.js   sign-in and sign-up handling
│   └── 19-storage-notice.js    storage warning on the sign-in screen
└── .vscode/                    Live Server port and extension recommendation
```

Load order matters — the scripts are numbered in the order `index.html` includes them.
Each file declares its module at the top level, so a file can only use what was loaded
before it.
