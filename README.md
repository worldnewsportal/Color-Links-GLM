# Color Link — Phase 2

A complete, offline-first mobile color-connecting puzzle game (Flow-style) built with
HTML5, CSS3 and vanilla JavaScript. No frameworks, no backend, no external network
requests. Designed mobile-first for Android WebView and ready to package as an APK
with Capacitor.

Phase 2 expands the game to **130 verified levels in 5 chapters** and adds six new
gameplay mechanics, a star rating system, coins & rewards, daily challenges,
achievements, and a full statistics screen — while preserving all Phase 1
functionality and player progress (versioned save with safe migration).

## Features

### Core gameplay (Phase 1)
- **Full gameplay engine** — connect matching color pairs with flowing paths;
  paths follow adjacent cells, never cross, and completion is validated automatically.
- **Pointer input** (touch/mouse/pen) with a single-active-pointer guard,
  scroll/zoom prevention, and pointer-cancel handling.

### Phase 2 — levels & chapters
- **130 predefined levels**, all machine-verified (structure + witness solution +
  solver re-check, see `scripts/validate-levels.js`).
- **5 themed chapters**: Beginner (1–26), Intermediate (27–52), Advanced (53–78),
  Expert (79–104), Master (105–130).
- **Chapter selection screen** with per-chapter description, completion bar,
  star totals and an 80%-completion unlock rule.

### Phase 2 — new gameplay mechanics (modular, in `core/mechanics.js`)
- **Obstacles** — blocked cells paths cannot pass through.
- **Full-board challenge** — every free cell must be covered to win; the HUD shows
  the number of remaining empty cells.
- **Bridge tiles** — one crossing cell where two *different* paths may legally cross.
- **Locked cells** — cells that open once the key color pair is connected.
- **Time challenges** — per-level countdown with low-time warning and retry dialog.
- **Special tiles** — directional arrows (forced exit direction), teleport pairs
  (paths jump between twins), and restricted-exit tiles. Every mechanic has explicit
  rules in the engine, renderer visuals, validation, and a one-time explanation toast.

### Phase 2 — progression & rewards
- **3-star rating** — per-level move targets derived from each level's verified
  optimal solution (no arbitrary universal limits); best rating is kept, replays
  never reduce stars; star animation in the completion dialog.
- **Coins** — earned from levels (+10), stars (+5 each), chapter completion (+50),
  daily challenges (+100) and achievements; full history and duplicate-claim
  protection in the save; animated reward toasts. No ads, no purchases.
- **Advanced hints** — 3 free hints per level, then 15 coins per hint; hints always
  come from a verified solution; if no solution is available nothing is charged.
- **Daily challenge** — one deterministic, solver-verified puzzle per calendar day
  (seeded from the device-local date, works offline), with countdown to the next
  challenge, board preview, difficulty label and duplicate-protected reward.
- **Achievements** — 7 achievements (first connection, 10/50 levels, perfect
  player, speed solver, chapter master, star collector) with progress bars,
  unlock rewards and persistent records.
- **Statistics** — completed levels, total stars, coins earned, hints used,
  total moves, attempts, daily challenges completed, chapters completed, sessions
  and total playtime, all computed from real gameplay data.

### Persistence (LocalStorage, safe in-memory fallback)
- **Versioned save (`progress_v2`)** — validated on load; Phase 1 saves migrate
  automatically (progress, settings and records are never erased); corrupted or
  missing data falls back safely.
- Settings: sound effects, background music, vibration, language
  (English / العربية with full RTL), theme (Light / Dark), reset progress with
  confirmation dialog.

### Feedback
Press animations, path draw ticks, cut feedback, completion sound + particles,
optional vibration, chapter/level transition animations — tuned for mid-range
Android devices (no expensive rendering loops).

## Project structure

```
color-link/
├── www/                    # web app (Capacitor webDir)
│   ├── index.html
│   ├── styles/             # main.css, components.css, game.css
│   ├── assets/             # images, audio, fonts (SVG icon; audio is synthesized)
│   └── src/
│       ├── core/           # game.js, board.js, path-engine.js, level-manager.js,
│       │                   # input-manager.js, renderer.js, solver.js, mechanics.js
│       ├── ui/             # main-menu, gameplay-screen, level-selection, settings,
│       │                   # stats, daily-screen, achievements-screen, dialogs
│       ├── data/           # levels.js (1–30), levels2.js (31–130)
│       └── systems/        # storage.js, audio.js, localization.js, progression.js,
│                           # hints.js, coins.js, daily.js, achievements.js
├── scripts/
│   ├── validate-levels.js  # verifies all 130 levels (structure + witness + solver)
│   ├── generate-levels.cjs # Phase 1 level authoring tool
│   ├── generate-phase2.cjs # Phase 2 level authoring tool (witness solutions)
│   ├── smoke-test.js       # headless logic tests (engine, mechanics, economy…)
│   └── ui-smoke-test.cjs   # jsdom integration test driving the real UI
├── .github/workflows/android-build.yml
├── capacitor.config.json
├── package.json
└── README.md
```

## Run locally

No build step is required — it is a static site:

```bash
npm start            # serves ./www on http://localhost:8080
# or simply open www/index.html in a browser
```

## Tests

```bash
npm run validate     # all 130 levels must be solver-verified
npm test             # headless smoke tests + jsdom UI integration tests
```

## Build an Android APK (Capacitor)

Requires JDK 17 and Android SDK (or Android Studio).

```bash
npm install
npx cap add android      # first time only
npx cap sync android
npx cap open android     # build/run from Android Studio
```

### GitHub Actions APK build

The repo includes `.github/workflows/android-build.yml`. Push the repository to
GitHub with the Android platform checked in (`android/`), and the workflow builds
a debug APK on every push to `main` and uploads it as a build artifact.

Typical first-time sequence:

```bash
npm install
npx cap add android
git add -A
git commit -m "Add Android platform"
git push origin main
```

## Notes

- Audio is synthesized with the WebAudio API, so no audio files or network
  requests are needed; the assets folders are ready for optional media.
- All asset paths are relative, so the app runs from `file://`, a static server,
  or Capacitor's `https://localhost` without changes.
- Arabic switches the whole layout to RTL (`dir="rtl"`) including menus and dialogs.
- Phase 2 scope: 130 levels, chapters, mechanics, stars, coins, dailies,
  achievements; still no ads / IAP / backend.
