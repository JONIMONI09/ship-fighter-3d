# ERROR REPORT — living bug list

Every finding from a review, an audit or a playtest is recorded here with a
**solution path** and a status. Statuses: `OPEN`, `FIXED`, `N/A`.
The audit IDs (SBR-xxx) match `schiffsbruch-audit-spec.md`.

## OPEN

- **SBR-009 — web fonts still come from Google.** `css/styles.css` imports
  Rajdhani and Orbitron. Chrome logs `glyf: Glyph bbox was incorrect` for
  Rajdhani, and the page needs internet for its display face.
  *Solution:* `node tools/vendor.mjs` downloads the WOFF2 files, then replace
  the `@import` with local `@font-face` rules. If the bbox warning survives a
  self-hosted copy, swap Rajdhani for a clean condensed face. Not executed in
  this environment because the shell cannot write into the repository
  (`EPERM`/`ENOENT`); the helper and the boot watchdog are in place.
- **SBR-010 — three.js is loaded from jsdelivr.** Offline play needs a local
  copy. *Solution:* run `node tools/vendor.mjs`, then point the importmap at
  `./vendor/three.module.js`. Until then `index.html` shows a boot error after
  7 s instead of a silent black page.
- **SBR-019 (partial) — root artifacts are ignored, not deleted.**
  `server.pid`, `smoke32.log`, `smoke32.err.log`, `smoke32err.log` remain on
  disk because the shell cannot delete files (`EPERM`). They are covered by
  `.gitignore`; delete them manually once from a normal terminal.

## FIXED

- **SBR-001 / SBR-023 (2026-11-12) — smoke aborted with EBADF.**
  *Finding:* `tools/smoke.mjs` wrote its DOM dump into the repository and the
  write threw, so no PASS/FAIL lines were printed.
  *Solution:* dump goes to `os.tmpdir()` inside `try/catch`; the gate continues
  even when the dump fails. Smoke now also asserts that a run actually started
  (`data-state="play"`).
- **SBR-002 (2026-11-12) — every npm script was dead.**
  *Finding:* the npm shim pointed at a missing `npm-cli.js`.
  *Solution:* `tools/gates.mjs` is the canonical, npm-free gate runner; README
  documents it and keeps npm as an optional alias.
- **SBR-003 (2026-11-12) — touch could not reach the dockyard or map.**
  *Solution:* `DOCK` and `MAP` buttons in `#touchUI`, wired to `openWerft()`
  and `toggleTacticalMap()` with the normal play guards; touch hint updated.
- **SBR-004 (2026-11-12) — run state leaked between runs.**
  *Solution:* `resetRunState()` resets `armory` (shell/missile choice, restock
  counters, reload chain), calls `impReset()`, clears ring visuals and restores
  admin defaults on every `startGame()`.
- **SBR-005 (2026-11-12) — `buy()` deducted credits before applying.**
  *Solution:* purchases go through `tryPurchase()` on a snapshot; lane locks
  and caps are re-checked inside `buy()`; rejected purchases leave the balance
  untouched and report a reason.
- **SBR-006 (2026-11-12) — cheats survived restarts and ranked.**
  *Solution:* `resetRunState()` restores `TUNES`; enabling a cheat sets
  `runCheated`; cheated runs show “CHEATED RUN — not ranked” and never write
  the best score.
- **SBR-007 (2026-11-12) — counters drifted across four documents.**
  *Solution:* `tools/counters.mjs` generates the marked block in README,
  PROJECT_MAP and `.clinerules/01`; `--check` is part of the gate chain.
- **SBR-008 (2026-11-12) — README documented a non-existent `B` key.**
  *Solution:* README rewritten from the verified control table; TAB is the
  dockyard key, `KeyB` does not exist.
- **SBR-011 (2026-11-12) — duplicate `devHead` id.**
  *Solution:* the crash toolbar is `crashHead`; CSS targets both; id audit
  reports 0 duplicates.
- **SBR-013 (2026-11-12) — plan.md contained “- FIX” and `undefined` sources.**
  *Solution:* the brainstormer now extracts the “Where to change what” section
  and reads the source label field; plan.md regenerated.
- **SBR-015 (2026-11-12) — no engine-level verification.**
  *Solution:* `tools/engine-scan.mjs` (undefined call targets),
  `tools/id-audit.mjs` (DOM contract), smoke autostart; all in `gates.mjs`.
- **SBR-016 (2026-11-12) — accessibility blockers.**
  *Solution:* pinch zoom allowed, `role`/`tabindex`/`aria-label` on HUD and
  touch controls, Enter/Space activation, focus ring, reduced-motion support.
- **SBR-017 (2026-11-12) — desktop-only touch hint.**
  *Solution:* touch builds show `DOCK · MAP · FIRE · ZOOM · Drone · Damage Control`.
- **SBR-018 (2026-11-12) — god mode could still sink from flooding.**
  *Solution:* god mode clears floods, integrity damage and burn before the sink
  check; documented in the README.
- **SBR-020 (2026-11-12) — per-frame DOM write.**
  *Solution:* the zoomed class is toggled only when the state changes.
- **SBR-021 (2026-11-12) — no licence or credits.**
  *Solution:* `LICENSE` (MIT) and `THIRD_PARTY.md` added.
- **SBR-022 (2026-11-12) — mixed naming.**
  *Solution:* “Werft” removed from user-visible strings; DOCKYARD is the single
  in-game term, the German title stays as the brand.
