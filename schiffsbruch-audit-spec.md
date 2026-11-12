# SCHIFFSBRUCH — Bug-Hunt & Showcase Hardening Spec

| Field | Value |
|---|---|
| Status | Approved scope, implementation not started |
| Date | 2026-11-12 |
| Language | English (decision from interview; code comments stay English) |
| Product | SCHIFFSBRUCH 3D · DOCKYARD (ship combat game) |
| Repository | `ship fighter` (three.js, ES modules, zero build step) |
| Request (verbatim, German) | “befrage mich was es ist und was ich für wünsche habe finde fehler etc!!!” |
| Request interpretation | Interview the owner about the product and their wishes, then produce a complete, evidence-based defect register and hardening plan. |

This document contains no unfinished sections and no deferred decisions. Every open question from
the interview has a recorded decision in §2. Every defect has an ID, evidence, reproduction and a
fix direction.

---

## 1. What the product is

SCHIFFSBRUCH is a browser-based 3D naval combat game. The player commands a battleship,
steers with WASD, aims and fires with the mouse, fights escalating waves of AI ships, and spends
earned credits in a dockyard between fights. The distinguishing mechanic is a real buoyancy
simulation: hits open leaks in four chambers, water floods progressively, the hull lists and can
sink, and damage control consumes crew.

**Stack and architecture (verified in the repository):**

```
index.html            DOM shell, importmap for three@0.163.0 (CDN), module entry js/main.js
css/styles.css        all styling; imports Orbitron + Rajdhani from Google Fonts
js/core.js            373 lines — PURE simulation (waves, flooding, ballistics, economy math)
                      imports nothing; runs under node:test
js/game.js            2,901 lines — three.js scene, ships, AI, weapons, HUD, input, dev console
js/main.js            one line: import './game.js'
tests/core.test.js    124 node:test cases, all passing
tools/                smoke.mjs (headless boot test), reviewer.mjs, brainstormer.mjs,
                      plugin-selftest.mjs, split*.mjs, fix31.mjs, fix32.mjs
docs/                 LESSONS.md, PROJECT_MAP.md, plan.md, error-report.md, review-report.md,
                      PLUGIN_FORGE.md
.clinerules/          coding standards, physics rules, testing policy, workflow discipline
legacy/               original single-file game + extracted JS (reference only)
```

**Current player-facing feature set (verified in code and menu text):**

- Wave loop with six enemy classes (patrol, torpedo, destroyer, freighter, cruiser, battleship,
  carrier) and bosses every fifth wave; boss rotation 5/20/35 cruiser, 10/25/40 battleship,
  15/30/45 carrier, 2–3 bosses from wave 15/30.
- Buoyancy/flooding with four chambers, listing, progressive sinking, damage control, crew cost.
- Dockyard with 11 upgrade lanes, tabbed shop (UPGRADES / WEAPONS & AMMO / FLEET COMMAND),
  full-screen info cards, six shell types and four missile types.
- Fleet escorts (levels 1–3) and a FLEET COMMAND registry (levels 4+) with build timers,
  per-ship upgrades, carriers with strike jets, and a shared ammo pool.
- Tactical map (M) with selection, per-ship modes (auto/aggressive/passive), follow/stop and
  priority targets.
- Touch controls: virtual joystick, FIRE, ZOOM, orientation prompt.
- Dev console with live tuning sliders and cheat toggles (see §5).
- Global crash screen with copyable stack trace.
- Persistence: high score only (`localStorage` key `schiffsbruch3d_2_hs`), dev password and
  rebind keys. No run progress is saved.

**Measured baseline on 2026-11-12 (this machine, Windows, Node v25.4.0):**

| Check | Result |
|---|---|
| `node --test tests/core.test.js` | **124 passed, 0 failed** (30 suites) |
| `node --check js/game.js` / `js/core.js` / `tools/smoke.mjs` | pass (exit 0) |
| `node tools/smoke.mjs` | **FAIL — `EBADF: bad file descriptor, write` at `tools/smoke.mjs:73`** |
| `npm --version` / `npm test` | **FAIL — `Cannot find module 'D:\GIT\Git\node_modules\npm\bin\npm-cli.js'`** |
| Shell utilities `ls`, `head`, `tail`, `grep` | unavailable in this shell (exit 127); `node` works |

---

## 2. Interview decisions

These are the answers the owner gave, converted into binding decisions.

