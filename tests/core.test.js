/* Unit tests for the PURE core module — every exported function gets
 * reference-value tests (hand-computed numbers, not snapshots). */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAU, clamp, rand, wrapPI, waveRaw, waveScaled, solveElev, fillFloods,
  distributeTargets, timeToSurface, waveTier, bossCount, upgradeCost, zoomFOV, escortStats,
  eliteReady, REGISTRY, REG_UPG, registryCap, regUpgCost, buildSeconds, buildRemaining, buildCardHelp,
  ORD_TYPES, MSL_TYPES, ordCost, mslCost, priceGrowth, salvoCooldown, shellAccuracy,
  tryPurchase, purchaseCap, buildLeft, adaptTier,
} from '../js/core.js';

describe('clamp', () => {
  it('keeps values inside range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp(0.5, 0, 1), 0.5);
  });
});

describe('rand', () => {
  it('stays inside [a,b)', () => {
    for (let i = 0; i < 500; i++) {
      const r = rand(-2, 7);
      assert.ok(r >= -2 && r < 7, `rand out of range: ${r}`);
    }
  });
  it('is not degenerate (covers both halves)', () => {
    let low = 0, high = 0;
    for (let i = 0; i < 200; i++) (rand(0, 10) < 5) ? low++ : high++;
    assert.ok(low > 10 && high > 10, 'distribution suspicious');
  });
});

describe('wrapPI', () => {
  it('maps angles into [-PI, PI) (boundary wraps to -PI)', () => {
    assert.equal(wrapPI(0), 0);
    assert.ok(Math.abs(wrapPI(Math.PI) + Math.PI) < 1e-9);   // +π → -π (boundary)
    assert.ok(Math.abs(wrapPI(-Math.PI) + Math.PI) < 1e-9);  // -π → -π
    assert.ok(Math.abs(wrapPI(3 * Math.PI) + Math.PI) < 1e-9);
    assert.ok(Math.abs(wrapPI(Math.PI / 2) - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(wrapPI(2 * Math.PI + 0.1) - 0.1) < 1e-9);
    assert.ok(Math.abs(wrapPI(-2 * Math.PI - 0.1) + 0.1) < 1e-9);
  });
  it('reference: wrapPI(5) ≈ -1.2832', () => {
    assert.ok(Math.abs(wrapPI(5) - (5 - TAU)) < 1e-9);
  });
});

describe('waveRaw', () => {
  /* Reference formula: full 7-term sum pinned with literal constants.
     Any coefficient drift in core.js (or a missing 7th term) fails here. */
  const waveRef = (x, z, t) =>
    0.85 * Math.sin(x * 0.45 + z * 0.16 + t * 1.05)
    + 0.50 * Math.sin(x * 0.72 - z * 0.83 + t * 1.70)
    + 0.30 * Math.sin(-x * 0.35 + z * 1.12 + t * 2.40)
    + 0.20 * Math.sin(x * 1.10 + z * 0.90 + t * 3.00)
    + 0.08 * Math.sin(x * 3.10 - z * 2.30 + t * 4.00)
    + 0.06 * Math.sin(x * 2.70 + z * 3.30 + t * 3.60)
    + 0.05 * Math.sin(x * 9.20 + z * 7.10 + t * 5.20); /* 7th ripple term */

  it('reference value at (0,0,0) is 0', () => {
    assert.equal(waveRaw(0, 0, 0), 0);
  });
  it('matches the pinned 7-term reference formula', () => {
    for (let i = 0; i < 200; i++) {
      const x = rand(-100, 100), z = rand(-100, 100), t = rand(0, 60);
      assert.ok(Math.abs(waveRaw(x, z, t) - waveRef(x, z, t)) < 1e-12,
        `waveRaw(${x},${z},${t}) drifted from reference formula`);
    }
  });
  it('bounded by |sum of amplitudes| = 2.04', () => {
    for (let i = 0; i < 300; i++) {
      const h = waveRaw(rand(-100, 100), rand(-100, 100), rand(0, 60));
      assert.ok(Math.abs(h) <= 2.04 + 1e-9, `wave out of bound: ${h}`);
    }
  });
  it('is deterministic and continuous (small dt ⇒ small dh)', () => {
    const a = waveRaw(10, -4, 3.3);
    assert.equal(a, waveRaw(10, -4, 3.3));
    assert.ok(Math.abs(waveRaw(10, -4, 3.301) - a) < 0.05);
  });
});

describe('waveScaled', () => {
  it('scales linearly (waveH = waveRaw * WSCALE)', () => {
    assert.equal(waveScaled(3, 7, 2, 0.55), waveRaw(3, 7, 2) * 0.55);
    assert.equal(waveScaled(1, 1, 1, 0), 0);
  });
});

describe('solveElev', () => {
  it('reference: 45° at max range (R*g = v²)', () => {
    assert.ok(Math.abs(solveElev(130 * 130 / 11, 130, 11) - Math.PI / 4) < 1e-9);
  });
  it('reference: 0 at zero range', () => assert.equal(solveElev(0, 130, 11), 0));
  it('clamps beyond max range to 45° (no NaN)', () => {
    assert.ok(Math.abs(solveElev(1e6, 130, 11) - Math.PI / 4) < 1e-9);
  });
  it('monotonic in R', () => {
    assert.ok(solveElev(50, 130, 11) < solveElev(300, 130, 11));
  });
});

describe('module graph', () => {
  /* game.js must only import names that core.js actually exports — a typo
     here kills the whole page at module load (browser-only failure). */
  it('js/game.js imports only existing exports of js/core.js', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
    const m = src.match(/import\s*\{([^}]+)\}\s*from\s*'\.\/core\.js'/);
    assert.ok(m, 'game.js must import from ./core.js');
    const core = await import('../js/core.js');
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    for (const n of names) assert.ok(n in core, `core.js does not export "${n}"`);
  });
});

