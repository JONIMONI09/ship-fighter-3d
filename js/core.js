/* ============================================================
 * core.js — PURE simulation helpers (no THREE, no DOM, no globals).
 * Fully testable in Node (`node --test`). Units: meters, seconds.
 * ============================================================ */

/** 2π */
export const TAU = Math.PI * 2;

/** Clamp v into [lo, hi]. */
export function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Random float in [a, b). */
export function rand(a, b) { return a + Math.random() * (b - a); }

/** Wrap angle to (-π, +π]. */
export function wrapPI(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/* ------------------------------------------------------------
 * Ocean surface. CRITICAL INVARIANT: this formula must stay
 * IDENTICAL to the GLSL wave function W(p) in js/game.js
 * (same terms, same frequencies, same phases).
 * Range: |waveRaw| <= 0.85+0.50+0.30+0.20+0.08+0.06+0.05 = 2.04
 * ------------------------------------------------------------ */
export function waveRaw(x, z, t) {
  return 0.85 * Math.sin(x * 0.45 + z * 0.16 + t * 1.05)
       + 0.50 * Math.sin(x * 0.72 - z * 0.83 + t * 1.70)
       + 0.30 * Math.sin(-x * 0.35 + z * 1.12 + t * 2.40)
       + 0.20 * Math.sin(x * 1.10 + z * 0.90 + t * 3.00)
       + 0.08 * Math.sin(x * 3.10 - z * 2.30 + t * 4.00)
       + 0.06 * Math.sin(x * 2.70 + z * 3.30 + t * 3.60)
       + 0.05 * Math.sin(x * 9.20 + z * 7.10 + t * 5.20);
}

/** Scaled wave height: multiply raw waves by a world scale factor. */
export function waveScaled(x, z, t, scale) { return waveRaw(x, z, t) * scale; }

/* ------------------------------------------------------------
 * Ballistics: elevation angle θ for a projectile launched at
 * speed v to hit range R under gravity g (vacuum solution):
 *   R = v²·sin(2θ)/g  ⇒  θ = ½·asin(R·g/v²), clamped to [0, 45°]
 * ------------------------------------------------------------ */
export function solveElev(R, v, g) {
  return 0.5 * Math.asin(clamp(R * g / (v * v), 0, 1));
}

/* ------------------------------------------------------------
 * Missile salvo target distribution. Round i flies at targets[i]
 * while the list lasts; if there are more rounds than targets the
 * list wraps (the primary target receives the extra rounds).
 * An empty list ⇒ every round gets null = "loft & scan" behaviour.
 * Pure: returns a new array, mutates nothing.
 * ------------------------------------------------------------ */
export function distributeTargets(count, targets) {
  const out = [];
  const n = targets.length;
  for (let i = 0; i < count; i++) out.push(n ? targets[i % n] : null);
  return out;
}

/* ------------------------------------------------------------
 * timeToSurface(y, vy, g): time [s] until a point y metres ABOVE
 * the surface (y>=0) with vertical velocity vy (up = +) hits the
 * surface under gravity g. Solves the positive root of
 *   y + vy·t − ½·g·t² = 0  ⇒  t = (vy + √(vy² + 2gy)) / g
 * which always exists when y>=0 and g>0. Used by the engine to
 * paint live missile impact markers. Pure.
 * ------------------------------------------------------------ */
export function timeToSurface(y, vy, g) {
  if (g <= 0 || !isFinite(y) || !isFinite(vy)) return Infinity;
  return (vy + Math.sqrt(vy * vy + 2 * g * y)) / g;
}

/* ------------------------------------------------------------
 * waveTier(wave): late-game difficulty ramp for ENEMY base stats.
 * Multipliers grow monotonically with the wave number and cap out
 * (hp 2.4×, dmg 1.9×, spd 1.5×). The engine applies these to the
 * SHIPS base values FIRST and the admin TUNES sliders (eHP/eDmg/
 * eSpeed) AFTERWARDS — the dev console therefore always stays #1
 * and can never be overwritten by wave scaling. Pure & capped.
 * ------------------------------------------------------------ */
export function waveTier(wave) {
  const n = Math.max(1, wave);
  return {
    hp: Math.min(2.4, 1 + 0.05 * (n - 1)),
    dmg: Math.min(1.9, 1 + 0.035 * (n - 1)),
    spd: Math.min(1.5, 1 + 0.02 * (n - 1)),
  };
}

/* ------------------------------------------------------------
 * bossCount(wave): how many bosses fight in a given wave.
 * Every 5th wave is a boss wave (returns 0 otherwise). 1 boss up to
 * wave 14, a 2nd from wave 15, a 3rd from wave 30 — so late-game
 * sectors are genuinely crowded. Capped at 3. Pure.
 * ------------------------------------------------------------ */
export function bossCount(wave) {
  if (wave % 5 !== 0) return 0;
  let n = 1;
  if (wave >= 15) n++;
  if (wave >= 30) n++;
  return Math.min(3, n);
}

/* ------------------------------------------------------------
 * upgradeCost(base, grow, lv): geometric shop pricing so the economy
 * always has something to spend on — each purchase makes the next
 * one more expensive: cost = round(base · grow^level). Pure.
 * ------------------------------------------------------------ */
export function upgradeCost(base, grow, lv) {
  return Math.round(base * Math.pow(grow, Math.max(0, lv)));
}

/* ------------------------------------------------------------
 * zoomFOV(lvl, baseFov): camera FOV for the sniper-zoom level
 * selector (FIX #32). Level 0 = no zoom (baseFov), each further
 * level tightens the view multiplicatively (like Modern Warships
 * scope steps). Clamped & NaN-safe. Pure.
 * Reference: zoomFOV(2, 60) = 27.744 (60 · 0.68²).
 * ------------------------------------------------------------ */
export function zoomFOV(lvl, baseFov) {
  const l = Math.max(0, Math.min(4, Math.round(Number(lvl) || 0)));
  const f = Number(baseFov);
  if (!Number.isFinite(f) || f <= 0) return 22; /* sane sniper fallback */
  return Math.max(2, f * Math.pow(0.68, l));
}

/* ------------------------------------------------------------
 * escortStats(lv): stats of ONE player-owned escort vessel at level
 * lv (0 = freshly bought). HP & gun damage scale ×1.35 per level so
 * buying the next escort also upgrades the whole escort wing.
 * ------------------------------------------------------------ */
export function escortStats(lv) {
  const k = Math.pow(1.35, Math.max(0, lv));
  return { hp: Math.round(320 * k), dmg: Math.round(14 * k) };
}

/* ------------------------------------------------------------
 * eliteReady(lv): ELITE-boss gate — true only when EVERY base
 * dockyard lane is maxed. Single source of truth used by the
 * Ship constructor (previously duplicated & dead there) and by
 * the FLEET COMMAND unlock hint. Pure.
 * ------------------------------------------------------------ */
export function eliteReady(lv) {
  return !!lv
    && (lv.hull ?? 0) >= 4 && (lv.turret ?? 0) >= 2 && (lv.reload ?? 0) >= 4
    && (lv.dmg ?? 0) >= 4 && (lv.drone ?? 0) >= 2 && (lv.engine ?? 0) >= 3
    && (lv.crew ?? 0) >= 2 && (lv.armor ?? 0) >= 3 && (lv.size ?? 0) >= 3
    && (lv.fleet ?? 0) >= 4;
}

/* ------------------------------------------------------------
 * REGISTRY — the player's fleet book. Late-game (once every base
 * dockyard lane is maxed) the FLEET COMMAND bay unlocks: whole ships
 * can be registered here, each with its own hull/ammo/aircraft
 * upgrades. Pure data + helper so tests can pin the rules.
 *
 *   key    → stable ship class key
 *   name   → display name
 *   cost   → base purchase price (CR)
 *   build  → build time at dockyard level 0 (seconds)
 *   max    → how many of this class the registry accepts
 * ------------------------------------------------------------ */
export const REGISTRY = {
  escort:   { name: 'ESCORT DESTROYER', cost: 6000,  build: 35, max: 6, hull: 1, ammo: 1 },
  carrier:  { name: 'FLEET CARRIER',    cost: 24000, build: 95, max: 2, hull: 1, ammo: 1, jets: 1, bombs: 1 },
};

/* FLEET COMMAND bay upgrades (per registered ship). Levels are stored in
 * dockyard.lv under `<key>:hull|ammo|jets|bombs|dmg`. Scaling ×1.5 per
 * level so "once you have everything" stays an endless money sink. */
export const REG_UPG = {
  hull:  { label: 'HULL PLATING',  base: 3800, grow: 1.5, max: 3 },
  ammo:  { label: 'AMMO MAGAZINE', base: 2600, grow: 1.5, max: 3 },
  jets:  { label: 'AIR WING',      base: 9000, grow: 1.6, max: 3 },
  bombs: { label: 'BOMB BAYS',     base: 5200, grow: 1.6, max: 3 },
  dmg:   { label: 'GUNNERY DRILL', base: 3400, grow: 1.5, max: 3 },
  cmd:   { label: 'COMMAND STAFF', base: 12000, grow: 1.5, max: 3 },
};

/* registryCap(lv): FLEET COMMAND slots = 2 base + 1 per COMMAND STAFF
 * level (the staff runs the extra hulls), hard cap 8. Pure. */
export function registryCap(lv) { return Math.min(8, 2 + Math.max(0, lv)); }

/* regUpgCost(key, lv): price of one REG_UPG level. Costs inflate
 * super-linearly (×1.35 per already-owned level) — late game upgrades
 * get MORE expensive. Pure. */
export function regUpgCost(key, lv) {
  const u = REG_UPG[key];
  return Math.round(u.base * Math.pow(u.grow, Math.max(0, lv)) * Math.pow(1.35, Math.max(0, lv)));
}

/* buildSeconds(key, lvFleet, lvDock): late-game ships take REAL TIME to
 * build. Formula: registry base time × (1 + 0.35 per fleet/COMMAND STAFF
 * level) × dockyard staff discount, floored at 5 s so a maxed player can
 * never insta-spawn a capital ship. Pure. */
export function buildSeconds(key, lvFleet, lvDock) {
  return Math.max(5, Math.round(REGISTRY[key].build *
    (1 + 0.35 * Math.max(0, lvFleet)) * (1 - 0.10 * Math.max(0, lvDock))));
}
/* buildCardHelp(key,lvFleet,lvDock): single source of truth for how a
 * registry card should describe its build. Guards against NaN inputs
 * (a maxed lane used to pass undefined → "KEEL LAID — NaN s build time").
 * Returns "ready" seconds ≥ 0 (0 means instantly deployable). Pure. */
export function buildCardHelp(key, lvFleet, lvDock) {
  const f = (lvFleet && isFinite(lvFleet)) ? lvFleet : 0;
  const d = (lvDock && isFinite(lvDock)) ? lvDock : 0;
  const s = buildSeconds(key, f, d);
  return Math.max(0, s - 4); /* any build under 5s reads as "ready now" */
}

/* buildRemaining(entry, dt): advances ONE build order. Returns 0 when
 * the order is done (entry.done set), else the time still left.
 * Progress scales with the crew budget (more crew = faster). Pure-ish:
 * mutates only the entry object it is given. */
export function buildRemaining(entry, dt) {
  if (entry.done) return 0;
  const speed = entry.crew > 0 ? 1 + Math.min(1, entry.crew / 100) : 0.25;
  entry.t -= dt * speed;
  if (entry.t <= 0) { entry.t = 0; entry.done = true; }
  return entry.done ? 0 : entry.t;
}

/* ------------------------------------------------------------
 * Progressive flooding model (4 buoyancy chambers per ship).
 * h = { floods:[0..1]×4, integ:[0..1]×4, doomed:bool }
 *  - water inrolls through breached chambers (integ < 1)
 *  - repairing slows inflow to 25 %, pumps water out and re-seals
 *  - chambers >62 % full leak into their two neighbours
 * Returns the average fill (ship-wide damage indicator).
 * Pure: mutates only h, no time-dependence besides dt.
 * ------------------------------------------------------------ */
export function fillFloods(h, dt, repairing, crewF = 1) {
  for (let i = 0; i < 4; i++) {
    let f = h.floods[i];
    if (h.integ[i] < .999) {
      let flow = (1 - h.integ[i]) * .30 * (h.doomed ? 2 : 1) * (1 + f * 1.6);
      if (repairing) flow *= .25;
      f = f + (1 - f) * Math.min(1, flow * dt);
    } else if (repairing && f > 0) {
      f = Math.max(0, f - .10 * crewF * dt);
    }
    if (repairing) h.integ[i] = Math.min(1, h.integ[i] + .05 * crewF * dt);
    if (!repairing && f > 0) f = Math.max(0, f - .005 * dt);
    h.floods[i] = f;
    if (f > .62) {
      const n1 = i ^ 1, n2 = i ^ 2;   // neighbour chambers (bit trick)
      h.floods[n1] = Math.min(1, h.floods[n1] + .010 * dt * f);
      h.floods[n2] = Math.min(1, h.floods[n2] + .010 * dt * f);
    }
  }
  return (h.floods[0] + h.floods[1] + h.floods[2] + h.floods[3]) / 4;
}

/* ------------------------------------------------------------
 * ORDNANCE TYPES (session 4 — the munitions system). Each type has:
 * dmg multiplier, restock cost per unit, spread modifier for the
 * main guns, and a flavor description shown in the shop.
 * ------------------------------------------------------------ */
export const ORD_TYPES = {
  ap: { id:'ap', name:'AP — ARMOR PIERCING', icon:'🔩', dmg:1.0, cost:2, spread:0.6,
    desc:'Tungsten penetrator. Balanced damage, tight dispersion, cheap to restock. The workhorse of every navy.' },
  he: { id:'he', name:'HE — HIGH EXPLOSIVE', icon:'💥', dmg:1.25, cost:5, spread:1.0,
    desc:'Fragmentation warhead. +25 % damage but wider dispersion and a premium price. Ideal against light hulls and swarms.' },
  sap: { id:'sap', name:'SAP — SEMI-ARMOR PIERCING', icon:'⚔️', dmg:1.12, cost:4, spread:0.8,
    desc:'Thinner walls, more filler than AP. A good middle ground: mild damage boost without losing much accuracy.' },
  clus: { id:'clus', name:'CLUSTER — MIRV SHELL', icon:'✳️', dmg:1.05, cost:8, spread:1.6,
    desc:'Splits into bomblets on impact. Huge area saturation — but the dispersion is wild. Zone denial, not sniping.' },
  ins: { id:'ins', name:'INS — INCENDIARY', icon:'🔥', dmg:1.15, cost:6, spread:1.1,
    desc:'Thermite payload that sets ships on fire. Slightly boosted damage, chance of sustained burns on the target.' },
  heat: { id:'heat', name:'HEAT — SHAPED CHARGE', icon:'🔻', dmg:1.3, cost:7, spread:0.9,
    desc:'Copper-liner jet burns through armor. Strong damage with acceptable dispersion. Banned by three treaties.' },
};

export const MSL_TYPES = {
  bal: { id:'bal', name:'RGM — FIRE & FORGET', icon:'🚀', dmg:1.0, cost:15, seek:0,
    desc:'Ballistic rocket, no seeker. Cheapest suppression available. Flies where you point it, no guidance, no mercy.' },
  ir: { id:'ir', name:'AGM — IR SEEKER', icon:'🎯', dmg:1.0, cost:22, seek:1,
    desc:'Locked-on homing rocket (2 seekers per salvo). Chases the target you aimed at. Dodgeable with hard turns.' },
  sar: { id:'sar', name:'ASM — SEA-SKIMMER', icon:'🌊', dmg:1.25, cost:30, seek:2,
    desc:'Terminal sea-skimming attack (3 seekers per salvo). Dives at the waterline — very hard to dodge, very expensive.' },
  heavy: { id:'heavy', name:'P-1000 — HEAVY SHIP-KILLER', icon:'☄️', dmg:1.6, cost:45, seek:3,
    desc:'Massive 4-seeker salvo with +60 % warhead. The thing battleships have nightmares about. Empties wallets faster than magazines.' },
};

export function ordCost(typeKey, count) { return Math.round((ORD_TYPES[typeKey]?.cost ?? 2) * Math.max(1, count)); }
export function mslCost(typeKey, count) { return Math.round((MSL_TYPES[typeKey]?.cost ?? 15) * Math.max(1, count)); }

/* priceGrowth(base, n): escalating restock price. Each purchase in a
 * chain costs (n+1)× the base unit price — the more you buy, the more
 * each unit costs. Reference: priceGrowth(2, 4) = 10. Pure. */
export function priceGrowth(base, n) { return base * (Math.max(0, n) + 1); }

/* salvoCooldown(base, chain): rocket reload escalation. Returns the
 * reload duration after a salvo, given how many consecutive salvos
 * were fired without an admin pause. Chain grows +30 s per salvo,
 * capped at 120 s. Pure. Reference: salvoCooldown(30, 3) = 120. */
export function salvoCooldown(base, chain) { return Math.min(120, base + 30 * Math.max(0, chain)); }

/* shellAccuracy(base, zoomed, playerLvl): main-gun dispersion factor.
 * - zoomed (aiming in sniper view): 45 % tighter
 * - dockyard accuracy upgrade: 12 % tighter per level
 * Pure. Reference: shellAccuracy(0.02, true, 2) = 0.0085184 (0.02*0.55*0.88^2). */
export function shellAccuracy(base, zoomed, playerLvl) {
  let s = base;
  if (zoomed) s *= 0.55;
  s *= Math.pow(0.88, Math.max(0, playerLvl));
  return s;
}

/* ------------------------------------------------------------
 * Session 4a — purchase safety + adaptive difficulty (pure helpers).
 * FIX: #26 guarantees: a failed purchase NEVER mutates state and ALWAYS
 * yields a user-readable reason. FIX: #27 scales enemies with the
 * player's fleet pressure, capped so the game stays playable.
 * ------------------------------------------------------------ */

/* tryPurchase(state, cost): central purchase guard.
 * state = { credits } (or null). On success deducts cost and returns
 * { ok:true, reason:'', credits:newBalance }. On failure state is left
 * UNTOUCHED and ok=false with a reason key: 'NO_FUNDS' (not enough
 * credits) or 'COST' (invalid price, e.g. NaN/negative).
 * Pure. References:
 *   tryPurchase({credits:100}, 30) → {ok:true,  credits:70}
 *   tryPurchase({credits:10},  30) → {ok:false, reason:'NO_FUNDS', credits:10}
 *   tryPurchase(null,        30)   → {ok:false, reason:'NO_FUNDS', credits:0} */
export function tryPurchase(state, cost) {
  const c = state ? (state.credits ?? 0) : 0;
  if (!(typeof cost === 'number' && isFinite(cost) && cost >= 0))
    return { ok: false, reason: 'COST', credits: c };
  if (c < cost) return { ok: false, reason: 'NO_FUNDS', credits: c };
  state.credits = c - cost;
  return { ok: true, reason: '', credits: state.credits };
}

/* purchaseCap(count, max): clamp a desired purchase quantity to stock
 * limits. Never returns more than max, never negative.
 * References: purchaseCap(8, 1000)=8 · purchaseCap(8, 3)=3 ·
 *             purchaseCap(-2, 5)=0 · purchaseCap(8, -1)=0. Pure. */
export function purchaseCap(count, max) {
  return Math.max(0, Math.min(Math.max(0, count), Math.max(0, max)));
}

/* buildLeft(entry): READ-ONLY snapshot of the remaining build time in
 * seconds (same crew speed model as buildRemaining). Unlike
 * buildRemaining it never mutates the entry — safe for UI renderers.
 * Reference: buildLeft({done:false, t:100, crew:50}) = 100/1.5 ≈ 66.67;
 *            buildLeft({done:true, t:40, crew:0}) = 0. Pure. */
export function buildLeft(entry) {
  if (!entry || entry.done) return 0;
  const speed = entry.crew > 0 ? 1 + Math.min(1, entry.crew / 100) : 0.25;
  return entry.t / speed;
}

/* adaptTier(wave, base, pressure): adaptive difficulty tier.
 * base = waveTier(wave) (pass it to avoid recomputing). pressure = the
 * player's fleet strength (0..1; escorts + upgrade lanes). Every factor
 * grows by up to +6 % per full pressure point, each factor keeps its own
 * hard cap (hp 2.4 · dmg 1.9 · spd 1.5) so late-game enemies get
 * individually tougher but never unkillable. Admin dev-sliders still
 * multiply AFTER this — the dev console stays the final authority.
 * Pure. Reference: adaptTier(50, {hp:2.4,dmg:1.9,spd:1.5}, 1) =
 *   {hp:2.4, dmg:1.9, spd:1.5} (all at cap). */
export function adaptTier(wave, base, pressure) {
  const b = base || waveTier(wave);
  const p = Math.min(1, Math.max(0, pressure ?? 0));
  return { hp:  Math.min(2.4, b.hp  * (1 + 0.06 * p)),
           dmg: Math.min(1.9, b.dmg * (1 + 0.06 * p)),
           spd: Math.min(1.5, b.spd * (1 + 0.06 * p)) };
}
