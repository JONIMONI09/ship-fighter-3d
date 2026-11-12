/* Zero-dependency gate runner. Canonical verification command:
 *   node tools/gates.mjs
 * Runs every gate in order, prints one PASS/FAIL line each, and exits non-zero
 * if any gate fails. Does not need npm and does not write into the repository.
 */
import { spawnSync } from 'node:child_process';

const NODE = process.execPath;
const steps = [
  ['syntax core', [NODE, '--check', 'js/core.js']],
  ['syntax game', [NODE, '--check', 'js/game.js']],
  ['syntax main', [NODE, '--check', 'js/main.js']],
  ['unit tests', [NODE, '--test', 'tests/core.test.js']],
  ['engine reference scan', [NODE, 'tools/engine-scan.mjs']],
  ['DOM id audit', [NODE, 'tools/id-audit.mjs']],
  ['doc counters', [NODE, 'tools/counters.mjs', '--check']],
  ['headless smoke', [NODE, 'tools/smoke.mjs']],
];

let failed = 0;
for (const [name, args] of steps) {
  console.log('\n=== ' + name + ' ===');
  const r = spawnSync(args[0], args.slice(1), { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log('GATE FAIL: ' + name); }
}
console.log('\n' + (failed ? 'GATES: ' + failed + ' FAILED' : 'GATES: ALL PASS'));
process.exit(failed ? 1 : 0);