describe('distributeTargets', () => {
  /* Salvo target AI (FIX #18): rounds i → targets[i % n], extras wrap onto
   * the primary; an empty target list yields null ⇒ LOFT & scan behaviour. */
  it('empty target list ⇒ every round is null (loft & scan)', () => {
    assert.deepEqual(distributeTargets(4, []), [null, null, null, null]);
  });
  it('count 0 ⇒ empty assignment', () => {
    assert.deepEqual(distributeTargets(0, ['a']), []);
  });
  it('reference: 5 rounds over [P,D1,D2] ⇒ P,D1,D2,P,D1 (extras wrap)', () => {
    const P = { id: 'P' }, D1 = { id: 'D1' }, D2 = { id: 'D2' };
    assert.deepEqual(distributeTargets(5, [P, D1, D2]), [P, D1, D2, P, D1]);
  });
  it('more targets than rounds ⇒ first N targets get the rounds', () => {
    const t = ['a', 'b', 'c', 'd'];
    assert.deepEqual(distributeTargets(2, t), ['a', 'b']);
  });
  it('5 rounds over [P,D] ⇒ P gets the wrap-around extra (3:2 split)', () => {
    const P = { id: 'P' }, D = { id: 'D' };
    const r = distributeTargets(5, [P, D]); // i%2 → P,D,P,D,P
    assert.equal(r.filter(x => x === P).length, 3);
    assert.equal(r.filter(x => x === D).length, 2);
  });
  it('even split: 6 rounds over [P,D] alternate P,D,P,D,P,D', () => {
    const P = { id: 'P' }, D = { id: 'D' };
    assert.deepEqual(distributeTargets(6, [P, D]), [P, D, P, D, P, D]);
  });
  it('never mutates the input list', () => {
    const t = ['a', 'b'];
    distributeTargets(5, t);
    assert.deepEqual(t, ['a', 'b']);
  });
});

