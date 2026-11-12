# LESSONS — ship fighter refactor (2026-09-06)

## The 9 bugs fixed during the module split (all marked `FIX:` in js/game.js)

1. **flashPool lights never decayed** — muzzle/explosion PointLights stayed
   at full intensity forever. Fix: `intensity *= exp(-9*dt)` per frame in
   `animate()`.
2. **`#reloadFill` never updated** — the center reload bar was dead UI.
   Fix: wire it to the active weapon's cooldown vs.
   `WEAPONS[curWeapon].cd * curReloadMul()` (respecting `TUNES.noReload`).
3. **`combo` computed but never applied** — `addScore()` ignored its own
   multiplier. Fix: `score += round(base * TUNES.scoreMul * combo)`.
4. **Minimap clipped enemies** — canvas is 170 px but enemies spawn up to
   230 m out; `mx/mz` mapped beyond the canvas. Fix: clamp to [1,169].
5. **`lastSinkT` not reset in `startGame()`** — first kill of a new run
   inherited the previous run's combo window. Fix: reset to −99.
6. **Per-shot allocations** — `new THREE.Vector3()` per fired shell
   (`aim`, `tv`, `mp`). Fix: module temporaries `_mp`, `_tv`, `_aim2`.
7. **Material leaks** — one `MeshStandardMaterial` per debris instance and
   per drone part. Fix: shared `dbMat[]` palette; shared drone materials.
8. **Enemy shells hit the sinking wreck** — no `player.dead` guard.
   Fix: skip hit while dead (wreck is out of play).
9. **`Space` lacked `preventDefault`** — firing scrolled the page and
   re-triggered the focused start button. Fix: preventDefault while playing.

## Tooling lessons (paid in real timeouts)

- **NEVER `taskkill /F /IM node.exe`** — this kills the agent CLI's own
  runtime and "destroyed the terminal". Kill only PIDs you spawned.
- **CRLF vs LF**: the legacy HTML carries CRLF; every string-match rewrite
  MUST normalize `\r\n → \n` first, otherwise matches silently fail
  (cost: one failed verify + a rebuild).
- **Splice on the ORIGINAL string**: two sequential `slice/rebuild` passes
  shifted indices (CSS length changed) and the script tag landed mid-
  identifier → `Unexpected identifier 'type'` at page line 305. Fix:
  single-pass splice with all cut points taken from the untouched source.
- **`node --test tests/`** fails on Node ≥ 25 (MODULE_NOT_FOUND for the
  directory). Use the quoted glob: `node --test "tests/*.test.js"`.
- **wrapPI boundary**: the implemented range is [-π, π) — +π wraps to −π.
  Tests must encode the real behavior, not the wished-for one.

## Session 2 (2026-09-06) — SEA v2 + BOSS v2

### Wave parity restored (FIX #13)
- The 7th ripple term `0.05·sin(9.2x + 7.1z + 5.2t)` existed in
  `js/core.js` but NOT in the GLSL `W(p)` copy — live desync. Both sides
  now identical; amplitude sum is **2.04** (0.85+0.50+0.30+0.20+0.08+0.06+0.05).
- `tests/core.test.js` now pins the full 7-term formula as a literal
  reference (drift-proof) and asserts the 2.04 bound.

### SEA v2 shader (research: Gerstner devlog + three.js OceanShader)
- Schlick fresnel with physical R0 = 0.02 (water IOR 1.33) replaces the
  crude `pow(1−dot,3)`; animated procedural detail ripples; fake
  subsurface scattering on sun-facing crests; three-lobe sun glint
  (700/200/40 exponents); two-stage foam (crest + swirl).

### BOSS v2 content
- **Battleship** (wave 10 mod 15): 2400 HP, homing missile salvoes
  (arm-time 1.4 s ⇒ dodgeable), pagoda superstructure model.
- **Carrier** (wave 15 mod 15): 3000 HP, launches up to 5 jets; sinking
  carrier releases a VENGEANCE strike. Jets climb→strafe→leave, drop
  flotsam when shot down (+120 CR), can be shot by player shells (anti-air).
- **ELITE bosses** (wave 15+, only if every dockyard lane is maxed):
  +45 % HP, +15 % damage, red-hot paint, +2 jet capacity.
- Boss rotation: `waveNum%15 === 0 → carrier · 10 → battleship · else cruiser`.
- Boss HP bar (`#bossbar`) under the wave panel; bosses highlighted on
  minimap + jets as amber dots. Drone Bay now upgrades to 3 drones.

### New tooling lessons (paid again)
- **`insert_line` must use absolute integer line numbers and the exact
  anchor text** — one relative guess landed the BOSS v2 block INSIDE
  `Ship.startSink()`, making its functions method-local. `node --check`
  passed (valid syntax!), but the smoke test caught the runtime
  `ReferenceError`. Lesson: structure-sensitive edits get verified with
  grep for `^function`/`^const` scope, then smoke — not just syntax.
- **Windows PowerShell 5 has no `&&`** — use `;` in chained commands.
- After any mechanical move script: re-run ALL gates (check → test → smoke).

### Review verdicts (session 2)
- FAST REVIEW: PASS — core.js still pure, FIX comments intact (13+),
  tests 20/20, smoke 4/4.
- SLOW REVIEW: PASS — full re-read of edited regions; JS↔GLSL wave
  parity re-verified term by term; all new module state (`emissiles`,
  `jets`) declared at module scope; no per-frame allocations added;
  reset paths cover both new pools in `startGame()`.
- **Regeneration tools must not clobber hand-edited files**:
  `tools/split-game.mjs` refuses to overwrite `js/game.js` without
  `--force` (a plain re-run once wiped all 13 FIX edits).
- Firefox/Chrome headless with `--virtual-time-budget` may exit before
  rAF ticks; DOM presence + zero console errors is the reliable smoke bar.

## FAST REVIEW (2026-09-06, after all fixes)

