/* FIX #31: shop layout — auto-fit grids, panel scroll, red X close button.
 * Applied 2026-09-14. Idempotent-ish: throws if anchors already replaced.
 * Run: node tools/fix31.mjs  (from project root) */
import fs from 'node:fs';
const base = 'C:/Users/ggjon/Desktop/ship fighter/';
let ok = 0;

const cp = base + 'css/styles.css';
let css = fs.readFileSync(cp, 'utf8');
const reps = [
  ['#shop{display:grid;grid-template-columns:repeat(4,210px);gap:12px;margin:14px 0}',
   '#shop{display:grid;grid-template-columns:repeat(auto-fit,210px);gap:12px;margin:14px 0;max-width:min(96vw,920px)}'],
  ['#werft{cursor:default}',
   `#werft{cursor:default}
#werftX{position:absolute;top:14px;right:18px;font-family:'Orbitron';font-size:26px;color:var(--red);background:transparent;border:2px solid var(--red);width:44px;height:44px;line-height:1;cursor:pointer;pointer-events:auto;transition:.12s}
#werftX:hover{background:rgba(239,71,111,.25);color:#ffd7de}
.shopPanel{max-width:96vw;overflow-x:auto;padding:0 4px}`],
  ['#fleetBay{display:grid;grid-template-columns:repeat(3,210px);gap:12px;margin:10px 0 4px;max-height:32vh;overflow-y:auto;padding-right:4px;width:fit-content;max-width:100%}',
   '#fleetBay{display:grid;grid-template-columns:repeat(auto-fit,210px);gap:12px;margin:10px 0 4px;max-height:36vh;overflow-y:auto;padding-right:4px;width:100%;max-width:min(96vw,700px)}'],
  ['#weaponShop{display:grid;grid-template-columns:repeat(3,210px);gap:12px;margin:10px 0 4px;width:fit-content;max-width:100%}',
   '#weaponShop{display:grid;grid-template-columns:repeat(auto-fit,210px);gap:12px;margin:10px 0 4px;width:100%;max-width:min(96vw,700px)}'],
];
for (const [o, n] of reps) {
  if (!css.includes(o)) throw new Error('CSS anchor missing: ' + o.slice(0, 40));
  css = css.replace(o, n); ok++;
}
fs.writeFileSync(cp, css, 'utf8');

const hp = base + 'index.html';
let html = fs.readFileSync(hp, 'utf8');
const hOld = '  <button id="werftClose">▶ RESUME [TAB]</button>';
if (!html.includes(hOld)) throw new Error('HTML anchor missing');
html = html.replace(hOld, '  <button id="werftX" title="Close (TAB)">✕</button>\r\n' + hOld);
fs.writeFileSync(hp, html, 'utf8'); ok++;

const gp = base + 'js/game.js';
let js = fs.readFileSync(gp, 'utf8');
const jOld = "$('werftClose').addEventListener('click',closeWerft);";
if (!js.includes(jOld)) throw new Error('JS anchor missing');
js = js.replace(jOld, "$('werftX').addEventListener('click',closeWerft);\r\n" + jOld);
fs.writeFileSync(gp, js, 'utf8'); ok++;

console.log('FIX31 APPLIED:', ok, 'edits (4 CSS + 1 HTML + 1 JS)');

// ---- CSS ----
