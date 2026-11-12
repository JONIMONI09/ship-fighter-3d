# Coding Standards (SCHIFFSBRUCH — ship fighter, multi-file ESM)

- **Multi-file ES modules**, no build step. `index.html` uses an importmap for
  `three`; app code lives in `js/`.
- **Architecture layers** (imports only in this direction, never backwards):
  ```
  js/core.js   → PURE simulation (math, waves, flooding, ballistics).
                 Imports NOTHING (no three, no DOM) — must run in Node tests!
  js/game.js   → engine: three scene, ships, weapons, AI, HUD, input.
                 Imports core.js. Self-executing module (no exports needed).
  js/main.js   → entry point: `import './game.js'`.
  ```
- **No allocations in the animate loop**: reuse module temporaries
  (`_mp`, `_tv`, `_aim2`, …). Shared materials instead of per-instance
  `MeshStandardMaterial` (see FIX: debris/drone materials).
- **Units**: meters, seconds, knots→m/s at the boundaries only. Constants
  live in `TUNES`/`WEAPONS` config objects, never inline magic numbers.
- **No game state in module globals outside `js/game.js`**; `js/core.js`
  functions must be stateless (mutate only their arguments).
- **English**: all code comments, identifiers and ALL markdown documents are
  written in English. `FIX:` comments document every deliberate bug fix and
  reference its number. Counters are generated — do not hand-edit them:

<!-- COUNTERS:START -->
| Counter | Value |
|---|---|
| `FIX:` markers in `js/game.js` | 115 |
| Distinct numbered fixes | 32 |
| Highest `FIX` number | #41 |
| Unit tests | 124 |
<!-- COUNTERS:END -->

- **Tooling rule**: string-rewrite tools (tools/split*.mjs) MUST normalize
  CRLF→LF before matching and MUST splice on the ORIGINAL string
  (single pass) — see docs/LESSONS.md.
