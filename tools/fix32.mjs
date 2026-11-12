#!/usr/bin/env node
/* FIX #32 — dockyard: info on demand (I key / ℹ button).
   CSS: .overlay button (0,1,1) out-specified .minibtn (0,1,0) → card buttons
   were 18px/40px+14px → INFO overlapped price button. Scoped minibtn rules.
   JS: descriptions removed from cards; only ℹ / I opens infoModal. */
import { readFileSync, writeFileSync } from 'node:fs';

const P = 'C:/Users/ggjon/Desktop/ship fighter';
const read = (f, crlf) => {
  const raw = readFileSync(`${P}/${f}`, 'utf8');
  return crlf ? raw : raw.replace(/\r\n/g, '\n');
};
const write = (f, s) => writeFileSync(`${P}/${f}`, s.replace(/\n/g, '\r\n'), 'utf8');

function apply(src, pairs, label) {
  for (const [oldS, newS] of pairs) {
    const idx = src.indexOf(oldS);
    if (idx < 0) { console.log(`FAIL ${label}: pattern not found:\n---\n${oldS.slice(0, 200)}\n---`); process.exit(1); }
    if (src.indexOf(oldS, idx + 1) >= 0) { console.log(`FAIL ${label}: matched MULTIPLE times:\n---\n${oldS.slice(0, 120)}`); process.exit(1); }
    src = src.slice(0, idx) + newS + src.slice(idx + oldS.length);
  }
  return src;
}
/* ---------------- game.js: R1–R5 ---------------- */
let g = read('js/game.js', false);

g = apply(g, [
  [`<h3>\${it.name}</h3><p>\${it.desc}</p>\n      <div class="lvl">LEVEL \${lv}/\${it.max}</div>`,
   `<h3>\${it.name}</h3>\n      <div class="lvl">LEVEL \${lv}/\${it.max}</div>`],
  [`    div.querySelector('.info').onclick=e=>{e.stopPropagation();showInfo(it.name,upgradeInfoHTML(it),()=>buy(it));};`,
   `    const openIt=()=>showInfo(it.name,upgradeInfoHTML(it),()=>buy(it));
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openIt();};
    div.addEventListener('mouseenter',()=>{_infoHover=openIt;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openIt)_infoHover=null;});`],
  [`<h3>\${w.name}</h3><p>\${w.desc}</p>\n      <div class="lvl">\${curWeapon===w.k?'EQUIPPED':'TAP TO EQUIP'}</div>`,
   `<h3>\${w.name}</h3>\n      <div class="lvl">\${curWeapon===w.k?'EQUIPPED':'TAP TO EQUIP'}</div>`],
  [`    div.querySelector('.info').onclick=e=>{e.stopPropagation();showInfo(w.name,\`<p>\${w.desc}</p>\`);};`,
   `    const openW=()=>showInfo(w.name,\`<p>\${w.desc}</p>\`);
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openW();};
    div.addEventListener('mouseenter',()=>{_infoHover=openW;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openW)_infoHover=null;});`],
  [`  ammoDiv.innerHTML=\`<h3>💣 MUNITIONS CRATE</h3><p>+25 ammo for the whole fleet — escorts, jets &amp; bombs all draw from this pool.</p>\n    <div class="lvl">POOL \${fleet.ammo}/\${AMMO_CAP}</div><div class="cost \${(!aFull&&credits<aCost)?'no':''}">\${aFull?'MAGAZINES FULL':aCost+' CR'}</div>\`;`,
   `  ammoDiv.innerHTML=\`<h3>💣 MUNITIONS CRATE</h3>\n    <div class="lvl">POOL \${fleet.ammo}/\${AMMO_CAP}</div><div class="cost \${(!aFull&&credits<aCost)?'no':''}">\${aFull?'MAGAZINES FULL':aCost+' CR'}</div>\n    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>\`;`],
  [`  ammoDiv.onclick=()=>{`,
   `  const openCrate=()=>showInfo('💣 MUNITIONS CRATE',\`<p>+25 ammo for the whole fleet — escorts, jets &amp; bombs all draw from this pool.</p><div class="infoRow"><b>Pool</b><span>\${fleet.ammo}/\${AMMO_CAP}</span></div><div class="infoRow"><b>Next crate</b><span>\${aCost} CR</span></div>\`);
  ammoDiv.querySelector('.info').onclick=e=>{e.stopPropagation();openCrate();};
  ammoDiv.addEventListener('mouseenter',()=>{_infoHover=openCrate;});
  ammoDiv.addEventListener('mouseleave',()=>{if(_infoHover===openCrate)_infoHover=null;});
  ammoDiv.onclick=()=>{`],
], 'game.js R1–R5');