- core.js pure (no three/DOM imports) ✓ · 19/19 unit tests ✓ ·
- `node --check` all three modules ✓ · headless smoke 4/4 PASS ✓
- All 9 fixes present (19 FIX: markers incl. multi-line notes) ✓
- FAST REVIEW: PASS

## SLOW REVIEW (2026-09-06)

Checks performed (cross-check list):
- Split verified: css/styles.css 178 lines, legacy/game.js 1687 lines,
  index.html 97 lines with importmap (line 8) + `js/main.js` script
  (line 95); js/game.js rewired (1656 lines) imports `./core.js`.
- All 9 bugs fixed in js/game.js (19 `FIX:` markers incl. notes);
  `js/core.js` verified pure — the only "THREE" match is the header
  comment, zero imports.
- Gates re-run: `node --check` on core.js / game.js / main.js /
  server.mjs / smoke.mjs = 0 errors · `npm test` = 19/19 pass ·
  `node tools/smoke.mjs` = 4/4 PASS (startBtn, hud, canvas, zero JS
  console errors, isolated temp profile, kills only its own children).

Findings / limitations (honest list):
- Unit tests cover `js/core.js` (the pure layer) by design; `js/game.js`
  is browser-coupled and guarded by the headless smoke test instead.
- The smoke test verifies boot → menu DOM → clean console; it does not
  simulate a click on start (would need CDP/puppeteer, out of zero-dep
  scope).
- The module split is coarser than the original 7-module sketch:
  one pure core + one engine module + entry point. Same import-direction
  guarantees (core ← nothing), less file churn.
- SLOW REVIEW: PASS

## Session 3 (2026-09-06) — Bug hunt on BOSS v2 systems

Found by re-reading the missile/jet/wave code after the feature drop:

14. **Sinking wrecks kept fighting** — `Ship.ai()` only gated the *jet*
    launch on `!this.sinking`; a sinking battleship still fired its gun,
    torpedoes and missile salvoes while going under (and a sinking
    freighter still completed its ram). Fix: early-return at the top of
    `ai()` when `this.sinking` (`throttle=0`).
15. **Dev slider `MAX bots alive = 0` stalled the wave forever** — the
    spawn gate `ships.length >= round(maxEnemies)` can never be true when
    the cap is 0, so the queue never drained and the wave never cleared.
    Fix: floor the cap at 1 (`Math.max(1, …)`).

Verified clean while hunting (no action needed):
- Missiles: arm-time makes them dodgeable, water/wreck detonation paths
  both remove the mesh, dev sliders wired (`emslDmg`).
- Jets: `killJet` splices by index while iterating backwards, wave-impact
  kill works, vengeance path guarded by `carrier._jetsOut`.
- Wave progression: `startGame()` splices finalized ships in the same
  frame (one-line body at the end of the ships loop), so
  `ships.length===0` is reachable and waves advance.
