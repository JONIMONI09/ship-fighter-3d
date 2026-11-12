/* Extracts CSS and JS from legacy/Ship_fight_new.html into
 * css/styles.css, legacy/game.js and a properly spliced index.html.
 * Run: node tools/split.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = readFileSync(path.join(root, 'legacy', 'Ship_fight_new.html'), 'utf8').replace(/^\uFEFF/, '');
mkdirSync(path.join(root, 'css'), { recursive: true });

const s0 = src.indexOf('<style>');
const s1 = src.indexOf('</style>');
const css = src.slice(s0 + 7, s1);
writeFileSync(path.join(root, 'css', 'styles.css'), css.trim() + '\n');

const j0 = src.indexOf('<script type="module">');
const jsStart = src.indexOf('>', j0) + 1;
const j1 = src.indexOf('</script>', jsStart);
const js = src.slice(jsStart, j1);
writeFileSync(path.join(root, 'legacy', 'game.js'), js.trim() + '\n');

// Single-pass splice on the ORIGINAL string (indices stay valid):
// [head]<style>...</style>[importmap + body ...]  ->  link + main.js
const html = src.slice(0, s0)
  + '<link rel="stylesheet" href="./css/styles.css">'
  + src.slice(s1 + 8, j0)
  + '<script type="module" src="./js/main.js"></script>'
  + src.slice(j1 + 9);
writeFileSync(path.join(root, 'index.html'), html);

console.log('split OK: css', css.split('\n').length, 'lines, js', js.split('\n').length, 'lines, html', html.split('\n').length, 'lines');