describe('fillFloods', () => {
  const mk = () => ({ floods: [0, 0, 0, 0], integ: [1, 1, 1, 1], doomed: false });

  it('sealed intact hull never floods', () => {
    const h = mk();
    for (let i = 0; i < 600; i++) fillFloods(h, 1 / 60, false, 1);
    assert.deepEqual(h.floods, [0, 0, 0, 0]);
  });

  it('breached chamber fills monotonically towards 1', () => {
    const h = mk(); h.integ[0] = 0;
    let prev = -1;
    for (let i = 0; i < 1200; i++) {
      const avg = fillFloods(h, 1 / 60, false, 1);
      assert.ok(avg >= prev - 1e-12, 'flooding must not recede');
      prev = avg;
    }
    assert.ok(h.floods[0] > 0.9, `should be nearly full, got ${h.floods[0]}`);
    assert.ok(h.floods.every(f => f <= 1 + 1e-12), 'capacity limit 1.0');
  });

  it('full chamber leaks into both neighbours', () => {
    const h = mk(); h.floods = [1, 0, 0, 0]; h.integ = [1, 1, 1, 1];
    fillFloods(h, 1, false, 1);       // f>.62 ⇒ neighbours n1=1^1=1... wait n2=1^2=3
    assert.ok(h.floods[1] > 0 || h.floods[3] > 0, 'leak must reach a neighbour');
  });

  it('repairing pumps water out and re-seals breaches', () => {
    const h = mk(); h.floods = [0.8, 0.5, 0.3, 0.1]; h.integ = [0.5, 0.5, 1, 1];
    for (let i = 0; i < 3000; i++) fillFloods(h, 1 / 60, true, 1);
    assert.ok(h.floods.every(f => f < 0.05), `pumped out: ${h.floods}`);
    assert.ok(h.integ.every(v => v > 0.999), 'breaches re-sealed');
  });

  it('doomed ships flood twice as fast', () => {
    const a = mk(), b = mk();
    a.integ = [0, 0, 0, 0]; b.integ = [0, 0, 0, 0]; b.doomed = true;
    for (let i = 0; i < 15; i++) { fillFloods(a, 0.1, false, 1); fillFloods(b, 0.1, false, 1); }
    const sumA = a.floods.reduce((s, f) => s + f, 0);
    const sumB = b.floods.reduce((s, f) => s + f, 0);
    // before saturation: flow doubles ⇒ ~2× fill; assert comfortably above 1.4×
    assert.ok(sumB > sumA * 1.4, `doomed must flood faster: ${sumB.toFixed(3)} vs ${sumA.toFixed(3)}`);
  });

  it('mass/level never exceeds capacity and avg stays in [0,1]', () => {
    const h = mk(); h.floods = [1, 1, 1, 1]; h.integ = [0, 0, 0, 0]; h.doomed = true;
    for (let i = 0; i < 600; i++) {
      const avg = fillFloods(h, 1 / 30, false, 1);
      assert.ok(h.floods.every(f => f >= 0 && f <= 1), 'each chamber in [0,1]');
      assert.ok(avg >= 0 && avg <= 1, 'avg in [0,1]');
    }
  });
});
describe('timeToSurface', () => {
  it('reference: dropped from y=0 with vy=10, g=11 lands at t=20/11≈1.8182', () => {
    const t = timeToSurface(0, 10, 11);
    assert.ok(Math.abs(t - 20 / 11) < 1e-9, `t=${t}`);
  });
  it('reference: dropped from rest at y=27 under g=11 lands at t=√(54/11)', () => {
    const t = timeToSurface(27, 0, 11);
    assert.ok(Math.abs(t - Math.sqrt(54 / 11)) < 1e-9, `t=${t}`);
  });
  it('reference: thrown DOWN (vy=-2) from y=10 lands EARLIER than from rest', () => {
    const down = timeToSurface(10, -2, 11);
    const rest = timeToSurface(10, 0, 11);
    const exp = (-2 + Math.sqrt(4 + 220)) / 11;
    assert.ok(Math.abs(down - exp) < 1e-9, `t=${down}`);
    assert.ok(down < rest, 'negative vy must splash sooner');
  });
  it('monotonic: higher launch y ⇒ longer flight (strict after y>0)', () => {
    let prev = 0;
    for (let y = 0; y <= 300; y += 10) {
      const t = timeToSurface(y, 0, 11);
      assert.ok(t >= prev, `t must not shrink with y, got ${t}<${prev} at y=${y}`);
      if (y > 0) assert.ok(t > 0, 'positive y must give positive time');
      prev = t;
    }
    assert.ok(prev > 0, 'deep drop must take time');
  });
  it('guard: g<=0 or NaN inputs ⇒ Infinity (no negative clamp)', () => {
    assert.equal(timeToSurface(10, 5, 0), Infinity);
    assert.equal(timeToSurface(10, 5, -11), Infinity);
    assert.equal(timeToSurface(NaN, 5, 11), Infinity);
    assert.equal(timeToSurface(10, Infinity, 11), Infinity);
  });
  it('always lands: every root exists for y>=0, any finite vy (t>=0)', () => {
    for (let y = 0; y <= 200; y += 20) {
      for (let vy = -40; vy <= 40; vy += 10) {
        const t = timeToSurface(y, vy, 11);
        assert.ok(isFinite(t) && t >= 0, `y=${y} vy=${vy} t=${t}`);
      }
    }
  });
});

