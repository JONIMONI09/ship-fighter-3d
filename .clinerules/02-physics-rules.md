# Physics Design (SCHIFFSBRUCH — ship fighter)

## Water surface — JS↔GLSL parity (CRITICAL)

- `waveRaw(x, z, t)` in `js/core.js` is the single source of truth: **seven sine
  terms** (6 base + 1 ripple since SEA v2, see FIX #13/#16), |waveRaw| ≤ 2.04.
  The GLSL copy inside the water-shader string in
  `js/game.js` MUST stay character-identical in structure (same terms,
  frequencies, phases). World height = `waveH = waveRaw * WSCALE`.
- Everything that touches the surface (buoyancy probes, splash FX, wave
  following) goes through `waveRaw`/`waveScaled` — never a second formula.

## Float physics v4 (per ship)

- Each ship has buoyancy probes sampled from the wave field; the hull
  follows the local surface (heave), pitch/roll follow the surface gradient
  (listing/trim). Speed-dependent squat and wave resistance are tuned in
  `TUNES`.
- A ship becomes `doomed` when total flooding passes the capsize threshold:
  floods accelerate (×2 inflow), the hull settles progressively by the bow
  or stern and finally sinks below the surface.

## 4-chamber progressive flooding (`fillFloods` in js/core.js)

- State per ship: `floods[0..3]` (fill 0..1), `integ[0..3]` (1 = sealed,
  <1 = breached), `doomed` flag.
- Inflow through a breach: `(1-integ)·0.30·(doomed?2:1)·(1+fill·1.6)`,
  repair slows inflow to 25 %, pumps out at `0.10/s` and re-seals at
  `0.05/s`. Non-repairing hulls slowly drain free water (`0.005/s`).
- A chamber above 0.62 leaks into its two neighbour chambers
  (`i^1`, `i^2`) at `0.010·fill` per second — damage spreads.
- Pure function: mutates only its state object, returns average fill.

## Ballistics (`solveElev`)

- Vacuum solution `θ = ½·asin(R·g/v²)`, clamped to [0°, 45°] (NaN-safe for
  out-of-range R). Shells integrate gravity explicitly in the game loop.

## Critical implementation rules (learned from real bugs)

1. **Time deltas clamp**: `dt = min(0.05, real dt)` — tab switches must not
   teleport projectiles or flood chambers.
2. **Muzzle FX lights decay**: every pooled PointLight decays
   `intensity *= exp(-9·dt)` per frame (FIX #1, 2026-09-06).
3. **Score combo must apply**: `addScore` multiplies by `combo` (FIX #3).
4. **Reset hygiene**: `startGame()` resets ALL match state incl. `lastSinkT`
   (FIX #5) — otherwise the first kill inherits a stale combo window.
5. **Minimap clamps**: canvas is 170 px but enemies spawn up to 230 m out —
   map coordinates clamp to [1,169] (FIX #4).

