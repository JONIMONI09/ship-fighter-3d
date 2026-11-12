/* Entry point: the game module self-executes on import (menu, loop, input).
   ?autostart=1 boots straight into a run — used by tools/smoke.mjs. */
import './game.js';

if (new URLSearchParams(location.search).has('autostart')) {
  const start = document.getElementById('startBtn');
  if (start) setTimeout(() => start.click(), 0);
}