| Topic | Owner answer | Decision recorded in this spec |
|---|---|---|
| Primary goal | “Fehler finden & beheben” | This pass is a defect hunt and hardening pass. No new gameplay, no new ships, weapons or modes. |
| Quality bar | “Showcase/Portfolio” | Everything visible to a visitor must work on first contact: correct README, no stale copies, no console noise, no dead ends on any device. |
| Target devices | “ALLEN!°!!” (all) | Desktop mouse+keyboard, touch tablet, touch phone and weak/integrated GPU are all first-class. Mobile may not be missing core actions. |
| Taboo areas | “Nichts ist tabu” | Large refactors are allowed where they serve the goal. `legacy/` remains reference material, not a target. |
| Documentation language | English | This spec and all markdown stay English. Code identifiers and comments stay English. |
| Duplicate HTML files | “dort lassen” (leave them there) | `Ship_fight_new.html`, `served.html`, `live-8123.html` stay in the repository root. They must be clearly marked as archives so nobody edits or opens the wrong file. |
| Google-Fonts warnings | “intelligent lösen!!!!” | Solve at the root, not by muting: self-host the fonts locally; if Chrome's font sanitizer still reports the glyph-bbox warning for the self-hosted file, replace the broken face with a metrically similar clean font. See SBR-009. |
| Audit depth | “ALLES!!!!!!” | Full repository audit: game code, tests, tools, docs, rules, duplicate files, server, CSS, HTML. |
| Difficulty curve | “so wie jetzt!!!” | No balance pass. Wave tiering, boss scaling and economy stay as they are except where a defect is proven. |
| Persistence | “bitte selber nur schauen” (inspect it yourself) | Keep the current model: high score only. Run persistence is out of scope for this pass. |
| Cheat mode | “sage dann wo ich den cheatmode aktivieren kann also den godmode” | Exact activation path is documented in §5, including the fact that no Ctrl/STRG key is involved. |
| Placeholders | “keine Platzhalter” | This document contains no unfinished sections. Fix directions are concrete and assignable. |

---

## 3. Definition of Done (showcase bar)

A defect is only closed when all of the following are true:

1. **Reproduced before the fix.** The reproduction steps below were executed and failed.
2. **Fixed at the cause**, not hidden by disabling a test, widening an assertion or swallowing an
   error.
3. **Verified after the fix** with the smallest relevant check. For shared code that means the
   full gate chain in §8; for a single DOM/UI change it may be a targeted manual check plus the
   smoke boot.
4. **No new console output on a clean boot.** The project deliberately treats every console line
   as a failure because Chromium labels three.js shader errors as INFO.
5. **`FIX:` bookkeeping respected.** New engine fixes get the next free number after `#36`
   (currently `#37`, `#38`, …), a `FIX:` comment at the change site, and a matching entry in
   `docs/error-report.md`, `docs/LESSONS.md` and the counters in `.clinerules/01-coding-standards.md`.
6. **Gameplay invariants intact:** `js/core.js` still imports nothing; `waveRaw` and the GLSL
   `W()` copy stay identical; admin `TUNES` multipliers stay last in every scaling chain;
   no new per-frame allocations; no new dependencies; still zero build step.
7. **Docs match reality.** Counters, test counts, controls and file lists are generated or
   cross-checked, not hand-typed in four places.

---

## 4. Defect register

Severity: **S1 blocker** = showcase cannot be verified or started; **S2 high** = core loop broken
on a supported device or state corruption; **S3 medium** = visible wrongness, drift or degraded
quality; **S4 low** = hygiene and polish.

| ID | Sev | Area | Summary | Evidence |
|---|---|---|---|---|
| SBR-001 | S1 | Tooling | Headless smoke test aborts instead of reporting PASS/FAIL | `node tools/smoke.mjs` → `EBADF` at `tools/smoke.mjs:73` |
| SBR-002 | S1 | Tooling | Every `npm` script is unusable on this machine | `npm --version` → missing `npm-cli.js` in Git installation |
| SBR-003 | S2 | Mobile | Touch players cannot open the Dockyard or the Tactical Map | `index.html#touchUI` has only joystick, FIRE, ZOOM; `openWerft()`/`toggleTacticalMap()` are keyboard-only |
| SBR-004 | S2 | State | Run state leaks between runs: ordnance prices and reload chain persist; impact rings persist | `startGame()` (game.js:2702) never calls `impReset()` and never resets `armory.*Buys`/`mslChain`/`mslWait` |
| SBR-005 | S2 | Economy | Upgrades are not transactional: credits are deducted before the effect is applied | `buy()` (game.js:1730) does `credits-=cost` before branch; no `tryPurchase`, no refund, no cap re-check |
| SBR-006 | S2 | Fairness | Cheat toggles survive `startGame()` and can inflate the best score | `TUNES` is module-global; `startGame()` does not reset it; `best` is written unconditionally at game.js:2093 |
| SBR-007 | S2 | Docs | Four documents disagree about fixes, markers and tests | `.clinerules/01` says 93 markers/27 fixes; `PROJECT_MAP.md` says 83/29 up to #30; `session.md` says 60 markers/24 fixes/112–117 tests; reality is 110 markers/27 distinct/max #36/124 tests |
| SBR-008 | S2 | Showcase | README control table is wrong and stale | README says “B for the shipyard (Werft)”; `KeyB` occurs 0 times in `js/game.js`; the real key is TAB |
| SBR-009 | S3 | Visual | Google-Fonts import causes console noise and an external dependency | `css/styles.css:1` imports Rajdhani/Orbitron; Chrome logs `glyf: Glyph bbox was incorrect` for Rajdhani |
| SBR-010 | S3 | Offline | Game only starts with internet access to two CDNs | three.js from jsdelivr in `index.html` importmap; fonts from fonts.googleapis.com |
| SBR-011 | S3 | HTML | Duplicate element ID `devHead` | `index.html` defines `id="devHead"` twice (dev console and crash screen) |
| SBR-012 | S3 | Showcase | Stale root copies of the game are byte-identical leftovers | `Ship_fight_new.html` = `legacy/Ship_fight_new.html` (104,498 B); `served.html` = `live-8123.html` (7,138 B) and both are older/smaller than `index.html` (7,909 B) |
| SBR-013 | S3 | Docs | `docs/plan.md` is broken generator output | Contains “Current feature map: - FIX” and four sources listed as `undefined` |
| SBR-014 | S3 | Docs | `docs/error-report.md` is malformed | Sequence is `## FIXED`, `## OPEN` with a placeholder line, then `## FIXED` again |
| SBR-015 | S3 | Testing | No engine-level coverage; the shipped `spawnEscort` crash proves the gap | 124 pure tests, 0 tests that exercise `buy()`, waves or reset; smoke never clicks `startBtn` |
| SBR-016 | S3 | Accessibility | Page blocks zoom and uses non-semantic controls | `maximum-scale=1,user-scalable=no` in `index.html`; `#btnFire`, HUD slots are `<div>` with click handlers, no roles/labels |
| SBR-017 | S3 | Mobile | On-screen instructions are desktop-only | `#hint` and menu list TAB/M/E/R; no touch equivalent is shown |
| SBR-018 | S3 | Godmode | “GOD MODE” does not prevent flooding deaths | `damagePlayer()` returns early, but `fillFloods()` still runs and `startPlayerSink()` triggers at average flood > 0.52 |
| SBR-019 | S4 | Repo | Debug artifacts in the repository root | `server.pid`, `smoke32.log`, `smoke32.err.log`, `smoke32err.log`; no `.gitignore` |
| SBR-020 | S4 | Perf | DOM is written every frame in the animate loop | `body.classList.toggle('zoomed', …)` runs unconditionally per frame (game.js, camera block) |
| SBR-021 | S4 | Repo | No licence/credits file for a public showcase | No `LICENSE` in the repository; `package.json` is `private` |
| SBR-022 | S4 | UX | Mixed German/English naming in a showcase build | Title “SCHIFFSBRUCH”, menu text “DOCKYARD/Werft”, English HUD |
| SBR-023 | S4 | Tooling | Smoke test writes its DOM dump into the repository | `writeFileSync('tools/.last-dom.html', dom)` at `tools/smoke.mjs:73` |

