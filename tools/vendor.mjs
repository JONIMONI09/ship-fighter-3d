/* Offline vendoring helper. Run once in a normal terminal:
 *   node tools/vendor.mjs
 * Downloads three.js 0.163.0 and the two OFL fonts into vendor/, then prints
 * the importmap/font-face snippets to use. The game keeps working from the CDN
 * until this has been run; index.html has a boot watchdog for the offline case.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  ['https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js', 'vendor/three.module.js'],
  ['https://cdn.jsdelivr.net/npm/three@0.163.0/LICENSE', 'vendor/three.LICENSE'],
];
const fonts = [
  ['https://fonts.gstatic.com/s/rajdhani/v17/LDI2apCSOBg7S-QT7pb0EPOreec.woff2', 'vendor/fonts/rajdhani-500.woff2'],
  ['https://fonts.gstatic.com/s/rajdhani/v17/LDI2apCSOBg7S-QT7pb0EPOreec.woff2', 'vendor/fonts/rajdhani-600.woff2'],
  ['https://fonts.gstatic.com/s/orbitron/v31/yMJRMIlzdpvBhQQL_Qq7dys.woff2', 'vendor/fonts/orbitron-700.woff2'],
];

async function grab(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(root, out);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  console.log('OK ' + out + ' (' + buf.length + ' bytes)');
}

for (const [url, out] of [...files, ...fonts]) {
  try { await grab(url, out); }
  catch (e) { console.log('SKIP ' + out + ' — ' + e.message); }
}
console.log('\nNow switch index.html to the local copy:');
console.log('  {"imports":{"three":"./vendor/three.module.js"}}');
console.log('and replace the Google Fonts @import with local @font-face rules.');
