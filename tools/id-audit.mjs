/* Static DOM contract audit: duplicate ids in index.html and JS references
 * that point at an element the page does not define. Zero dependencies. */
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const js = readFileSync('js/game.js', 'utf8');

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const seen = new Set(), dupes = new Set();
for (const id of ids) { if (seen.has(id)) dupes.add(id); seen.add(id); }

const used = [...js.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]);
const missing = [...new Set(used)].filter(id => !seen.has(id));

console.log('HTML ids: ' + ids.length + ' · unique: ' + seen.size);
console.log('duplicate ids: ' + (dupes.size ? [...dupes].join(', ') : 'none'));
console.log('JS $() ids: ' + new Set(used).size + ' · missing in HTML: ' + (missing.length ? missing.join(', ') : 'none'));

if (dupes.size || missing.length) {
  console.log('ID AUDIT: FAIL');
  process.exit(1);
}
console.log('ID AUDIT: PASS');