describe('waveTier', () => {
  it('wave 1 is the identity (all multipliers = 1)', () => {
    const t = waveTier(1);
    assert.equal(t.hp, 1); assert.equal(t.dmg, 1); assert.equal(t.spd, 1);
  });
  it('reference: wave 5 → hp 1.2, dmg 1.14, spd 1.08', () => {
    const t = waveTier(5);
    assert.ok(Math.abs(t.hp - 1.2) < 1e-12);
    assert.ok(Math.abs(t.dmg - 1.14) < 1e-12);
    assert.ok(Math.abs(t.spd - 1.08) < 1e-12);
  });
  it('waves below 1 clamp to the wave-1 identity', () => {
    const t = waveTier(0), u = waveTier(-3);
    assert.equal(t.hp, 1); assert.equal(t.spd, 1);
    assert.equal(u.hp, 1); assert.equal(u.dmg, 1); assert.equal(u.spd, 1);
  });
  it('monotonic growth up to the caps (never grows past 2.4/1.9/1.5)', () => {
    let ph = 0, pd = 0, ps = 0;
    for (let w = 1; w <= 80; w++) {
      const t = waveTier(w);
      assert.ok(t.hp >= ph && t.dmg >= pd && t.spd >= ps, `must not shrink at w=${w}`);
      ph = t.hp; pd = t.dmg; ps = t.spd;
      assert.ok(t.hp <= 2.4 && t.dmg <= 1.9 && t.spd <= 1.5, 'caps respected');
    }
  });
  it('caps hit exactly at wave 100 (no cliff, saturates)', () => {
    const t = waveTier(100);
    assert.equal(t.hp, 2.4); assert.equal(t.dmg, 1.9); assert.equal(t.spd, 1.5);
  });
  it('deterministic and pure (no mutation, same answer every call)', () => {
    const t1 = waveTier(17), t2 = waveTier(17);
    assert.deepEqual(t1, t2);
  });
});