### 4.1 SBR-001 — smoke test aborts with EBADF

**Reproduction:** run `node tools/smoke.mjs` from the project root.

**Observed:** the process exits 1 with

```
Error: EBADF: bad file descriptor, write
    at writeFileSync (node:fs:2404:20)
    at file:///.../tools/smoke.mjs:73:5
```

No PASS/FAIL lines are printed, so the documented “4/4 PASS, 0 console errors” result is stale and
cannot be reproduced. A direct write probe from the same shell confirms the write path itself is
broken in this environment: `fs.writeFileSync('tools/.write-probe.tmp','x')` fails with `ENOENT`,
while `fs.statSync('tools/.last-dom.html')` succeeds (8,172 B). Reading works; creating a file under
`tools/` does not.

**Fix direction:** write the DOM dump to `fs.mkdtempSync(path.join(tmpdir(), 'sf-smoke-'))` instead
of the repository, and wrap the write in `try/catch` so a dump failure can never abort the test.
Keep the dump path in the failure output and print the `errno` when the dump cannot be written. The
assertions must run even when the dump fails — the dump is diagnostic, not part of the gate. Do not
delete the existing repository dump until the temp path is proven. The fix must be verified both
from this shell (where repository writes are unreliable) and from a normal terminal.

**Verification:** `node tools/smoke.mjs` prints four PASS lines and exits 0; deliberately introducing
a console error makes it exit 1 with the error listed.

### 4.2 SBR-002 — npm scripts are dead on this machine

**Reproduction:** `npm --version` or `npm test`.

**Observed:** `Cannot find module 'D:\GIT\Git\node_modules\npm\bin\npm-cli.js'`. The npm shim points
at a Git for Windows installation that no longer contains npm. Every documented command in
`README.md`, `.clinerules/03-testing-policy.md` and `docs/plan.md` starts with `npm`, so a visitor
following the README cannot run anything.

**Fix direction:** add a dependency-free `tools/gates.mjs` that runs, in order, `node --check` on
`js/core.js`, `js/game.js`, `js/main.js` and the tools, `node --test tests/*.test.js` (quoted glob,
never the directory form), and `node tools/smoke.mjs`, printing one PASS/FAIL line per gate and
exiting non-zero on the first failure. Document `node tools/gates.mjs` in the README as the
canonical command and keep the `npm` aliases as convenience only. Do not modify the machine-wide
npm installation; the repository must not depend on it.

**Verification:** `node tools/gates.mjs` runs from a clean shell and exits 0 with three gate lines.

### 4.3 SBR-003 — touch cannot reach the dockyard or tactical map

**Reproduction:** open the game in a mobile emulator (touch enabled), start a run, try to open the
dockyard or the tactical map.

**Observed:** `#touchUI` contains only `#joyBase`, `#btnFire` and `#btnZoom`. `openWerft()` is
called only from the `Tab` branch of the keydown handler (game.js:2452–2453), and
`toggleTacticalMap()` only from `KeyM` (game.js:2469). Weapons, drones and damage control are
reachable by tapping the HUD slots, but the two central management screens are not. A phone
player can fight but can never upgrade or command the fleet.

**Fix direction:** add two touch buttons to `#touchUI` in the HUD safe area: `DOCKYARD` and `MAP`,
visible only when `IS_TOUCH`. Wire them to `openWerft()` and `toggleTacticalMap()` and respect the
existing `touchPlayOK()` / `uiBlockedF()` guards. Give both buttons `role="button"`, `aria-label`
and a minimum 44×44 px hit area. Reuse the existing `.hidden` and `#btnZoom` styling patterns.

