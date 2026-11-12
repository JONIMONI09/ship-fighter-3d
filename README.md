# SCHIFFSBRUCH — ship fighter

Browser-based 3D naval combat: command a battleship, fight escalating waves,
manage leaks and flooding, and spend credits in the dockyard. three.js, ES
modules, **zero build step**.

**Official links**

- Repository: <https://github.com/JONIMONI09/ship-fighter-3d>
- Play online: <https://jonimoni09.github.io/ship-fighter-3d/>

## Play

Online via GitHub Pages (link above), or locally:

```
node server.mjs          # http://localhost:8123/
```

Open **`index.html`** — it is the only entry point. `Ship_fight_new.html`,
`served.html` and `live-8123.html` are archive snapshots kept for reference;
they are not the current game.

Internet is needed for three.js and the web fonts. If the CDN cannot load, the
page shows a boot error instead of a black screen. `node tools/vendor.mjs`
downloads local copies for offline use.

## Verify

```
node tools/gates.mjs     # all gates: syntax, tests, audits, smoke
node --test tests/core.test.js
node tools/smoke.mjs     # headless Chrome, boots and starts a run
```

`npm` aliases exist (`npm start`, `npm test`, `npm run smoke`), but the
`node` commands above are canonical and work without npm.

<!-- COUNTERS:START -->
| Counter | Value |
|---|---|
| `FIX:` markers in `js/game.js` | 115 |
| Distinct numbered fixes | 32 |
| Highest `FIX` number | #41 |
| Unit tests | 124 |
<!-- COUNTERS:END -->

## Controls (verified against `js/game.js`)

| Input | Action |
|---|---|
| W / S | Throttle / reverse |
| A / D | Rudder |
| Mouse | Aim all turrets |
| LMB | Fire |
| 1 / 2 / 3, wheel | Main battery / machine gun / rocket pod |
| RMB hold / MMB | Zoom (wheel steps the scope) |
| E | Launch / recall drones; on the map: cycle ship mode |
| R | Damage control |
| TAB | Dockyard |
| I | Info card for the hovered shop card |
| M | Tactical map |
| F (map open) | Follow / hold the selected ship |
| ESC | Close info → dockyard → dev console → map, then pause |
| Touch | Joystick, FIRE, ZOOM, DOCK, MAP, HUD weapon/drone/DC buttons |

## Features

- **Boss fights** every fifth wave: cruiser, battleship (homing salvoes),
  carrier (jets and dive bombs), up to three bosses from wave 30.
- **Buoyancy simulation**: four chambers, progressive flooding, listing,
  sinking, damage control that consumes crew.
- **Dockyard**: 11 upgrade lanes, hull growth, alloy plating, turrets, drones,
  crew; tabbed shop with explicit BUY/EQUIP buttons and full info cards.
- **Fleet**: escort wing, FLEET COMMAND registry with build timers, per-ship
  upgrades, carriers with strike jets, shared ammo pool.
- **Ordnance**: six shell types, four missile types, escalating restock
  prices, no-cheat reload chain.
- **Tactical map**: select ships, box-select, priority targets, auto /
  aggressive / passive, follow / hold.
- Touch controls and a crash screen with a copyable stack trace.

## Cheat console / god mode

No Ctrl key is involved.

1. Start a run.
2. Hold **H** and press **C** while H is still down (either order works).
3. Password: **`admin`** (default; stored as `sb_dev_pw`).
4. In `TOGGLES`, enable **GOD MODE**, **INFINITE HP**, **NO RELOAD**,
   **AIMBOT**, **AIM ASSIST**, or turn **ENEMIES FIRE BACK** off.
5. **ESC** closes. **REBIND TRIGGER KEYS** accepts two new keys within 15 s;
   a timeout restores H+C. **RESET ALL DEFAULTS** restores every slider.

God mode also clears flooding and fires now, so it cannot be sunk by leaks.
A run with any cheat enabled is marked **CHEATED RUN — not ranked** and never
becomes the stored best score.

## Structure

```
index.html            DOM shell, importmap, HUD, menus
css/styles.css        all styling
js/core.js            pure simulation (no imports, runs in Node)
js/game.js            engine: scene, ships, AI, weapons, HUD, input
js/main.js            entry, ?autostart=1 for the smoke gate
tests/core.test.js    124 unit tests
tools/                gates, smoke, audits, counters, vendor, review/brainstorm
docs/                 project map, lessons, error report, plan
legacy/               original single-file build (reference)
```

New pure mechanics go to `js/core.js` plus a test; gameplay goes to
`js/game.js` with constants in `TUNES`/`WEAPONS`. `js/core.js` must stay pure,
the GLSL wave copy must stay identical to `waveRaw`, and admin multipliers
must stay last in every scaling chain.

## Credits

three.js 0.163.0 (MIT) · Orbitron and Rajdhani (SIL Open Font License).
See `THIRD_PARTY.md`; the project code is MIT (`LICENSE`).