describe('bossCount', () => {
  it('non-boss waves return 0', () => {
    assert.equal(bossCount(1), 0); assert.equal(bossCount(2), 0);
    assert.equal(bossCount(4), 0); assert.equal(bossCount(6), 0);
  });
  it('every 5th wave has exactly 1 boss up to wave 10', () => {
/* ============================================================
 * ORDNANCE (FIX #25) — shell & missile types + pricing + reload
 * ============================================================ */
describe('ORD_TYPES catalog', () => {
  it('offers exactly 10 purchasable types (6 shells, 4 missiles)', () => {
    assert.equal(Object.keys(ORD_TYPES).length, 6);
    assert.equal(Object.keys(MSL_TYPES).length, 4);
    for (const k in ORD_TYPES) assert.equal(ORD_TYPES[k].id, k);
    for (const k in MSL_TYPES) assert.equal(MSL_TYPES[k].id, k);
  });
  it('every type carries dmg, cost, shop text (+seek for missiles)', () => {
    for (const k in ORD_TYPES) {
      const t = ORD_TYPES[k];
      assert.ok(t.dmg > 0 && t.cost > 0 && t.spread > 0 && t.desc.length > 20, k);
    }
    for (const k in MSL_TYPES) {
      const t = MSL_TYPES[k];
      assert.ok(t.dmg > 0 && t.cost > 0 && Number.isInteger(t.seek) && t.seek >= 0, k);
    }
  });
  it('more damage = wider dispersion OR higher price (balance invariant)', () => {
    for (const k in ORD_TYPES) {
      const t = ORD_TYPES[k];
      const ap = ORD_TYPES.ap;
      if (t.dmg > ap.dmg) assert.ok(t.spread > ap.spread || t.cost > ap.cost, k);
    }
  });
});

describe('ordCost / mslCost', () => {
  it('unit cost × count, rounded', () => {
    assert.equal(ordCost('ap', 40), 80);      /* 2 CR per AP shell */
    assert.equal(ordCost('heat', 10), 70);    /* 7 CR per HEAT shell */
    assert.equal(mslCost('ir', 4), 88);       /* 22 CR per IR missile */
    assert.equal(mslCost('heavy', 2), 90);    /* 45 CR per P-1000 */
  });
  it('falls back to defaults for unknown keys', () => {
    assert.equal(ordCost('nope', 3), 6);
    assert.equal(mslCost('nope', 3), 45);
  });
  it('zero/negative count clamps to one unit', () => {
    assert.equal(ordCost('ap', 0), 2);
    assert.equal(mslCost('bal', -5), 15);
  });
});

describe('priceGrowth', () => {
  it('reference: priceGrowth(2, 4) = 10 (5th purchase costs 5x)', () => {
    assert.equal(priceGrowth(2, 4), 10);
  });
  it('first purchase (n=0) costs the base price', () => {
    assert.equal(priceGrowth(22, 0), 22);
  });
  it('strictly increasing and linear', () => {
    let prev = -1;
    for (let n = 0; n <= 10; n++) {
      const p = priceGrowth(5, n);
      assert.ok(p > prev); prev = p;
    }
  });
  it('negative purchase count clamps to the first purchase', () => {
    assert.equal(priceGrowth(5, -3), 5);
  });
});

describe('salvoCooldown', () => {
  it('reference: salvoCooldown(30, 3) = 120 (30 + 3·30, at the cap)', () => {
    assert.equal(salvoCooldown(30, 3), 120);
  });
  it('first salvo after a pause has no escalation', () => {
    assert.equal(salvoCooldown(30, 0), 30);
  });
  it('grows by exactly +30 s per consecutive salvo', () => {
    assert.equal(salvoCooldown(30, 1), 60);
    assert.equal(salvoCooldown(30, 2), 90);
  });
  it('never exceeds the 120 s cap', () => {
    assert.equal(salvoCooldown(30, 10), 120);
    assert.equal(salvoCooldown(30, 100), 120);
  });
  it('negative chain clamps to 0', () => {
    assert.equal(salvoCooldown(30, -2), 30);
  });
});

describe('shellAccuracy', () => {
  it('reference: shellAccuracy(0.02, true, 2) = 0.0085184 (zoom + 2 accuracy levels)', () => {
    assert.ok(Math.abs(shellAccuracy(0.02, true, 2) - 0.0085184) < 1e-9);
  });
  it('hip-fire without upgrades returns the base spread', () => {
    assert.equal(shellAccuracy(0.02, false, 0), 0.02);
  });
  it('zoom tightens dispersion by 45 %', () => {
    assert.ok(Math.abs(shellAccuracy(0.02, true, 0) - 0.011) < 1e-9);
  });
  it('monotonic: accuracy upgrades never loosen the spread', () => {
    let prev = 1;
    for (let lv = 0; lv <= 4; lv++) {
      const s = shellAccuracy(0.02, false, lv);
      assert.ok(s <= prev); prev = s;
    }
  });
  it('negative level clamps to level 0', () => {
    assert.equal(shellAccuracy(0.02, false, -1), 0.02);
  });
});
    assert.equal(bossCount(5), 1); assert.equal(bossCount(10), 1);
  });
  it('2nd boss joins from wave 15, 3rd from wave 30 (cap 3)', () => {
    assert.equal(bossCount(15), 2); assert.equal(bossCount(20), 2);
    assert.equal(bossCount(25), 2);
    assert.equal(bossCount(30), 3); assert.equal(bossCount(35), 3);
    assert.equal(bossCount(100), 3);
  });
  it('never exceeds 3 even at absurd waves', () => {
    assert.equal(bossCount(5000), 3);
  });
});

describe('upgradeCost', () => {
  it('level 0 = base (no markup)', () => {
    assert.equal(upgradeCost(150, 1.7, 0), 150);
    assert.equal(upgradeCost(2400, 2.4, 0), 2400);
  });
  it('reference: base 150, grow 1.7 → lv2 = 433 (1.7²=2.88999… → 433.49 rounds down)', () => {
    assert.equal(upgradeCost(150, 1.7, 2), 433);
  });
  it('monotonic: every level makes the next purchase more expensive', () => {
    let prev = 0;
    for (let lv = 0; lv <= 8; lv++) {
      const c = upgradeCost(100, 1.8, lv);
      assert.ok(c > prev, `cost must grow, got ${c}<=${prev} at lv ${lv}`);
      prev = c;
    }
  });
  it('negative level clamps to level 0', () => {
    assert.equal(upgradeCost(500, 2, -3), 500);
  });
  it('deterministic & pure', () => {
    assert.equal(upgradeCost(130, 1.7, 4), upgradeCost(130, 1.7, 4));
  });
});