**Verification:** in a touch emulator, the dockyard opens, a purchase completes, the map opens,
a ship can be selected, and closing returns to play. Desktop layout is unchanged.

### 4.4 SBR-004 — match state leaks into the next run

**Reproduction:** start a run, buy several shell restocks and missile restocks so prices escalate,
fire rocket salvos so the reload chain grows, then start a new run and open the WEAPONS & AMMO tab.

**Observed:** `startGame()` resets ships, shells, rockets, missiles, jets, torpedoes, debris, drones,
escorts, player, score, credits, ammo, combo, `lastSinkT`, `shipsSunk`, `gameOver`, `waveNum`,
weapon cooldowns, `waveGear`, camera and sink timer — but it does not reset `armory.shellBuys`,
`armory.mslBuys`, `armory.mslChain`, `armory.mslWait`, and it never calls `impReset()`. Restock
prices therefore continue where the previous run stopped, and stale impact rings can survive until
the pool is overwritten.

**Fix direction:** add an explicit `resetRunState()` used by `startGame()` that resets the full
`armory` object to `{shell:'ap', msl:'ir', mslChain:0, mslWait:0, shellBuys:0, mslBuys:0}`, calls
`impReset()`, clears `impPts`, and resets the ring/particle pools to invisible. Keep the function
next to `startGame()` so future state additions have one obvious home.

**Verification:** a new run shows base restock prices and a 30 s first rocket reload; no impact ring
from the previous run is visible in the first second of the new run.

### 4.5 SBR-005 — purchases are not transactional

**Reproduction:** call `buy()` for an upgrade with exactly enough credits, or trigger it while the
fleet registry is full at fleet level 4+.

**Observed:** `buy()` reads `credits`, silently returns when the balance is too low, then deducts
`credits-=cost` **before** applying the effect. There is no `tryPurchase()` snapshot, no `it.can()`
re-check, and no rollback. The rest of the shop (ammo, registry, per-ship upgrades) already uses
the snapshot pattern, so this is an inconsistency in the one path every player uses first.

**Fix direction:** route `buy()` through `tryPurchase({credits}, cost)` exactly like the other
cards, apply the effect only after `pay.ok`, and re-check `it.can()` and the lane cap inside
`buy()` rather than trusting the renderer. Emit a `feed()` reason for every rejected purchase.
Keep the existing `renderWerft()` refresh.

**Verification:** a unit test around a pure purchase helper (or a DOM-level test if one is added)
shows: insufficient funds leave the balance untouched; a blocked lane leaves the balance
untouched; a successful purchase deducts exactly the cost once.

### 4.6 SBR-006 — cheat state and high score

**Reproduction:** open the dev console, enable GOD MODE, sink ships, finish the run, reload, then
start a normal run.

**Observed:** `TUNES` lives at module scope and `startGame()` never restores `DEV_DEF`. Cheats stay
active across runs, including after `location.reload()` only if the dev panel was not reset (the
values themselves are not persisted, but a same-session restart keeps them). The high score is
written unconditionally when the score exceeds `best`, so a cheated run can become the permanent
“BEST” value.

**Fix direction:** snapshot `cheatsOn()` at run start into a per-run flag `runCheated`. In
`startGame()`, restore all `TUNES` keys to `DEV_DEF` while preserving deliberate admin tuning only
when the dev console is open. Do not write `best` for a run with `runCheated`; show a
“CHEATED RUN — not ranked” note on the end screen. Keep the dev console's ability to tune live
during a run.

**Verification:** enable god mode, finish, restart: cheats are off; best score is unchanged and the
end screen explains why.

### 4.7 SBR-007 — counters and docs drift

**Reproduction:** count `FIX:` markers and numbered references in `js/game.js` and compare with the
four documents.

**Measured:** 110 `FIX:` markers, 27 distinct numbered references, highest number `#36`;
`node --test` reports 124 tests in 30 suites.

**Documented:** `.clinerules/01` — 93 markers, 27 numbered `#10–#36` (numbering right, marker count
wrong); `docs/PROJECT_MAP.md` — 83 markers, 29 fixes up to `#30`; `session.md` — 60 markers,
24 fixes, 112–117 tests; `docs/review-report.md` — 110 markers, 26 numbered refs.

**Fix direction:** create `tools/counters.mjs` that computes markers, distinct numbered refs, the
highest number, test count and gate status, and writes a single generated block between
`<!-- COUNTERS:START -->` and `<!-- COUNTERS:END -->` in `README.md`, `docs/PROJECT_MAP.md` and
`.clinerules/01-coding-standards.md`. Replace hand-typed numbers in prose with “see counters
block”. Run it as the last step of `tools/gates.mjs`.

**Verification:** running the tool twice produces identical output; all three documents show the
same numbers as the tool.

### 4.8 SBR-008 — README controls are wrong

**Reproduction:** read `README.md` and press `B` in port.

**Observed:** `B` is not bound anywhere in `js/game.js` (`KeyB` count: 0). The dockyard opens with
`TAB`. The README also claims “23 bug fixes applied” and “93 FIX markers” in other places, both
stale.

**Fix direction:** replace the controls section with the verified table from §5 and §7, delete
stale counts (or replace with the generated counters block), and add a one-line “which file to
open” note pointing at `index.html`.

