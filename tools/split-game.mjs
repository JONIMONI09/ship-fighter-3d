/* Rewires legacy/game.js to import the pure core module.
 * - removes duplicate pure definitions (waveRaw, fillFloods, helpers)
 * - injects the import statement
 * Run: node tools/split-game.mjs        (rewrite)
 *      node tools/split-game.mjs --verify  (only check no leftovers)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gamePath = path.join(root, 'js', 'game.js');
if (existsSync(gamePath) && !process.argv.includes('--force')) {
  console.log('js/game.js exists — kept (hand-maintained). Use --force to regenerate.');
  process.exit(0);
}
let js = readFileSync(path.join(root, 'legacy', 'game.js'), 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n');   // normalize CRLF -> LF so patterns match

// 1) helpers block: keep three temp vectors, drop redefined pure helpers
js = js.replace(
  `const TAU=Math.PI*2, UP=new THREE.Vector3(0,1,0),\n      XA=new THREE.Vector3(1,0,0), ZA=new THREE.Vector3(0,0,1);\nconst clamp=THREE.MathUtils.clamp;\nconst rand=(a,b)=>a+Math.random()*(b-a);\nconst wrapPI=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;};`,
  `const UP=new THREE.Vector3(0,1,0),\n      XA=new THREE.Vector3(1,0,0), ZA=new THREE.Vector3(0,0,1);`
);

// 2) waveRaw now comes from core (waveH stays as WSCALE-aware wrapper)
js = js.replace(
  `function waveRaw(x,z,t){\n  return 0.85*Math.sin(x*0.45+z*0.16+t*1.05)\n       + 0.50*Math.sin(x*0.72-z*0.83+t*1.70)\n       + 0.30*Math.sin(-x*0.35+z*1.12+t*2.40)\n       + 0.20*Math.sin(x*1.10+z*0.90+t*3.00)\n       + 0.08*Math.sin(x*3.10-z*2.30+t*4.00)\n       + 0.06*Math.sin(x*2.70+z*3.30+t*3.60);\n}\n`,
  `/* FIX: waveRaw lives in js/core.js (single source, unit-tested).\n   The GLSL copy in the water shader below must stay identical. */\n`
);

// 3) fillFloods now comes from core
js = js.replace(/\/\* ================= Progressive flooding ================= \*\/\nfunction fillFloods[\s\S]*?\n\}\n\n/, `/* FIX: fillFloods lives in js/core.js (unit-tested). */\n`);

// 4) solveElev: keep call sites, delegate to pure core (uses global G)
js = js.replace(
  `function solveElev(R,v){return .5*Math.asin(clamp(R*G/(v*v),0,1));}`,
  `const solveElev=(R,v)=>solveElevG(R,v,G); /* FIX: pure impl in core.js */`
);

// 5) inject import right after the THREE import
js = js.replace(
  `import * as THREE from 'three';`,
  `import * as THREE from 'three';\nimport { TAU, clamp, rand, wrapPI, waveRaw, fillFloods, solveElev as solveElevG } from './core.js';`
);

writeFileSync(gamePath, js);

const leftovers = ['function waveRaw', 'function fillFloods', 'function solveElev(']
  .filter(s => js.includes(s));
const missing = ["from './core.js'"].filter(s => !js.includes(s));
if (leftovers.length || missing.length) {
  console.error('VERIFY FAIL', { leftovers, missing });
  process.exit(1);
}
console.log('game.js rewired OK,', js.split('\n').length, 'lines');
