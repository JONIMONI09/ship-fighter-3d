/* Single source of truth for the project counters.
 *   node tools/counters.mjs          print the block
 *   node tools/counters.mjs --write  rewrite the marked block in the docs
 *   node tools/counters.mjs --check  fail if a doc block is missing/stale
 * The shell may be read-only; --check is what the gate runner uses.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const game = readFileSync('js/game.js', 'utf8');
const tests = readFileSync('tests/core.test.js', 'utf8');
const markers = (game.match(/FIX:/g) || []).length;
const numbers = [...game.matchAll(/#(\d+)/g)].map(m => +m[1]);
const distinct = new Set(numbers).size;
const highest = numbers.length ? Math.max(...numbers) : 0;
const testCount = (tests.match(/\bit\(/g) || []).length;

const block = [
  '<!-- COUNTERS:START -->',
  '| Counter | Value |',
  '|---|---|',
  '| `FIX:` markers in `js/game.js` | ' + markers + ' |',
  '| Distinct numbered fixes | ' + distinct + ' |',
  '| Highest `FIX` number | #' + highest + ' |',
  '| Unit tests | ' + testCount + ' |',
  '<!-- COUNTERS:END -->',
].join('\n');

const files = ['README.md', 'docs/PROJECT_MAP.md', '.clinerules/01-coding-standards.md'];
const mode = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--check') ? 'check' : 'print';

if (mode === 'print') { console.log(block); process.exit(0); }

let bad = 0;
for (const file of files) {
  let src;
  try { src = readFileSync(file, 'utf8'); }
  catch (e) { console.log('MISSING ' + file); bad++; continue; }
  const start = src.indexOf('<!-- COUNTERS:START -->');
  const end = src.indexOf('<!-- COUNTERS:END -->');
  if (start < 0 || end < start) {
    console.log('NO COUNTERS BLOCK in ' + file); bad++; continue;
  }
  const current = src.slice(start, end + '<!-- COUNTERS:END -->'.length).replace(/\r\n/g, '\n');
  if (current !== block) {
    if (mode === 'write') {
      writeFileSync(file, src.slice(0, start) + block + src.slice(end + '<!-- COUNTERS:END -->'.length));
      console.log('UPDATED ' + file);
    } else {
      console.log('STALE COUNTERS in ' + file); bad++;
    }
  } else {
    console.log('OK ' + file);
  }
}
if (mode === 'check' && bad) { console.log('COUNTERS: FAIL (' + bad + ')'); process.exit(1); }
console.log(mode === 'write' ? 'COUNTERS: WRITTEN' : 'COUNTERS: OK');