**Verification:** every key in the README is present in `js/game.js` and every key in the game is
listed.

### 4.9 SBR-009 — font dependency and glyph warnings

**Reproduction:** load the game in Chrome with the console open.

**Observed:** `css/styles.css:1` imports Orbitron and Rajdhani from Google Fonts. Chrome logs
repeated `downloadable font: glyf: Glyph bbox was incorrect; adjusting` messages for Rajdhani
weights 500. The page also fails without internet access.

**Fix direction:** self-host both families as WOFF2 under `css/fonts/`, add `@font-face` rules with
`font-display:swap` and the OFL licence files, and remove the `@import`. Then measure in headless
Chrome: if the bbox warning still appears for the self-hosted Rajdhani file, replace Rajdhani with
a metrically similar clean condensed face and keep the existing `font-family` fallback chain
(`'Rajdhani', 'Barlow Condensed', sans-serif`). Record the final choice in this section after the
change. Do not silence the smoke test to hide the message.

**Verification:** a cold load with cache disabled produces zero font-related console lines, and the
menu renders identically at 1280×720 and 390×844.

### 4.10 SBR-010 — two CDN dependencies

**Observed:** `index.html` importmap maps `three` to jsdelivr; `css/styles.css` imports fonts from
Google. Without internet the game never boots and the crash screen cannot help because the module
itself fails to load.

**Fix direction:** vendor `three.module.js` (0.163.0) into `vendor/three.module.js`, point the
importmap at `./vendor/three.module.js`, and ship the three.js MIT licence next to it. This keeps
the zero-build promise and makes the game work from `file://`-style static hosting behind a
firewall. Keep a comment with the upstream URL and version. Fonts are handled by SBR-009.

**Verification:** disable the network in DevTools, reload, start a run; the game plays.

### 4.11 SBR-011 — duplicate ID `devHead`

**Observed:** `index.html` contains `<div id="devHead">` inside `#dev` and again inside `#crash`.
That is invalid HTML, makes `getElementById('devHead')` ambiguous and applies the same flex styling
to two unrelated toolbars.

**Fix direction:** rename the crash toolbar to `id="crashHead"` and update the CSS selector to
`#devHead, #crashHead` (or give both a shared class `.toolbarRow`). Check with the ID audit script
that no duplicate remains.

**Verification:** `node tools/id-audit.mjs` (new, see §8) reports 0 duplicate IDs; both toolbars
still lay out correctly.

### 4.12 SBR-012 — stale root copies

**Observed:** `Ship_fight_new.html` is byte-identical to `legacy/Ship_fight_new.html`
(MD5 `36c2a40a…`). `served.html` and `live-8123.html` are byte-identical to each other
(MD5 `9128cc30…`), 136 lines, and predate the current `index.html` (which contains FIX #34/#36
markup). A visitor who opens either file sees an older game with no dockyard tabs and no tactical
map.

