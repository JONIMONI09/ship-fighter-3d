# PROJECT MAP

```
ship fighter/
├── index.html            # DOM shell: importmap (three), CSS link, HUD/menus,
│                         # <script type="module" src="./js/main.js">, boot watchdog
├── css/styles.css        # all styling (extracted from the legacy single file)
├── js/
│   ├── core.js           # PURE sim: waves, flooding, ballistics, economy math.
│   │                     # no imports — all node:test-able
│   ├── game.js           # engine: three scene, water shader, ships, AI,
│   │                     # weapons, HUD, input, dev console, tactical map
│   └── main.js           # entry: import './game.js' (+ ?autostart=1)
├── tests/core.test.js    # node:test — one describe per core.js export
├── tools/
│   ├── gates.mjs         # canonical npm-free gate runner
│   ├── smoke.mjs         # headless Chrome boot + start test
│   ├── engine-scan.mjs   # undefined call-target scan (spawnEscort class of bug)
│   ├── id-audit.mjs      # duplicate DOM ids + missing $() references
│   ├── counters.mjs      # generated counters (--check / --write)
│   ├── vendor.mjs        # offline three.js + fonts downloader
│   ├── reviewer.mjs      # rules/docs audit → docs/review-report.md
│   ├── brainstormer.mjs  # research → docs/plan.md
│   ├── plugin-selftest.mjs, split*.mjs, fix31.mjs, fix32.mjs
├── vendor/               # optional local three.js after tools/vendor.mjs
├── legacy/               # original single-file game (reference only)
├── docs/                 # LESSONS, PROJECT_MAP, plan, error-report, review-report
├── server.mjs            # zero-dep static dev server (port 8123)
├── package.json          # start / test / smoke / gates / review / brainstorm
└── .clinerules/          # 01 coding · 02 physics · 03 testing · 04 workflow
```

<!-- COUNTERS:START -->
| Counter | Value |
|---|---|
| `FIX:` markers in `js/game.js` | 115 |
| Distinct numbered fixes | 32 |
| Highest `FIX` number | #41 |
| Unit tests | 124 |
<!-- COUNTERS:END -->

## Recent fixes

- #37 transactional `buy()` (snapshot, re-checked caps, no silent loss)
- #38 `resetRunState()` for ordnance prices, reload chain, rings, cheats
- #39 god mode also clears flooding/fire
- #40 touch DOCK/MAP buttons (dockyard and tactical map were keyboard-only)
- #41 cheated runs are marked and never ranked

## Where to change what

- New pure mechanic (waves, flooding, ballistics, scoring math) → `js/core.js`
  + a test in `tests/core.test.js` first.
- New gameplay (weapon, ship class, shop item, FX) → `js/game.js`, constants
  into `TUNES`/`WEAPONS`, no new module-level mutable state outside it.
- Anything the browser must reach from tests → keep `index.html` IDs stable
  (`startBtn`, `hud`, `minimap`, …); smoke and CSS depend on them.
- World height always comes from `waveRaw`/`waveScaled` — never a second formula.
- Admin `TUNES` multipliers stay last in every scaling chain.

## Entry points

`index.html` is the only game entry. `Ship_fight_new.html`, `served.html` and
`live-8123.html` are archive snapshots (banner at the top) and are not served
or tested.