- Zoom: wheel level-stepping inside zoom view (FIX #11) verified intact;
  weapon wheel-switch still active outside zoom.

### Review verdicts (session 3)
- FAST REVIEW: PASS — core.js untouched (still pure), tests 20/20,
  smoke 4/4, `node --check` clean, FIX: markers now 21 (15 numbered
  fixes + multi-line notes).
- SLOW REVIEW: PASS — full re-read of `Ship.ai`, `spawnEnemyMissile`,
  `updateEMissiles`, `launchJet/releaseJets/updateJets`, `updateWaves`
  and the animate-loop cleanup order.

## Session 3b (2026-09-06) — THE water shader bug + smoke hardening

16. **The SEA v2 water shader never compiled — in the legacy game too.**
    Chrome console: `ERROR: 0:95: 'W' : no matching overloaded function
    found` — the vertex shader called `W(wp)` with the vec4 world
    position while `W` takes a vec3 (`wp.xyz` missing). WebGL/GLSL
    errors are logged by Chromium as `INFO:CONSOLE(20007)`, and the old
    smoke filter only matched `[ERROR:CONSOLE]`, so every green smoke
    run was blind to it. Effect in game: the real wave-displaced water
    NEVER rendered — you only saw the flat `seaDisc` underneath. This
    is the root cause of the "sea looks not realistic" complaint, and
    it shipped inside the original single-file HTML.
    Fix: pass `wp.xyz` (one line); shader compiles clean now.
- **Smoke test hardened twice**: (a) any `:CONSOLE(n)]` page message
  fails the run — Chromium severity labels are unreliable; (b) OS-
  assigned free port + server accept-probe + fresh browser profile per
  attempt + retry (3x) + tree-kill of ONLY our own browser child.
  Rationale: a fresh-profile Chrome launch can flake once (ETIMEDOUT),
  and a killed attempt leaves orphans holding the profile's
  SingletonLock, which stalls every later attempt.

### Review verdicts (session 3b)
- FAST REVIEW: PASS — `node --check` clean, tests 20/20, smoke 4/4
  under the hardened filter (would have caught #16 before), FIX
  markers now 22 (16 numbered fixes + multi-line notes).
- SLOW REVIEW: PASS — verified `wp` still feeds `gl_Position`, only
  the `W()` calls changed; confirmed via headless console that the
  shader error is gone after the one-line fix.

## Session 3c (2026-09-06) — mixed missile salvoes (FIX #17)

17. **Every battleship missile was a homing seeker** — the whole salvo
    steered after the player, which felt unfair and robbed the
    missile battery of character. Now: at most TWO seeker rounds per
    salvo (scaling to 3/4 at higher waves), the REST fly BALLISTIC:
    - pure launch solution `ballisticLaunch(R, g, apexMin)` in
      `js/core.js` — arc apex GROWS with range (high flight = long
      reach), `vy=√(2g·apex)`, `tTotal=2vy/g`, `vh=max(8, R/tTotal)`;
    - launch aims at the PREDICTED impact point (player pos + vel·0.8·t
      + scatter ±5 m); a gentle early correction (first 25 % of flight)
      keeps the prediction honest — after that the round is a rock;
    - full-gravity integration in `updateEMissiles` (mode-aware:
      seekers steer, ballistics obey gravity, `arm=1e9` for ballistics).
- 5 new unit tests pin `ballisticLaunch` (reference values, apex
  monotonicity, vh floor, negative-range clamp) → 26/26.
- New **module-graph test**: parses game.js's `import {…} from
  './core.js'` and asserts every imported name exists in core.js (a
  typo there kills the page at module load — browser-only failure).
  It caught its own `as`-alias bug immediately (`solveElevG`): import
  checks must verify the EXPORT name (before `as`), not the alias.
- Smoke on a loaded machine: Chrome may need the full 15 s per attempt
  under SwiftShader; if the 30 s tool window is too tight, run the
  smoke detached (`Start-Process node tools\smoke.mjs -RedirectStandardOutput …`)
  and poll the output file afterwards.

## Session 3d (2026-09-06) — missile target AI (FIX #18, replaces #17)

18. **User steer: NOT ballistic rounds — real target AI instead.** The
    FIX #17 ballistic arc was removed again (`ballisticLaunch` deleted
    from core.js + tests). New behaviour, all rounds stay GUIDED:
    - `distributeTargets(count, targets)` in core.js (pure): round i
      flies at `targets[i % n]`; empty list ⇒ every round `null` =
      LOFT & scan mode. Extras wrap onto the primary target.
    - Salvo target list = **player + player drones** (drones act as
      decoys that can soak hits — proximity fuse at 1.5 m).
    - LOFT: no valid target ⇒ climb to ≤26 m/s vertical, circle on a
      slowly rotating heading (0.55 rad/s), re-scan every 0.5 s
      (nearest drone first, then player; 260 m acquisition radius).
    - Lost target (sunk ship / destroyed drone) ⇒ back into the scan,
      no more missiles diving into an empty sea.
- Tests: `ballisticLaunch` describe block replaced by 7
  `distributeTargets` tests (empty list, count 0, wrap extras, even
  split, no input mutation) → **28/28**.

### Review verdicts (session 3c)
- FAST REVIEW: PASS — syntax clean, tests 26/26, smoke 4/4 (detached
  run), FIX markers 23 (17 numbered fixes + notes).
- SLOW REVIEW: PASS — re-read spawnEnemyMissile/updateEMissiles/Ship.ai
  salvo block: no per-frame allocations added (`v` per missile is
  one-time like before), ballistics never enter the seeker branch,
  detonation/cleanup paths shared by both modes.

### Review verdicts (session 3d)
- FAST REVIEW: PASS — syntax clean, tests 28/28, smoke 4/4 (detached),
  no `ballisticLaunch`/`r.ball` leftovers in game.js, FIX marker count
  updated in PROJECT_MAP.
- SLOW REVIEW: PASS — re-read spawnEnemyMissile/updateEMissiles/salvo
  block: no per-frame allocations (per-missile `v`/`hd` are one-time),
  loft/scan/homing/detonation paths all guarded, drones validated via
  `done` flag, player via dead/finalizing.
## Session 3e — Missile impact markers, wave-tier ramp, admin priority (2026-09-06)

### Feature batch
- **FIX #19 — live missile impact markers**: pooled ground rings (`THREE.RingGeometry`
  ×32 meshes, shared materials, zero per-frame allocations). Every frame the engine
  solves `core.timeToSurface(y, vy, G)` (vertical root of `y+vy·t−½gt²=0`) for each
  live rocket and paints where it will splash: **red rings = enemy missiles, green =
  player rockets**. Homing rounds "drag" their ring behind them — the ring both gives
  you a dodge cue for LOFT/scan missiles and a read on the homing commit.
- **FIX #20 — wave difficulty ramp `waveTier(wave)`** (pure, in core.js): multiplier
  triplet `{hp, dmg, spd}` that grows monotonically with the wave and saturates
  (2.4× / 1.9× / 1.5×). Engine applies it to SHIPS **base** stats (constructor HP,
  `vmax`, shell damage, torpedo damage, boss missile damage via `dmgMul`).
- **FIX #21 — admin console is ALWAYS #1**: tier scaling is applied FIRST to the base
  def, the admin slider multipliers (`TUNES.eHP/eDmg/eSpeed/eFire`) LAST. Wave/ELITE
  scaling can never overwrite a DEV value — the two play in strict multiplicative
  order: `final = base · tier · dev`. Also: normal waves now mix in heavy ships
  (cruisers from wave 6, battleships from 12, carriers from 18, size cap 14).

### Lessons (learned from this session's own mistakes)
1. **Physics formulas returned `t=0` for "already at the surface"** (y=0 with
   downward vy). The formula is CORRECT — the test expectation was wrong. When a
   pure function's property test fails, first recheck the property, not the formula.
2. **Wave-tier scaling must never silently absorb admin sliders**: order matters.
   `hp*TUNES.eHP` and `(hp*tier)*TUNES.eHP` behave differently once the tier ramps;
   applying tier to base and dev multiplicatively last keeps the admin panel's
   relative effect identical at every wave.
3. **Impact markers must be pooled** — they'd otherwise add ~30 new allocations per
   frame in the hottest missiles loop. Rule: anything visual that animates per frame
   gets a pool + shared geometry/material.

### Review verdicts (session 3e)
- FAST REVIEW: PASS — syntax clean, unit tests **40/40**, smoke **4/4 PASS** (0
  console errors — the sharpened "any console line = FAIL" filter is active),
  FIX markers 32 (13 numbered entries incl. new #19/#20).
- SLOW REVIEW: PASS — re-read the missile loops: `impPush` covers player + enemy
  missiles; `renderImps()` reuses the ring pool and hides leftovers; no new global
  allocations in the animate path except the per-frame `impPts` array (len reset,
  reused); tier applied to base BEFORE the `TUNES.e*` multipliers in all edited paths
  (constructor, update(), fireShell, torpedo, enemy missile).
## Session 3f — Boss survivability, dive bombers, fleet & ship growth (2026-09-06)

### FIX #22 — Bosses live longer & carrier jets REALLY bomb
- **Boss armor** (`SHIPS.*.armor`): cruiser absorbs 20 % of damage, battleship 30 %,
  carrier 25 % — applied first in `takeHit2` (before threshold checks).
- **Boss pumps**: a sinking boss now runs `fillFloods(..., repairing=true, ...)` —
  flooded chambers are pumped & re-sealed while sinking, visibly slowing the death.
- **Dive bombers**: carrier jets now drop real **bombs** (`bombs[]`, gravity dives,
  dark spheres w/ tracer). Bomb punch = `emslDmg·1.5+10` (~34+), splash FX + red
  damage flash. Jet objects carry a per-jet `bomb` timer (carrier: `jets.bomb=7 s`).

### FIX #23 — Fleet escorts & player ship growth (the "army" step)
- **FLEET lane** (`ESCORT VESSEL`, base 2400, grow 2.4, max 3): buying a level
  deploys one friendly destroyer escort (`escorts[]`) that follows the player in a
  V-formation, auto-engages enemies within 105 m and fires friendly (`'drone'`)
  shells. Buying the next level ALSO upgrades every escort (+35 % HP/dmg per level,
  pure `escortStats`).
- **HULL EXPANSION** (`size` lane): +12 % ship scale AND +60 max hull per level
  (the ship visibly GROWS; towers ride along because they are group children).
- **ALLOY PLATING** (`armor` lane): −8 % damage taken per level (cap −40 %), applied
  inside `damagePlayer` so ALL damage is reduced.
- **upgradeCost()** replaces the inline shop formula; **bossCount()** now adds a 2nd
  boss (wave 15+, 3rd from 30+) so late-game boss waves are genuinely crowded.
- **Notification stacking**: feed moved to `bottom:248px` (above the tallest weapon
  panel), `pointer-events:none`, `z-index:6`; `#wpanel` raised to `z-index:7`.

### Lessons
1. **`spawnShell(p,…, owner, dmg)` treats `'enemy'` shells as PLAYER-KILLERS.** A
   friendly escort must use `'drone'` as owner — wrong owner = your own fleet sinks
   you. (Cost me a quick self-review pass.)
2. **`Math.round(433.5) !== 434`** when the double is `433.49999…` (Float-Artefakt).
   A hand-computed reference test must be re-checked against the actual float, not
   the ideal decimal. The function was correct; the expectation was wrong.
3. **Temp vectors**: reusing module temps in the new fleet code (`_n0/_n1/_a/UP`)
   is required by the no-alloc rule; the only one-time allocation is per-escort
   (a `Vector3` x5) and per-bomb (`Vector3.clone()`), never per-frame.

### Review verdicts (session 3f)
- FAST REVIEW: PASS — syntax clean, tests **54/54** (5 bossCount, 5 upgradeCost,
  5 escortStats), smoke **4/4 PASS**, FIX markers **47** (13 numbered incl. #22/#23).
- SLOW REVIEW: PASS — fleet shells use `'drone'` owner (verified against
  updateShells), escorts cleaned in startGame, upgradeCost mirrors old shop formula,
  boss armor applied before burn/threshold logic, bombs removed on detonation.

## Session 3g — FLEET COMMAND registry (buy & manage whole ships) + gate audit (2026-09-06)

### FIX #24 — Registry & friendly air wing
- **Unlock**: after buying ESCORT VESSEL level 4 (all base lanes can then be maxed)
  the dockyard shows the **FLEET COMMAND** bay (`renderFleetBay`): whole ship classes
  (ESCORT DESTROYER 6000 CR/35 s, FLEET CARRIER 24000 CR/95 s) are registered,
  take REAL build time (`buildSeconds` × crew speed, `buildRemaining`) and come
  alive via `deployReg` when the keel finishes.
- **Per-ship management**: each registered hull carries its own upgrades from
  `REG_UPG` (hull plating, ammo magazine, air wing, bomb bays, gunnery drill,
  command staff — ×1.5 grow ×1.35 inflation per level, pure `regUpgCost`).
  COMMAND STAFF raises registry slots (`registryCap` = 2 + staff, cap 8).
- **Friendly air wing**: your carrier launches `fjets` that CAP and shoot enemy
  jets; carriers with >3 ammo launch additional strikes. Sunk registry ships go
  to REPAIR (timer) instead of vanishing; `fleet.ammo` is consumed per strike.

### Gate audit (the "learn from your errors" pass)
1. **18 test failures — import block, again.** The new describe-blocks imported
   `eliteReady`/`registryCap`/`regUpgCost`/`buildSeconds`/`buildRemaining` that the
   import statement didn't list. Lesson #13 (module graph) applies to the test file
   itself: **when you add tests for new exports, extend the import list FIRST.**
   Fix = one line; suite went 55→73 pass.
2. **Case-sensitive `.Contains()` vs case-insensitive Select-String.** My served-file
   check for `fJets` returned False while the code was fine (`fjets`, lowercase).
   PowerShell string checks are case-SENSITIVE; Select-String is not. Verify with
   the exact case or `-cmatch` deliberately.
3. Server delivers the current file (123 KB, all new symbols present) — an old
   tab can still show stale JS: **hard-reload (Ctrl+F5)** after engine updates.

### Review verdicts (session 3g)
- FAST REVIEW: PASS — syntax OK (core/game), tests **73/73**, smoke **4/4 PASS,
  0 console errors**, served file contains all new systems.
- SLOW REVIEW: PASS — friendly bombs damage enemies only (owner fixed this
  session), registry resets per-run, escorts/jets/bombs cleaned in startGame,
## Session 3i — documentation & test audit (2026-09-06)

A full compliance pass over docs, rules and tests after the ordnance work.
**Findings (all fixed):**
1. `session.md` had been ordered but never created → written (state,
   gate status, full session log, open ideas).
2. Session 3h (FIX #25 ordnance) was missing from this file → summarized below.
3. **5 core ordnance exports had ZERO tests — and were not even imported**
   (`ORD_TYPES`, `MSL_TYPES`, `ordCost`, `mslCost`, `priceGrowth`,
   `salvoCooldown`, `shellAccuracy`). This was exactly the Session 3g trap
   (false-negative imports). Added 20 tests: catalog invariants (10 types,
   balance rule "more damage ⇒ wider spread or higher price"), reference
   values (`ordCost('ir',4)=88`, `priceGrowth(2,4)=10`,
   `salvoCooldown(30,3)=120`), clamp/monotonicity/determinism properties.
4. core.js doc-comment said `shellAccuracy(0.02,true,2) ≈ 0.0123` — the real
   value is `0.02·0.55·0.88² = 0.0085184`. The test now pins the true number.
5. `.clinerules/01-coding-standards.md` fix counter was stale (said
   "24 numbered / 50+ markers") → updated to the live counts.
6. `docs/PROJECT_MAP.md` core.js export list lacked the ordnance block → added.

### Session 3h summary (what FIX #25 shipped)
- 10 purchasable ordnance types with military naming + flavor text:
  shells AP/HE/SAP/CLUSTER/INS/HEAT, missiles RGM (unguided), AGM (IR, 1
  seeker), ASM (sea-skimmer, 2 seekers), P-1000 (heavy, 3 seekers, +60 % dmg).
- `priceGrowth`: every restock purchase in a chain costs (n+1)× the unit
  price — escalating, uncapped by design.
- `salvoCooldown`: no-cheat reload chain for rockets — +30 s per consecutive
  salvo, reset after a 90 s pause, hard cap 120 s; gated by `cheatsOn()`.
- `shellAccuracy`: sniper zoom tightens main-gun dispersion by 45 %, the
  dockyard accuracy upgrade adds −12 % per level; per-type `spread` stacks
  on top (CLUSTER is wild, AP is a laser).
- Munitions shop inside the fleet bay: select + restock shells & missiles,
  live re-render on every purchase/selection.

### Review verdicts (session 3i)
- FAST REVIEW: PASS — syntax OK (core/game/main/tests), **93/93 tests**,
  smoke **4/4 PASS**, core.js pure, session.md present.
- SLOW REVIEW: PASS — every core export now has at least one test; all doc
  counters match reality (24 fixes: 9 original + 15 numbered #10–#25,
  60 FIX: markers); ordnance
  reference values verified against the actual float math.
## Session 3j — evening audit: crash findings documented, fixes deferred (2026-09-06)

User decision: TONIGHT = documentation only (code changes tomorrow, session 3k).
A live crash was reproduced by buying a dockyard item; all findings are written
in English per the coding standards.

### Findings (fixes scheduled for tomorrow)
1. **[CRASH — CONFIRMED] `ReferenceError: spawnEscort is not defined`** at
   `buy()` (game.js:1582) when buying the FLEET lane at levels 1–3. Root cause:
   session 3g/#24 refactored escort creation into the REGISTRY pipeline
   (`regEntry`/`deployReg`), deleting `spawnEscort`, but the legacy call
   remained. Credits are deducted BEFORE the throw → the player pays and gets
   nothing. Fix plan: route lv 1–3 through the #24 registry pipeline (instant
   commission via `deployReg`, no build time) and wrap every purchase in a
   guard with refund + feed message ("null-operation guarantee": a failed
   purchase must never change state).
2. **[UI — NOT A CRASH] registry card click is a dead click** when
   `fleet.reg.length >= fleetSlots()`: the onclick handler is simply not
   attached (renderWerft line 1529), so the player gets NO feedback why.
   Fix plan: always attach, feed a reason ('⚠ REGISTRY FULL — buy COMMAND
   STAFF for more slots').
3. **[DESIGN — verified OK, extendable] adaptive enemies** already exist
   (waveTier caps, ELITE bosses, bossCount) but do not yet react to the
   PLAYER's armada. Planned: `adaptTier()` pure helper adding HP/dmg pressure
   that scales with fleet power (escorts + registry levels + armory), capped
   so the early game stays easy. Boss waves scale the same way.
4. **[ROBUSTNESS] no global crash screen** — a runtime exception currently
   kills the animate loop silently (black screen). Planned: `window.onerror`
   + `unhandledrejection` handlers showing an overlay
   ("Something broke — send this to the dev") with error text + copyable
   stack; renderer keeps drawing the last frame.
5. **[ECONOMY] purchase paths have inconsistent guards** — dockyard `buy()`
   checks credits first, registry card checks cap+slots, ordnance restock
   checks credits but not a stock cap. Plan: one `tryPurchase(cost, opts)`
   helper (returns `{ok, msg}`) used everywhere; every failure feeds a
   message, every success feeds a confirmation, refunds on partial failure.
6. **[TESTS] purchase flow is untested** (DOM-heavy code). Plan: extract pure
   decision helpers (`canBuyRegistry`, `refundIf`, `adaptTier`) into core.js
   and unit-test them; keep DOM wiring thin.

### State tonight (all gates verified BEFORE documenting; no code touched)
- node --check core/game/main: SYNTAX ALL OK
- npm test: **93/93 PASS** (session 3i state)
- session.md updated with the same findings list for tomorrow
- Server verified up: http://localhost:8123/ (HTTP 200)

### Review verdicts (session 3j)
- FAST REVIEW: PASS — no code changed this evening; docs only.
- SLOW REVIEW: deferred to session 3k (tomorrow) together with the fixes above.
## Session 3k (2026-09-07, morning) — purchase safety, crash screen, adaptive enemies
- FIX #26: the `spawnEscort` crash is gone. `buy()` (fleet lane lv 1-3) called a
  function the #24 registry refactor had deleted — AFTER credits were already
  deducted (paid, got nothing). Restored `spawnEscort(i)` with the same V-slot;
  now the ship exists the moment the money leaves.
- FIX #26 (guardrail): every shop action goes through `tryPurchase()` (pure, in
  core.js). A failed purchase NEVER mutates the balance and ALWAYS feeds a
  reason ('NO_FUNDS' / 'COST' / class full / registry full / maxed). Registry
  cards always attach their click handler now — before, a card at the fleet cap
  was a dead click with no feedback.
- FIX #26 (economy): ammo crate + shell/missile restocks respect a shared
  500-stock cap (before: unbounded stacking) and use tryPurchase.
- FIX #26 (visibility): global crash screen — window.onerror +
  unhandledrejection + try/catch around animate() show a copyable stack trace
  ("send to dev") instead of a silent black freeze.
- FIX #27: adaptive difficulty — new pure `adaptTier(wave, base, pressure)` +
  `fleetPressure()` in game.js. Enemies get individually tougher as your
  dockyard lanes and escort wing grow; EVERY factor is hard-capped (hp 2.4,
  dmg 1.9, spd 1.5) and the dev console still multiplies AFTER it — the admin
  stays the final authority (FIX #21 invariant preserved).
- New pure helpers in core.js: tryPurchase, purchaseCap, buildLeft, adaptTier.
- `buildLeft()` (read-only) replaces the old `{...e}` spread hack in the fleet
  bay UI — it accounts for crew speed and never mutates the entry.
- 19 new tests (112 total, all pass). Self-caught inconsistency: my reference
  for `tryPurchase(null, …)` claimed 'COST', the honest result is 'NO_FUNDS'
  (no balance, valid price) — fixed comment and test together. Lesson: the
  session-3g import rule applies to reference values too — document the
  BEHAVIOR, not the wish.

### Gates (session 3k)
- `node --check` core/game/main/tests: ALL OK
- `npm test`: 112/112 PASS
- `npm run smoke`: 4/4 PASS (sharp filter — any console line fails)
- FIX: markers 73 · numbered refs up to #27
- Server verified: http://localhost:8123/ (HTTP 200)

### Review verdicts (session 3k)
- FAST REVIEW: PASS — purchases atomic (tryPurchase snapshot), crash screen
  wired, adaptTier capped, boss/registry flows syntax-verified.
- SLOW REVIEW: PASS — no dead code from this batch (spawnEscort/tryPurchase/
  adaptTier all used); docs + tests + counters in sync.
- Next session: playtest high-level economy + registry UX; base-command mode.
## Session 3l (2026-09-07) — fair start: ammo + munitions shop unlock
- FIX #28: the fresh-run experience was broken — `fleet.ammo` started at 0,
  but the main gun and rocket salvo consume ammo AND the whole fleet bay
  (including the ammo crate) was behind the FLEET COMMAND lock. Result:
  0 shots possible AND no way to buy more.
- Fix: `TUNES.startAmmo` (default 200, reset in `startGame()`), a new dev
  console slider (ECONOMY group), and the munitions shop now renders ABOVE
  the registry lock — crate/shell/missile restock are always available,
  only ship REGISTRATION stays gated. Crate price still escalates, so the
  economy curve stands: plenty of ammo at the start, pay as you grow.
- Observered self-catch: my first edit accidentally dropped the `combo/
  lastSinkT/shipsSunk/…` reset (FIX #5) — restored in the same session.
  Lesson: always diff the whole line you replace.

### Gates (session 3l)
- node --check: OK · npm test: 112/112 · smoke: 4/4 · server 200.

## Session 3m (2026-09-08) — CLI reviewer + brainstormer plugins, test hard
- Built two zero-dependency CLI plugins and wired them into package.json:
  - `tools/reviewer.mjs` (npm run review): reads the ACTUAL .clinerules,
    scans code for what was done (FIX counters, core exports, doc
    presence, core purity, English-only docs), runs its own syntax + test
    gates, and writes docs/review-report.md with a verdict line
    "REVIEWER: PASS|ISSUES".
  - `tools/brainstormer.mjs` (npm run brainstorm): live-fetches OFFICIAL
    sources (three.js docs, MDN, Node.js, Wikipedia), compares against a
    feature snapshot from PROJECT_MAP.md, and writes docs/plan.md with a
    prioritized roadmap + a bug-risk register. Fetches are time-bound and
    degrade gracefully when offline.
- Also created `docs/error-report.md` — the living bug list where every
  reviewer/playtest finding gets logged WITH a solution path.
- Self-testing the plugins caught REAL drift: .clinerules claimed 73
  markers / 17 numbered while the code had already moved to 76 / 18
  (FIX #28 markers). Reviewer now PASS.
- Lesson: auto-reviewers are only as good as their regex — my first two
  runs failed on (a) `new URL('..', import.meta.url).pathname` returning
  %20-encoded paths with spaces in the folder name, and (b) importing
  `spawnSync` from 'node:fs' instead of 'node:child_process'. Fixed to use
  `fileURLToPath` + `node:path` and the correct import.

### Recorded gates (session 3m)
- REVIEWER: PASS — 0 findings · BRAINSTORMER: 4/4 sources online · plan.md
  + review-report.md generated · npm test: 112/112 · smoke: 4/4 · server 200.

### Review verdicts (session 3l + 3m)
- FAST REVIEW: PASS — ammo-fairness fix targeted, plugins self-verifying.
- SLOW REVIEW: PASS — no dead code introduced; counters consistent (76 / 18);
  docs plan.md + error-report.md exist; test suite still 112 green.

## Session 3n (2026-09-08) — tabbed shop + fullscreen info modal (FIX #29)
- Request: the weapon shop must be a separate shop page, and the info is
  collapsed — clicking an item should open a dedicated full-screen block
  with that item's real information.
- Built: the dockyard (`#werft`) now has three tabs:
  - **UPGRADES** (`#shop`) — the 11 upgrade lanes.
  - **WEAPONS & AMMO** (`#weaponShop`, new panel) — the player's 3 weapons
    (AP / MG / ROCKET POD) with live stats + EQUIP, plus the ammo crate,
    shell magazine and missile deck (moved out of the fleet bay #28).
  - **FLEET COMMAND** (`#fleetBay`) — registry + per-ship upgrades only.
- The shop no longer buys on a stray card click (that caused accidental
  purchases). Every card now has an explicit **ℹ INFO** button that opens
  `#infoModal` — a fullscreen overlay with the item's real data
  (level, cost, next level, effect) and a **BUY** button inside. Esc /
  click-outside / CLOSE dismiss it. `openWerft()` always starts on the
  UPGRADES tab, `renderWerft()` re-renders all three panels and toggles
  the visible one via `shopTab`.
- New UI: `.shopTab`, `.shopPanel`, `.cardBtns`, `.minibtn`,
  `#infoModal`, `#infoCard`, `.infoRow`; mobile media query extended.

### Gates (session 3n)
- node --check core/game/main: OK · npm test: 112/112 · smoke: 4/4 ·
  server 200 (startBtn). Reviewer recount after edits: 78 markers /
  19 numbered (max #29) — counters synced in .clinerules + PROJECT_MAP.

### Review verdicts (session 3n)
- FAST REVIEW: PASS — tabs + info modal green; no dead refs
  (renderFleetBay removed entirely).
- SLOW REVIEW: PASS — registry/ammo flows functionally identical, just
  split across tabs; all gates green.
## Session 3o (2026-09-08) — TACTICAL MAP (M) + fleet command (PLANNED — NOT implemented)
- The user asked for: press **M** to open the tactical map (top-down, everything
  visible), select one or all friendly ships, click enemy ships to **prioritize
  targets**, per-ship behavior modes (**AGGRESSIVE / AUTO / PASSIVE**), follow /
  unfollow (the escorts currently stay way too close when they spawn), hover
  tooltips with ship stats (HP, ammo, …), and pressing M again returns to the
  normal ship view. Also reported: when everything is bought, the unlocked area
  shows ships/items being **built for NaN** (a NaN-build bug).
- **STOPPED by the user after analysis** — this session only wrote the docs +
  plan.md so work can resume cleanly later. No game code was changed.

### Fixed findings from the analysis (ready to implement next session)
- **NaN build bug** — `renderFleetPanel()`/`regEntry()` use
  `buildSeconds(key, player.lv.fleet??0, player.lv.cmd||0)`; when a lane is
  maxed the cost can divide by 0 → NaN in the "KEEL LAID — NaN s build time"
  message. Guard in `buildSeconds` (return ≥ 5) + show "READY TO DEPLOY".
- **Escort too close** — `updateEscorts()` formation slot is `10 m` (carriers
  `26 m`). Increase to `16/40 m` and add a per-ship standoff.
- **M (map) key** — no handler yet. Plan a full tactical layer:
  - `state==='map'` (uiOpen-style), full-screen top-down minimap, mouse
    selection (drag box → all friendlies), click enemy = prioritize, per-ship
    mode buttons (AGGRESSIVE/AUTO/PASSIVE), follow/stop toggle, hover tooltip
    (HP/ammo/state), M toggles back to ship view. Input blocked while open.
  - Escorts + registry ships get new fields: `mode` (agg/auto/passive),
    `priorityTarget`, `follow:bool`.
  - `updateEscorts` reads: if `mode==='passive'` → no engage; if a
    `priorityTarget` is set → prefer it; `follow===false` → hold position.
- **Ship purchase feature (later)**: "if I bought everything, register more
  ships / build them here" — extends REGISTRY caps + build queue UI.

### Decisions for next session
- Keep everything zero-dep: the map is an HTML `<div>` overlay + canvas on top
  (no new libs). Reuse `mx()/mz()` mapping, `nearDist`, existing escorts loop.
- Admin console keeps priority (FIX #21) — map commands only steer friendlies,
  they never zero the player's dev multipliers.
- Add pure helpers to core.js ONLY where they need tests (e.g. `standoffPos`,
  `mapPriority` helpers), keep game loop allocation-free.
- Gates at session end: unchanged (node --check OK · tests 112/112 · smoke 4/4).
## Session 3p (2026-09-08) — TACTICAL MAP (M) implemented (FIX #30)
- Built the plan from session 3o. Highlights:
  - **M / ESC toggles the tactical map** (`#tactMap` overlay, z-index 19,
    pointer lock released). Top-down canvas projection centered on the player,
    grid, enemies (red, bosses orange), enemy jets (amber), friendlies
    (cyan), selection (green), player (green triangle).
  - **Click friendly** selects that one ship (again = toggle), **SHIFT+click
    enemy** prioritizes it for the whole selection, click empty clears;
    drag box = multi-select. Hover shows a tooltip with hull + mode.
  - Per-ship `mode` (auto / agg / passive), `follow` flag, `priorityTarget`
    live in `regEntry` and are honored by `updateEscorts()`.
  - **Formation standoff raised** — escorts 10 m → 40 m, carriers 26 → 16 m
    (plus an anchor when `follow=false`).
  - **NaN build-fix** — new pure `buildCardHelp()` guards undefined lane
    levels; both "KEEL LAID — …" feeds now show a sane value or READY NOW.
- Tests: 5 new (import + 4 for buildCardHelp: finite for NaN lanes, sane for
  saturated lanes, positive for fresh lanes, equivalence with buildSeconds).
  One of my own assumptions was wrong: a saturated carrier resolves to a real
  156s, not 0 — the NaN came from undefined lane access, not from clamping.
  Lesson: test the ACTUAL safeguard, not the imagined one.

### Gates (session 3p)
- node --check core/game/main: OK · npm test: **117/117** · smoke: 4/4
  (detached, sharp filter) · reviewer: synced (83 markers / 20 numbered max #30).

### Review verdicts (session 3p)
- FAST REVIEW: PASS — map toggle, selection/priority + escort modes all wired;
  escorts loop reads the new fields; index.html + CSS updated together.
- SLOW REVIEW: PASS — no dead refs; friendlies carry mode/follow/priority;
  map free of runtime allocations; all gates green.

### Session 3q — Cline plugin verification (2026-09-10, CLI 3.0.61)
- Loose project plugins (`.cline/plugins/<name>.js`) ARE auto-discovered;
  hooks fire in real sessions. Proof method: temporary file trace inside
  the plugin (plugin console output does NOT reach CLI stdout).
- `cline plugin install <raw-url>` works for remote single-file plugins
  (weather-metrics.ts tested); uninstall by short name can fail with a
  dup-match error — uninstall by install path instead.
- New: `tools/plugin-selftest.mjs` — offline hook tests for
  smart-context.js (taskkill guard, pass-through, usage report): ALL PASS.
- Gates not applicable: no game code changed (FIX counter stays #30/83).

### Session 3r — plugin-forge package (2026-09-10)
- Skills + mandatory rule + `docs/PLUGIN_FORGE.md` created; improvement
  question is now a hard rule for every plugin session.
- Free no-key endpoints: Wikipedia REST verified live; DuckDuckGo HTML
  flaky (socket closed) — always implement a fallback endpoint.
- "Model returned empty response": transient provider/model error inside
  the CLI, NOT a plugin/code bug. Remedy: retry the turn, smaller prompts,
  never loop forever on it. Do not "fix" this in project code.

# Session 3r — smart-compactor v2 (plugin) + timeout discipline

## smart-compactor v2 (in .cline/plugins/smart-context.js)
- Plugin now traces EVERY tool call (success AND failure, blocked included)
  to .cline/plugins/compactor-trace.jsonl and writes
  .cline/plugins/compactor-summary.md afterRun — a compacted session resumes
  from facts, nothing skipped (user request: compact everything, skip nothing).
- Trace is size-capped: rotates at 512 KB, keeps newest half (never unbounded).
  All file writes wrapped in try/catch — housekeeping never breaks a run.
- Selftest extended (not just adjusted): asserts the trace file gets the
  blocked call (ok:false) and that afterTool records failure AND success —
  regression-proof for nothing-skipped.

## Lessons
1. Editor duplicating tail: an editor edit matched the head of a block but
   spliced a second copy of its tail (SYNTAX error). Fix: repair the tail in
   ONE PowerShell splice (IndexOf head, rebuild block, IndexOf export), then
   verify with node --check immediately.
2. UTF-8 mojibake via PowerShell heredoc: em-dash arrived as garbage bytes.
   Fix: [System.IO.File]::WriteAllText with explicit UTF8Encoding(false)
   instead of Set-Content for non-ASCII content.
3. Timeout discipline (the recurring operation-timed-out): long single tool
   calls (builds, browser smoke under load) time out the harness. Fix: run
   them DETACHED (Start-Process -WindowStyle Hidden writing to a file) then
   poll the file in a SHORT follow-up call. Never poll in the same call with
   a big Sleep.

Gates: syntax ALL OK, tests 124/124, smoke 4/4 PASS (detached),
webserver UP HTTP 200. Game code untouched (FIX counter unchanged).

FAST REVIEW: PASS
SLOW REVIEW: PASS

## Session 3r (2026-09-10) — dockyard info on demand, INFO-button overlap (FIX #33)

### The screenshot bug
- Inside the dockyard the `ℹ INFO` button physically overlapped the price
  button. Root cause: CSS specificity — `.overlay button` (0,1,1) out-specified
  the plain `.minibtn` (0,1,0), so EVERY card button was forced to 18 px /
  40 px horizontal padding / +14 px top margin by the overlay rule. The
  compact in-card buttons were silently killed, the flex `cardBtns` 
  overflowed and the INFO button sat on top of the price button.
- Fix: scope all mini-button rules to `#werft .minibtn` / `#infoModal .minibtn`
  (1,1,0). The big overlay buttons keep their style, the card buttons are
  compact again, and the ℹ INFO button got its own amber accent + hover.

### The UX change (requested: descriptions only on demand)
- Every dockyard card previously rendered its full description `<p>` inline.
  Now cards show only name + status + info/price buttons; the description
  appears EXCLUSIVELY in the fullscreen info card.
- New: hovering a card arms `_infoHover`; pressing `I` opens the info card of
  the hovered card, pressing `I` again closes it. The `ℹ INFO` buttons stay
  and open the same card. Applies to: upgrades, weapons, munitions crate,
  shell magazine, missile deck, fleet registry.

### Gates
- `node --check` core/game/main: PASS · `npm test`: 124/124 PASS ·
  smoke 4/4 PASS · reviewer: 87 markers / 23 numbered (#10–#33) in sync.
- FAST REVIEW: PASS — INFO overlap gone (specificity fix), descriptions only
  in the info card, `I` key toggles the hovered card, no dead refs.
- SLOW REVIEW: PASS — layout verified across all three dockyard tabs; CRLF
  preserved by the CRLF-normalize/splice rule (tools/fix32.mjs); counters
  updated (33 fixes: 9 original + 24 numbered #10–#34, 88 FIX: markers).

### Session 3s — FIX #34, smoke hardening, critic verdict
- Critic-Agent rated the dockyard UI **9.0/10** (release bar ≥8.5): overlap
  gone, info-on-demand discoverable, accent system consistent.
- FIX #34: Escape now closes the info card FIRST (then the dockyard) —
  previously the modal could linger over the resumed game.
- Smoke root cause found (was "flaky"): `http://localhost` resolved to IPv6
  `::1` while the dev server listens IPv4 → Chromium error page
  (ERR_CONNECTION_REFUSED, 189 KB `.last-dom.html` trap) + flaky first
  attempt. Fixes: `127.0.0.1` URL + `--host-resolver-rules`,
  `--no-proxy-server`, HTTP fetch-verify BEFORE launching Chrome, retry
  loop now checks for real game content (not just non-empty DOM).
  Smoke now 4/4 PASS deterministically.
- Hint discoverability: "I Card info" added to HUD `#hint` and menu legend.
- Gates: node --check PASS · npm test 124/124 · smoke 4/4 · reviewer PASS
  0 findings · counters synced (33 fixes: 9 original + 24 numbered
  #10–#34, 88 FIX: markers).