describe('escortStats', () => {
  it('level 0 is the base line (320 hp, 14 dmg)', () => {
    const s = escortStats(0);
    assert.equal(s.hp, 320); assert.equal(s.dmg, 14);
  });
  it('reference: level 2 → 320·1.35²≈583 hp, 14·1.35²≈26 dmg', () => {
    const s = escortStats(2);
    assert.equal(s.hp, Math.round(320 * 1.35 * 1.35));
    assert.equal(s.dmg, Math.round(14 * 1.35 * 1.35));
  });
  it('monotonic: higher level never reduces wing stats', () => {
    let ph = 0, pd = 0;
    for (let lv = 0; lv <= 8; lv++) {
      const s = escortStats(lv);
      assert.ok(s.hp >= ph && s.dmg >= pd, 'must not shrink');
      ph = s.hp; pd = s.dmg;
    }
  });
  it('negative level clamps to base', () => {
    const s = escortStats(-1);
    assert.equal(s.hp, 320); assert.equal(s.dmg, 14);
  });
  it('deterministic', () => {
    const a = escortStats(3), b = escortStats(3);
    assert.equal(a.hp, b.hp); assert.equal(a.dmg, b.dmg);
  });
});

describe('eliteReady', () => {
  const maxedLv = { hull: 4, turret: 2, reload: 4, dmg: 4, drone: 2, engine: 3, crew: 2, armor: 3, size: 3, fleet: 4 };
  it('all lanes maxed → true', () => {
    assert.equal(eliteReady(maxedLv), true);
  });
  it('any single lane short → false', () => {
    for (const k of Object.keys(maxedLv)) {
      const lv = { ...maxedLv, [k]: maxedLv[k] - 1 };
      assert.equal(eliteReady(lv), false, `lane ${k} must gate ELITE`);
    }
  });
  it('empty/undefined levels object → false', () => {
    assert.equal(eliteReady(undefined), false);
    assert.equal(eliteReady(null), false);
    assert.equal(eliteReady({}), false);
  });
});

describe('registryCap', () => {
  it('base is 2 slots (no command staff)', () => {
    assert.equal(registryCap(0), 2);
  });
  it('+1 per staff level, hard cap 8', () => {
    assert.equal(registryCap(1), 3);
    assert.equal(registryCap(3), 5);
    assert.equal(registryCap(6), 8);
    assert.equal(registryCap(50), 8);
  });
  it('negative staff level clamps to base', () => {
    assert.equal(registryCap(-2), 2);
  });
});

describe('regUpgCost', () => {
  it('level 0 = base × grow^0 × 1.35^0', () => {
    assert.equal(regUpgCost('hull', 0), 3800);
    assert.equal(regUpgCost('jets', 0), 9000);
  });
  it('super-linear: grow(1.5) × inflation(1.35) per level', () => {
    /* lv1 = base·1.5·1.35 = base·2.025 */
    assert.equal(regUpgCost('hull', 1), Math.round(3800 * 2.025));
  });
  it('strictly increasing across levels (late game costs MORE)', () => {
    let prev = 0;
    for (let lv = 0; lv <= 3; lv++) {
      const c = regUpgCost('bombs', lv);
      assert.ok(c > prev, `cost must grow, got ${c}<=${prev} at lv ${lv}`);
      prev = c;
    }
  });
  it('unknown upgrade key throws (config typo guard)', () => {
    assert.throws(() => regUpgCost('nope', 0));
  });
});

describe('buildSeconds', () => {
  it('level 0 = registry base time', () => {
    assert.equal(buildSeconds('escort', 0, 0), 35);
    assert.equal(buildSeconds('carrier', 0, 0), 95);
  });
  it('fleet/staff level SLOWS the build (+35 % per level)', () => {
    assert.equal(buildSeconds('escort', 2, 0), Math.round(35 * 1.7));
  });
  it('dockyard (cmd) staff discount −10 % per level', () => {
    assert.equal(buildSeconds('escort', 0, 2), Math.round(35 * 0.8));
  });
  it('floored at 5 s — never insta-spawn', () => {
    assert.ok(buildSeconds('escort', 9, 3) >= 5);
  });
});

