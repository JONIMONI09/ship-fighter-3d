---
name: ship-fighter
description: SCHIFFSBRUCH (ship fighter) project rules. Use when editing js/core.js, js/game.js, js/main.js, tests, tools, or docs in this repo — architecture layers, mandatory gates (node --check, npm test, npm run smoke), FIX: comment policy, TUNES/WEAPONS constants, no animate-loop allocations, admin-slider priority, waveRaw JS/GLSL parity, tryPurchase invariant, tool safety.
---

# SKILL.md — smart-context-agent project rules

- Multi-file ES modules: `js/core.js` (pure, Node-testable) → `js/game.js` (engine) → `js/main.js` (entry). Never import backwards.
- `node --check` all JS → `npm test` (124 pass expected) → `npm run smoke` (4/4 PASS, zero console errors) before "done".
- FIX: comments document every deliberate bug fix. Keep the numbered count in sync with `.clinerules/01-coding-standards.md` and docs/LESSONS.md — verify the next free FIX number BEFORE starting a fix.
- Units: meters, seconds. Constants live in `TUNES`/`WEAPONS`, never inline magic numbers.
- No allocations in the animate loop — reuse module temporaries (`_mp`, `_tv`, `_aim2`).
- Admin dev-sliders always apply LAST in every scaling chain (nothing may override them).
- All code comments, identifiers and markdown docs in English.
- Wave field parity: `waveRaw` in js/core.js must stay term-identical to the GLSL copy in the water shader.
- Purchases go through `tryPurchase()` (core.js) — credits never leave the player without receiving the item.
- Tool safety: never `taskkill /F /IM node.exe` — kill only spawned child processes by PID.