write('js/game.js', g);
console.log('game.js R1–R5 OK');
/* ---------------- game.js: R6–R8 ---------------- */
g = read('js/game.js', false);
g = apply(g, [
  [`  ms.innerHTML=\`<h3>🔫 SHELL MAGAZINE</h3><p>\${ORD_TYPES[armory.shell]?.desc||''}</p>\n    <div class="lvl">STOCK \${fleet.ammo} · accuracy up +12%/lv in DOCKYARD</div>\${shOpts}\${shFill}<div class="cost">SELECT TO EQUIP</div>\`;`,
   `  ms.innerHTML=\`<h3>🔫 SHELL MAGAZINE</h3>\n    <div class="lvl">STOCK \${fleet.ammo} · accuracy up +12%/lv in DOCKYARD</div>\${shOpts}\${shFill}<div class="cost">SELECT TO EQUIP</div>\n    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>\`;`],
  [`  ms.querySelectorAll('.ordRow').forEach(r=>{`,
   `  const openShell=()=>showInfo('🔫 SHELL MAGAZINE',\`<p>\${ORD_TYPES[armory.shell]?.desc||'Pick a shell type below — each row shows its profile.'}</p>\`);
  ms.querySelector('.info').onclick=e=>{e.stopPropagation();openShell();};
  ms.addEventListener('mouseenter',()=>{_infoHover=openShell;});
  ms.addEventListener('mouseleave',()=>{if(_infoHover===openShell)_infoHover=null;});
  ms.querySelectorAll('.ordRow').forEach(r=>{`],
  [`  mm.innerHTML=\`<h3>🚀 MISSILE DECK</h3><p>\${MSL_TYPES[armory.msl]?.desc||''}</p>\n    <div class="lvl">STOCK \${fleet.ammo} · salvo costs \${mslCost(armory.msl,1)*2} ammo · reload chain 30→120s</div>\${msOpts}\${msFill}<div class="cost">SELECT TO EQUIP</div>\`;`,
   `  mm.innerHTML=\`<h3>🚀 MISSILE DECK</h3>\n    <div class="lvl">STOCK \${fleet.ammo} · salvo costs \${mslCost(armory.msl,1)*2} ammo · reload chain 30→120s</div>\${msOpts}\${msFill}<div class="cost">SELECT TO EQUIP</div>\n    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>\`;`],
  [`  mm.querySelectorAll('.ordRow').forEach(r=>{`,
   `  const openMs=()=>showInfo('🚀 MISSILE DECK',\`<p>\${MSL_TYPES[armory.msl]?.desc||'Pick a missile type below — each row shows its seeker profile.'}</p>\`);
  mm.querySelector('.info').onclick=e=>{e.stopPropagation();openMs();};
  mm.addEventListener('mouseenter',()=>{_infoHover=openMs;});
  mm.addEventListener('mouseleave',()=>{if(_infoHover===openMs)_infoHover=null;});
  mm.querySelectorAll('.ordRow').forEach(r=>{`],
  [`    div.innerHTML=\`<h3>\${R.name}</h3><p>Register a new hull — builds in ~\${R.build}s, then fights autonomously. Sunk ships auto-repair at the dockyard.</p>\n      <div class="lvl">IN SERVICE \${own}/\${R.max}</div>\n      <div class="cost \${(credits<cost&&!capFull)?'no':''}">\${capFull?'CLASS FULL':cost+' CR'}</div>\`;`,
   `    div.innerHTML=\`<h3>\${R.name}</h3>\n      <div class="lvl">IN SERVICE \${own}/\${R.max}</div>\n      <div class="cost \${(credits<cost&&!capFull)?'no':''}">\${capFull?'CLASS FULL':cost+' CR'}</div>\n      <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>\`;`],
  [`    div.onclick=()=>{`,
   `    const openReg=()=>showInfo(R.name,\`<p>Register a new hull — builds in ~\${R.build}s, then fights autonomously. Sunk ships auto-repair at the dockyard.</p><div class="infoRow"><b>Build</b><span>~\${R.build}s</span></div><div class="infoRow"><b>Class size</b><span>\${own}/\${R.max} in service</span></div>\`);
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openReg();};
    div.addEventListener('mouseenter',()=>{_infoHover=openReg;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openReg)_infoHover=null;});
    div.onclick=()=>{`],
], 'game.js R6–R8');
write('js/game.js', g);
console.log('game.js R6–R8 OK');
/* ---------------- game.js: R9–R10 ---------------- */
g = read('js/game.js', false);
g = apply(g, [
  [`let shopTab='upg';\nconst TAB_KEYS=['upg','weapon','fleet'];`,
   `let shopTab='upg';\n/* FIX: #32 — pressing I opens the info card of the hovered dockyard card. */\nlet _infoHover=null;\nconst TAB_KEYS=['upg','weapon','fleet'];`],
  [`  if(e.code==='Tab'&&!e.repeat&&state==='play'&&player&&!player.dead&&!devOpen&&!devPwOpen){\n    e.preventDefault();uiOpen?closeWerft():openWerft();return;}\n  if(e.repeat)return;`,
   `  if(e.code==='Tab'&&!e.repeat&&state==='play'&&player&&!player.dead&&!devOpen&&!devPwOpen){\n    e.preventDefault();uiOpen?closeWerft():openWerft();return;}\n  if(e.code==='KeyI'&&!e.repeat&&uiOpen){ /* FIX: #32 — info card on demand: I toggles the hovered card's info */\n    const im=$('infoModal');\n    if(im&&!im.classList.contains('hidden'))hideInfo();\n    else if(_infoHover){_infoHover();}\n    return;}\n  if(e.repeat)return;`],
], 'game.js R9–R10');
write('js/game.js', g);
console.log('game.js R9–R10 OK');

