# Color Link — Phase 1

A complete, offline-first mobile color-connecting puzzle game (Flow-style) built with
HTML5, CSS3 and vanilla JavaScript. No frameworks, no backend, no external network
requests. Designed mobile-first for Android WebView and ready to package as an APK
with Capacitor.

## Features

- **Full gameplay engine** — connect matching color pairs with flowing paths;
  paths follow adjacent cells, never cross, and completion is validated automatically.
- **30 predefined levels**, all machine-verified solvable (see `scripts/validate-levels.js`).
  Difficulty ramps from 5×5 / 2 pairs up to 8×8 / 6 pairs with obstacle cells.
- **Screens**: main menu (animated background, progress display), level selection
  (locked/unlocked/completed states), gameplay (undo, restart, hints, timer, moves),
  settings, statistics.
- **Hints** — 3 free hints per level; the hint ghost-draws the next useful segment
  of a verified solution (computed by the built-in solver).
- **Persistence** (LocalStorage, with safe in-memory fallback):
  completed levels, unlocked progress, best records, playtime, hints, settings.
- **Settings**: sound effects, background music, vibration, language
  (English / العربية with full RTL), theme (Light / Dark), reset progress
  with confirmation dialog.
- **Feedback**: press animations, path draw ticks, cut feedback, completion
  sound + particles, optional vibration.
- **Input**: Pointer Events (touch/mouse/pen) with a single-active-pointer guard,
  scroll/zoom prevention, pointer-cancel handling.

## Project structure

```
color-link/
├── www/                    # web app (Capacitor webDir)
│   ├── index.html
│   ├── styles/             # main.css, components.css, game.css
│   ├── assets/             # images, audio, fonts (SVG icon; audio is synthesized)
│   └── src/
│       ├── core/           # game.js, board.js, path-engine.js, level-manager.js,
│       │                   # input-manager.js, renderer.js, solver.js
│       ├── ui/             # main-menu, gameplay-screen, level-selection,
│       │                   # settings-screen, stats-screen, dialogs
│       ├── data/levels.js  # 30 verified level definitions
│       └── systems/        # storage.js, audio.js, localization.js,
│                           # progression.js, hints.js
├── scripts/
│   ├── validate-levels.js  # verifies every level is solvable
│   ├── generate-levels.cjs # dev tool used to author harder levels
│   └── smoke-test.js       # headless logic tests (solvability, drawing, undo…)
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
npm run validate     # all 30 levels must be solver-verified
npm test             # headless smoke tests (board, path engine, storage…)
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
- Language: Arabic switches the whole layout to RTL (`dir="rtl"`).
- Phase 1 scope: 30 levels, local progression, no ads / IAP / backend.