**Decision:** keep the files in place (owner's explicit wish). Add a visible banner comment at the
top of each archive file: `<!-- ARCHIVE SNAPSHOT — NOT THE GAME. Play index.html. -->`, and add the
same note to the README with the file list. Do not regenerate them from the current build; that
would create a third source of truth.

**Verification:** both archive files start with the banner; README names `index.html` as the only
entry point.

### 4.13 SBR-013 — broken plan generator

**Observed:** `docs/plan.md` contains `## 2. Current feature map (from PROJECT_MAP.md)` followed by
`- FIX`, and four source entries named `undefined` with valid URLs. The feature-map parser grabs a
markdown code-fence label instead of the section body, and the source object uses the wrong key.

**Fix direction:** fix `tools/brainstormer.mjs` to parse the “Where to change what” and feature
sections by heading, and to read `r.name` (or the correct field) for the source list. Regenerate
`docs/plan.md` once after the fix and commit the generated file.

**Verification:** the regenerated plan has a non-empty feature map with at least five bullets and
four named sources; no `undefined` string remains.

### 4.14 SBR-014 — malformed error report

**Observed:** `docs/error-report.md` has a `## FIXED` section, then `## OPEN` with a placeholder
line, then a second `## FIXED` section. It also has no entry for findings that the reviewer plugin
already reports (the counter drift).

**Fix direction:** restructure into exactly two sections, `## OPEN` and `## FIXED (newest first)`,
move all three existing entries under `FIXED`, add entries for SBR-001 through SBR-023 with their
final status, and keep the “solution path” column. No placeholder lines.

**Verification:** the file parses as valid markdown, has one `## OPEN` and one `## FIXED`, and every
SBR ID appears exactly once.

### 4.15 SBR-015 — no engine-level verification

**Observed:** the suite covers `core.js` only. The historical `spawnEscort` crash
(`ReferenceError` after credits were deducted) shipped despite 112 green tests because nothing
exercised `buy()` or the reset path. `tools/smoke.mjs` asserts that the start button exists but
never clicks it, so wave spawning, the dockyard and the boss loop are untested.

**Fix direction:** add two layers without adding dependencies:
1. `tools/engine-scan.mjs` — a static reference check that parses every `function name(` in
   `js/game.js` and every `name(` call site, and fails on a call to a name that is neither defined
   in the file nor imported from `core.js` or `three`. This would have caught `spawnEscort`.
2. A DOM-level smoke extension: after the boot assertions, use Chrome's `--virtual-time-budget`
   with a `?autostart=1` query parameter that `main.js` interprets as “click start”, or drive the
   existing `startBtn` through an injected script. Assert that `#waveN` is not `–` and that
   `#hud` shows a wave after 8 s. Keep the zero-console assertion.

**Verification:** `node tools/engine-scan.mjs` passes on the current tree and fails when a temporary
call to an undefined function is added; smoke reports a started wave.

### 4.16 SBR-016 — accessibility blockers

**Observed:** `<meta name="viewport" … maximum-scale=1,user-scalable=no>` prevents pinch zoom; the
fire button and HUD weapon slots are `<div>` elements with click handlers, no `role`, no
`tabindex`, no `aria-label`; the tactical legend communicates teams by colour alone.

**Fix direction:** remove `maximum-scale` and `user-scalable`; add `role="button"`, `tabindex="0"`,
`aria-label` and Enter/Space handlers to `#btnFire`, `#btnZoom`, `#s0–#s2`, `#dronesIco`, `#dcIco`;
add shape/label suffixes to the tactical legend (friendly = circle + cyan, enemy = triangle + red,
boss = diamond + orange). Add `@media (prefers-reduced-motion: reduce)` to disable screen shake and
the damage flash.

**Verification:** keyboard-only navigation can start a run, fire and open the dockyard; axe-style
manual checks find no unnamed interactive element; the game is usable at 200 % browser zoom.

### 4.17 SBR-017 — desktop-only instructions on touch

**Observed:** `#hint` reads “TAB Dockyard · I Card info · E Drone · MMB/RMB Zoom · R Damage
Control · Wheel: Weapon”; the menu lists the same keyboard table. `#touchUI` shows no equivalent
text.

**Fix direction:** choose the hint text by input mode at boot: on `IS_TOUCH`, show
“☰ Dockyard · MAP · FIRE · ZOOM · ▲ Drone · ✚ Damage Control”. Keep the desktop string unchanged.
Add the two new touch buttons from SBR-003 to the same hint.

**Verification:** on a touch emulator the hint names only actions that exist as on-screen controls.

### 4.18 SBR-018 — god mode does not stop flooding

**Observed:** `damagePlayer()` returns immediately when `TUNES.godMode` is set, but `updatePlayer()`
still runs `fillFloods()`, and `startPlayerSink()` triggers when the average flood exceeds 0.52.
A god-mode player who takes many hull breaches can still sink. The dev label says “GOD MODE (no
damage)”, which is technically accurate but misleading in practice.

**Fix direction:** decide and document one behaviour: either rename the toggle to “NO DIRECT
DAMAGE” and keep flooding lethal, or make god mode also pin floods/integrity (`if(TUNES.godMode)
{ P.floods.fill(0); P.integ.fill(1); P.burn=0; }` before the sink check). The showcase choice is
the second, because the toggle is presented as a cheat. Keep `INFINITE HP` separate.

**Verification:** enable god mode, ram a battleship and take ten torpedoes; hull stays full and the
ship does not sink. Disable it; normal sinking returns.

### 4.19 SBR-019 — repository hygiene

**Observed:** root contains `server.pid`, `smoke32.log`, `smoke32.err.log`, `smoke32err.log`;
`tools/` contains `.last-dom.html` and `.smoke-out.txt`; there is no `.gitignore`.

**Fix direction:** add a `.gitignore` covering `*.log`, `*.pid`, `tools/.*`, `node_modules/`,
`vendor/*.map` if maps are not shipped; delete the four root artifacts (they are reproducible);
keep `tools/.last-dom.html` out of git via the ignore rule and stop writing it (SBR-001/023).

**Verification:** `git status` is clean after a full gate run.

### 4.20 SBR-020 — per-frame DOM write

**Observed:** the camera block calls `body.classList.toggle('zoomed', …)` every frame. `classList`
toggles are cheap but still touch the DOM style invalidation path 60 times per second.

**Fix direction:** cache the last zoom state in a module variable and only toggle when it changes.

**Verification:** a frame trace shows no `classList` writes while zoom is unchanged.

### 4.21 SBR-021 — licence and credits

**Observed:** no `LICENSE` file; the project embeds three.js (MIT) and two OFL fonts, and the
README has no credits section.

**Fix direction:** add a `LICENSE` for the project code (owner's choice, default MIT for a
portfolio), a `THIRD_PARTY.md` listing three.js 0.163.0 (MIT), Orbitron and Rajdhani (OFL) with
their upstream URLs, and a README credits line.

**Verification:** every vendored asset has a matching entry and licence file.

### 4.22 SBR-022 — mixed naming

**Observed:** “SCHIFFSBRUCH” title, “DOCKYARD” menu, “Werft” in prose and comments, English HUD.

**Decision:** keep the German title as the brand, use “DOCKYARD” as the single in-game term, and
remove “Werft” from user-visible strings (comments may keep it as flavour). Do not rename the
project or the repository.

**Verification:** grep for `Werft` in `index.html` and `js/game.js` returns no user-visible string.

### 4.23 SBR-023 — smoke writes into the repository

Covered by SBR-001's fix. The dump is diagnostic output, not a build artifact, and belongs in
`os.tmpdir()`.

---

## 5. Cheat mode / god mode — exact operating instructions

This is the answer to “wo kann ich den cheatmode aktivieren, also den godmode? STRG und welche
Taste nochmal?”.

**There is no Ctrl/STRG key involved.** The trigger is a two-key chord.

1. Start a run (`SET SAIL`). The chord is ignored in the menu, while paused, and while any modal
   is open.
2. Press and hold **H**, then press **C** while **H** is still down (or the reverse order — the
   check runs on every keydown while both keys are held). Default codes: `KeyH` + `KeyC`, stored in
   `localStorage` as `sb_dev_keys`.
3. The **DEV ACCESS** password dialog opens. Default password: **`admin`** (case-sensitive, stored
   as `sb_dev_pw`). Enter it and press **UNLOCK** (Enter also submits).
4. The **DEV CONSOLE** opens. In the `TOGGLES` group, tick **GOD MODE (no damage)**.
   Related toggles in the same group: INFINITE HP, NO RELOAD TIME, AIMBOT, AIM ASSIST, ENEMIES FIRE
   BACK.
5. Close with **ESC** or the ✕ button. The console also has **RESET ALL DEFAULTS** and
   **REBIND TRIGGER KEYS** (press two new keys within 15 seconds; timeout restores H+C).
6. The password can be changed at the bottom of the dev console (minimum 3 characters) and is
   stored in plain text in `localStorage`. This is a cheat console, not a security boundary.

**Known limitation to fix under SBR-018:** god mode currently blocks direct damage but not
flooding, so a sufficiently breached hull can still sink.

---

## 6. Invariants that fixes must not break

1. `js/core.js` imports nothing and runs in Node. No THREE, no DOM, no module-level mutable state.
2. `waveRaw()` in `core.js` and `W()` in the water vertex shader stay structurally identical
   (same seven terms, frequencies, phases). World height is always `waveRaw * WSCALE`.
3. Admin `TUNES` multipliers are applied last in every scaling chain (`eHP`, `eSpeed`, `eDmg`,
   `eFire`).
4. No allocations in the animate loop; reuse the module temporaries (`_a`, `_b`, `_mp`, …) and
   shared materials.
5. Zero build step and zero new runtime dependencies. Vendoring three.js is a relocation, not a
   dependency change.
6. Keep `index.html` IDs stable (`startBtn`, `hud`, `minimap`, `waveN`, …); smoke and CSS depend on
   them.
7. New fixes use the next free `FIX:` number after `#36` and update the counters in the same
   change.
8. All markdown and code comments stay English.

---

## 7. Verified control reference (source of truth for README)

| Input | Action | Code reference |
|---|---|---|
| W / S | Throttle / reverse | `keys.KeyW` / `keys.KeyS` in `updatePlayer()` |
| A / D | Rudder | `keys.KeyA` / `keys.KeyD` |
| Mouse move | Aim all turrets | camera rotation + `getAimPoint()` |
| LMB | Fire | `mouseDown` |
| 1 / 2 / 3, wheel | AP / MG / rocket pod | `switchWeapon()` |
| RMB hold / MMB | Zoom | `setZoom()` |
| E | Launch / recall drone; on the tactical map: cycle ship mode | `toggleDrones()`, `cycleSelMode()` |
| R | Damage control | `toggleDC()` |
| TAB | Dockyard | `openWerft()` / `closeWerft()` |
| I | Info card for the hovered shop card | `_infoHover()` |
| M | Tactical map | `toggleTacticalMap()` |
| F (map open) | Follow / hold selected ship | `toggleSelFollow()` |
| ESC | Close info → close dockyard → close dev → close map → pause | keydown handler |
| H + C | Dev console trigger | `DEVKEYS`, `openDevPw()` |
| `admin` | Dev password | `DEVPW` default |
| Touch | Joystick, FIRE, ZOOM, HUD slots for weapons/drones/DC | `initTouchUI()` |
| Touch (to be added) | DOCKYARD, MAP | SBR-003 |

---

## 8. Verification protocol

Because this shell has no `ls`/`head`/`tail`/`grep` and the npm launcher is broken, all commands are
run through `node` and must not be piped into missing utilities.

**Gate chain (run from the project root):**

```
node --check js/core.js
node --check js/game.js
node --check js/main.js
node --test tests/core.test.js
node tools/engine-scan.mjs        # new, SBR-015
node tools/id-audit.mjs           # new, SBR-011
node tools/smoke.mjs
node tools/gates.mjs              # new, runs the chain and prints PASS/FAIL
```

Expected: every command exits 0; `node --test` reports 124+ passing; smoke prints four PASS lines;
gates prints one line per gate.

**New audit helpers (small, dependency-free, checked in):**

- `tools/id-audit.mjs` — extracts `id="…"` from `index.html`, reports duplicates, extracts every
  `$('…')` and `getElementById('…')` from `js/game.js`, reports references with no matching ID.
  Current expected result after the fix: 0 duplicates, 0 missing.
- `tools/engine-scan.mjs` — reports calls to function names that are not defined locally, not
  imported from `core.js`, and not known browser/three.js globals. Maintain a small allowlist file
  for browser globals (`requestAnimationFrame`, `fetch`, …) rather than inline exceptions.
- `tools/counters.mjs` — generates the counters block (SBR-007).
- `tools/gates.mjs` — orchestrates the chain.

**Manual device matrix (required before sign-off):**

| Device | Viewport | Must pass |
|---|---|---|
| Desktop Chrome | 1920×1080 | Start, steer, fire all three weapons, open dockyard with TAB, buy an upgrade, open map with M, select a ship, survive to wave 2 |
| Desktop Chrome, 200 % zoom | 960×540 CSS px | HUD does not overlap; dockyard scrolls; no clipped buttons |
| Touch tablet emulation | 1024×768 landscape | Joystick + FIRE + ZOOM + DOCKYARD + MAP; upgrade purchase; map selection |
| Touch phone emulation | 844×390 landscape | Same as tablet; no rotate prompt in landscape; HUD readable |
| Weak GPU / SwiftShader | headless | Boot without console errors; frame time reported, no shader compilation errors |
| Offline | network disabled | Boot, menu, start wave 1 (after SBR-009/010) |
| Keyboard only | desktop | Start, fire, dockyard, map, close all modals with ESC |

**Evidence to record per fix:** before/after command output, the exact device/viewport for visual
fixes, and the `FIX:` number. No “it works” claims without an artifact.

---

## 9. Implementation order

**Phase 0 — restore the ability to verify (SBR-001, 002, 019, 023, 007)**
Fix the smoke write path, add `tools/gates.mjs`, `.gitignore`, remove root logs, add
`tools/counters.mjs` and the generated blocks. Nothing else can be trusted until smoke reports a
real result.

**Phase 1 — crash and state correctness (SBR-004, 005, 006, 018)**
`resetRunState()`, transactional `buy()`, cheat snapshot and ranked-run flag, god-mode flooding
decision. Add the corresponding unit tests for pure helpers and the engine scan.

**Phase 2 — mobile parity (SBR-003, 016, 017)**
Two touch buttons, input-mode hint text, accessibility attributes, zoom allowed, reduced motion.

**Phase 3 — offline and visual identity (SBR-009, 010, 011, 020, 022)**
Vendor three.js, self-host or replace fonts, fix the duplicate ID, cache the zoom class toggle,
remove user-visible “Werft”.

**Phase 4 — documentation and showcase (SBR-008, 012, 013, 014, 021)**
README rewrite with the verified control table and archive note, archive banners, plan generator
fix, error-report restructure, licence and third-party credits.

**Phase 5 — full verification and sign-off (SBR-015)**
Run the gate chain, the manual matrix, regenerate counters, and attach the results to the final
report.

Each phase is independently reviewable. Do not mix phases in one commit: a phase that changes
behaviour must not also regenerate documentation counters, so regressions can be attributed.

---

## 10. Non-goals

- No new gameplay systems, ships, weapons, bosses or maps.
- No difficulty or economy rebalancing; the current curve is the reference.
- No run save / persistent dockyard; high score only.
- No multiplayer, networking or replay.
- No framework, bundler, TypeScript migration or new runtime dependency.
- No art overhaul; only fixes that remove visible defects.
- No deletion of the archive HTML files (explicit owner decision).

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Fixing smoke reveals many console errors at once | Phase 0 looks stalled | Treat the first honest smoke run as the baseline; fix boot errors before adding assertions |
| Self-hosting Rajdhani does not remove the bbox warning | Font decision loops | Timebox to one attempt, then switch to a clean condensed face and document the change |
| Vendoring three.js drifts from CDN version | Shader/API mismatch | Pin 0.163.0, record the upstream URL and SHA-256 in `THIRD_PARTY.md`, never auto-update |
| Touch buttons overlap the HUD on small phones | New visual defect | Place them in the existing bottom safe area, test at 844×390 and 667×375 |
| God-mode flooding change alters normal balance | Unintended difficulty change | Gate the flood reset behind `TUNES.godMode` only; add a regression check that normal flooding is unchanged |
| Counter generator rewrites hand-written prose | Lost context | Only rewrite the marked block; the rest of each document is untouched |
| Fixes touch `game.js` while docs claim 110 markers | New drift | Run `tools/counters.mjs` as the last gate in every phase |

---

## 12. Acceptance checklist

- [ ] `node tools/gates.mjs` exits 0 and prints the real gate results.
- [ ] `node tools/smoke.mjs` prints four PASS lines, exits 0, and writes nothing into the repo.
- [ ] `node --test` reports 124+ passing tests.
- [ ] Duplicate-ID audit reports 0 duplicates; reference audit reports 0 missing IDs.
- [ ] Second run starts with base ordnance prices, a 30 s rocket reload and no stale rings.
- [ ] A failed purchase leaves the credit balance untouched and explains why.
- [ ] Cheat toggles are off after restart; a cheated run cannot become the best score.
- [ ] A phone in landscape can start, fight, upgrade and command the fleet without a keyboard.
- [ ] Cold boot with cache disabled produces zero console lines, including font warnings.
- [ ] The game boots and plays with the network disabled.
- [ ] README controls match §7 exactly; `B` is gone; `index.html` is named as the entry point.
- [ ] Archive files carry the “ARCHIVE SNAPSHOT” banner; the README explains them.
- [ ] `docs/plan.md` contains no `undefined` and has a non-empty feature map.
- [ ] `docs/error-report.md` has one `## OPEN` and one `## FIXED`, with every SBR ID once.
- [ ] Counters in README, PROJECT_MAP and `.clinerules/01` are identical and generated.
- [ ] `LICENSE` and `THIRD_PARTY.md` exist; every vendored asset is credited.
- [ ] God-mode instructions in README match §5, including “no Ctrl key”.