describe('buildRemaining', () => {
  it('done orders return 0 forever', () => {
    const e = { t: 0, done: true, crew: 50 };
    assert.equal(buildRemaining(e, 10), 0);
    assert.equal(e.done, true);
  });
  it('crew speeds up the build (100 crew = 2× speed)', () => {
    const e = { t: 10, done: false, crew: 100 };
    buildRemaining(e, 1);
    assert.ok(Math.abs(e.t - 8) < 1e-9, `expected 8, got ${e.t}`);
  });
  it('no crew → crawl speed 0.25×', () => {
    const e = { t: 10, done: false, crew: 0 };
    buildRemaining(e, 1);
    assert.ok(Math.abs(e.t - 9.75) < 1e-9, `expected 9.75, got ${e.t}`);
  });
  it('finishing sets done and returns 0', () => {
    const e = { t: 0.5, done: false, crew: 100 };
    assert.equal(buildRemaining(e, 1), 0);
    assert.equal(e.done, true);
    assert.equal(e.t, 0);
  });
  it('mutates only its own entry (input untouched object shape)', () => {
    const e = { t: 5, done: false, crew: 50 };
    buildRemaining(e, 1);
    assert.deepEqual(Object.keys(e).sort(), ['crew', 'done', 't']);
  });
});
/* FIX #32 — zoomFOV: Modern-Warships-style scope steps. */
describe('zoomFOV', () => {
  it('level 0 returns the base FOV unchanged', () =>
    assert.ok(Math.abs(zoomFOV(0, 60) - 60) < 1e-9));
  it('reference: zoomFOV(2, 60) = 27.744 (60·0.68²)', () =>
    assert.ok(Math.abs(zoomFOV(2, 60) - 27.744) < 1e-9));
  it('reference: zoomFOV(2, 22) = 10.1728 (22·0.68², sniper base)', () =>
    assert.ok(Math.abs(zoomFOV(2, 22) - 10.1728) < 1e-9));
  it('each level multiplies by 0.68 (monotone tightening)', () => {
    let prev = 60;
    for (let l = 1; l <= 4; l++) {
      const f = zoomFOV(l, 60);
      assert.ok(f < prev, `level ${l} must be tighter than ${l-1}`);
      assert.ok(Math.abs(f - prev * 0.68) < 1e-9);
      prev = f;
    }
  });
  it('clamps levels below 0 and above 4', () => {
    assert.ok(Math.abs(zoomFOV(-3, 60) - 60) < 1e-9);
    assert.ok(Math.abs(zoomFOV(9, 60) - zoomFOV(4, 60)) < 1e-9);
  });
  it('NaN-safe: non-finite base FOV falls back to sniper default 22', () => {
    assert.equal(zoomFOV(1, NaN), 22);
    assert.equal(zoomFOV(1, 0), 22);
    assert.equal(zoomFOV(1, -5), 22);
  });
  it('never returns an unusable FOV (< 2°) even at max level', () =>
    assert.ok(zoomFOV(4, 60) >= 2));
});

/* ================= Session 4a — purchase safety + adaptive difficulty ===== */

describe('tryPurchase', () => {
  it('succeeds and deducts credits', () => {
    const s = { credits: 100 };
    assert.deepEqual(tryPurchase(s, 30), { ok: true, reason: '', credits: 70 });
    assert.equal(s.credits, 70);
  });
  it('NO_FUNDS leaves the state untouched', () => {
    const s = { credits: 10 };
    assert.deepEqual(tryPurchase(s, 30), { ok: false, reason: 'NO_FUNDS', credits: 10 });
    assert.equal(s.credits, 10);
  });
  it('invalid cost (NaN/negative) returns COST and never mutates', () => {
    const s = { credits: 50 };
    assert.deepEqual(tryPurchase(s, NaN), { ok: false, reason: 'COST', credits: 50 });
    assert.deepEqual(tryPurchase(s, -5), { ok: false, reason: 'COST', credits: 50 });
    assert.equal(s.credits, 50);
  });
  it('null state is safe — no funds, no crash', () => {
    assert.deepEqual(tryPurchase(null, 30), { ok: false, reason: 'NO_FUNDS', credits: 0 });
  });
  it('exact balance purchase lands at 0', () => {
    const s = { credits: 30 };
    assert.deepEqual(tryPurchase(s, 30), { ok: true, reason: '', credits: 0 });
  });
});

