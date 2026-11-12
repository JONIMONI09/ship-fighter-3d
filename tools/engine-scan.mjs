/* Conservative static reference scan for js/game.js.
 * Would have caught the historical `spawnEscort is not defined` crash:
 * every `name(` call site must resolve to a function/class/const/parameter in
 * the file, an import from core.js, or a known browser builtin. Comments,
 * string literals and template-literal text are stripped first (the water
 * shader is GLSL, not JS), while ${...} expressions are kept. Zero deps.
 */
import { readFileSync } from 'node:fs';

const raw = readFileSync('js/game.js', 'utf8');

function stripLiterals(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; out += ' '; continue; }
    if (src.startsWith('//', i)) { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; out += ' '; continue; }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++];
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    if (src[i] === '`') {
      i++; out += '`';
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          let depth = 1; i += 2; out += '${';
          while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (depth > 0) out += src[i];
            i++;
          }
          out += '}'; continue;
        }
        i++;
      }
      i++; out += '`'; continue;
    }
    out += src[i++];
  }
  return out;
}

const src = stripLiterals(raw);
const defined = new Set();

for (const m of src.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)/gm)) defined.add(m[1]);
for (const m of src.matchAll(/^\s*class\s+([A-Za-z_$][\w$]*)/gm)) defined.add(m[1]);
for (const m of src.matchAll(/(?:^|[;{}])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) defined.add(m[1]);
/* additional declarators / assignment targets: const X=..., Z=... */
for (const m of src.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
/* object/class shorthand methods: name(...) { */
for (const m of src.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) defined.add(m[1]);
/* destructured consts */
for (const m of src.matchAll(/^\s*(?:const|let|var)\s*\{([^}]+)\}\s*=/gm))
  for (const part of m[1].split(',')) defined.add(part.trim().split(':').pop().split('=')[0].trim());
/* function/method parameters are valid call targets */
for (const m of src.matchAll(/(?:function\s*[A-Za-z_$]?[\w$]*|^\s*[A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/gm))
  for (const part of m[1].split(','))
    for (const piece of part.split(/[={}\[\]:]/))
      if (/^[A-Za-z_$][\w$]*$/.test(piece.trim())) defined.add(piece.trim());

const imported = new Set(['THREE']);
for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from/g))
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop().trim();
    if (name) imported.add(name);
  }

const allow = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 'typeof',
  'delete', 'void', 'do', 'else', 'await', 'yield', 'super', 'in', 'of', 'case',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'alert', 'confirm', 'prompt', 'matchMedia', 'getComputedStyle',
  'structuredClone', 'URLSearchParams', 'AudioContext', 'Map', 'Set', 'Array',
  'Object', 'JSON', 'String', 'Number', 'Boolean', 'Math', 'Date', 'Promise',
  'Error', 'Image', 'FormData', 'Blob', 'URL', 'performance', 'navigator',
  'document', 'window', 'console', 'btoa', 'atob', 'encodeURIComponent',
  'decodeURIComponent', 'Intl', 'WeakMap', 'WeakSet', 'Float32Array', 'Uint8Array',
  'addEventListener', 'removeEventListener', 'dispatchEvent', 'getElementById',
]);

const calls = [...src.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[2]);
const missing = [...new Set(calls)].filter(n => !defined.has(n) && !imported.has(n) && !allow.has(n));

console.log('defined names: ' + defined.size + ' · imported: ' + imported.size + ' · call sites: ' + calls.length);
if (missing.length) {
  console.log('ENGINE SCAN: FAIL — undefined call targets: ' + missing.join(', '));
  process.exit(1);
}
console.log('ENGINE SCAN: PASS');