/* ---------------- styles.css ---------------- */
let c = read('css/styles.css', false);
c = apply(c, [
  [`{display:flex;gap:6px;margin-top:6px}
.minibtn{pointer-events:auto;cursor:pointer;font-family:'Orbitron';font-size:12px;letter-spacing:1px;padding:4px 10px;background:transparent;color:var(--cyan);border:1px solid rgba(76,195,255,.5);transition:.12s}
.minibtn:hover{background:var(--cyan);color:#12202e}
.minibtn.buy{color:var(--grn);border-color:rgba(80,220,120,.6)}
.minibtn.buy:hover{background:var(--grn);color:#12202e}
.minibtn.buy.off,.minibtn[disabled]{opacity:.4;cursor:default}
.minibtn.buy.poor{color:var(--red);border-color:rgba(255,90,74,.6)}`,
   `{display:flex;gap:6px;margin-top:6px;flex-wrap:nowrap}
/* FIX: #32 — .overlay button (0,1,1) out-specified the plain .minibtn (0,1,0),
   so every dockyard card button was forced to 18px/40px padding + 14px top
   margin and the ℹ INFO button overlapped the price button (screenshot bug).
   Scoping to #werft/#infoModal (1,1,0) restores the compact in-card buttons
   WITHOUT touching the big overlay buttons. */
#werft .minibtn,#infoModal .minibtn{pointer-events:auto;cursor:pointer;font-family:'Orbitron';font-size:12px;letter-spacing:1px;padding:4px 10px;background:transparent;color:var(--cyan);border:1px solid rgba(76,195,255,.5);transition:.12s;white-space:nowrap}
#werft .minibtn:hover,#infoModal .minibtn:hover{background:var(--cyan);color:#12202e}
#werft .minibtn.info,#infoModal .minibtn.info{color:var(--amber);border-color:rgba(255,183,3,.6)}
#werft .minibtn.info:hover,#infoModal .minibtn.info:hover{background:rgba(255,183,3,.18);color:var(--amber)}
#werft .minibtn.buy,#infoModal .minibtn.buy{color:var(--grn);border-color:rgba(80,220,120,.6)}
#werft .minibtn.buy:hover,#infoModal .minibtn.buy:hover{background:var(--grn);color:#12202e}
#werft .minibtn.buy.off,#infoModal .minibtn.buy.off,#werft .minibtn[disabled],#infoModal .minibtn[disabled]{opacity:.4;cursor:default}
#werft .minibtn.buy.poor,#infoModal .minibtn.buy.poor{color:var(--red);border-color:rgba(255,90,74,.6)}`],
], 'styles.css');
write('css/styles.css', c);
console.log('FIX #32 applied: game.js + styles.css written.');