/* Headless-Chrome smoke test: boots the real game, checks DOM + console errors.
 * Kills ONLY the processes it spawned (own browser PID tree + own server child).
 * OS-assigned free port, FRESH profile per attempt (a killed Chrome leaves
 * orphans that hold the profile SingletonLock and stall later attempts).
 * HARDENED: Chromium logs page console output as INFO:CONSOLE(n) regardless of
 * severity, so ANY console message fails the run (three.js shader errors are
 * INFO-level; the game emits zero console messages on a clean boot).
 * The DOM dump is diagnostic only and goes to os.tmpdir(): the repository is
 * not a scratch directory, and a dump failure must never abort the gate. */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';

function freePort(){
  return new Promise(res => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
function probe(port){
  return new Promise(res => {
    const c = net.connect(port, '127.0.0.1');
    c.on('connect', () => { c.end(); res(true); });
    c.on('error', () => res(false));
  });
}
const PORT = await freePort();
const server = spawn(process.execPath, [path.join(process.cwd(), 'server.mjs')],
  { stdio: 'ignore', env: { ...process.env, PORT: String(PORT) } });

let exitCode = 0;
try {
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 100)); up = await probe(PORT); }
  /* probe only proves the port is open — verify real HTTP before Chrome */
  let httpOk = false;
  for (let i = 0; i < 30 && !httpOk; i++) {
    try { const resp = await fetch(`http://127.0.0.1:${PORT}/`); httpOk = (await resp.text()).includes('id="startBtn"'); } catch { }
    if (!httpOk) await new Promise(r => setTimeout(r, 150));
  }
  if (!httpOk) { console.error('SMOKE FAIL: server up but never served real index'); exitCode = 1; }
  if (!up || !httpOk) { console.error('SMOKE FAIL: dev server never came up on port ' + PORT); exitCode = 1; }
  else {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  const browser = candidates.find(p => p && existsSync(p));
  if (!browser) { console.error('SMOKE FAIL: no Chrome/Edge found'); exitCode = 1; }
  else {
    let dom = '', r = null;
    for (let attempt = 1; attempt <= 3 && !dom.includes('id="startBtn"'); attempt++) {
      const profile = mkdtempSync(path.join(tmpdir(), 'sf-smoke-'));
      const args = ['--headless=new', '--no-proxy-server', '--disable-gpu', '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader', '--no-first-run', `--user-data-dir=${profile}`,
        '--enable-logging=stderr', '--v=0', '--virtual-time-budget=12000',
        '--timeout=20000', '--dump-dom',
        '--host-resolver-rules=MAP localhost 127.0.0.1',
        `http://127.0.0.1:${PORT}/?autostart=1`];
      r = spawnSync(browser, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
      dom = r.stdout || '';
      if (dom && !dom.includes('id="startBtn"')) console.log('(diag: attempt ' + attempt + ' non-game DOM, len ' + dom.length + ', title ' + ((dom.match(/<title>[^<]*<\/title>/) || ['?'])[0]) + ')');
      if (!dom) {
        console.log('(diag: attempt ' + attempt + ' empty DOM — status ' + r.status +
          ', err ' + (r.error && r.error.code) + ')');
        /* tree-kill ONLY our own browser child (never a global kill) */
        if (r.pid) { try { spawnSync('taskkill', ['/PID', String(r.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} }
      }
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
      if (!dom && attempt < 3) await new Promise(rr => setTimeout(rr, 500));
    }
    /* Diagnostic dump: temp dir only, never fails the gate. */
    let dumpPath = '(not written)';
    try {
      const dumpDir = mkdtempSync(path.join(tmpdir(), 'sf-smoke-dump-'));
      dumpPath = path.join(dumpDir, 'dom.html');
      writeFileSync(dumpPath, dom);
    } catch (e) {
      console.log('(diag: DOM dump failed ' + (e && e.code ? e.code : e) + ')');
    }
    const errors = ((r && r.stderr) || '').split('\n')
      .filter(l => /:CONSOLE\(\d+\)\]\s*"/.test(l) || /Uncaught/.test(l));
    const checks = {
      'DOM has startBtn': dom.includes('id="startBtn"'),
      'DOM has hud': dom.includes('id="hud"'),
      'DOM has canvas': /<canvas/i.test(dom),
      'no JS console errors': dom.length > 0 && errors.length === 0,
      'game started (state=play)': /data-state="play"/.test(dom),
    };
    for (const [k, v] of Object.entries(checks)) {
      console.log((v ? 'PASS' : 'FAIL') + '  ' + k);
      if (!v) exitCode = 1;
    }
    if (exitCode) console.log('(diag: DOM dump ' + dumpPath + ')');
    if (errors.length) { console.log('--- console errors ---'); errors.slice(0, 10).forEach(e => console.log(e.trim())); }
  }
  }
} finally {
  server.kill();                    // kill ONLY our own child
}
process.exit(exitCode);
