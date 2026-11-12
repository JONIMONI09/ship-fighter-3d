# Testing Policy & Tooling

## Unit tests — Node built-in runner (`node:test`, NO extra deps)

- `tests/core.test.js` — one `describe` per exported function of
  `js/core.js` (currently 19 exports incl. REGISTRY/REG_UPG data,
  `registryCap`, `regUpgCost`, `buildSeconds`, `buildRemaining`).
  ⚠ When you add tests for NEW core exports, extend the test file's
  import block in the SAME edit — missing imports fail as false
  negatives (Session 3g lesson).
- Rule: every new pure function gets at least one **reference-value test**
  (hand-computed number, not a snapshot) plus property tests (bounds,
  monotonicity, determinism).
- Run: `npm test` → `node --test "tests/*.test.js"`.
  ⚠ On Node ≥ 25 the directory form `node --test tests/` FAILS with
  MODULE_NOT_FOUND — always use the quoted glob form.
- `wrapPI` range is documented as **[-π, π)** (boundary wraps to −π) —
  tests encode exactly this behavior.

## Headless browser smoke test (zero-dep)

- `tools/smoke.mjs`: starts `server.mjs` (auto-picks a free port), drives
  headless Chrome or Edge (`--headless=new --dump-dom`, SwiftShader flags for
  GPUs without WebGL), then asserts: startBtn present, hud present, canvas
  present, **zero console output at all** — every console line FAILS, because
  Chromium severity labels are unreliable (this is what finally caught the
  dead water shader, FIX #16). 3 attempts with a fresh temp profile per run;
  kills ONLY its own browser/server processes. Run: `npm run smoke`.
- Gates before "done": `node --check js/core.js js/game.js js/main.js`
  (0 errors) → `npm test` (all pass) → `npm run smoke` (all PASS).

## Tool safety rules (hard-learned)

- **NEVER run `taskkill /F /IM node.exe`** (or similar global kills) — it
  destroys the agent CLI's own runtime. Clean up by PID or by killing only
  the exact child process you spawned (`child.kill()`).
- Keep each shell command small; PowerShell heredocs (`@' … '@`) are the
  reliable way to create files when the editor tool cannot.
- `tools/split-game.mjs` regenerates `js/game.js` only with `--force`;
  the checked-in file is hand-maintained and must not be overwritten
  silently (it carries all 50+ `FIX:` markers, 24 numbered fixes).

## Review workflow

- **Fast reviewer** (after every change batch): checklist — core.js still
  pure? FIX comments intact? tests green? smoke green? Verdict line:
  FAST REVIEW: PASS|FAIL.
- **Slow reviewer** (once, when everything is done): full read of all
  source files + docs cross-check, re-run all gates. Verdict:
  SLOW REVIEW: PASS|FAIL with findings list. Record both in
  docs/LESSONS.md.