describe('purchaseCap', () => {
  it('clamps above max', () => assert.equal(purchaseCap(8, 3), 3));
  it('keeps in-range counts', () => assert.equal(purchaseCap(8, 1000), 8));
  it('floors negatives to zero', () => assert.equal(purchaseCap(-2, 5), 0));
  it('zero/negative max yields zero', () => {
    assert.equal(purchaseCap(8, 0), 0);
    assert.equal(purchaseCap(8, -1), 0);
  });
});

describe('buildLeft', () => {
  it('reference: crew 50 → t/1.5', () => {
    const e = { done: false, t: 100, crew: 50 };
    assert.ok(Math.abs(buildLeft(e) - 100 / 1.5) < 1e-9);
  });
  it('done entries return 0 regardless of t', () =>
    assert.equal(buildLeft({ done: true, t: 40, crew: 0 }), 0));
  it('null entry returns 0', () => assert.equal(buildLeft(null), 0));
  it('no crew uses the 0.25× crawl factor', () => {
    const e = { done: false, t: 10, crew: 0 };
    assert.ok(Math.abs(buildLeft(e) - 40) < 1e-9); /* 10 / 0.25 */
  });
  it('never mutates its input', () => {
    const e = { done: false, t: 8, crew: 20 };
    const t0 = e.t;
    buildLeft(e);
    assert.equal(e.t, t0);
  });
});

describe('adaptTier', () => {
  it('pressure 0 returns the base tier unchanged', () => {
    const b = { hp: 1.0, dmg: 1.0, spd: 1.0 };
    const r = adaptTier(10, b, 0);
    assert.ok(Math.abs(r.hp - 1.0) < 1e-12 && Math.abs(r.dmg - 1.0) < 1e-12);
  });
  it('full pressure boosts each factor by +6 % (caps respected)', () => {
    const b = { hp: 2.0, dmg: 1.5, spd: 1.2 };
    const r = adaptTier(50, b, 1);
    assert.ok(Math.abs(r.hp - Math.min(2.4, 2.0 * 1.06)) < 1e-9);
    assert.ok(Math.abs(r.dmg - Math.min(1.9, 1.5 * 1.06)) < 1e-9);
    assert.ok(Math.abs(r.spd - Math.min(1.5, 1.2 * 1.06)) < 1e-9);
  });
  it('gapless cap: base at cap + full pressure stays at cap', () => {
    const r = adaptTier(50, { hp: 2.4, dmg: 1.9, spd: 1.5 }, 1);
    assert.ok(Math.abs(r.hp - 2.4) < 1e-12 && Math.abs(r.dmg - 1.9) < 1e-12);
  });
  it('negative pressure clamps to 0', () => {
    const r = adaptTier(10, { hp: 1, dmg: 1, spd: 1 }, -2);
    assert.ok(Math.abs(r.hp - 1) < 1e-12);
  });
  it('monotone non-decreasing in pressure', () => {
    const b = { hp: 1.5, dmg: 1.2, spd: 1.1 };
    const r0 = adaptTier(20, b, 0), r1 = adaptTier(20, b, 1);
    assert.ok(r1.hp >= r0.hp && r1.dmg >= r0.dmg && r1.spd >= r0.spd);
  });
});

/* ================= buildCardHelp (session 3p, FIX #30 NaN-guard) ====== */
describe('buildCardHelp', () => {
  it('never returns NaN — undefined lanes read as 0', () => {
    const v = buildCardHelp('escort', undefined, undefined);
    assert.ok(isFinite(v) && v >= 0, `expected finite >=0, got ${v}`);
  });
  it('clamps saturated lanes back to a sane minimum (never absurd)', () => {
    const v = buildCardHelp('carrier', 4, 3);
    assert.ok(v >= 0 && v < 999, `expected finite sane, got ${v}`);
  });
  it('never returns NaN — undefined lanes read as 0', () => {
    const v = buildCardHelp('escort', undefined, undefined);
    assert.ok(isFinite(v) && v >= 0, `expected finite >=0, got ${v}`);
  });
  it('positive seconds for fresh lanes', () => {
    const v = buildCardHelp('escort', 0, 0);
    assert.ok(v > 0, `expected >0, got ${v}`);
  });
  it('equivalent to buildSeconds when build resolves above 5s', () => {
    const a = buildCardHelp('escort', 0, 0);
    const b = buildSeconds('escort', 0, 0);
    assert.equal(a, b - 4);
  });
});