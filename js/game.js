import * as THREE from 'three';
import { TAU, clamp, rand, wrapPI, waveRaw, fillFloods, solveElev as solveElevG, distributeTargets, timeToSurface, waveTier, bossCount, upgradeCost, zoomFOV, escortStats, REGISTRY, REG_UPG, registryCap, regUpgCost, buildSeconds, buildRemaining, buildCardHelp, eliteReady, ORD_TYPES, MSL_TYPES, ordCost, mslCost, priceGrowth, salvoCooldown, shellAccuracy, tryPurchase, purchaseCap, buildLeft, adaptTier } from './core.js';

/* ================= Helpers ================= */
const UP=new THREE.Vector3(0,1,0),
      XA=new THREE.Vector3(1,0,0), ZA=new THREE.Vector3(0,0,1);
const $=id=>document.getElementById(id);
/* ================= Global error trap =================
   FIX: #26 — an uncaught exception used to kill the game loop silently
   (black screen). Now every error shows a crash screen with a copyable
   stack trace and a reload button instead. */
let crashShown=false;
function showCrash(err){
  if(crashShown)return;crashShown=true;
  const msg=(err&&err.stack)?err.stack:(err&&err.message)?err.message:String(err);
  const pre=document.getElementById('crashPre');
  pre.textContent='['+new Date().toISOString()+']\n'+msg;
  document.getElementById('crash').classList.remove('hidden');
  const bC=document.getElementById('crashCopy');
  if(bC)bC.onclick=()=>{try{navigator.clipboard.writeText(pre.textContent);}catch(_){}};
  const bR=document.getElementById('crashReload');
  if(bR)bR.onclick=()=>location.reload();
}
window.addEventListener('error',e=>showCrash(e.error||e.message),true);
window.addEventListener('unhandledrejection',e=>showCrash(e.reason||e.message||'Unhandled rejection'),true);
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3(),_d=new THREE.Vector3(),
      _e=new THREE.Vector3(),_n0=new THREE.Vector3(),_n1=new THREE.Vector3(),
      _l1=new THREE.Vector3(),_l2=new THREE.Vector3(),
      _at=new THREE.Vector3(),_aim=new THREE.Vector3(),_abp=new THREE.Vector3();
const _q0=new THREE.Quaternion(),_q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_qb=new THREE.Quaternion();
const _qm=new THREE.Matrix4(),_eu=new THREE.Euler();
const _mp=new THREE.Vector3(),_tv=new THREE.Vector3(),_aim2=new THREE.Vector3(); /* FIX: fire-loop temps (no per-shot allocations) */

const body=document.body;

/* Mobile detection (touch = coarse pointer) */
const IS_TOUCH=('ontouchstart'in window)||navigator.maxTouchPoints>0||(matchMedia('(pointer:coarse)').matches);
const REDUCED_MOTION=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= DEV TUNES ================= */
const DEV_DEF={
  godMode:0,infHP:0,noReload:0,aimbot:0,aimAssist:0,eAggro:1,
  pThrust:11,pTurn:.68,pVmax:14,pHP:130,pReloadMul:1,pDmgMul:1,fireChance:.18,
  heDmg:60,mgDmg:5,mgVel:190,shellVel:130,grav:11,
  rocketLife:9,rocketVel:64,rocketTurn:6,rocketDmg:46,rocketCount:1,salvoGap:.16,
  jetHp:55,jetMgDmg:4,emslDmg:16,eAmmo:15,bombDmg:1, /* BOSS v2 + fleet dev knobs */
  eSpeed:1,eFire:1,eDmg:1,eHP:1,maxEnemies:10,
  credMul:1,scoreMul:1,startCR:100,startAmmo:200,waveBonusMul:1,
  waveScale:.55,waterBlue:.75,masterVol:.75,
  fov:60,camDist:17,sens:1,
};
const TUNES={...DEV_DEF};
if(IS_TOUCH){TUNES.aimAssist=1;TUNES.camDist=12;TUNES.sens=1.3;}
let G=11,WSCALE=.55;
let DEVPW='admin',DEVKEYS=['KeyH','KeyC'];
try{DEVPW=localStorage.getItem('sb_dev_pw')||'admin';
    const k=JSON.parse(localStorage.getItem('sb_dev_keys')||'null');if(Array.isArray(k)&&k.length===2)DEVKEYS=k;}catch(e){}

/* ================= State ================= */
let state='menu',uiOpen=false,paused=false,gameOver=false,tNow=0,shakeV=0,recoil=0;
let runCheated=false,zoomCls=false;
let score=0,credits=0,combo=1,lastSinkT=-99,shipsSunk=0,waveNum=0;
let devPwOpen=false,devOpen=false,rebinding=false,rebindT=0,rebindBuf=[];
let best=0;try{best=+localStorage.getItem('schiffsbruch3d_2_hs')||0;}catch(e){}

/* ================= Scene ================= */
const scene=new THREE.Scene();
const FOGC=0x9cc3e8;
scene.fog=new THREE.Fog(FOGC,260,900);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,2200);
camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(FOGC);
document.body.appendChild(renderer.domElement);
window.__SB_BOOTED=true; /* boot watchdog in index.html */
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);checkOrientation();});
addEventListener('orientationchange',()=>setTimeout(checkOrientation,250));
const sunDir=new THREE.Vector3(-0.4,0.5,-0.7).normalize();
const dl=new THREE.DirectionalLight(0xfff3e0,1.7); dl.position.copy(sunDir).multiplyScalar(240); scene.add(dl);
scene.add(new THREE.HemisphereLight(0xcfe6ff,0x2a3542,0.8));

/* ================= Waves: JS & Shader IDENTICAL (scaled) ================= */
/* FIX: waveRaw lives in js/core.js (single source, unit-tested).
   The GLSL copy in the water shader below must stay identical. */
function waveH(x,z,t){return waveRaw(x,z,t)*WSCALE;}
const c1a=new THREE.Color(0x062f57),c1b=new THREE.Color(0x0431ba);
const c2a=new THREE.Color(0x1e78b8),c2b=new THREE.Color(0x1160f0);
/* FIX: clean shader (old one had a GLSL typo without p. prefix -> waves failed to render) */
const waterMat=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uSun:{value:sunDir},uFog:{value:new THREE.Color(FOGC)},uWS:{value:.55},
    uC1:{value:new THREE.Color(0x0a3d72)},uC2:{value:new THREE.Color(0x1e7cb8)},uSunC:{value:new THREE.Color(0xfff6dd)}},
  vertexShader:`uniform float uTime,uWS;varying vec3 vP;varying float vW;varying vec3 vN;
    /* FIX #13 (2026-09-06): 7th ripple term added — JS (core.js) <-> GLSL parity restored.
       MUST stay identical to waveRaw() in js/core.js (same terms/frequencies/phases). */
    float W(vec3 p){return (0.85*sin(p.x*0.45+p.z*0.16+uTime*1.05)
      +0.50*sin(p.x*0.72-p.z*0.83+uTime*1.70)+0.30*sin(-p.x*0.35+p.z*1.12+uTime*2.40)
      +0.20*sin(p.x*1.1+p.z*0.9+uTime*3.0)+0.08*sin(p.x*3.1-p.z*2.3+uTime*4.0)
      +0.06*sin(p.x*2.7+p.z*3.3+uTime*3.6)
      +0.05*sin(p.x*9.2+p.z*7.1+uTime*5.2))*uWS;}
    void main(){
      vec4 wp=modelMatrix*vec4(position,1.);
      /* FIX: #16 (2026-09-06) W() takes vec3 — wp is vec4, so W(wp) never
         compiled ("no matching overloaded function found") and the whole
         water material silently failed (three logs shader errors at INFO
         level). Pass wp.xyz; water now renders at all. */
      vec3 p=wp.xyz;
      float e=1.6,h0=W(p),hx=W(p+vec3(e,0.,0.)),hz=W(p+vec3(0.,0.,e));
      wp.y+=h0;vP=wp.xyz;vW=h0;
      vN=normalize(vec3(h0-hx,e,h0-hz));
      gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:`uniform vec3 uSun,uFog,uC1,uC2,uSunC;uniform float uTime,uWS;varying vec3 vP;varying float vW;varying vec3 vN;
    void main(){
      vec3 fn=normalize(cross(dFdx(vP),dFdy(vP)));if(fn.y<0.)fn=-fn;
      vec3 N=normalize(vN*0.75+fn*0.4);if(N.y<0.)N=-N;
      /* SEA v2: animated detail ripples (procedural, no texture fetch) */
      float rx=sin(vP.x*2.3+uTime*2.9)+sin((vP.x-vP.z)*3.1-uTime*2.2)*0.7;
      float rz=sin(vP.z*2.6-uTime*2.4)+sin((vP.x+vP.z)*2.0+uTime*1.8)*0.7;
      N=normalize(N+vec3(rx*0.05,0.,rz*0.05));
      vec3 V=normalize(cameraPosition-vP);
      /* SEA v2: Schlick fresnel with physical R0=0.02 (water IOR 1.33) */
      float R0=0.02;
      float fr=R0+(1.-R0)*pow(1.-max(dot(N,V),0.),5.);
      vec3 sky=mix(vec3(0.70,0.84,0.95),vec3(0.26,0.50,0.80),clamp(vP.y*0.35+0.5,0.,1.));
      vec3 col=mix(mix(uC1,uC2,clamp(N.y*1.6-0.15,0.,1.)),sky,clamp(fr*1.5,0.,1.));
      /* SEA v2: fake subsurface scattering — turquoise glow through sun-facing crests */
      float sss=pow(max(dot(V,-normalize(vec3(uSun.x,0.,uSun.z))),0.),3.)
                *(0.25+0.75*clamp(vW/max(uWS,0.01),0.,1.));
      col+=mix(uC2,vec3(0.10,0.75,0.85),0.5)*sss*0.35;
      /* SEA v2: three-lobe sun glint (tight sparkle + core + soft path) */
      vec3 H=normalize(uSun+V);
      float dh=max(dot(N,H),0.);
      col+=uSunC*pow(dh,700.)*2.4+uSunC*pow(dh,200.)*1.4+uSunC*pow(dh,40.)*0.10;
      /* SEA v2: two-stage foam — crest foam + churning swirl on the highest tops */
      float crest=smoothstep(0.42,0.9,vW/max(uWS,0.01));
      float swirl=sin(vP.x*0.8+vP.z*0.6+uTime*0.7)*sin(vP.x*0.5-vP.z*0.9-uTime*0.5);
      float foam=clamp(crest*0.45+smoothstep(0.55,1.,crest*0.7+swirl*0.35+crest*crest*0.5)*0.38,0.,0.85);
      col=mix(col,vec3(0.94,0.97,0.98),foam);
      float f=smoothstep(420.,900.,distance(cameraPosition,vP));
      gl_FragColor=vec4(mix(col,uFog,f),1.);}`
});
const water=new THREE.Mesh(new THREE.PlaneGeometry(760,760,260,260).rotateX(-Math.PI/2),waterMat);
scene.add(water);
const seaDisc=new THREE.Mesh(new THREE.CircleGeometry(1800,48).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({color:0x0f5aa0}));
seaDisc.position.y=-0.4;scene.add(seaDisc);
const sky=new THREE.Mesh(new THREE.SphereGeometry(1400,24,12),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,uniforms:{uSun:{value:sunDir}},
  vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 uSun;varying vec3 vD;
    void main(){
      vec3 col=mix(vec3(0.612,0.765,0.886),vec3(0.08,0.36,0.74),pow(clamp(vD.y,0.,1.),0.55));
      float sd=max(dot(vD,uSun),0.);
      col+=vec3(1.,0.95,0.85)*pow(sd,180.)*0.9+vec3(1.)*smoothstep(.9995,.99985,sd)*1.4;
      gl_FragColor=vec4(col,1.);}`
}));
sky.renderOrder=-1;scene.add(sky);
[[210,-60,10],[-230,-30,13],[60,-250,9]].forEach(([x,z,r])=>{
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,1),new THREE.MeshStandardMaterial({color:0x5a6a58,roughness:1,flatShading:true}));
  rock.position.set(x,-r*0.55,z);rock.scale.y=0.75;scene.add(rock);
  const lt=new THREE.Mesh(new THREE.CylinderGeometry(0.7,1,r*1.4,8),new THREE.MeshStandardMaterial({color:0xd8dadd,roughness:.8}));
  lt.position.set(x,r*0.55,z);scene.add(lt);
});

/* ================= Particles ================= */
function makeDot(){const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.4,'rgba(255,255,255,.8)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
class Particles{
  constructor(max){this.max=max;this.cur=0;
    this.pos=new Float32Array(max*3);this.col=new Float32Array(max*3);
    this.alp=new Float32Array(max);this.siz=new Float32Array(max);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3));
    geo.setAttribute('aCol',new THREE.BufferAttribute(this.col,3));
    geo.setAttribute('aAlpha',new THREE.BufferAttribute(this.alp,1));
    geo.setAttribute('aSize',new THREE.BufferAttribute(this.siz,1));
    const mat=new THREE.ShaderMaterial({uniforms:{uTex:{value:makeDot()}},
      vertexShader:`attribute vec3 aCol;attribute float aAlpha,aSize;varying vec3 vC;varying float vA;
        void main(){vC=aCol;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_PointSize=aSize*(240./-mv.z);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform sampler2D uTex;varying vec3 vC;varying float vA;
        void main(){gl_FragColor=vec4(vC,texture2D(uTex,gl_PointCoord).a*vA);}`,
      transparent:true,depthWrite:false});
    this.p=new THREE.Points(geo,mat);this.p.frustumCulled=false;this.p.renderOrder=10;scene.add(this.p);
    this.d=Array.from({length:max},()=>({life:0,max:1,vx:0,vy:0,vz:0,g:0,dg:0,s0:1,s1:1,wk:0,c0:[1,1,1],c1:[1,1,1]}));
    this.geo=geo;}
  spawn(x,y,z,o){const i=this.cur;this.cur=(this.cur+1)%this.max;const d=this.d[i];
    d.life=d.max=o.life;d.vx=o.vx||0;d.vy=o.vy||0;d.vz=o.vz||0;
    d.g=o.g||0;d.dg=o.drag||0;d.s0=o.s0;d.s1=o.s1??o.s0;d.wk=o.waterKill?1:0;
    d.c0=o.c0;d.c1=o.c1||o.c0;this.pos[i*3]=x;this.pos[i*3+1]=y;this.pos[i*3+2]=z;}
  update(dt,t){for(let i=0;i<this.max;i++){const d=this.d[i];
      if(d.life<=0){this.alp[i]=0;continue;}
      d.life-=dt;if(d.life<=0){this.alp[i]=0;continue;}
      const k=1-d.life/d.max,j=i*3;
      d.vy+=d.g*dt;
      if(d.dg){const f=Math.exp(-d.dg*dt);d.vx*=f;d.vy*=f;d.vz*=f;}
      this.pos[j]+=d.vx*dt;this.pos[j+1]+=d.vy*dt;this.pos[j+2]+=d.vz*dt;
      if(d.wk&&d.vy<0&&this.pos[j+1]<waveH(this.pos[j],this.pos[j+2],t)+.05)d.life=Math.min(d.life,.1);
      this.col[j]=d.c0[0]+(d.c1[0]-d.c0[0])*k;
      this.col[j+1]=d.c0[1]+(d.c1[1]-d.c0[1])*k;
      this.col[j+2]=d.c0[2]+(d.c1[2]-d.c0[2])*k;
      this.siz[i]=d.s0+(d.s1-d.s0)*k;
      this.alp[i]=Math.min(1,(1-k)*1.5)*(k<.06?k/.06:1);}
    for(const a of ['position','aCol','aAlpha','aSize'])this.geo.attributes[a].needsUpdate=true;}
}
const particles=new Particles(2800);
const ringGeo=new THREE.CircleGeometry(1,26).rotateX(-Math.PI/2);
class Rings{constructor(n){this.it=[];for(let i=0;i<n;i++){
    const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
    m.visible=false;m.renderOrder=9;scene.add(m);
    this.it.push({m,life:0,max:1,r0:1,r1:5,o0:.5,foll:false});}}
  spawn(x,z,o={}){let s=this.it.find(i=>i.life<=0)||this.it[0];
    s.life=s.max=o.life||1;s.r0=o.r0||0.5;s.r1=o.r1||6;s.o0=o.o0||0.5;s.foll=!!o.oil;
    s.m.material.color.set(o.color??0xffffff);s.m.position.set(x,o.y??0,z);s.m.visible=true;}
  update(dt,t){for(const s of this.it){if(s.life<=0){s.m.visible=false;continue;}
    s.life-=dt;const k=1-s.life/s.max;
    if(s.foll)s.m.position.y=waveH(s.m.position.x,s.m.position.z,t)+0.04;
    const r=s.r0+(s.r1-s.r0)*k;s.m.scale.set(r,1,r);s.m.material.opacity=s.o0*(1-k);}}}
const rings=new Rings(52);
const flashPool=Array.from({length:3},()=>{const l=new THREE.PointLight(0xfff0c0,0,70);scene.add(l);return l;});
let flashI=0;
function flash(p,inten=40,col=0xfff0c0){const l=flashPool[flashI++%3];l.position.copy(p);l.position.y+=1.5;l.color.set(col);l.intensity=inten;}
/* FIX: #19 (2026-09-06) missile impact markers — pooled ground rings
   showing where each live rocket is CURRENTLY predicted to splash.
   Prediction: core.timeToSurface() integrates the vertical motion and
   the marker follows the straight continuation of the velocity (homing
   rockets "drag" their ring with them — dodge OUT of the ring!). 
   Enemy = red rings, player = green. Pools → zero per-frame allocations. */
const impRingGeo=new THREE.RingGeometry(.9,1.15,24);
const impMatP=new THREE.MeshBasicMaterial({color:0x44ff66,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false});
const impMatE=new THREE.MeshBasicMaterial({color:0xff5533,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});
const impPoolP=Array.from({length:24},()=>{const m=new THREE.Mesh(impRingGeo,impMatP);m.visible=false;scene.add(m);return m;});
const impPoolE=Array.from({length:10},()=>{const m=new THREE.Mesh(impRingGeo,impMatE);m.visible=false;scene.add(m);return m;});
let impPts=[];
function impReset(){impPts.length=0;}
function impPush(x,z,enemy){impPts.push({x,z,e:enemy?1:0});}
function renderImps(){
  let pi=0,ei=0;
  for(const p of impPts){
    const pool=p.e?impPoolE:impPoolP;
    const m=pool[p.e?ei++%impPoolE.length:pi++%impPoolP.length];
    m.visible=true;m.position.set(p.x,waveH(p.x,p.z,tNow)+.3,p.z);
  }
  for(;pi<impPoolP.length;pi++)impPoolP[pi].visible=false;
  for(;ei<impPoolE.length;ei++)impPoolE[ei].visible=false;
}
function ap(p){const d=camera.position.distanceTo(p);
  _a.copy(p).sub(camera.position).normalize();
  _b.set(0,0,-1).applyEuler(_eu.set(camera.rotation.x,camera.rotation.y,0,'YXZ'));
  _c.crossVectors(_b,UP).normalize();
  return [d,clamp(_a.dot(_c),-1,1)*0.7];}

/* ================= Sound ================= */
const sfx={ctx:null,
  init(){if(this.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();
    this.master=this.ctx.createGain();this.master.gain.value=TUNES.masterVol;
    const comp=this.ctx.createDynamicsCompressor();this.master.connect(comp);comp.connect(this.ctx.destination);
    const len=this.ctx.sampleRate*2;this.noise=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=this.noise.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource();src.buffer=this.noise;src.loop=true;
    const lp=this.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
    const g=this.ctx.createGain();g.gain.value=0.12;
    const lfo=this.ctx.createOscillator();lfo.frequency.value=0.13;
    const lg=this.ctx.createGain();lg.gain.value=0.05;lfo.connect(lg);lg.connect(g.gain);
    src.connect(lp);lp.connect(g);g.connect(this.master);src.start();lfo.start();},
  _n(dur,type,f0,f1,vol,pan=0,q=1){if(!this.ctx)return;const t=this.ctx.currentTime;
    const s=this.ctx.createBufferSource();s.buffer=this.noise;s.loop=true;
    const flt=this.ctx.createBiquadFilter();flt.type=type;flt.frequency.setValueAtTime(f0,t);
    if(f1)flt.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);flt.Q.value=q;
    const g=this.ctx.createGain();g.gain.setValueAtTime(Math.max(.001,vol),t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(flt);flt.connect(g);
    if(this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);g.connect(p);p.connect(this.master);}
    else g.connect(this.master);s.start(t);s.stop(t+dur+.05);},
  _t(f0,f1,dur,vol,type='sine',pan=0){if(!this.ctx)return;const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    const g=this.ctx.createGain();g.gain.setValueAtTime(Math.max(.001,vol),t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+dur+.05);},
  cannon(pan=0,a=1){this._n(.35,'lowpass',900,150,.7*a,pan);this._t(90,34,.4,.6*a);},
  mg(pan=0){this._n(.07,'bandpass',1800,900,.28,pan,2);this._t(300,120,.06,.2,'square',pan);},
  rocket(pan=0){this._n(.8,'bandpass',600,2200,.4,pan);},
  boom(pan=0,a=1){this._n(1.3,'lowpass',700,60,.9*a,pan);this._t(60,26,.9,.7*a);},
  splash(pan=0,a=1){this._n(.5,'bandpass',1100,500,.45*a,pan,.8);},
  hit(pan=0){this._t(520,180,.14,.4,'square',pan);this._n(.1,'highpass',2200,0,.2,pan);},
  sunk(pan=0,a=1){this._n(2,'lowpass',300,50,.55*a,pan);this._t(120,30,1.6,.4*a);},
  torp(pan=0){this._n(1.1,'lowpass',400,120,.5,pan);}
};
function apd(p){const [d,pan]=ap(p);return [d,pan];}

/* ================= Effects ================= */
function fxExplosion(p,s=1){
  for(let i=0;i<Math.floor(14*s);i++)particles.spawn(p.x,p.y,p.z,{vx:rand(-9,9)*s,vy:rand(2,14)*s,vz:rand(-9,9)*s,g:-12,drag:1.1,life:rand(.35,.85),s0:rand(1.6,3.2)*s,s1:5.5*s,c0:[1,.85,.4],c1:[.32,.18,.1]});
  for(let i=0;i<Math.floor(9*s);i++)particles.spawn(p.x,p.y,p.z,{vx:rand(-2.5,2.5)*s,vy:rand(3,8)*s,vz:rand(-2.5,2.5)*s,g:1.4,drag:.7,life:rand(1.3,2.6),s0:2.2*s,s1:9*s,c0:[.24,.24,.27],c1:[.05,.05,.06]});
  particles.spawn(p.x,p.y,p.z,{life:.13,s0:15*s,s1:22*s,c0:[1,.95,.8]});
  if(p.y<2)rings.spawn(p.x,p.z,{r1:7*s,life:.9,o0:.5});
  flash(p,45*s);
  const [d,pan]=apd(p);sfx.boom(pan,1/(1+d/60));
  if(d<32)shakeV=Math.max(shakeV,0.28*s);
}
function fxSplash(p,n=14,s=1){
  for(let i=0;i<n;i++)particles.spawn(p.x,p.y+.3,p.z,{vx:rand(-4,4)*s,vy:rand(5,14)*s,vz:rand(-4,4)*s,g:-15,drag:.3,life:rand(.5,1.1),s0:rand(.9,1.8)*s,s1:.4,c0:[.82,.92,.98],c1:[.45,.7,.85],waterKill:true});
  rings.spawn(p.x,p.z,{r1:rand(2.5,4.5)*s,life:.8,o0:.5,y:waveH(p.x,p.z,tNow)});
  const [d,pan]=apd(p);sfx.splash(pan,1);
}
function fxMuzzle(p,dir,big=1){
  for(let i=0;i<6;i++)particles.spawn(p.x,p.y,p.z,{vx:dir.x*rand(12,22)+rand(-2,2),vy:dir.y*rand(12,22)+rand(0,2),vz:dir.z*rand(12,22)+rand(-2,2),drag:4,life:rand(.08,.2),s0:rand(2,3.6)*big,s1:1,c0:[1,.8,.4],c1:[.6,.2,.05]});
  for(let i=0;i<4;i++)particles.spawn(p.x,p.y,p.z,{vx:dir.x*rand(3,7)+rand(-1.5,1.5),vy:rand(1,3),vz:dir.z*rand(3,7)+rand(-1.5,1.5),g:1,drag:1.5,life:rand(.6,1.3),s0:1.6*big,s1:5*big,c0:[.3,.3,.33],c1:[.07,.07,.08]});
}
function bowSpray(h,spd,dt){
  h._spray=(h._spray||0)+dt*spd*0.5;
  while(h._spray>1){h._spray--;
    const side=Math.random()<.5?1:-1;
    _a.set(side*rand(0.4,0.55)*h.def.w,0.15,h.def.l*(rand(0.42,0.5))).applyQuaternion(h.quat).add(h.pos);
    particles.spawn(_a.x,waveH(_a.x,_a.z,tNow)+.15,_a.z,{vx:side*rand(.5,2),vy:rand(1,3.5),vz:rand(-1,1),g:-9,life:rand(.4,.9),s0:rand(.8,1.5),s1:2.4,c0:[.93,.97,.99],c1:[.6,.8,.9],waterKill:true});}
}

/* ================= Projectiles ================= */
const shells=[];
const shellGeo=new THREE.SphereGeometry(0.17,8,8);
const matP=new THREE.MeshBasicMaterial({color:0xffe2a0});
const matE=new THREE.MeshBasicMaterial({color:0xff8860});
const matD=new THREE.MeshBasicMaterial({color:0x7fe0ff});
function spawnShell(p,vx,vy,vz,owner,dmg,grav=true){
  const m=new THREE.Mesh(shellGeo,owner==='player'?matP:owner==='enemy'?matE:matD);
  m.position.copy(p);scene.add(m);
  shells.push({m,v:new THREE.Vector3(vx,vy,vz),last:p.clone(),owner,dmg,grav,life:9,tr:0});
}
const ships=[];
let player=null;
function updateShells(dt){
  for(let i=shells.length-1;i>=0;i--){
    const s=shells[i];s.life-=dt;
    if(s.grav)s.v.y-=G*dt;
    s.last.copy(s.m.position);
    s.m.position.addScaledVector(s.v,dt);
    s.tr-=dt;
    if(s.tr<=0){s.tr=0.022;const p=s.m.position;
      particles.spawn(p.x,p.y,p.z,{life:.2,s0:.5,s1:1.3,c0:s.owner==='player'?[1,.85,.55]:s.owner==='drone'?[.5,.9,1]:[.9,.45,.3]});}
    const p=s.m.position,wh=waveH(p.x,p.z,tNow);
    let dead=false;
    if(s.owner==='enemy'){
      if(player&&!player.finalizing&&!player.dead&&playerSegmentHit(s.last,p)){damagePlayer(s.dmg,p);dead=true;} /* FIX: sinking wreck no longer eats shells */
    }else{
      for(const sh of ships){
        if(sh.finalizing)continue;
        const pt=sh.segmentHit(s.last,p);
        if(pt){sh.takeHit(pt,s.dmg);hitmarkFx();dead=true;break;}
      }
      /* BOSS v2: anti-air — MG/AP shells can clip jets (sphere test) */
      if(!dead)for(const j of jets){
        if(p.distanceTo(j.mesh.position)<1.9){
          hitmarkFx();j.hp-=s.dmg;
          if(j.hp<=0)killJet(j,jets.indexOf(j));
          dead=true;break;}
      }
    }
    if(!dead&&p.y<=wh&&s.v.y<0){
      fxSplash(p,s.owner==='enemy'?12:10,1);
      dead=true;
    }
    if(dead||s.life<=0||Math.abs(p.x)>400||Math.abs(p.z)>400){scene.remove(s.m);shells.splice(i,1);}
  }
}
/* Rockets */
const rockets=[];
const rktBody=new THREE.CylinderGeometry(.12,.12,.9,7);
const rktNose=new THREE.ConeGeometry(.12,.3,7);
const rktMat=new THREE.MeshStandardMaterial({color:0x9aa5ad,roughness:.5,metalness:.4,flatShading:true});
function spawnRocket(mp,target){
  if(!player)return;
  const g=new THREE.Group();
  const b=new THREE.Mesh(rktBody,rktMat);b.rotation.x=Math.PI/2;g.add(b);
  const n=new THREE.Mesh(rktNose,rktMat);n.rotation.x=Math.PI/2;n.position.z=.55;g.add(n);
  g.position.copy(mp);scene.add(g);
  _n0.set(0,0,1).applyQuaternion(player.quat);
  rockets.push({m:g,v:new THREE.Vector3(_n0.x*14,rand(20,26),_n0.z*14),target,life:TUNES.rocketLife,arm:.5});
  const [d,pan]=apd(mp);sfx.rocket(pan);
}
function updateRockets(dt){
  for(let i=rockets.length-1;i>=0;i--){
    const r=rockets[i];r.life-=dt;r.arm-=dt;
    if(!r.target||r.target.finalizing){
      let bd=1e9;r.target=null;
      for(const sh of ships){if(sh.finalizing)continue;const dd=sh.pos.distanceTo(r.m.position);if(dd<bd){bd=dd;r.target=sh;}}
    }
    if(r.arm<=0&&r.target){
      _n0.copy(r.target.pos).sub(r.m.position).normalize();
      r.v.normalize().lerp(_n0,Math.min(1,TUNES.rocketTurn*dt)).normalize().multiplyScalar(TUNES.rocketVel);
    }else{r.v.y+=8*dt;}
    r.m.position.addScaledVector(r.v,dt);
    r.m.lookAt(_n1.copy(r.m.position).add(r.v));
    particles.spawn(r.m.position.x,r.m.position.y,r.m.position.z,{life:.35,s0:1.1,s1:2.6,c0:[1,.75,.35],c1:[.4,.2,.1]});
    let det=false;
    if(r.target&&!r.target.finalizing&&r.m.position.distanceTo(r.target.pos)<r.target.def.l*0.48){det=true;
      r.target.takeHit2(r.target.pos.clone(),TUNES.rocketDmg*player.dmgMul,true);}
    const wh=waveH(r.m.position.x,r.m.position.z,tNow);
    /* FIX: #19 live impact ring (green) — predicted splashes for player rounds */
    const _tt=timeToSurface(r.m.position.y-wh,r.v.y,G);
    if(_tt<9)impPush(r.m.position.x+r.v.x*_tt,r.m.position.z+r.v.z*_tt,false);
    if(!det&&r.m.position.y<=wh){det=true;fxSplash(r.m.position,12,1.3);}
    if(det||r.life<=0){fxExplosion(r.m.position,1);scene.remove(r.m);rockets.splice(i,1);}
  }
}
/* Torpedoes */
const torps=[];
const torpGeo=new THREE.CapsuleGeometry(.22,1.6,4,8).rotateX(Math.PI/2);
const torpMat=new THREE.MeshStandardMaterial({color:0x2a3036,roughness:.4,metalness:.5});
function fireTorpedo(sh){
  if(!player)return;
  const mp=_a.set(0,-0.3,0).applyQuaternion(sh.quat).add(sh.pos);
  const T=Math.max(.5,sh.pos.distanceTo(player.pos)/17);
  _b.copy(player.pos).addScaledVector(player.vel,T);
  const m=new THREE.Mesh(torpGeo,torpMat);m.position.copy(mp);scene.add(m);
  _c.copy(_b).sub(mp);_c.y=0;_c.normalize();
  m.lookAt(_d.copy(mp).add(_c));
  torps.push({m,dx:_c.x,dz:_c.z,life:14,tr:0,dmg:50*sh.tier.dmg});
  const [d,pan]=apd(mp);sfx.torp(pan);
  feed('⚠ TORPEDO LAUNCHED — EVADE!','warn');
}
function updateTorps(dt){
  if(!player)return;
  for(let i=torps.length-1;i>=0;i--){
    const t=torps[i];t.life-=dt;t.tr-=dt;
    t.m.position.x+=t.dx*17*dt;t.m.position.z+=t.dz*17*dt;
    t.m.position.y=waveH(t.m.position.x,t.m.position.z,tNow)-0.7;
    if(t.tr<=0){t.tr=.05;const p=t.m.position;
      particles.spawn(p.x,p.y+1,p.z,{life:.9,s0:.7,s1:2,c0:[.85,.93,.97],c1:[.5,.7,.8],waterKill:true});}
    let dead=false;
    if(!player.finalizing&&playerSegmentHit(t.m.position)){
      damagePlayer(t.dmg,t.m.position);fxExplosion(t.m.position,1.4);dead=true;}
    if(dead||t.life<=0||Math.abs(t.m.position.x)>400||Math.abs(t.m.position.z)>400){scene.remove(t.m);torps.splice(i,1);}
  }
}
/* Debris */
const debris=[];
const dbGeo=[new THREE.BoxGeometry(1,.5,.7),new THREE.BoxGeometry(.6,.6,.6),new THREE.CylinderGeometry(.5,.5,.25,10)];
const dbCol=[0x6b5a41,0x4a4d52,0xc46a2e,0x8a4b3a,0x3d5a68];
const dbMat=dbCol.map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.9,flatShading:true})); /* FIX: shared materials (was: one material per debris = GPU memory leak) */
class Debris{
  constructor(p){this.m=new THREE.Mesh(dbGeo[Math.floor(Math.random()*3)],
    dbMat[Math.floor(Math.random()*dbMat.length)]);
    const s=rand(.5,1.1);this.m.scale.set(s,s,s);
    this.m.position.copy(p).add(_a.set(rand(-4,4),rand(0,2),rand(-4,4)));
    this.m.rotation.set(rand(0,3),rand(0,3),rand(0,3));
    this.vel=new THREE.Vector3(rand(-3,3),rand(2,5),rand(-3,3));
    this.av=new THREE.Vector3(rand(-2,2),rand(-2,2),rand(-2,2));
    this.life=rand(13,20);scene.add(this.m);}
  update(dt,t){this.life-=dt;const p=this.m.position;
    this.vel.y-=9.8*dt;
    const sub=clamp((waveH(p.x,p.z,t)-p.y)/1.1,0,1);
    this.vel.y+=sub*15*dt;
    const f=Math.exp(-(sub>0?1.4:.15)*dt);this.vel.multiplyScalar(f);
    p.addScaledVector(this.vel,dt);
    if(sub>0&&p.y<0.4)this.av.multiplyScalar(Math.exp(-1.5*dt));
    this.m.rotation.x+=this.av.x*dt;this.m.rotation.y+=this.av.y*dt;this.m.rotation.z+=this.av.z*dt;
    if(this.life<=0||p.y<-5){scene.remove(this.m);return true;}
    return false;}
}

/* ================= Enemy types (vmax = hard speed cap) ================= */
const SHIPS={
  patrol:{name:'PATROL BOAT',l:9,w:3,hullH:1.8,draft:2.3,hp:60,score:100,thrust:13,turn:.85,hold:45,vmax:9,
    gun:{dmg:4,rate:3.4,range:60,speed:50},ram:14,model:'war',hullCol:0x5a6e82},
  torpedo:{name:'TORPEDO BOAT',l:10,w:3,hullH:1.7,draft:2.2,hp:80,score:150,thrust:16,turn:1.0,hold:58,vmax:10.5,
    gun:null,torp:{dmg:50,rate:7,range:85},ram:16,model:'torp',hullCol:0x37465a},
  destroyer:{name:'DESTROYER',l:14,w:3.6,hullH:2.1,draft:2.6,hp:190,score:250,thrust:9.5,turn:.55,hold:75,vmax:8,
    gun:{dmg:10,rate:4.4,range:98,speed:55},ram:26,model:'war',hullCol:0x39424e},
  freighter:{name:'ARMOURED FREIGHTER',l:20,w:5.4,hullH:2.8,draft:3.4,hp:480,score:400,thrust:6,turn:.32,hold:95,vmax:6,
    gun:{dmg:14,rate:6.5,range:115,speed:56},ram:40,model:'cargo',hullCol:0x4a4238,cargo:true},
  cruiser:{name:'▶ HEAVY CRUISER (BOSS)',l:26,w:6.2,hullH:3.2,draft:3.8,hp:950,score:1000,thrust:5.5,turn:.28,hold:110,vmax:5.5,
    gun:{dmg:12,rate:3.2,range:135,speed:58},ram:60,model:'cruiser',hullCol:0x2c333c,armor:.80},
  /* BOSSES v2 (2026-09-06): battleship fires homing missile salvoes, carrier hosts jets */
  battle:{name:'☠ BATTLESHIP (BOSS)',l:36,w:8,hullH:4.2,draft:4.6,hp:2400,score:2800,thrust:4.2,turn:.18,hold:135,vmax:4.5,
    gun:{dmg:16,rate:2.6,range:160,speed:60},rockets:{dmg:16,rate:11,count:4,vel:34,turn:3.4,range:190},
    ram:90,model:'battle',hullCol:0x232a33,armor:.70},
  carrier:{name:'✈ CARRIER (BOSS)',l:42,w:9,hullH:3.6,draft:4.2,hp:3000,score:4000,thrust:3.6,turn:.15,hold:165,vmax:3.8,
    gun:{dmg:9,rate:4.0,range:120,speed:54},jets:{rate:9,max:5,dmg:8,mgCd:.14,bomb:7},
    ram:110,model:'carrier',hullCol:0x39414c,armor:.75},
};
const blobGeo=new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2);
const blobMat=new THREE.MeshBasicMaterial({color:0x06263e,transparent:true,opacity:.3,depthWrite:false});

function buildShipMesh(def){
  const g=new THREE.Group();
  const hullM=new THREE.MeshStandardMaterial({color:def.hullCol,roughness:.72,metalness:.12,flatShading:true});
  const redM=new THREE.MeshStandardMaterial({color:0x6e2222,roughness:.9,flatShading:true});
  const whiM=new THREE.MeshStandardMaterial({color:0xcdd3d8,roughness:.75,flatShading:true});
  const darkM=new THREE.MeshStandardMaterial({color:0x22262b,roughness:.6,metalness:.3,flatShading:true});
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m;};
  add(new THREE.BoxGeometry(def.w,def.hullH,def.l),hullM,0,0,0);
  add(new THREE.BoxGeometry(def.w+.12,def.hullH*.5,def.l*.99),redM,0,-def.hullH*.3,0);
  const bh=def.l*.16;
  const bow=add(new THREE.ConeGeometry(def.w*.55,bh,4),hullM,0,0,def.l/2+bh*.45,Math.PI/2,0,Math.PI/4);
  bow.scale.set(1,1,.55);
  const top=def.hullH*.5;
  if(def.cargo){
    add(new THREE.BoxGeometry(def.w*.7,def.hullH*1.2,def.l*.16),whiM,0,top+def.hullH*.6,-def.l*.36);
    add(new THREE.CylinderGeometry(.35,.42,1.7,9),darkM,0,top+1.4,-def.l*.14);
    const cols=[0xb5453a,0xd9903f,0x3d7a5a,0x365a8c,0x8c8c8c];
    for(let i=0;i<7;i++){const cm=new THREE.MeshStandardMaterial({color:cols[i%cols.length],roughness:.8,flatShading:true});
      add(new THREE.BoxGeometry(1.5,.95,2.3),cm,(i%2?1.35:-1.35),top+.47,-def.l*.02+Math.floor(i/2)*2.7);}
    add(new THREE.CylinderGeometry(.08,.1,2.8,6),darkM,0,top+1.2,def.l*.38);
    add(new THREE.BoxGeometry(def.w*.5,.7,1.4),darkM,0,top+.35,def.l*.36);
    add(new THREE.CylinderGeometry(.09,.11,1.8,8),darkM,0,top+.5,def.l*.36+1.3,Math.PI/2);
  }else if(def.model==='cruiser'){
    add(new THREE.BoxGeometry(def.w*.7,def.hullH*1.6,def.l*.2),whiM,0,top+def.hullH*.8,-def.l*.05);
    add(new THREE.BoxGeometry(def.w*.45,def.hullH*.8,def.l*.1),whiM,0,top+def.hullH*1.7,-def.l*.08);
    add(new THREE.CylinderGeometry(.45,.55,2.6,9),darkM,0,top+1.9,-def.l*.22);
    for(const gz of [def.l*.34,-def.l*.02,-def.l*.3]){
      add(new THREE.BoxGeometry(2.2,.8,2.4),whiM,0,top+.42,gz);
      add(new THREE.CylinderGeometry(.1,.13,2.4,8),darkM,0,top+.55,gz+1.6,Math.PI/2);}
    add(new THREE.CylinderGeometry(.06,.09,3.4,6),darkM,0,top+2.6,-def.l*.08);
  }else if(def.model==='battle'){
    /* BATTLESHIP: pagoda superstructure, 3 big turrets, rocket battery dome */
    for(const gz of [def.l*.36,def.l*.10,-def.l*.16]){
      add(new THREE.BoxGeometry(2.6,1,2.6),whiM,0,top+.5,gz);
      for(const gx of [-.6,.6])
        add(new THREE.CylinderGeometry(.14,.17,2.8,8),darkM,gx,top+.6,gz+1.5,Math.PI/2);}
    add(new THREE.BoxGeometry(def.w*.6,def.hullH*1.7,def.l*.16),whiM,0,top+def.hullH*.85,-def.l*.02);
    add(new THREE.BoxGeometry(def.w*.38,def.hullH*.8,def.l*.08),whiM,0,top+def.hullH*1.75,-def.l*.02);
    add(new THREE.CylinderGeometry(.5,.6,2.8,9),darkM,0,top+1.9,-def.l*.30);
    add(new THREE.SphereGeometry(.5,10,8),new THREE.MeshStandardMaterial({color:0x2b3d2f,roughness:.4,metalness:.4}),0,top+def.hullH*1.9,def.l*.02);
    add(new THREE.CylinderGeometry(.07,.1,4.4,6),darkM,0,top+2.9,-def.l*.02);
  }else if(def.model==='carrier'){
    /* CARRIER: angled flight deck + island tower (jets spawn on deck) */
    const deck=add(new THREE.BoxGeometry(def.w*1.35,.34,def.l*.96),whiM,0,top+def.hullH*.5,0);
    deck.rotation.y=.06;
    add(new THREE.BoxGeometry(def.w*.8,.3,def.l*.9),darkM,0,top+def.hullH*.28,0);
    add(new THREE.BoxGeometry(def.w*.42,def.hullH*1.4,def.l*.13),whiM,0,top+def.hullH*1.0,-def.w*.32);
    add(new THREE.BoxGeometry(def.w*.3,def.hullH*.6,1.6),whiM,0,top+def.hullH*1.9,-def.w*.32);
    add(new THREE.CylinderGeometry(.06,.09,3,6),darkM,0,top+def.hullH*2.0,-def.w*.32);
    add(new THREE.CylinderGeometry(.09,.11,2.2,8),darkM,0,top+1.5,def.l*.30,Math.PI/2);
  }else{
    add(new THREE.BoxGeometry(def.w*.72,def.hullH*.9,def.l*.22),whiM,0,top+def.hullH*.45,-def.l*.08);
    add(new THREE.BoxGeometry(def.w*.4,.7,def.l*.08),whiM,0,top+def.hullH*.9+.35,-def.l*.08);
    add(new THREE.CylinderGeometry(.32,.4,1.6,9),darkM,0,top+1.2,-def.l*.28);
    if(def.model==='torp'){
      add(new THREE.BoxGeometry(1.4,.5,1.2),darkM,0,top+.3,def.l*.3);
      add(new THREE.CylinderGeometry(.13,.13,1.6,8),whiM,0,top+.3,def.l*.3,Math.PI/2);
      add(new THREE.CylinderGeometry(.13,.13,1.8,8),darkM,0,top+.3,def.l*.3+1.2,Math.PI/2);
    }else{
      for(const gz of [def.l*.3,-def.l*.02]){
        add(new THREE.BoxGeometry(1,.55,1.2),whiM,0,top+.32,gz);
        add(new THREE.CylinderGeometry(.09,.11,1.9,8),darkM,0,top+.42,gz+1.4,Math.PI/2);}
    }
    add(new THREE.CylinderGeometry(.06,.09,2.6,6),darkM,0,top+1.5,-def.l*.3);
  }
  return g;
}

/* FIX: fillFloods lives in js/core.js (unit-tested). */
/* ============================================================
   FLOAT PHYSICS v4 — speed fix (forward/lateral split + vmax cap),
   ship sits a bit higher (0.30 draft) so it never looks submerged.
   ============================================================ */
function floatStep(h,dt){
  const def=h.def,t=tNow;
  const fl=h.floods,avg=(fl[0]+fl[1]+fl[2]+fl[3])/4;
  const fx=Math.sin(h.yaw),fz=Math.cos(h.yaw);
  const bx=h.pos.x+fx*def.l*.42,bz=h.pos.z+fz*def.l*.42;
  const sx=h.pos.x-fx*def.l*.42,sz=h.pos.z-fz*def.l*.42;
  const lx=h.pos.x+fz*def.w*.4,lz=h.pos.z-fx*def.w*.4;
  const rx=h.pos.x-fz*def.w*.4,rz=h.pos.z+fx*def.w*.4;
  let pitchT=(waveH(sx,sz,t)-waveH(bx,bz,t))/def.l*2.4
            +(fl[0]+fl[1]-fl[2]-fl[3])*.28;
  let rollT =(waveH(lx,lz,t)-waveH(rx,rz,t))/def.w*2.4
            -(fl[0]+fl[2]-fl[1]-fl[3])*.28
            -h.yawRate*.35;
  if(h.doomed){
    const ramp=Math.min(1,(tNow-h.sinkT)*.15);
    pitchT+=h.dP*(0.15+ramp*.9);
    rollT +=h.dR*(0.15+ramp*.9);
  }
  pitchT=clamp(pitchT,-.55,.55);rollT=clamp(rollT,-.65,.65);
  const K=8,C=4.2;
  h.pitchV+=((pitchT-h.pitch)*K-h.pitchV*C)*dt;
  h.rollV +=((rollT -h.roll )*K-h.rollV *C)*dt;
  h.pitch=clamp(h.pitch+h.pitchV*dt,-1.2,1.2);
  h.roll =clamp(h.roll +h.rollV *dt,-1.3,1.3);
  const fwdx=fx,fwdz=fz;
  const fwd=h.vel.x*fwdx+h.vel.z*fwdz;
  const lat=h.vel.x*fwdz-h.vel.z*fwdx;
  let nf=fwd*Math.exp(-0.25*dt);
  let nl=lat*Math.exp(-(h.sinking?.6:2.2)*dt);
  const vmax=h.vmax||9;
  const mag=Math.hypot(nf,nl);
  if(mag>vmax){const k=vmax/mag;nf*=k;nl*=k;}
  h.vel.x=fwdx*nf+fwdz*nl;
  h.vel.z=fwdz*nf-fwdx*nl;
  const sinkRamp=h.sinking?Math.min(1,(tNow-h.sinkT)*.12):0;
  const targetY=waveH(h.pos.x,h.pos.z,t)-def.draft*(0.30+0.40*avg)-sinkRamp*(def.draft+14);
  h.vel.y+=(targetY-h.pos.y)*30*dt;
  h.vel.y*=Math.exp(-5.5*dt);
  if(h.vel.y>7)h.vel.y=7;else if(h.vel.y<-9)h.vel.y=-9;
  h.pos.y+=h.vel.y*dt;
  if(!h.sinking&&h.pos.y>waveH(h.pos.x,h.pos.z,t)+1.2)
    h.pos.y=waveH(h.pos.x,h.pos.z,t)+1.2;
  h.pos.x+=h.vel.x*dt;h.pos.z+=h.vel.z*dt;
  _q0.setFromAxisAngle(UP,h.yaw);
  _q1.setFromAxisAngle(XA,h.pitch);
  _q2.setFromAxisAngle(ZA,h.roll);
  h.quat.copy(_q0).multiply(_q1).multiply(_q2);
}
function makeChambers(def){const ox=def.w*.38,oz=def.l*.33;
  return [new THREE.Vector3(ox,0,oz),new THREE.Vector3(-ox,0,oz),new THREE.Vector3(ox,0,-oz),new THREE.Vector3(-ox,0,-oz)];}

/* ================= Enemy ships ================= */
class Ship{
  constructor(type){
    this.def=SHIPS[type];this.type=type;
    /* ELITE BOSSES (wave 15+): once the player's dockyard loadout is fully
       upgraded (all lanes maxed), bosses arrive hardened: +45 % HP, +15 % dmg,
       red-hot paint and +2 jet capacity. */
    this.elite=eliteReady(player&&player.lv)&&this.isBossType(type)&&waveNum>=15; /* FIX: #24 single source of truth (was dead-duplicated) */
    if(this.elite){
      this.def={...this.def,
        gun:this.def.gun?{...this.def.gun,dmg:this.def.gun.dmg*1.15}:null,
        rockets:this.def.rockets?{...this.def.rockets,dmg:this.def.rockets.dmg*1.15}:null,
        jets:this.def.jets?{...this.def.jets,max:this.def.jets.max+2}:null};
      feed('☠ ELITE '+SHIPS[type].name.replace(/^[^ ]+ /,'')+' INBOUND — hardened hull!','warn');
    }
    /* FIX: #20 (2026-09-06) wave-tier difficulty ramp. waveTier() scales the
       BASE def; admin TUNES.eHP/eSpeed multiply AFTER it — the dev console
       always stays the final authority and can never be overwritten. */
    this.tier=adaptTier(waveNum,waveTier(waveNum),fleetPressure()); /* FIX: #27 — enemies scale with YOUR fleet strength, gapless caps (2.4/1.9/1.5) */
    this.hp=this.def.hp*this.tier.hp*TUNES.eHP; /* FIX: #21 (2026-09-06) admin multipliers apply LAST — dev console is always the final authority */
    if(this.elite){this.hp*=1.45;} /* ELITE bosses: reinforced hull */
    this.maxhp=this.hp;
    this.vmax=this.def.vmax*this.tier.spd*TUNES.eSpeed;
    this.pos=new THREE.Vector3();this.vel=new THREE.Vector3();
    this.quat=new THREE.Quaternion();
    this.yaw=0;this.yawRate=0;this.throttle=1;
    this.pitch=0;this.roll=0;this.pitchV=0;this.rollV=0;
    this.chambers=makeChambers(this.def);
    this.floods=[0,0,0,0];this.integ=[1,1,1,1];
    this.pDir=Math.random()<.5?1:-1;
    this.group=buildShipMesh(this.def);scene.add(this.group);
    this.blob=new THREE.Mesh(blobGeo,blobMat);scene.add(this.blob);
    this.blob.scale.set(this.def.l*.42,1,this.def.w*.85);
    if(this.elite){const hot=new THREE.Color(0xff3818); /* one-time tint, not per-frame */
      this.group.traverse(o=>{if(o.isMesh&&o.material&&o.material.color){o.material=o.material.clone();o.material.color.lerp(hot,.4);}});}
    this.smokeAcc=0;this.fireAcc=0;this.sprayAcc=0;this.burn=0;
    this.gunCd=rand(2,5);this.torpCd=rand(3,7);
    this.sinking=false;this.finalizing=false;this.doomed=false;this.scored=false;
    this.sinkT=0;this.dP=rand(-1,1);this.dR=rand(-1,1);
    this.charging=(type==='freighter'&&waveNum>=4&&Math.random()<.35);
    this.hold=this.def.hold+rand(-8,8);
    /* BOSS v2 systems: missile battery / jet wing */
    if(this.def.rockets)this.mslCd=6;
    if(this.def.jets)this.jetCd=4;
    if(this.isBoss())feed('☠ '+this.def.name+' ON RADAR — '+(type==='battle'?'MISSILE BATTERY ACTIVE':type==='carrier'?'AIR WING INBOUND':''),'warn');
  }
  spawnAt(ang){
    const R=this.isBoss()?rand(215,235):rand(190,230); /* bosses keep more distance */
    this.pos.set(player.pos.x+Math.sin(ang)*R,0,player.pos.z+Math.cos(ang)*R);
    this.pos.y=waveH(this.pos.x,this.pos.z,tNow)-this.def.draft*.34;
    this.yaw=Math.atan2(player.pos.x-this.pos.x,player.pos.z-this.pos.z);
  }
  isBoss(){return this.type==='cruiser'||this.type==='battle'||this.type==='carrier';}
  isBossType(t){return t==='cruiser'||t==='battle'||t==='carrier';}
  update(dt,noAI){
    if(this.finalizing)return;
    if(!isFinite(this.pos.x+this.pos.y+this.pos.z)){this.finalize();return;}
    this.vmax=this.def.vmax*this.tier.spd*TUNES.eSpeed;
    const avg=fillFloods(this,dt,this.isBoss()&&this.sinking,1); /* FIX: #22 bosses pump while sinking (slower death) */
    const cap=this.isBoss()?.68:.52; /* bosses resist flooding longer */
    if(!this.sinking&&(avg>.52||this.hp<=0))this.startSink();
    if(this.sinking)this.throttle=0;
    else if(!noAI)this.ai(dt);
    floatStep(this,dt);
    this.group.quaternion.copy(this.quat);
    this.group.position.copy(this.pos);
    this.group.updateMatrixWorld(true);
    if(this.burn>0){
      this.burn-=dt;this.hp-=2.2*dt;
      this.fireAcc+=dt*20;
      while(this.fireAcc>1){this.fireAcc--;
        const sp=_a.set(rand(-1,1),1+this.def.hullH,rand(-2,2)).applyQuaternion(this.quat).add(this.pos);
        particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1,1),vy:rand(3,7),vz:rand(-1,1),g:2.5,drag:.4,life:rand(.3,.7),s0:1.6,s1:3.6,c0:[1,.55,.15],c1:[.6,.1,.02]});}
    }
    const dmgR=this.hp/this.maxhp;
    if(dmgR<.9){
      this.smokeAcc+=(1-dmgR)*13*dt*(this.doomed?2:1);
      while(this.smokeAcc>1){this.smokeAcc--;
        const sp=_a.set(rand(-1,1),1.2+this.def.hullH,this.def.l*.28*rand(0,1)-this.def.l*.14).applyQuaternion(this.quat).add(this.pos);
        if(this.doomed&&Math.random()<.55)
          particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1.5,1.5),vy:rand(3,7),vz:rand(-1.5,1.5),g:2,drag:.5,life:rand(.5,1),s0:1.4,s1:4.5,c0:[1,.55,.2],c1:[.5,.1,.05]});
        else
          particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1,1),vy:rand(2.5,5.5),vz:rand(-1,1),g:.6,drag:.5,life:rand(1.4,2.6),s0:1.6,s1:7,c0:[.18,.18,.2],c1:[.04,.04,.05]});
      }
    }
    const avgF=(this.floods[0]+this.floods[1]+this.floods[2]+this.floods[3])/4;
    if(avgF>.12){this.sprayAcc+=dt*avgF*14;
      while(this.sprayAcc>1){this.sprayAcc--;
        const ci=Math.floor(rand(0,4));
        if(this.floods[ci]>.08){
          const sp=_a.copy(this.chambers[ci]).applyQuaternion(this.quat).add(this.pos);
          sp.y=waveH(sp.x,sp.z,tNow)+.2;
          particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1.5,1.5),vy:rand(2,5),vz:rand(-1.5,1.5),g:-12,life:rand(.3,.7),s0:.7,s1:1.8,c0:[.85,.93,.97],c1:[.5,.72,.85],waterKill:true});}}}
    const spd=Math.hypot(this.vel.x,this.vel.z);
    if(spd>4)bowSpray(this,spd,dt);
    this.blob.position.set(this.pos.x,waveH(this.pos.x,this.pos.z,tNow)+.05,this.pos.z);
    if(this.sinking&&this.type==='carrier'&&tNow-this.sinkT>3)releaseJets(this,true);
    if(this.pos.y<(this.isBoss()?-19:-16))this.finalize();
  }
  ai(dt){
    if(player.dead){this.throttle=.25;return;}
    /* FIX: #14 (2026-09-06) sinking wrecks stop fighting — AI froze movement
       but kept firing guns/missiles while going under. */
    if(this.sinking){this.throttle=0;return;}
    const pos=this.pos;
    const dp=_e.set(pos.x-player.pos.x,0,pos.z-player.pos.z);
    const d=dp.length()||.01;
    let tx,tz;
    if(this.charging){tx=player.pos.x;tz=player.pos.z;}
    else if(d>this.hold+13){tx=player.pos.x;tz=player.pos.z;}
    else{const th=Math.atan2(dp.x,dp.z)+.4*this.pDir;
      tx=player.pos.x+Math.sin(th)*this.hold;tz=player.pos.z+Math.cos(th)*this.hold;}
    const desired=Math.atan2(tx-pos.x,tz-pos.z);
    const err=wrapPI(desired-this.yaw);
    const rate=clamp(err*1.8,-this.def.turn,this.def.turn);
    this.yawRate+=(rate-this.yawRate)*Math.min(1,6*dt);
    this.yaw+=this.yawRate*dt;
    this.throttle=Math.abs(err)>1.2?.4:1;
    this.vel.x+=Math.sin(this.yaw)*this.def.thrust*TUNES.eSpeed*this.throttle*dt;
    this.vel.z+=Math.cos(this.yaw)*this.def.thrust*TUNES.eSpeed*this.throttle*dt;
    const dh=nearDist(this.pos,player.pos);
    this.gunCd-=dt;this.torpCd-=dt;
    if(TUNES.eAggro&&this.def.gun&&this.gunCd<=0&&dh<this.def.gun.range&&!gameOver&&state==='play'){
      this.gunCd=this.def.gun.rate*rand(.85,1.2)/TUNES.eFire;this.fireShell(dh);}
    if(TUNES.eAggro&&this.def.torp&&this.torpCd<=0&&dh<this.def.torp.range&&!gameOver&&state==='play'){
      this.torpCd=this.def.torp.rate*rand(.9,1.2)/TUNES.eFire;fireTorpedo(this);}
    /* BOSS v2: battleship homing missile salvoes (arm time makes them dodgeable) */
    if(this.def.rockets){this.mslCd-=dt;
      if(TUNES.eAggro&&this.mslCd<=0&&dh<this.def.rockets.range&&!gameOver&&state==='play'&&!player.dead){
        this.mslCd=this.def.rockets.rate*rand(.9,1.15)/TUNES.eFire;
        feed('⚠ MISSILE SALVO INBOUND — evasive action!','warn');
        /* FIX: #18 (2026-09-06) salvo target AI — the battery targets the
           player AND any player drones; distributeTargets() splits the
           salvo across them (extras wrap onto the primary). With no valid
           target a round LOFTS: climbs high and scans until it finds one. */
        const tgts=[player];
        for(const d of drones)tgts.push(d);
        const assign=distributeTargets(this.def.rockets.count,tgts);
        for(let k=0;k<this.def.rockets.count;k++){
          const mp=_a.set(rand(-2,2),this.def.hullH*1.2+1,rand(-4,4)).applyQuaternion(this.quat).add(this.pos);
          spawnEnemyMissile(mp,this.def.rockets,k,assign[k],this.tier.dmg);}}}
    /* BOSS v2: carrier launches jets periodically (cap = alive jets) */
    if(this.def.jets&&!this.sinking){this.jetCd-=dt;
      if(this.jetCd<=0&&!gameOver&&state==='play'&&!player.dead){
        this.jetCd=this.def.jets.rate*rand(.9,1.2);
        if(jets.length<this.def.jets.max)launchJet(this);}}
    if(this.charging&&dh<(this.def.l+player.def.l)*.5){
      fxExplosion(pos,2.4);damagePlayer(this.def.ram,pos);
      feed('💀 RAMMING HIT! −'+this.def.ram+' HULL','warn');
      for(let i=0;i<7;i++)debris.push(new Debris(pos));
      this.finalize();}
  }
  fireShell(dh){
    const mp=_a.set(0,this.def.hullH*.25,this.def.l*.42).applyQuaternion(this.quat).add(this.pos);
    const ty=player.pos.y+rand(-.5,1.5);
    const dx=player.pos.x+player.vel.x*.8+rand(-4,4)-mp.x;
    const dz=player.pos.z+player.vel.z*.8+rand(-4,4)-mp.z;
    const T=Math.max(.4,dh/this.def.gun.speed);
    const vy=(ty-mp.y+.5*G*T*T)/T;
    spawnShell(mp,dx/T,vy,dz/T,'enemy',this.def.gun.dmg*this.tier.dmg*TUNES.eDmg);
    _b.set(dx,vy*.4,dz).normalize();
    fxMuzzle(mp,_b,.8);
    const [d,pan]=apd(mp);sfx.cannon(pan,d<3?1:.55);
  }
  segmentHit(a,b){
    _qm.copy(this.group.matrixWorld).invert();
    const pa=_a.copy(a).applyMatrix4(_qm),pb=_b.copy(b).applyMatrix4(_qm);
    const n=Math.min(6,Math.max(2,Math.ceil(a.distanceTo(b)/.9)));
    for(let i=1;i<=n;i++){const k=i/n;
      const x=pa.x+(pb.x-pa.x)*k,y=pa.y+(pb.y-pa.y)*k,z=pa.z+(pb.z-pa.z)*k;
      if(Math.abs(x)<this.def.w*.5+.4&&Math.abs(z)<this.def.l*.5+.6&&y>-this.def.hullH*.6-.4&&y<3.4)
        return new THREE.Vector3(x,y,z).applyMatrix4(this.group.matrixWorld);}
    return null;
  }
  takeHit(wpt,dmg){this.takeHit2(wpt,dmg,false);}
  takeHit2(wpt,dmg,silent){
    if(this.finalizing)return;
    /* FIX: #22 (2026-09-06) boss armor — battleships absorb 30 %, carrier 25 %,
       cruisers 20 % of incoming damage BEFORE any threshold checks. */
    const armor=this.isBoss()?(this.def.armor??1):1;
    this.hp-=dmg*armor;fxExplosion(wpt,.8);
    const [d,pan]=apd(wpt);sfx.hit(pan);
    const critical=this.hp<=this.maxhp*.35;
    if(Math.random()<(critical?.38:.16))this.burn=Math.max(this.burn,rand(6,12));
    _qb.copy(this.quat).invert();
    const local=_a.copy(wpt).sub(this.pos).applyQuaternion(_qb);
    let bi=0,bd=1e9;
    for(let i=0;i<4;i++){const dd=(local.x-this.chambers[i].x)**2+(local.z-this.chambers[i].z)**2;if(dd<bd){bd=dd;bi=i;}}
    this.integ[bi]=Math.max(0,this.integ[bi]-(silent?.5:.75));
    this.floods[bi]=Math.min(1,this.floods[bi]+(silent?.12:.22));
    if(this.hp<=0&&!this.doomed){this.doomed=true;this.integ=[.2,.2,.2,.2];fxExplosion(this.pos,1.6);}
  }
  startSink(){
    this.sinking=true;this.sinkT=tNow;
    const [d,pan]=apd(this.pos);
    if(!this.scored){this.scored=true;shipsSunk++;
      addScore(this.def.score);addCredits(this.def.score);
      feed('⚓ '+this.def.name+' SUNK  +'+Math.round(this.def.score*TUNES.credMul)+' CR','good');
      sfx.sunk(pan,1/(1+d/60));}
    fxSplash(this.pos,22,2);
    rings.spawn(this.pos.x,this.pos.z,{r1:this.def.l*.8,life:1.4,o0:.55,y:waveH(this.pos.x,this.pos.z,tNow)});
    rings.spawn(this.pos.x,this.pos.z,{r1:this.def.l*1.6,life:20,o0:.3,color:0x0c1013,oil:true});
    for(let i=0;i<5;i++)debris.push(new Debris(this.pos));
  }
  finalize(){if(this.finalizing)return;this.finalizing=true;
    scene.remove(this.group);scene.remove(this.blob);fxSplash(this.pos,16,1.6);}
}
function nearDist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}

/* ================= BOSS v2: enemy missiles & carrier jets ================= */
const emissiles=[];
const emsGeo=new THREE.CylinderGeometry(.16,.16,1.4,7).rotateX(Math.PI/2);
const emsMat=new THREE.MeshStandardMaterial({color:0x3a3f45,roughness:.5,metalness:.4,flatShading:true});
function spawnEnemyMissile(mp,cfg,k,tgt,dmgMul=1){
  const m=new THREE.Mesh(emsGeo,emsMat);m.position.copy(mp);scene.add(m);
  /* FIX: #18 (2026-09-06) salvo target AI — each round receives its target
     from core.distributeTargets(); tgt=null ⇒ LOFT & scan (updateEMissiles). */
  const a=rand(0,TAU);
  const hd=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
  if(tgt){_n0.copy(tgt.pos).sub(mp);_n0.y=0;
    if(_n0.lengthSq()>.01)hd.copy(_n0.normalize());}
  emissiles.push({m,v:new THREE.Vector3(hd.x*8,18,hd.z*8),
    life:18,arm:1.2+k*.1,tr:0,t:0,scan:.4,tgt,hd,spd:cfg.vel,dmg:dmgMul});
  const [d,pan]=apd(mp);sfx.rocket(pan);
}
function validTgt(r){
  if(!r.tgt)return false;
  if(r.tgt===player)return !player.dead&&!player.finalizing;
  return !r.tgt.done; /* drones: done = destroyed/returning home */
}
function updateEMissiles(dt){
  for(let i=emissiles.length-1;i>=0;i--){
    const r=emissiles[i];r.life-=dt;r.arm-=dt;r.tr-=dt;r.t+=dt;r.scan-=dt;
    /* FIX: #18 (2026-09-06) target AI instead of blind ballistics.
       LOFT: no target ⇒ climb high and circle; a round only commits once
       it has ACQUIRED something (drones first — they are closer decoys —
       then the player). A lost target (sunk ship / destroyed drone)
       re-enters the scan instead of flying into the sea. */
    if(!validTgt(r)){
      r.tgt=null;
      if(r.scan<=0){r.scan=.5;
        let bd=1e9,best=null;
        for(const d of drones){if(d.done)continue;
          const dd=d.pos.distanceToSquared(r.m.position);if(dd<bd){bd=dd;best=d;}}
        if(!best&&!player.dead&&!player.finalizing){best=player;bd=player.pos.distanceToSquared(r.m.position);}
        if(bd<260*260)r.tgt=best;}
      /* loft: climb, keep some headway, slowly circle the scan heading */
      r.v.y=Math.min(r.v.y+9*dt,26);
      r.hd.applyAxisAngle(_n1.set(0,1,0),.55*dt);
      r.v.x+=(r.hd.x*r.spd*.6-r.v.x)*Math.min(1,1.2*dt);
      r.v.z+=(r.hd.z*r.spd*.6-r.v.z)*Math.min(1,1.2*dt);
    }else if(r.arm<=0&&state==='play'){
      /* homing on the assigned target (player rounds lead slightly) */
      if(r.tgt===player)_n0.copy(r.tgt.pos).addScaledVector(r.tgt.vel,.55);
      else _n0.copy(r.tgt.pos);
      _n0.sub(r.m.position).normalize();
      r.v.normalize().lerp(_n0,Math.min(1,3.4*dt)).normalize().multiplyScalar(r.spd);
    }
    r.m.position.addScaledVector(r.v,dt);
    r.m.lookAt(_n1.copy(r.m.position).add(r.v));
    if(r.tr<=0){r.tr=.03;const p=r.m.position;
      particles.spawn(p.x,p.y,p.z,{life:.3,s0:1,s1:2.4,c0:[1,.6,.3],c1:[.4,.15,.05]});}
    let det=false;
    if(!player.finalizing&&!player.dead&&playerSegmentHit(r.m.position)){
      damagePlayer(TUNES.emslDmg*r.dmg,r.m.position);fxExplosion(r.m.position,1.5);det=true;}
    /* proximity fuse vs drones: a decoy that gets chased CAN soak the hit */
    if(!det)for(const d of drones){
      if(d.done)continue;
      if(d.pos.distanceToSquared(r.m.position)<20.25){fxExplosion(r.m.position,1.2);det=true;break;}}
    const wh=waveH(r.m.position.x,r.m.position.z,tNow);
    /* FIX: #19 live impact ring (red) — where THIS enemy missile will splash */
    const _tt=timeToSurface(r.m.position.y-wh,r.v.y,G);
    if(_tt<9)impPush(r.m.position.x+r.v.x*_tt,r.m.position.z+r.v.z*_tt,true);
    if(!det&&r.m.position.y<=wh){det=true;fxSplash(r.m.position,10,1.2);}
    if(det||r.life<=0){if(!det)fxExplosion(r.m.position,.8);scene.remove(r.m);emissiles.splice(i,1);}
  }
}

/* Carrier air wing — jets climb, orbit and strafe the player with MG bursts.
   When the carrier sinks, surviving jets go VENGEANCE (no more cap). */
const jets=[];
const jetMat=new THREE.MeshStandardMaterial({color:0x535d68,roughness:.55,metalness:.35,flatShading:true});
const jetDark=new THREE.MeshStandardMaterial({color:0x22262b,roughness:.6,flatShading:true});
function buildJetMesh(){
  const g=new THREE.Group();
  const f=new THREE.Mesh(new THREE.ConeGeometry(.35,2.6,6),jetMat);f.rotation.x=Math.PI/2;g.add(f);
  const wb=new THREE.Mesh(new THREE.BoxGeometry(3.4,.08,1),jetMat);wb.position.z=-.2;g.add(wb);
  const tw=new THREE.Mesh(new THREE.BoxGeometry(1.2,.06,.6),jetMat);tw.position.set(0,.2,-1);g.add(tw);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.7),jetDark);fin.position.set(0,.3,-1);g.add(fin);
  const en=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.6,8),jetDark);en.rotation.x=Math.PI/2;en.position.z=-1.2;g.add(en);
  return g;
}
let _jetSeq=0; /* FIX: #36 — stable ids so the tactical map can target jets */
function launchJet(carrier,vengeance){
  const cap=carrier.def.jets?carrier.def.jets.max:0;
  if(jets.length>=cap+2&&!vengeance)return;
  const mesh=buildJetMesh();
  const jid=++_jetSeq;
  _n0.set(0,carrier.def.hullH+2.4,0).applyQuaternion(carrier.quat).add(carrier.pos);
  mesh.position.copy(_n0);scene.add(mesh);
  const j={id:jid,mesh,pos:mesh.position,v:new THREE.Vector3(),hp:TUNES.jetHp,
    st:'climb',ang:rand(0,TAU),mg:1.2,home:carrier,trail:0,passes:0,leaveT:0,
    bomb:(carrier&&carrier.def.jets)?rand(2,4):rand(3,5)}; /* FIX: #22 dive-bomb timer */
  _n1.set(0,0,1).applyQuaternion(carrier.quat);
  j.v.set(_n1.x*22,12,_n1.z*22);
  jets.push(j);
  fxMuzzle(j.pos,_n1,.6);
  feed(vengeance?'✈ VENGEANCE STRIKE — jets scrambled from sinking carrier!':'✈ Enemy jet launched from carrier','warn');
  const [d,pan]=apd(j.pos);sfx.rocket(pan);
}
function releaseJets(carrier,vengeance){
  if(!carrier||carrier._jetsOut)return;carrier._jetsOut=true;
  let n=0;
  for(const j of jets){if(j.home===carrier&&!j.dead){j.st='strafe';n++;}}
  for(let i=n;i<(vengeance?3:2);i++)launchJet(carrier,vengeance);
}
function killJet(j,i){
  fxExplosion(j.pos,1.2);
  for(let k=0;k<4;k++)debris.push(new Debris(j.pos));
  scene.remove(j.mesh);jets.splice(i,1);
  if(state==='play'){addScore(120);addCredits(120);
    feed('✈ ENEMY JET DOWN  +120 CR','good');}
  const [d,pan]=apd(j.pos);sfx.sunk(pan,1.6);
}
function updateJets(dt){
  const sim=state==='play'&&!gameOver&&!player.dead;
  for(let i=jets.length-1;i>=0;i--){
    const j=jets[i],jp=j.mesh;
    if(j.home&&j.home.finalizing&&!j.avenged){j.avenged=true;j.st='strafe';}
    if(j.home&&j.home.sinking)j.st='strafe';
    j.ang+=dt*.5;
    const p=player.pos;
    if(j.st==='climb'){
      _n0.set(p.x+Math.sin(j.ang)*60,34,p.z+Math.cos(j.ang)*60);
      _n1.copy(_n0).sub(jp.position).normalize().multiplyScalar(30);
      j.v.lerp(_n1,Math.min(1,1.2*dt));
      if(jp.position.y>26)j.st='strafe';
    }else if(j.st==='strafe'){
      _n0.set(p.x+Math.sin(j.ang)*46,22,p.z+Math.cos(j.ang)*46);
      _n1.copy(_n0).sub(jp.position).normalize().multiplyScalar(32);
      j.v.lerp(_n1,Math.min(1,1.4*dt));
      /* FIX: #22 dive-bomb — jets drop a real bomb on their strafing passes */
      j.bomb-=dt;
      if(j.bomb<=0&&sim&&jp.position.y>6){
        j.bomb=(j.home&&j.home.def.jets)?j.home.def.jets.bomb*rand(.8,1.2):4;
        dropBomb(j);}
      j.mg-=dt;
      if(j.mg<=0&&sim){
        j.mg=(j.home&&j.home.def.jets)?j.home.def.jets.mgCd*rand(1,2):.25;
        _n1.copy(p).sub(jp.position).normalize();
        fxMuzzle(jp.position,_n1,.4);
        const T=Math.max(.3,jp.position.distanceTo(p)/90);
        spawnShell(jp.position,(p.x+p.vel.x*.4*T-jp.position.x)/T,(p.y-jp.position.y)/T*1.02,(p.z+p.vel.z*.4*T-jp.position.z)/T,'enemy',TUNES.jetMgDmg,false);
        const [d,pan]=apd(jp.position);sfx.mg(pan);}
    }else if(j.st==='leave'){
      _n1.copy(jp.position).sub(p).setY(26).normalize().multiplyScalar(40);
      j.v.lerp(_n1,Math.min(1,1.2*dt));
    }
    j.v.y-=G*.12*dt;
    jp.position.addScaledVector(j.v,dt);
    _q0.setFromUnitVectors(_tv.set(0,0,1),_n1.copy(j.v).normalize());
    j.mesh.quaternion.slerp(_q0,Math.min(1,8*dt));
    j.trail-=dt;
    if(j.trail<=0){j.trail=.02;
      particles.spawn(jp.position.x,jp.position.y,jp.position.z,{life:.25,s0:.6,s1:1.6,c0:[.85,.88,.92],c1:[.5,.55,.6]});}
    if(j.st!=='leave'&&jp.position.distanceTo(p)<70){
      j.passes++;if(j.passes>7){j.st='leave';j.leaveT=3;}}
    if(j.st==='leave'){j.leaveT-=dt;
      if(j.leaveT<=0){scene.remove(j.mesh);jets.splice(i,1);continue;}}
    const wh=waveH(jp.position.x,jp.position.z,tNow);
    if(jp.position.y<wh+.4)killJet(j,i); /* wave impact kills jets */
  }
}

/* FIX: #22 (2026-09-06) DIVE BOMBERS — carrier jets now drop real bombs.
   Bombs are gravity-dive projectiles (small, dark, tracer), they arc down
   onto the player and explode with a splash + AoE hull damage. */
const bombs=[];
const bombGeo=new THREE.SphereGeometry(.26,8,6);
const bombMat=new THREE.MeshStandardMaterial({color:0x15181c,roughness:.4,metalness:.6});
function dropBomb(j){
  const jp=j.mesh;
  _n0.copy(player.pos).sub(jp.position);_n0.y=0;if(_n0.lengthSq()<1)_n0.set(0,0,1);_n0.normalize();
  const m=new THREE.Mesh(bombGeo,bombMat);m.position.copy(jp.position);scene.add(m);
  bombVel.set(_n0.x*(j.v.length()*.4),j.v.y*.3-2,_n0.z*(j.v.length()*.4-6)); /* lob it toward the player */
  bombs.push({m,v:bombVel.clone(),life:6});
  const [d,pan]=apd(jp.position);sfx.rocket(pan); /* whistle-ish */
}
const bombVel=new THREE.Vector3();
function updateBombs(dt){
  for(let i=bombs.length-1;i>=0;i--){
    const b=bombs[i];b.life-=dt;
    b.v.y-=G*dt; /* real gravity dive */
    b.m.position.addScaledVector(b.v,dt);
    let det=false;
    if(b.friendly){
      /* FIX: #24 friendly bombs hit ENEMY ships, never the player */
      for(const sh of ships){
        if(sh.finalizing)continue;
        if(sh.pos.distanceToSquared(b.m.position)<64){
          sh.takeHit(b.m.position,b.dmg||30);fxExplosion(b.m.position,2);det=true;
          addScore(40);addCredits(40);break;}
      }
      if(!det&&!player.finalizing&&!player.dead&&player.pos.distanceToSquared(b.m.position)<36){
        damagePlayer((TUNES.emslDmg*1.5*TUNES.bombDmg+10)*.15,b.m.position); /* 15 % splash self-damage */
        fxExplosion(b.m.position,2.2);det=true;feed('💣 FRIENDLY BOMB SHORT!','warn');}
    }else if(!player.finalizing&&!player.dead&&player.pos.distanceToSquared(b.m.position)<49){
      damagePlayer(TUNES.emslDmg*1.5*TUNES.bombDmg+10,b.m.position); /* enemy bomb punch (dev-tunable) */
      fxExplosion(b.m.position,2.2);det=true;feed('💣 BOMB HIT!','warn');
    }
    const wh=waveH(b.m.position.x,b.m.position.z,tNow);
    if(!det&&b.m.position.y<=wh){det=true;fxSplash(b.m.position,12,1.8);fxExplosion(b.m.position,1.1);}
    if(det||b.life<=0){scene.remove(b.m);bombs.splice(i,1);}
  }
}

/* ================= PLAYER SHIP ================= */
function buildTower(){
  const root=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.6,.72,.3,12),new THREE.MeshStandardMaterial({color:0x39424e,roughness:.7,flatShading:true}));
  root.add(base);
  const pitch=new THREE.Group();pitch.position.y=.28;root.add(pitch);
  const whiM=new THREE.MeshStandardMaterial({color:0xb9c2c8,roughness:.75,flatShading:true});
  const darkM=new THREE.MeshStandardMaterial({color:0x252a31,roughness:.6,metalness:.3,flatShading:true});
  const house=new THREE.Mesh(new THREE.BoxGeometry(1.2,.6,1.4),whiM);house.position.y=.32;pitch.add(house);
  for(const x of [-.24,.24]){
    const br=new THREE.Mesh(new THREE.CylinderGeometry(.085,.1,2.3,8),darkM);
    br.rotation.x=Math.PI/2;br.position.set(x,.36,1.35);pitch.add(br);
    const mz=new THREE.Object3D();mz.position.set(x,.36,2.55);pitch.add(mz);
    root.userData['mz'+(x<0?'L':'R')]=mz;}
  root.userData.pitch=pitch;
  return root;
}
function initPlayer(){
  const def={l:18,w:4.4,hullH:2.3,draft:2.7,thrust:TUNES.pThrust,turn:TUNES.pTurn};
  player={def,pos:new THREE.Vector3(0,0,-10),vel:new THREE.Vector3(),
    quat:new THREE.Quaternion(),yaw:0,yawRate:0,throttle:0,
    pitch:0,roll:0,pitchV:0,rollV:0,chambers:makeChambers(def),
    floods:[0,0,0,0],integ:[1,1,1,1],
    hp:TUNES.pHP,maxhp:TUNES.pHP,crew:100,maxCrew:100,repairMode:false,burn:0,fireAcc:0,sprayAcc:0,
    towers:2,maxDrones:1,reloadMul:1,dmgMul:1,speedMul:1,
    lv:{hull:0,turret:0,reload:0,dmg:0,drone:0,engine:0,crew:0,armor:0,size:0,fleet:0},
    dead:false,sinking:false,finalizing:false,doomed:false,sinkT:0,dP:0,dR:0,wakeAcc:0};
  player.pos.y=waveH(0,0,0)-def.draft*.30;
  const g=new THREE.Group();
  const hullM=new THREE.MeshStandardMaterial({color:0x46586c,roughness:.68,metalness:.15,flatShading:true});
  const redM=new THREE.MeshStandardMaterial({color:0x6e2222,roughness:.9,flatShading:true});
  const whiM=new THREE.MeshStandardMaterial({color:0xc3ccd2,roughness:.7,flatShading:true});
  const darkM=new THREE.MeshStandardMaterial({color:0x22262b,roughness:.6,metalness:.3,flatShading:true});
  const add=(geo,mat,x,y,z,rx=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.x=rx;g.add(m);return m;};
  add(new THREE.BoxGeometry(def.w,def.hullH,def.l),hullM,0,0,0);
  add(new THREE.BoxGeometry(def.w+.12,def.hullH*.5,def.l*.99),redM,0,-def.hullH*.3,0);
  const bow=add(new THREE.ConeGeometry(def.w*.55,def.l*.16,4),hullM,0,0,def.l/2+def.l*.07,Math.PI/2,0,Math.PI/4);
  bow.scale.set(1,1,.55);
  const top=def.hullH*.5;
  add(new THREE.BoxGeometry(def.w*.75,1.5,5.5),whiM,0,top+.7,-1.2);
  add(new THREE.BoxGeometry(def.w*.55,.5,.8),darkM,0,top+1.35,-1.2);
  add(new THREE.CylinderGeometry(.5,.58,2.4,9),darkM,0,top+1.6,-4.6);
  add(new THREE.CylinderGeometry(.52,.52,.3,9),new THREE.MeshStandardMaterial({color:0x111418}),0,top+2.85,-4.6);
  add(new THREE.CylinderGeometry(.06,.1,4,6),darkM,0,top+2.4,.6);
  player.radar=add(new THREE.BoxGeometry(2.6,.08,.34),darkM,0,top+4.4,.6);
  player.group=g;scene.add(g);
  const slots=[def.l*.3,def.l*.11,-def.l*.17,-def.l*.34];
  player.towerList=slots.map(z=>{const t=buildTower();t.position.set(0,top+.15,z);g.add(t);return t;});
  player.blob=new THREE.Mesh(blobGeo,blobMat);scene.add(player.blob);
  player.blob.scale.set(def.l*.42,1,def.w*.85);
  applyStats();
}
function applyStats(){
  const lv=player.lv;
  player.maxhp=Math.round(TUNES.pHP+40*lv.hull+60*lv.size);
  player.towers=2+lv.turret;
  player.reloadMul=Math.pow(.9,lv.reload)*TUNES.pReloadMul;
  player.dmgMul=(1+lv.dmg*.15)*TUNES.pDmgMul;
  player.speedMul=1+lv.engine*.14;
  player.maxDrones=1+lv.drone;
  player.armor=Math.min(.4,lv.armor*.08); /* FIX: #23 alloy plating −8%/lvl, cap 40 % */
  player.scaleMul=1+lv.size*.12; /* FIX: #23 hull expansion grows the ship */
  player.maxCrew=100+20*lv.crew;
  player.crew=clamp(player.crew,0,player.maxCrew);
  player.def.thrust=TUNES.pThrust;
  player.def.turn=TUNES.pTurn;
  player.group.scale.setScalar(player.scaleMul);
  player.towerList.forEach((t,i)=>t.visible=i<player.towers);
  player.hp=Math.min(player.hp,player.maxhp);
  updateDronesHud();
}
function playerSegmentHit(p){
  _qm.copy(player.group.matrixWorld).invert();
  _e.copy(p).applyMatrix4(_qm);
  return Math.abs(_e.x)<player.def.w*.55&&Math.abs(_e.z)<player.def.l*.55&&_e.y>-2.2&&_e.y<3.5;
}
function curReloadMul(){
  const c=player.crew/player.maxCrew;
  return player.reloadMul*(1+(1-c)*0.8);
}
function toggleDC(){
  if(!player||player.dead)return;
  player.repairMode=!player.repairMode;
  feed(player.repairMode?'🔧 DAMAGE CONTROL ON — crew pumping & patching':'🔧 Damage control stood down',player.repairMode?'good':'info');
}
let sinkTimer=0;
function updatePlayer(dt){
  const P=player,def=P.def;
  let avg=fillFloods(P,dt,P.repairMode&&P.crew>1,clamp(P.crew/50,.2,1));
  /* FIX: #39 (2026-11-12) — god mode now also stops flooding, so the cheat
     cannot be sunk by leaks it is supposed to ignore. */
  if(TUNES.godMode){P.floods.fill(0);P.integ.fill(1);P.burn=0;avg=0;}
  if(!P.sinking&&!P.dead&&avg>.52)startPlayerSink();
  if(TUNES.infHP&&!P.finalizing)P.hp=P.maxhp;
  if(!P.sinking&&!P.dead){
    const thT=(touchJoy.active)?touchJoy.thr:(keys.KeyW?1:keys.KeyS?-0.45:0);
    P.throttle+=(thT-P.throttle)*Math.min(1,2*dt);
    const rud=(touchJoy.active)?touchJoy.rud:((keys.KeyA?1:0)-(keys.KeyD?1:0));
    const sf=.35+.65*Math.min(1,Math.abs(P.throttle));
    const yrTarget=rud*def.turn*1.5*sf;
    P.yawRate+=(yrTarget-P.yawRate)*Math.min(1,5*dt);
    P.yaw+=P.yawRate*dt;
    P.vmax=TUNES.pVmax*P.speedMul;
    const fx=Math.sin(P.yaw),fz=Math.cos(P.yaw);
    P.vel.x+=fx*def.thrust*P.speedMul*P.throttle*dt;
    P.vel.z+=fz*def.thrust*P.speedMul*P.throttle*dt;
  }
  if(P.repairMode&&P.crew>0&&!P.dead){
    const busy=(P.hp<P.maxhp-1)||P.floods.some(f=>f>.01)||P.integ.some(v=>v<.999)||(P.burn>0);
    if(busy){
      P.crew=Math.max(0,P.crew-1.6*dt*(P.burn>0?1.6:1));
      if(P.hp<P.maxhp)P.hp=Math.min(P.maxhp,P.hp+2*clamp(P.crew/50,.2,1)*dt);
      if(P.crew<=0){P.repairMode=false;feed('⚠ CREW EXHAUSTED — damage control halted!','warn');}
    }
  }
  if(P.burn>0){
    P.burn-=dt*(P.repairMode?2.6:0.55);
    if(!P.sinking&&!TUNES.godMode)P.hp=Math.max(0,P.hp-2.0*dt);
    P.fireAcc+=dt*20;
    while(P.fireAcc>1){P.fireAcc--;
      const sp=_a.set(rand(-1.5,1.5),def.hullH*.5+rand(0,2),rand(-3,3)).applyQuaternion(P.quat).add(P.pos);
      particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1,1),vy:rand(3,7),vz:rand(-1,1),g:2.5,drag:.4,life:rand(.3,.7),s0:1.7,s1:3.8,c0:[1,.55,.15],c1:[.6,.1,.02]});}
  }
  floatStep(P,dt);
  if(Math.abs(P.pos.x)>250){P.pos.x=Math.sign(P.pos.x)*250;P.vel.x*=-.3;}
  if(P.pos.z>70){P.pos.z=70;P.vel.z*=-.3;}
  if(P.pos.z<-280){P.pos.z=-280;P.vel.z*=-.3;}
  P.group.quaternion.copy(P.quat);
  P.group.position.copy(P.pos);
  P.group.updateMatrixWorld(true);
  const avg2=(P.floods[0]+P.floods[1]+P.floods[2]+P.floods[3])/4;
  if(avg2>.1){P.sprayAcc+=dt*avg2*14;
    while(P.sprayAcc>1){P.sprayAcc--;
      const ci=Math.floor(rand(0,4));
      if(P.floods[ci]>.08){
        const sp=_a.copy(P.chambers[ci]).applyQuaternion(P.quat).add(P.pos);
        sp.y=waveH(sp.x,sp.z,tNow)+.2;
        particles.spawn(sp.x,sp.y,sp.z,{vx:rand(-1.5,1.5),vy:rand(2,5),vz:rand(-1.5,1.5),g:-12,life:rand(.3,.7),s0:.8,s1:2,c0:[.85,.93,.97],c1:[.5,.72,.85],waterKill:true});}}}
  P.radar.rotation.y+=dt*3;
  const spd=Math.hypot(P.vel.x,P.vel.z);
  if(spd>3&&!P.sinking){P.wakeAcc+=dt*spd*.35;
    while(P.wakeAcc>1){P.wakeAcc--;
      _a.set(rand(-.5,.5),.2,def.l*.5).applyQuaternion(P.quat).add(P.pos);
      particles.spawn(_a.x,waveH(_a.x,_a.z,tNow)+.1,_a.z,{life:1.1,s0:1.4,s1:3.2,c0:[.92,.97,.99],c1:[.55,.78,.9],waterKill:true});}}
  bowSpray(P,spd,dt);
  P.blob.position.set(P.pos.x,waveH(P.pos.x,P.pos.z,tNow)+.05,P.pos.z);
  if(P.sinking&&P.pos.y<-14)finalizePlayer();
}
function startPlayerSink(){
  if(player.sinking)return;
  player.sinking=true;player.doomed=true;player.dead=true;player.sinkT=tNow;
  player.dP=rand(-1,1);player.dR=rand(-1,1);
  player.floods=[1,1,1,1];player.integ=[.2,.2,.2,.2];player.burn=0;
  fxExplosion(player.pos,2.2);
  for(let i=0;i<9;i++)debris.push(new Debris(player.pos));
  rings.spawn(player.pos.x,player.pos.z,{r1:20,life:24,o0:.32,color:0x0c1013,oil:true});
  feed('⚓ FLOODING UNCONTROLLABLE — SHIP IS GOING DOWN!','warn');
  banner('SHIP SINKING','Abandon ship!');
  state='over';
  try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}
  sinkTimer=2.6;
}
function finalizePlayer(){
  if(player.finalizing)return;
  player.finalizing=true;
  scene.remove(player.group);scene.remove(player.blob);
  fxSplash(player.pos,24,2.4);
  gameOverNow('SHIP SUNK');
  const [d,pan]=apd(player.pos);sfx.sunk(pan,1);
}
function damagePlayer(d,at){
  if(TUNES.godMode)return;
  if(player.dead||state!=='play')return;
  d=d*(1-(player.armor||0)); /* FIX: #23 alloy plating reduces ALL incoming damage */
  player.hp=Math.max(0,player.hp-d);
  ui.dmg.style.opacity=.9;setTimeout(()=>ui.dmg.style.opacity=0,60);
  shakeV=Math.max(shakeV,.4);
  if(at)fxExplosion(at,.7);
  if(d>=8&&Math.random()<TUNES.fireChance&&player.burn<=0){
    player.burn=rand(6,10);feed('🔥 FIRE ON BOARD! Press R for damage control','warn');}
  if(player.hp<=0)startPlayerSink();
}

/* ================= Turrets & Weapons ================= */
const WEAPONS=[
  {name:'AP',cd:2.0,speed:130,dmg:60},
  {name:'MG',cd:.13,speed:190,dmg:5,grav:false},
  {name:'RP',cd:6.5},
];
let curWeapon=0,weaponCds=[0,0,0],salvoQ=[];
/* FIX: #25 (2026-09-06) armory — selected ordnance types + the rocket reload
   chain. The chain ONLY grows without admin toggles (cheatsOn() gate). */
const armory={shell:'ap',msl:'ir',mslChain:0};
function cheatsOn(){return !!(TUNES.godMode||TUNES.infHP||TUNES.noReload||TUNES.infAmmo||TUNES.aimbot);}
let aimbotTarget=null;
/* SOFT AIM ASSIST: only snaps when target is already near the crosshair (cone) */
let assistTarget=null;
const ASSIST_CONE=0.16;
function getAimPoint(){
  if(TUNES.aimbot&&aimbotTarget)return _aim.copy(aimbotTarget);
  if(TUNES.aimAssist&&!TUNES.aimbot&&assistTarget)return _aim.copy(assistTarget);
  _b.set(0,0,-1).applyEuler(_eu.set(camera.rotation.x,camera.rotation.y,0,'YXZ'));
  const O=camera.position,D=_b;
  let t=(D.y<-.02)?(-O.y/D.y):400;
  t=clamp(t,3,600);
  _aim.copy(O).addScaledVector(D,t);
  _aim.x=clamp(_aim.x,-340,340);_aim.z=clamp(_aim.z,-340,340);
  return _aim;
}
const solveElev=(R,v)=>solveElevG(R,v,G); /* FIX: pure impl in core.js */
function leadVec(from,tp,tv,speed){
  _l1.copy(tp).sub(from);let T=_l1.length()/speed;
  _l2.copy(tp).addScaledVector(tv,T);
  T=Math.max(.08,_l2.distanceTo(from)/speed);
  _l2.copy(tp).addScaledVector(tv,T).sub(from);
  return _l2;
}
function computeAimbot(){
  aimbotTarget=null;
  if(!TUNES.aimbot||state!=='play'||!player||player.dead)return;
  let bd=1e9,tgt=null;
  for(const sh of ships){if(sh.finalizing)continue;
    const dd=sh.pos.distanceTo(player.pos);if(dd<bd){bd=dd;tgt=sh;}}
  if(!tgt)return;
  const vel=curWeapon===1?TUNES.mgVel:TUNES.shellVel;
  _abp.copy(leadVec(player.pos,tgt.pos,tgt.vel,vel)).add(player.pos);
  _abp.y=Math.max(_abp.y,waveH(_abp.x,_abp.z,tNow)+1);
  aimbotTarget=_abp;
}
function computeAssist(){
  assistTarget=null;
  if(!TUNES.aimAssist||TUNES.aimbot||state!=='play'||!player||player.dead)return;
  _b.set(0,0,-1).applyEuler(_eu.set(camera.rotation.x,camera.rotation.y,0,'YXZ'));
  let bestA=ASSIST_CONE,tgt=null;
  for(const sh of ships){if(sh.finalizing)continue;
    _n0.copy(sh.pos).sub(camera.position);const dd=_n0.length();if(dd>320||dd<3)continue;
    _n0.divideScalar(dd);
    const ang=Math.acos(clamp(_n0.dot(_b),-1,1));
    if(ang<bestA){bestA=ang;tgt=sh;}}
  if(!tgt)return;
  const vel=curWeapon===1?TUNES.mgVel:TUNES.shellVel;
  _abp.copy(leadVec(player.pos,tgt.pos,tgt.vel,vel)).add(player.pos);
  _abp.y=Math.max(_abp.y,waveH(_abp.x,_abp.z,tNow)+1);
  assistTarget=_abp;
}
function updateTowers(dt){
  const aim=_at.copy(getAimPoint());
  player.group.updateMatrixWorld(true);
  _qb.copy(player.quat).invert();
  for(let i=0;i<player.towers;i++){
    const tw=player.towerList[i];
    _c.copy(aim).sub(player.pos).applyQuaternion(_qb);
    const ty=Math.atan2(_c.x,_c.z);
    let tp;
    if(curWeapon===0){const R=Math.hypot(_c.x,_c.z);tp=solveElev(R,TUNES.shellVel);}
    else if(curWeapon===1){const R=Math.max(2,Math.hypot(_c.x,_c.z));tp=clamp(Math.atan2(_c.y,R),-.05,.5);}
    else tp=1.0;
    const dy=wrapPI(ty-tw.rotation.y);
    tw.rotation.y+=clamp(dy,-2.8*dt,2.8*dt);
    const pd=tw.userData.pitch;
    pd.rotation.x+=clamp(-tp-pd.rotation.x,-2.5*dt,2.5*dt);
  }
}
function fireCurrent(dt){
  const w=WEAPONS[curWeapon];
  if(weaponCds[curWeapon]>0)return;
  if(curWeapon===2&&salvoQ.length)return;
  weaponCds[curWeapon]=TUNES.noReload?0.03:w.cd*curReloadMul();
  player.group.updateMatrixWorld(true);
  const aim=_aim2.copy(getAimPoint()); /* FIX: reused temp instead of clone() */
  const tv=_tv; /* FIX: reused temp instead of new Vector3 */
  let tgt=null,bd=28;
  for(const sh of ships){if(sh.finalizing)continue;
    const dd=Math.hypot(sh.pos.x-aim.x,sh.pos.z-aim.z);
    if(dd<bd){bd=dd;tgt=sh;}}
  let fired=0;
  if(curWeapon===2){
    /* FIX: #25 rocket ammo + seeker cap + escalating reload chain */
    const msl=MSL_TYPES[armory.msl]||MSL_TYPES.bal;
    if(!cheatsOn()){
      if(fleet.ammo<msl.cost*2){feed('⚠ NOT ENOUGH AMMO FOR A SALVO — [TAB] munitions shop','warn');weaponCds[2]=.5;return;}}
    let n=0;
    for(let i=0;i<player.towers;i++){
      const tw=player.towerList[i];
      tw.userData.pitch.updateMatrixWorld(true);
      const mp=_mp; /* FIX: reused temp */
      tw.userData['mzR'].getWorldPosition(mp);
      for(let j=0;j<Math.round(TUNES.rocketCount)+msl.seek;j++) /* seekers add extra rockets */
        salvoQ.push({t:i*TUNES.salvoGap+j*TUNES.salvoGap*.5,mp:mp.clone(),tgt});
      n++;}
    if(n){
      if(!cheatsOn()){fleet.ammo-=msl.cost*2;armory.mslChain++;
        if(tNow-(armory.mslLastFire||-99)>90)armory.mslChain=1; /* long pause = chain reset */
        armory.mslLastFire=tNow;
        weaponCds[2]=salvoCooldown(w.cd*curReloadMul(),armory.mslChain);
        if(armory.mslChain>=2)feed('⏳ HEAVY SALVO — reload '+Math.round(weaponCds[2])+'s','info');}
      ui.cross.classList.add('kick');setTimeout(()=>ui.cross.classList.remove('kick'),110);}
    return;
  }
  for(let i=0;i<player.towers;i++){
    const tw=player.towerList[i];
    tw.userData.pitch.updateMatrixWorld(true);
    for(const mzK of ['mzL','mzR']){
      if(curWeapon===1&&(mzK==='mzL'))continue;
      const mp=_mp; /* FIX: reused temp */
      tw.userData[mzK].getWorldPosition(mp);
      if(tgt){tv.copy(tgt.vel);}else tv.set(0,0,0);
      if(curWeapon===0){
        /* FIX: #25 (2026-09-06) ammo system — each AP shell costs 1 unit of the
           selected shell type; ammo types change damage AND dispersion. */
        if(!cheatsOn()){
          if(fleet.ammo<=0){feed('⚠ OUT OF SHELLS — buy MUNITIONS CRATE [TAB]','warn');weaponCds[0]=.5;return;}
          fleet.ammo--;}
        const ord=ORD_TYPES[armory.shell]||ORD_TYPES.ap;
        const acc=shellAccuracy(.014,cvs._zoom,player.lv.ac||0)*ord.spread; /* FIX: #25 accuracy + per-ordnance spread */
        const vel=TUNES.shellVel;
        const d=leadVec(mp,tgt?tgt.pos:aim,tv,vel);
        const R=Math.max(3,Math.hypot(d.x,d.z));
        const th=solveElev(R,vel);
        const dd=leadVec(mp,tgt?tgt.pos:aim,tv,vel*Math.cos(th));
        const R2=Math.max(3,Math.hypot(dd.x,dd.z));
        const th2=solveElev(R2,vel);
        _a.set(dd.x/R2*Math.cos(th2),Math.sin(th2),dd.z/R2*Math.cos(th2));
        _a.applyEuler(_eu.set(0,rand(-acc,acc)+(tgt?.002:0)*rand(-1,1),0));
        _a.normalize();
        spawnShell(mp,_a.x*vel,_a.y*vel,_a.z*vel,'player',TUNES.heDmg*player.dmgMul*ord.dmg);
        fxMuzzle(mp,_a,1.1);flash(mp,50);fired++;
      }else{
        const d=leadVec(mp,tgt?tgt.pos:aim,tv,TUNES.mgVel);
        _a.copy(d).normalize().applyEuler(_eu.set(rand(-.012,.012),rand(-.012,.012),0));
        spawnShell(mp,_a.x*TUNES.mgVel,_a.y*TUNES.mgVel,_a.z*TUNES.mgVel,'player',TUNES.mgDmg*player.dmgMul,w.grav);
        fxMuzzle(mp,_a,.5);fired++;
      }
    }
  }
  if(fired){
    ui.cross.classList.add('kick');setTimeout(()=>ui.cross.classList.remove('kick'),110);
    recoil=curWeapon===0?.05:.008;
    shakeV=Math.max(shakeV,curWeapon===0?.15:.02);
    if(curWeapon===0)sfx.cannon(0,1);
    else if(curWeapon===1)sfx.mg(0);
  }
}
function updateSalvo(dt){
  for(let i=salvoQ.length-1;i>=0;i--){
    const s=salvoQ[i];s.t-=dt;
    if(s.t<=0){spawnRocket(s.mp,s.tgt);salvoQ.splice(i,1);}
  }
}
function switchWeapon(i){
  if(i<0||i>2)return;
  const changed=i!==curWeapon;
  curWeapon=i;
  for(let k=0;k<3;k++)$('s'+k).classList.toggle('active',k===curWeapon);
  if(changed)feed('⚔ WEAPON: '+['HE SHELLS','MACHINE GUN','ROCKET POD'][i],'info');
}

/* ================= Drones ================= */
const drones=[];let droneCd=0;
function buildDroneMesh(){
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:0x3a4652,roughness:.5,metalness:.4,flatShading:true});
  const b=new THREE.Mesh(new THREE.BoxGeometry(.7,.22,.7),m);g.add(b);
  for(const [x,z] of [[-.55,-.55],[.55,-.55],[-.55,.55],[.55,.55]]){
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.8,6),m);
    arm.rotation.z=Math.PI/2;arm.position.set(x*.5,0,z*.5);
    arm.lookAt(_n0.set(x*2,0,z*2));g.add(arm);
    const rot=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.03,12),
      new THREE.MeshBasicMaterial({color:0x9db4c4,transparent:true,opacity:.35}));
    rot.position.set(x,.12,z);g.add(rot);(g.userData.rots??=(g.userData.rots=[])).push(rot);}
  const led=new THREE.Mesh(new THREE.SphereGeometry(.08,6,6),new THREE.MeshBasicMaterial({color:0x4cc3ff}));
  led.position.set(0,-.15,0);g.add(led);
  return g;
}
class Drone{
  constructor(idx){this.mesh=buildDroneMesh();scene.add(this.mesh);
    this.pos=player.pos.clone().add(new THREE.Vector3(rand(-1,1),2,rand(-2,2)));
    this.state='rise';this.energy=20;this.ang=idx*2.1;this.cd=0;this.tgt=null;this.retgt=0;this.done=false;}
  update(dt){
    this.ang+=dt*.45;this.cd-=dt;this.energy-=dt;this.retgt-=dt;
    const want=_n0.set(
      player.pos.x+Math.sin(this.ang)*34,
      26+Math.sin(tNow*1.2+this.ang),
      player.pos.z+Math.cos(this.ang)*34);
    if(this.state==='return'){
      want.copy(player.pos).add(_n1.set(0,2.5,-3));
      if(this.pos.distanceTo(want)<1.5){this.done=true;}}
    else if(this.energy<=0){this.state='return';feed('◈ Drone returning (energy low)','info');}
    this.pos.lerp(want,Math.min(1,(this.state==='rise'?1.6:1.4)*dt));
    if(this.pos.y>3&&this.state==='rise')this.state='orbit';
    this.mesh.position.copy(this.pos);
    for(const r of this.mesh.userData.rots)r.rotation.y+=dt*40;
    if(this.state==='orbit'&&this.retgt<=0){this.retgt=.8;
      let bd=140;this.tgt=null;
      for(const sh of ships){if(sh.finalizing)continue;
        const dd=sh.pos.distanceTo(this.pos);if(dd<bd){bd=dd;this.tgt=sh;}}}
    if(this.state==='orbit'&&this.tgt&&!this.tgt.finalizing&&this.cd<=0){
      this.cd=.42;
      const d=leadVec(this.pos,this.tgt.pos,this.tgt.vel,190);
      _n1.copy(d).normalize().applyEuler(_eu.set(rand(-.02,.02),rand(-.02,.02),0));
      spawnShell(this.pos,_n1.x*190,_n1.y*190,_n1.z*190,'drone',6,false);
      particles.spawn(this.pos.x,this.pos.y,this.pos.z,{life:.1,s0:2,s1:.5,c0:[.6,.95,1]});
      const [dd,pan]=apd(this.pos);sfx.mg(pan);
    }
  }
  kill(){scene.remove(this.mesh);}
}
function toggleDrones(){
  if(state!=='play'||player.dead)return;
  const anyReturning=drones.some(d=>d.state==='return');
  if(drones.length>0&&!anyReturning){feed('◈ Drones returning to hangar…','info');for(const d of drones)d.state='return';return;}
  if(drones.length>0)return;
  if(droneCd>0||player.maxDrones===0)return;
  drones.push(new Drone(drones.length));
  droneCd=2.5;
  feed('◈ RECON DRONE LAUNCHED','info');
}
const dronesToCull=[];
function updateDrones(dt){
  droneCd-=dt;
  dronesToCull.length=0;
  for(const d of drones){d.update(dt);if(d.done)dronesToCull.push(d);}
  for(const d of dronesToCull){const i=drones.indexOf(d);if(i>=0){d.kill();drones.splice(i,1);}}
  updateDronesHud();
}
function updateDronesHud(){
  if(!player)return;
  const a=drones.length,m=player.maxDrones;
  let s='DRONES ';
  for(let i=0;i<m;i++)s+=i<a?'◈':'◇';
  $('dronesIco').textContent=s+'  [E]';
}

/* ================= Dockyard ================= */
const SHOP=[
  {id:'repair',name:'🔧 REPAIR',desc:'+50 hull (instant)',base:70,grow:1,max:99,can:()=>player.hp<player.maxhp,noTxt:'HULL FULL'},
  {id:'hull',name:'🛡 ARMOR BELT',desc:'+40 max hull',base:150,grow:1.7,max:4},
  {id:'armor',name:'🧱 ALLOY PLATING',desc:'−8% damage taken per level (stacks to −24%)',base:500,grow:2.0,max:3},
  {id:'size',name:'🏗 HULL EXPANSION',desc:'+12% ship size & +60 max hull per level',base:900,grow:2.1,max:3},
  {id:'turret',name:'🔫 GUN TURRET',desc:'+1 additional turret → bigger salvos!',base:340,grow:1.9,max:2},
  {id:'reload',name:'⚡ LOADING SYSTEM',desc:'−10% reload time',base:130,grow:1.7,max:4},
  {id:'dmg',name:'💥 WARHEADS',desc:'+15% damage on all weapons',base:130,grow:1.7,max:4},
  {id:'drone',name:'◈ DRONE BAY',desc:'+1 combat drone (auto-attacks)',base:280,grow:1.8,max:3},
  {id:'engine',name:'⚙ ENGINE TUNING',desc:'+14% speed & handling',base:110,grow:1.7,max:3},
  {id:'crew',name:'👥 CREW QUARTERS',desc:'+20 max crew, +30 recruits',base:160,grow:1.8,max:2},
  {id:'fleet',name:'🚢 ESCORT VESSEL',desc:'Buy a combat escort — follows & fires. Each level +1 ship & boosts all escorts +35%! Level 4 unlocks FLEET COMMAND (ship registry)',base:2400,grow:2.4,max:4},
];
function shopCost(it){return upgradeCost(it.base,it.grow,player.lv[it.id]??0);}
let shopTab='upg';
/* FIX: #33 — pressing I opens the info card of the hovered dockyard card. */
let _infoHover=null;
let _infoAnchor=null; /* FIX: #35 — card element the popover is anchored to */
const TAB_KEYS=['upg','weapon','fleet'];
function setShopTab(t){shopTab=t;renderWerft();}
function renderWerft(){
  $('werCred').textContent='🪙 '+credits+' CR';
  renderUpgrades();
  renderWeaponShop();
  renderFleetPanel();
  for(const k of TAB_KEYS){
    const b=$('tab'+k[0].toUpperCase()+k.slice(1));
    if(b)b.classList.toggle('on',k===shopTab);
    const p=$('panel'+k[0].toUpperCase()+k.slice(1));
    if(p)p.classList.toggle('hidden',k!==shopTab);
  }
}
/* FIX: #29 (2026-09-08) — shop cards no longer BUY on click. Every card
   opens a fullscreen info modal (showInfo) with the item's real data;
   an explicit BUY button inside commits the purchase. */
function showInfo(title,body,onBuy,anchor){
  $('infoTitle').textContent=title;
  $('infoBody').innerHTML=body;
  const b=$('infoBuy');
  if(onBuy){b.classList.remove('hidden');b.onclick=()=>{hideInfo();onBuy();};}
  else b.classList.add('hidden');
  _infoAnchor=anchor||null; /* FIX: #35 */
  $('infoModal').classList.remove('hidden');
  requestAnimationFrame(positionInfo);
  /* FIX: #35 — click anywhere outside the popover closes it */
  setTimeout(()=>document.addEventListener('pointerdown',infoOutside),0);
}
function infoOutside(e){const c=$('infoCard');if(c&&!c.contains(e.target))hideInfo();}
/* FIX: #35 — place the popover over the anchor card: above it if it fits,
   otherwise below; clamped to the viewport so it NEVER overlaps other UI
   or leaves the screen. Without an anchor it stays centered. */
function positionInfo(){
  const m=$('infoModal');if(!m||m.classList.contains('hidden'))return;
  const card=$('infoCard'),a=_infoAnchor;
  card.style.left='0px';card.style.top='0px';
  const cw=card.offsetWidth,ch=card.offsetHeight,vw=innerWidth,vh=innerHeight;
  let x=vw/2-cw/2,y=vh/2-ch/2;
  if(a){
    const r=a.getBoundingClientRect();
    x=r.left+r.width/2-cw/2;
    y=r.top-ch-10;
    if(y<8)y=r.bottom+10;
    x=Math.max(8,Math.min(x,vw-cw-8));
    y=Math.max(8,Math.min(y,vh-ch-8));
  }
  card.style.left=Math.round(x)+'px';card.style.top=Math.round(y)+'px';
}
addEventListener('resize',()=>{if(!$('infoModal').classList.contains('hidden'))positionInfo();});
function hideInfo(){
  $('infoModal').classList.add('hidden');
  document.removeEventListener('pointerdown',infoOutside);
}
function upgradeInfoHTML(it){
  const lv=player.lv[it.id]??0,cost=shopCost(it),maxed=lv>=it.max;
  const next=maxed?'—':(lv+1)+' with '+shopCost(it)+' CR';
  return `<div class="infoRow"><b>Current level</b><span>${lv} / ${it.max}</span></div>
    <div class="infoRow"><b>Cost</b><span>${maxed?'MAX LEVEL':cost+' CR'}</span></div>
    <div class="infoRow"><b>Next level</b><span>${next}</span></div>
    <div class="infoRow"><b>Effect</b><span>${it.desc}</span></div>`;
}
function renderUpgrades(){
  const box=$('shop');box.innerHTML='';
  for(const it of SHOP){
    const lv=player.lv[it.id]??0;
    const cost=it?shopCost(it):0;
    const maxed=lv>=it.max;
    const blocked=it.can&&!it.can();
    const div=document.createElement('div');
    div.className='item'+(maxed?' max':'')+(credits<cost&&!maxed?' poor':'');
    div.innerHTML=`<h3>${it.name}</h3>
      <div class="lvl">LEVEL ${lv}/${it.max}</div>
      <div class="cardBtns">
        <button class="minibtn info">ℹ INFO</button>
        <button class="minibtn buy${((maxed||blocked)?' off':'')+(credits<cost&&!maxed&&!blocked?' poor':'')}"${(maxed||blocked)?' disabled':''}>${maxed?'MAXED':blocked?(it.noTxt||'BLOCKED'):cost+' CR'}</button>
      </div>`;
    const openIt=()=>showInfo(it.name,upgradeInfoHTML(it),()=>buy(it),div);
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openIt();};
    div.addEventListener('mouseenter',()=>{_infoHover=openIt;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openIt)_infoHover=null;});
    if(!maxed&&!blocked){
      const buyBtn=div.querySelector('.buy');
      buyBtn.onclick=e=>{e.stopPropagation();buy(it);};
    }
    box.appendChild(div);
  }
}
/* FIX: #24 FLEET COMMAND bay — once ALL base lanes are maxed the player
   registers whole ships, upgrades each individually and buys ammo. */
function renderWeaponShop(){
  const bay=$('weaponShop');if(!bay)return;bay.innerHTML='';
  const AMMO_CAP=500;
  const head=document.createElement('div');head.className='regHead';
  head.textContent='🔫 WEAPONS & ORDNANCE — 💣 AMMO '+fleet.ammo+'/'+AMMO_CAP+' · sector resupply +'+(TUNES.eAmmo||15);
  bay.appendChild(head);
  /* -------- the player's own weapons (info + equip, FIX: #29) -------- */
  const WDEF=[
    {k:0,name:'🔩 AP — MAIN BATTERY',desc:'High-caliber deck gun. Reload '+WEAPONS[0].cd+'s · '+WEAPONS[0].dmg+' dmg · '+WEAPONS[0].speed+' m/s flat fire. The reliable workhorse. Press 1.',use:()=>{switchWeapon(0);}},
    {k:1,name:'⚡ MG — AUTO CANNON',desc:'Rapid-fire MG · '+WEAPONS[1].cd+'s · '+WEAPONS[1].dmg+' dmg · flat gunnery. Perfect vs jets and small craft. Press 2.',use:()=>{switchWeapon(1);}},
    {k:2,name:'🚀 RP — ROCKET POD',desc:'Salvo launcher · '+WEAPONS[2].cd+'s reload · consumes fleet ammo ('+mslCost(armory.msl,1)*2+' per salvo). Press 3.',use:()=>{switchWeapon(2);}},
  ];
  for(const w of WDEF){
    const div=document.createElement('div');div.className='item'+(curWeapon===w.k?' max':'');
    div.innerHTML=`<h3>${w.name}</h3>
      <div class="lvl">${curWeapon===w.k?'EQUIPPED':'TAP TO EQUIP'}</div>
      <div class="cardBtns"><button class="minibtn info">ℹ INFO</button>${curWeapon===w.k?'':`<button class="minibtn buy">EQUIP</button>`}</div>`;
    const openW=()=>showInfo(w.name,`<p>${w.desc}</p>`,null,div);
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openW();};
    div.addEventListener('mouseenter',()=>{_infoHover=openW;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openW)_infoHover=null;});
    if(curWeapon!==w.k)div.querySelector('.buy').onclick=e=>{e.stopPropagation();w.use();renderWerft();};
    bay.appendChild(div);
  }
  /* FIX: #31 (2026-09-09) — ammoDiv was referenced but never declared,
     crashing openWerft → renderWeaponShop with a ReferenceError (the
     CRASH screen). The crate is now created as its own card here. */
  const ammoDiv=document.createElement('div');ammoDiv.className='item';
  const aCost=300+fleet.ammo*4;
  const aRoom=purchaseCap(25,AMMO_CAP-fleet.ammo);
  const aFull=fleet.ammo>=AMMO_CAP;
  ammoDiv.innerHTML=`<h3>💣 MUNITIONS CRATE</h3>
    <div class="lvl">POOL ${fleet.ammo}/${AMMO_CAP}</div><div class="cost ${(!aFull&&credits<aCost)?'no':''}">${aFull?'MAGAZINES FULL':aCost+' CR'}</div>
    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>`;
  const openCrate=()=>showInfo('💣 MUNITIONS CRATE',`<p>+25 ammo for the whole fleet — escorts, jets &amp; bombs all draw from this pool.</p><div class="infoRow"><b>Pool</b><span>${fleet.ammo}/${AMMO_CAP}</span></div><div class="infoRow"><b>Next crate</b><span>${aCost} CR</span></div>`,null,ammoDiv);
  ammoDiv.querySelector('.info').onclick=e=>{e.stopPropagation();openCrate();};
  ammoDiv.addEventListener('mouseenter',()=>{_infoHover=openCrate;});
  ammoDiv.addEventListener('mouseleave',()=>{if(_infoHover===openCrate)_infoHover=null;});
  ammoDiv.onclick=()=>{
    if(aFull){feed('⚠ Magazines full ('+fleet.ammo+'/'+AMMO_CAP+') — shoot something first','warn');return;}
    const pay=tryPurchase({credits},aCost);
    if(!pay.ok){feed('⚠ Not enough credits — crate costs '+aCost+' CR','warn');return;}
    credits=pay.credits;fleet.ammo=Math.min(AMMO_CAP,fleet.ammo+25);ui.credits.textContent=credits;
    feed('💣 +'+aRoom+' AMMO loaded — pool '+fleet.ammo+'/'+AMMO_CAP,'good');sfx.hit(0);renderWerft();};
  bay.appendChild(ammoDiv);
  /* FIX: #25 MUNITIONS SHOP — pick your shell & missile types, restock them
     individually. Prices escalate with every purchase (priceGrowth). */
  const ms=document.createElement('div');ms.className='item';
  const shOpts=Object.keys(ORD_TYPES).map(k=>{
    const o=ORD_TYPES[k],sel=armory.shell===k;
    return `<div class="upRow ordRow${sel?' selOrd':''}" data-ord="${k}"><span>${o.icon} ${o.name}</span><b>${sel?'SELECTED':o.dmg+'× dmg · '+o.spread+'× sprd'}</b></div>`;}).join('');
  const shFill=`<div class="upRow ordRow" data-fill="shell"><span>🔩 RESTOCK 25 shells</span><b>${priceGrowth(ordCost(armory.shell,25),armory.shellBuys||0)} CR</b></div>`;
  ms.innerHTML=`<h3>🔫 SHELL MAGAZINE</h3>
    <div class="lvl">STOCK ${fleet.ammo} · accuracy up +12%/lv in DOCKYARD</div>${shOpts}${shFill}<div class="cost">SELECT TO EQUIP</div>
    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>`;
  const openShell=()=>showInfo('🔫 SHELL MAGAZINE',`<p>${ORD_TYPES[armory.shell]?.desc||'Pick a shell type below — each row shows its profile.'}</p>`,null,ms);
  ms.querySelector('.info').onclick=e=>{e.stopPropagation();openShell();};
  ms.addEventListener('mouseenter',()=>{_infoHover=openShell;});
  ms.addEventListener('mouseleave',()=>{if(_infoHover===openShell)_infoHover=null;});
  ms.querySelectorAll('.ordRow').forEach(r=>{
    r.onclick=()=>{const k=r.dataset.ord,f=r.dataset.fill;
      if(f){const c=priceGrowth(ordCost(armory.shell,25),armory.shellBuys||0);
        if(fleet.ammo>=500){feed('⚠ Magazines full (500/500) — no storage left for shells','warn');return;}
        const pay=tryPurchase({credits},c); /* FIX: #26 */
        if(!pay.ok){feed('⚠ Not enough credits — restock costs '+c+' CR','warn');return;}
        credits=pay.credits;fleet.ammo=Math.min(500,fleet.ammo+25);armory.shellBuys=(armory.shellBuys||0)+1;ui.credits.textContent=credits;
        feed('🔩 +25 '+armory.shell.toUpperCase()+' shells loaded','good');sfx.hit(0);}
      else{armory.shell=k;feed('🔫 Shells set to '+ORD_TYPES[k].name,'info');sfx.hit(0);}
      renderWerft();};});
  bay.appendChild(ms);
  const mm=document.createElement('div');mm.className='item';
  const msOpts=Object.keys(MSL_TYPES).map(k=>{
    const o=MSL_TYPES[k],sel=armory.msl===k;
    return `<div class="upRow ordRow${sel?' selOrd':''}" data-ord="${k}"><span>${o.icon} ${o.name}</span><b>${sel?'SELECTED':o.seek+' seekers · '+o.dmg+'× dmg'}</b></div>`;}).join('');
  const msFill=`<div class="upRow ordRow" data-fill="msl"><span>🚀 RESTOCK 8 missiles</span><b>${priceGrowth(mslCost(armory.msl,8),armory.mslBuys||0)} CR</b></div>`;
  mm.innerHTML=`<h3>🚀 MISSILE DECK</h3>
    <div class="lvl">STOCK ${fleet.ammo} · salvo costs ${mslCost(armory.msl,1)*2} ammo · reload chain 30→120s</div>${msOpts}${msFill}<div class="cost">SELECT TO EQUIP</div>
    <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>`;
  const openMs=()=>showInfo('🚀 MISSILE DECK',`<p>${MSL_TYPES[armory.msl]?.desc||'Pick a missile type below — each row shows its seeker profile.'}</p>`,null,mm);
  mm.querySelector('.info').onclick=e=>{e.stopPropagation();openMs();};
  mm.addEventListener('mouseenter',()=>{_infoHover=openMs;});
  mm.addEventListener('mouseleave',()=>{if(_infoHover===openMs)_infoHover=null;});
  mm.querySelectorAll('.ordRow').forEach(r=>{
    r.onclick=()=>{const k=r.dataset.ord,f=r.dataset.fill;
      if(f){const c=priceGrowth(mslCost(armory.msl,8),armory.mslBuys||0);
        if(fleet.ammo>=500){feed('⚠ Magazines full (500/500) — no storage left for missiles','warn');return;}
        const pay=tryPurchase({credits},c); /* FIX: #26 */
        if(!pay.ok){feed('⚠ Not enough credits — restock costs '+c+' CR','warn');return;}
        credits=pay.credits;fleet.ammo=Math.min(500,fleet.ammo+8);armory.mslBuys=(armory.mslBuys||0)+1;ui.credits.textContent=credits;
        feed('🚀 +8 '+armory.msl.toUpperCase()+' missiles loaded','good');sfx.hit(0);}
      else{armory.msl=k;feed('🚀 Missiles set to '+MSL_TYPES[k].name,'info');sfx.hit(0);}
      renderWerft();};});
  bay.appendChild(mm);
}
/* FIX: #24 FLEET COMMAND bay — ship registration + per-ship upgrades.
   Munitions moved to the separate WEAPONS & AMMO tab (FIX: #29). */
function renderFleetPanel(){
  const bay=$('fleetBay');if(!bay)return;bay.innerHTML='';
  const unlocked=fleetUnlock();
  const head=document.createElement('div');head.className='regHead';
  head.textContent='🛳 FLEET COMMAND — REGISTRY '+fleet.reg.length+'/'+fleetSlots()+' · SLOTS +1 PER COMMAND STAFF';
  bay.appendChild(head);
  if(!unlocked){
    const l=document.createElement('div');l.className='regLocked';
    l.textContent='🔒 FLEET COMMAND LOCKED — max out every dockyard lane (ESCORT VESSEL lvl 4) to unlock ship REGISTRATION & per-ship upgrades. Use the WEAPONS & AMMO tab for ordnance.';
    bay.appendChild(l);return;}
  /* one card per registry class — FIX: #26 the click handler is now ALWAYS
     attached and reports WHY a purchase is impossible (before: silent
     dead card when the fleet was full). tryPurchase guarantees the
     credits are only deducted when every check passed. */
  for(const key of Object.keys(REGISTRY)){
    const R=REGISTRY[key],own=regCount(key);
    const capFull=own>=R.max;
    const cost=R.cost;
    const div=document.createElement('div');
    div.className='item'+(capFull?' max':'')+(credits<cost&&!capFull?' poor':'');
    div.innerHTML=`<h3>${R.name}</h3>
      <div class="lvl">IN SERVICE ${own}/${R.max}</div>
      <div class="cost ${(credits<cost&&!capFull)?'no':''}">${capFull?'CLASS FULL':cost+' CR'}</div>
      <div class="cardBtns"><button class="minibtn info">ℹ INFO</button></div>`;
    const openReg=()=>showInfo(R.name,`<p>Register a new hull — builds in ~${R.build}s, then fights autonomously. Sunk ships auto-repair at the dockyard.</p><div class="infoRow"><b>Build</b><span>~${R.build}s</span></div><div class="infoRow"><b>Class size</b><span>${own}/${R.max} in service</span></div>`,null,div);
    div.querySelector('.info').onclick=e=>{e.stopPropagation();openReg();};
    div.addEventListener('mouseenter',()=>{_infoHover=openReg;});
    div.addEventListener('mouseleave',()=>{if(_infoHover===openReg)_infoHover=null;});
    div.onclick=()=>{
      if(capFull){feed('⚠ '+R.name+' CLASS FULL — all '+R.max+' hulls in service','warn');return;}
      if(fleet.reg.length>=fleetSlots()){
        feed('⚠ REGISTRY FULL ('+fleet.reg.length+'/'+fleetSlots()+') — buy COMMAND STAFF for more slots','warn');return;}
      const pay=tryPurchase({credits},cost); /* validate on a snapshot — a failed check can NOT touch the real balance (FIX: #26) */
      if(!pay.ok){feed(pay.reason==='COST'?'⚠ Invalid price — purchase aborted':'⚠ Not enough credits — need '+cost+' CR','warn');return;}
      credits=pay.credits;ui.credits.textContent=credits;
      fleet.reg.push(regEntry(key));
      feed('📋 '+R.name+' KEEL LAID — '+(buildCardHelp(key,player.lv.fleet??0,player.lv.cmd||0)||'READY NOW')+'s build time','info');
      sfx.hit(0);renderWerft();};
    bay.appendChild(div);
  }
  /* per-ship upgrade + status cards */
  for(const e of fleet.reg){
    const div=document.createElement('div');div.className='item';
    if(!e.done){
      const left=Math.ceil(buildLeft(e)); /* FIX: #26 read-only snapshot (the old {...e} spread hack never accounted for crew speed) */
      div.innerHTML=`<h3>⏳ ${e.name}</h3><p>Under construction — crew speeds up the build.</p>
        <div class="lvl">~${left}s REMAINING</div><div class="cost">BUILDING…</div>`;
    }else if(e.repair>0){
      div.innerHTML=`<h3>🔧 ${e.name}</h3><p>Sunk in action — dockyard crew is re-floating the hull.</p>
        <div class="lvl">~${Math.ceil(e.repair)}s</div><div class="cost">REPAIRING…</div>`;
    }else{
      let upBtns='';
      for(const uk of Object.keys(REG_UPG)){
        const lv=e.lvl[uk]??0,U=REG_UPG[uk];
        if(lv>=U.max)continue;
        upBtns+=`<div class="upRow" data-key="${uk}"><span>${U.label} ${lv}/${U.max}</span><b>${regUpgCost(uk,lv)} CR</b></div>`;
      }
      div.innerHTML=`<h3>🚢 ${e.name}</h3><p>Hull ${Math.round(e.hp)}/${e.maxhp} · Guns ${e.dmg} · ${e.key==='carrier'?('Jets cap '+(1+e.lvl.jets)+' · Bomb dmg '+Math.round(40*(1+.4*e.lvl.bombs))):('Range '+e.range)}</p>
        <div class="lvl">${upBtns||'ALL SYSTEMS MAXED'}</div><div class="cost">IN SERVICE</div>`;
      div.querySelectorAll('.upRow').forEach(row=>{
        row.onclick=()=>{const uk=row.dataset.key,lv=e.lvl[uk]??0,U=REG_UPG[uk],c=regUpgCost(uk,lv);
          if(lv>=U.max){feed('⚠ '+U.label+' already maxed on '+e.name,'warn');return;}
          const pay=tryPurchase({credits},c); /* FIX: #26 snapshot pattern */
          if(!pay.ok){feed('⚠ Not enough credits — '+U.label+' costs '+c+' CR','warn');return;}
          credits=pay.credits;ui.credits.textContent=credits;e.lvl[uk]=lv+1;
          if(e.obj){const st=regStats(e);e.hp=e.maxhp=st.hp;e.dmg=st.dmg;e.range=105*(1+.15*(e.lvl.dmg||0));}
          feed('🛠 '+e.name+' → '+U.label+' '+(lv+1),'good');sfx.hit(0);renderWerft();};
      });
    }
    bay.appendChild(div);
  }
}
function buy(it){
  const cost=it?shopCost(it):0;
  if(!it)return;
  /* FIX: #37 (2026-11-12) — transactional purchase: validate on a snapshot,
     re-check the lane, deduct only after every guard passed. */
  if(it.id!=='repair'&&it.can&&!it.can()){feed('⚠ '+it.name+' is still locked','warn');return;}
  if(it.id!=='repair'&&it.max!=null&&(player.lv[it.id]??0)>=it.max){feed('⚠ '+it.name+' is already maxed','warn');return;}
  const pay=tryPurchase({credits},cost);
  if(!pay.ok){feed(pay.reason==='COST'?'⚠ Invalid price — purchase aborted':'⚠ Not enough credits — '+it.name+' costs '+cost+' CR','warn');return;}
  credits=pay.credits;ui.credits.textContent=credits;

  if(it.id==='repair'){player.hp=Math.min(player.maxhp,player.hp+50);}
  else{player.lv[it.id]=(player.lv[it.id]??0)+1;
    const oldHp=player.hp,oldMax=player.maxhp;
    applyStats();
    if(it.id==='hull')player.hp=Math.min(player.maxhp,oldHp+(player.maxhp-oldMax)+40);
    if(it.id==='size')player.hp=Math.min(player.maxhp,oldHp+(player.maxhp-oldMax)+60);
    if(it.id==='crew')player.crew=Math.min(player.maxCrew,player.crew+30);
    /* FIX: #23/#24 — fleet lane lv 1-3 deploys escorts, lv 4+ registers
       REGISTRY hulls (with build time). Upgrading still boosts the wing.
       FIX: #26 — spawnEscort() was lost in the #24 registry refactor
       (buy() crashed AFTER credits were deducted → paid but got nothing).
       Restored: same V-formation slot the old helper used. */
    if(it.id==='fleet'){
      const nf=player.lv.fleet;
      for(const e of escorts){const st=escortStats(nf);e.hp=e.maxhp=st.hp;e.dmg=st.dmg;}
      if(nf<=3)spawnEscort(nf-1);
      else{ /* FLEET COMMAND unlocked: pick the next affordable/available hull */
        const key=(regCount('escort')<REGISTRY.escort.max||credits<REGISTRY.carrier.cost)?'escort':'carrier';
        if(regCount(key)<REGISTRY[key].max&&fleet.reg.length<fleetSlots()){
          fleet.reg.push(regEntry(key));
          feed('📋 '+REGISTRY[key].name+' KEEL LAID — '+(buildCardHelp(key,player.lv.fleet??0,player.lv.cmd||0)||'READY NOW')+'s build time','info');
        }else feed('⚠ REGISTRY FULL — buy COMMAND STAFF for more slots','warn');
      }}}
  feed('🛠 '+it.name.replace(/^[^ ]+ /,'')+' UPGRADED','good');
  sfx.hit(0);
  renderWerft();
}
/* FIX: #26 (2026-09-07) — commission one bought escort destroyer into the
 * formation slot i. Was removed during the #24 registry refactor while
 * buy() still called it → ReferenceError AFTER paying (money gone, no
 * ship). Rebuilt here so the purchase can never crash again. */
function spawnEscort(i){
  const st=escortStats(player.lv.fleet??1);
  const g=buildShipMesh(escortDef);
  g.position.copy(player.pos);g.position.y=0;
  scene.add(g);
  escorts.push({def:escortDef,m:g,pos:g.position,vel:new THREE.Vector3(),
    quat:new THREE.Quaternion(),yaw:player.yaw,pitch:0,roll:0,
    hp:st.hp,maxhp:st.hp,dmg:st.dmg,range:105,cd:rand(.5,2),reg:null,dead:false});
  feed('🚢 ESCORT DESTROYER COMMISSIONED — wing strength '+Math.round(st.hp),'good');
}
function openWerft(){uiOpen=true;paused=false;$('pause').classList.add('hidden');shopTab='upg';renderWerft();$('werft').classList.remove('hidden');
  try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}}
function closeWerft(){uiOpen=false;$('werft').classList.add('hidden');if(!IS_TOUCH)reqLock();}
$('werftX').addEventListener('click',closeWerft);
$('werftClose').addEventListener('click',closeWerft);
$('werft').addEventListener('click',e=>{if(e.target===$('werft'))closeWerft();});
/* FIX: #29 — dockyard tabs + fullscreen info modal controls */
for(const k of TAB_KEYS)$('tab'+k[0].toUpperCase()+k.slice(1)).addEventListener('click',()=>setShopTab(k));
$('infoClose').addEventListener('click',hideInfo);
$('infoModal').addEventListener('click',e=>{if(e.target===$('infoModal'))hideInfo();});
$('infoX').addEventListener('click',hideInfo); /* FIX: #35 */

/* ================= FLEET (bought escort vessels) =================
   FIX: #23 (2026-09-06) — the player can BUY escort ships in the dockyard
   (ESCORT VESSEL lane). Each purchase adds one friendly destroyer that
   follows the player, automatically engages enemies, and is upgradeable:
   buying the next escort level also boosts the whole wing (escortStats). */
const escorts=[];
const escortDef={...SHIPS.destroyer,model:'war',hullCol:0x3d708f,name:'ESCORT'};
const fleetCarrierDef={...SHIPS.carrier,model:'carrier',hullCol:0x2e6e8f,name:'FLEET CARRIER'};
const fleet={cmd:0,reg:[],ammo:200}; /* FIX: #28 — 0 ammo at spawn made the first shots impossible (base 200 now; startGame also resets from TUNES.startAmmo) */
const fleetUnlock=()=>player&&(player.lv.fleet??0)>=4;
const fleetSlots=()=>registryCap(player.lv.cmd||0);
const regCount=key=>fleet.reg.reduce((n,r)=>n+(r.key===key?1:0),0);
/* FIX: #27 (2026-09-07) — adaptive pressure: how strong is the player's
   fleet right now (0..1)? Dockyard lanes maxed + escorts in service feed
   into adaptTier() so enemies become individually tougher when the player
   is stacked, but every factor is hard-capped and the dev console STILL
   multiplies after this (admin stays the final authority). */
function fleetPressure(){
  if(!player||!player.lv)return 0;
  let sum=0,mx=0;
  for(const it of SHOP){sum+=Math.min(player.lv[it.id]??0,it.max);mx+=it.max;}
  const lane=Math.min(1,sum/Math.max(1,mx));
  return Math.min(1,lane*0.6+Math.min(1,escorts.length/3)*0.4);
}
function regEntry(key){
  return {key,id:'r'+Math.random().toString(36).slice(2,8),name:REGISTRY[key].name,
    lvl:{hull:0,ammo:0,jets:0,bombs:0,dmg:0},
    build:buildSeconds(key,player.lv.fleet??0,player.lv.cmd||0),
    done:false,repair:0,obj:null,hp:1,maxhp:1,range:105,cd:1,jt:0,
    /* FIX: #30 (2026-09-08) — tactical-map fields (see plan session 3o):
       mode: 'auto'|'agg'|'passive', follow flag, priority target id. */
    mode:'auto',follow:true,priorityTarget:null}; /* FIX: #30 */
}
function regStats(e){
  return {hp:escortStats(e.lvl.hull).hp*(e.key==='carrier'?4.2:1),
          dmg:escortStats(e.lvl.dmg).dmg*(e.key==='carrier'?1.6:1)};
}
function deployReg(e){
  const st=regStats(e);
  e.hp=e.maxhp=st.hp;e.dmg=st.dmg;e.dead=false;
  if(e.key==='escort'){
    const g=buildShipMesh(escortDef);
    e.obj=g;e.pos=new THREE.Vector3();e.vel=new THREE.Vector3();e.quat=new THREE.Quaternion();
    const i=escorts.length;
    _n0.set(i*(Math.sin(i*1.7)*3.5),0,-(8+i*1.5)).applyAxisAngle(UP,player.yaw);
    e.pos.copy(player.pos).add(_n0);
    e.pos.y=waveH(e.pos.x,e.pos.z,tNow)-escortDef.draft*.3;
    scene.add(g);
  }else{
    const g=buildShipMesh(fleetCarrierDef);g.scale.setScalar(.9);
    e.obj=g;e.pos=new THREE.Vector3();e.vel=new THREE.Vector3();e.quat=new THREE.Quaternion();
    _n0.set(6,0,-24).applyAxisAngle(UP,player.yaw);
    e.pos.copy(player.pos).add(_n0);
    e.pos.y=waveH(e.pos.x,e.pos.z,tNow)-fleetCarrierDef.draft*.3;
    scene.add(g);
  }
  if(e.key==='escort'){e.m=e.obj;e.reg=e;escorts.push(e);}
  feed('🛠 '+e.name+' COMMISSIONED — registry '+fleet.reg.filter(r=>r.done).length+'/'+fleetSlots(),'good');
  sfx.sunk(rand(0,.3),1);
}
/* friendly strike jets launched by REGISTERED carriers (cost ammo) */
const fjets=[];
function launchFJets(car,n){
  for(let k=0;k<n;k++){
    const mesh=buildJetMesh();
    mesh.position.copy(car.pos);mesh.position.y+=4;scene.add(mesh);
    fjets.push({mesh,v:new THREE.Vector3(rand(-8,8),14,rand(-8,8)),hp:TUNES.jetHp,
      st:'climb',t:2.5,passes:0,mg:1,car,dropped:0,trail:0});
  }
  feed('✈ '+n+' FRIENDLY JETS AIRBORNE — '+car.name,'good');
}
function killFJet(j,i){fxExplosion(j.mesh.position,1.1);scene.remove(j.mesh);fjets.splice(i,1);}
function updateFJets(dt){
  const sim=state==='play'&&!gameOver&&!player.dead;
  for(let i=fjets.length-1;i>=0;i--){
    const j=fjets[i],jp=j.mesh;
    j.t-=dt;
    let tgt=null,bd=999;
    for(const s of ships){if(s.finalizing)continue;const dd=nearDist(jp.position,s.pos);if(dd<bd){bd=dd;tgt=s;}}
    if(j.st==='climb'){
      /* FIX: #24 climb phase only — rally above/behind the player, THEN attack */
      _n0.set(player.pos.x,30,player.pos.z-40);
      _n1.copy(_n0).sub(jp.position).normalize().multiplyScalar(30);
      j.v.lerp(_n1,Math.min(1,1.2*dt));
      if(j.t<=0){j.st='attack';j.t=22;j.mg=.4;} /* 22 s on station */
    }else if(j.st==='attack'){
      /* FIX: #24 tgt may be null (no live ships) → break off instead of crashing */
      if(!tgt){j.st='leave';j.t=3;}
      else{
        _n0.copy(tgt.pos);_n0.y+=6;
        _n1.copy(_n0).sub(jp.position).normalize().multiplyScalar(34);
        j.v.lerp(_n1,Math.min(1,1.6*dt));
        j.mg-=dt;
        if(j.mg<=0&&sim&&bd<90){
          j.mg=.5;
          if(fleet.ammo>0){fleet.ammo--; /* guns cost ammo */
            const mp=jp.position,T=Math.max(.3,bd/90);
            spawnShell(mp,(tgt.pos.x-mp.x)/T,(tgt.pos.y-mp.y)/T*1.02,(tgt.pos.z-mp.z)/T,'drone',6*(1+.4*j.car.lvl.dmg));}}
        if(j.dropped===0&&j.car.lvl.bombs>0&&bd<42&&sim&&jp.position.y>10&&fleet.ammo>0){
          j.dropped=1;fleet.ammo--; /* one bomb per jet, from the shared pool */
          _n0.copy(tgt.pos).sub(jp.position);_n0.y=0;_n0.normalize();
          const m=new THREE.Mesh(bombGeo,bombMat);m.position.copy(jp.position);scene.add(m);
          bombs.push({m,v:new THREE.Vector3(_n0.x*16,-6,_n0.z*16),life:6,friendly:true,
            dmg:40*(1+.4*j.car.lvl.bombs)*TUNES.bombDmg});
          feed('💣 FRIENDLY BOMB AWAY — '+fleet.ammo+' bombs left','info');}
        if(jp.position.distanceTo(tgt.pos)<30)j.passes++;
        if(j.passes>2||j.t<=0){j.st='leave';j.t=3;}
      }
    }else{ /* leave */
      _n1.copy(jp.position).sub(player.pos).setY(30).normalize().multiplyScalar(42);
      j.v.lerp(_n1,Math.min(1,1.2*dt));
      if(j.t<=0){killFJet(j,i);continue;}
    }
    j.v.y-=G*.12*dt;
    jp.position.addScaledVector(j.v,dt);
    _q0.setFromUnitVectors(_tv.set(0,0,1),_n1.copy(j.v).normalize());
    j.mesh.quaternion.slerp(_q0,Math.min(1,8*dt));
    j.trail-=dt;
    if(j.trail<=0){j.trail=.03;
      particles.spawn(jp.position.x,jp.position.y,jp.position.z,{life:.22,s0:.5,s1:1.4,c0:[.6,.85,1],c1:[.4,.6,.8]});}
    const wh=waveH(jp.position.x,jp.position.z,tNow);
    if(jp.position.y<wh+.4)killFJet(j,i);
  }
}
function updateEscorts(dt){
  if(!player)return;
  /* build & repair progress — registry entries come alive when finished */
  for(const e of fleet.reg){
    if(!e.done){buildRemaining(e,dt);if(e.done)deployReg(e);}
    else if(e.repair>0){e.repair-=dt;
      if(e.repair<=0){e.repair=0;deployReg(e);feed('🔧 '+e.name+' REPAIRED — back in the fight','good');}}
  }
  for(let i=escorts.length-1;i>=0;i--){
    const e=escorts[i];
    if(e.dead){scene.remove(e.m);escorts.splice(i,1);continue;}
    const def=e.reg&&e.reg.key==='carrier'?fleetCarrierDef:escortDef;
    /* FIX: #30 — fleet behaviour modes (tactical map):
       'passive' → no engage, 'auto' → nearest, 'agg' → nearest+max fire.
       follow=false → hold formation anchor (25 m behind the player). */
    if(e.follow===false){
      _n0.set(0,0,-25).applyAxisAngle(_tv.set(0,1,0),player.yaw);
      _n1.copy(player.pos).add(_n0);
    }else{
      /* follow the player in a spreading formation (carriers stand off far) */
      _n0.set(Math.sin(i*1.3),0,Math.cos(i*1.3)).applyAxisAngle(_tv.set(0,1,0),player.yaw);
      _n1.copy(player.pos).addScaledVector(_n0,(e.reg&&e.reg.key==='carrier')?16:40); /* FIX: #30 — more standoff (was 10/26 m) */
    }
    const dist=nearDist(e.pos,_n1);if(dist>.5){
      _n1.sub(e.pos).normalize().multiplyScalar(Math.min(1,dist*0.6));
      e.vel.x+=(_n1.x-e.vel.x*0.1)*Math.min(1,2*dt);
      e.vel.z+=(_n1.z-e.vel.z*0.1)*Math.min(1,2*dt);}
    else{e.vel.x*=.93;e.vel.z*=.93;}
    e.pos.x+=e.vel.x*dt;e.pos.z+=e.vel.z*dt;
    e.pos.y=waveH(e.pos.x,e.pos.z,tNow)-def.draft*.3;
    /* auto-engage: 'passive' never fires; 'agg' prefers the priority target,
       else fires at double rate; 'auto' fires at the nearest live enemy. */
    const mode=e.reg?e.reg.mode:'auto';
    let t=null,bd=999;
    if(mode!=='passive'){
      /* FIX: #36 — priority target now resolves against the enemy lists */
      const pe=e.reg?priorityEnemy(e.reg.priorityTarget):null;
      if(pe){const dd=nearDist(e.pos,pe.pos);if(dd<bd){bd=dd;t=pe;}}
      if(!t)for(const s of ships){if(s.finalizing)continue;const dd=nearDist(e.pos,s.pos);if(dd<bd){bd=dd;t=s;}}
    }
    if(t&&bd<e.range&&state==='play'&&!gameOver&&!player.dead){
      e.yaw=Math.atan2(t.pos.x-e.pos.x,t.pos.z-e.pos.z);
      e.cd-=dt;
      if(e.cd<=0&&fleet.ammo>0){
        e.cd=(mode==='agg'?0.7:1.1)*rand(.9,1.3);fleet.ammo--; /* every shot costs 1 ammo */
        const mp=_a.set(0,def.hullH*.2,def.l*.45).applyQuaternion(e.quat).add(e.pos);
        const T=Math.max(.4,bd/50);
        spawnShell(mp,(t.pos.x-e.pos.x)/T,(t.pos.y+rand(-.3,1)-mp.y)/T+.5*G*T,(t.pos.z-e.pos.z)/T,'drone',e.dmg*player.dmgMul);
        fxMuzzle(mp,_b.set(t.pos.x-mp.x,0,t.pos.z-mp.z).normalize(),.6);}
      else if(e.cd<=0)e.cd=.5; /* out of ammo — hold fire, keep aiming */
    }
    e.quat.setFromAxisAngle(_tv.set(0,1,0),e.yaw);
    e.m.position.copy(e.pos);e.m.quaternion.copy(e.quat);e.m.updateMatrixWorld(true);
    /* sunk — registry ships go to REPAIR and come back */
    if(e.hp<=0&&!e.dead){e.dead=true;fxExplosion(e.pos,1.6);
      for(let k=0;k<5;k++)debris.push(new Debris(e.pos));
      e.m.visible=false;
      if(e.reg){e.reg.repair=buildSeconds(e.reg.key,player.lv.fleet??0,player.lv.cmd||0)*.5;e.reg.obj=null;
        feed('💥 '+e.reg.name+' SUNK — dockyard repair started ('+Math.round(e.reg.repair)+'s)','warn');}
      else feed('💥 ESCORT SUNK — wing reduced to '+escorts.length,'warn');}
  }
  /* registered carriers: follow far behind, launch strike jets */
  updateFJets(dt);
  for(const e of fleet.reg){
    if(e.key!=='carrier'||!e.obj)continue;
    _n0.set(8,0,-26).applyAxisAngle(UP,player.yaw);
    _n1.copy(player.pos).add(_n0);
    e.pos.lerp(_n1,Math.min(1,.5*dt));
    e.pos.y=waveH(e.pos.x,e.pos.z,tNow)-fleetCarrierDef.draft*.3;
    e.obj.position.copy(e.pos);e.obj.updateMatrixWorld(true);
    e.jt-=dt;
    const cap=1+e.lvl.jets;
    if(e.jt<=0&&state==='play'&&!gameOver&&!player.dead&&
       ships.length>0&&fleet.ammo>3&&fjets.filter(f=>f.car===e).length<cap){
      e.jt=14;launchFJets(e,Math.min(2,cap));}
  }
}
function clearEscorts(){
  for(const e of escorts){scene.remove(e.m);e.dead=true;}
  escorts.length=0;
  for(const e of fleet.reg){if(e.obj){scene.remove(e.obj);e.obj=null;}}
  for(const j of fjets)scene.remove(j.mesh);
  fjets.length=0;fleet.reg.length=0;fleet.ammo=0;
}

/* ================= Waves (spawn cap) ================= */
const waveGear={active:false,queue:[],timer:0,between:2.5};
function startNextWave(){
  waveNum++;document.body.dataset.wave=String(waveNum);waveGear.active=true;waveGear.queue=[];
  let list=[];
  if(waveNum%5===0){
    /* BOSS v2 rotation: 5/20/35… cruiser · 10/25/40… battleship · 15/30/45… carrier.
       FIX: #23 — bossCount() adds a 2nd boss from wave 15 and a 3rd from 30. */
    const bossType=(waveNum%15===10)?'battle':(waveNum%15===0)?'carrier':'cruiser';
    list.push(bossType);
    const allBoss=['cruiser','battle','carrier'];
    const bs=bossCount(waveNum);
    for(let k=1;k<bs;k++){
      const alt=allBoss.find(b=>b!==bossType);
      list.push(alt);}
    const esc=Math.min(2+Math.floor(waveNum/3),6);
    for(let i=0;i<esc;i++)list.push(Math.random()<.5?'torpedo':'destroyer');
    banner('WAVE '+waveNum,'⚠ '+bs+' BOSS SHIPS + '+esc+' ESCORTS!');
  }else{
    const n=Math.min(2+waveNum,14);
    for(let i=0;i<n;i++){const r=Math.random();
      let t='patrol';
      if(waveNum>=2&&r<.22)t='torpedo';
      else if(waveNum>=2&&r<.55)t='destroyer';
      else if(waveNum>=3&&r<.68)t='freighter';
      /* FIX: #20 (2026-09-06) later waves mix in HEAVY ships — different
         enemy types live in the same wave (cruisers from wave 6, mini
         battleships from 12, carriers from 18). A wave is never a mono
         fleet anymore, and the whole pack scales via waveTier(). */
      else if(waveNum>=6&&r<.74)t='cruiser';
      else if(waveNum>=12&&r<.80)t='battle';
      else if(waveNum>=18&&r<.85)t='carrier';
      list.push(t);}
    banner('WAVE '+waveNum,n+' CONTACTS INBOUND');
  }
  let delay=1.5;
  for(const t of list){waveGear.queue.push({type:t,delay});delay=rand(1.6,3.4);}
  waveGear.timer=.5;
}
let _shipSeq=0; /* FIX: #36 — stable ids so the tactical map can target ships */
function spawnShip(type){
  const s=new Ship(type);
  s.id='s'+(++_shipSeq);
  s.spawnAt(rand(0,TAU));
  ships.push(s);
  if(s.charging)feed('⚠ ARMOURED FREIGHTER ON RAMMING COURSE!','warn');
}
function updateWaves(dt){
  if(gameOver||player.dead)return;
  const wg=waveGear;
  if(wg.active){
    if(wg.queue.length){wg.timer-=dt;
      if(wg.timer<=0){
        /* FIX: #15 (2026-09-06) dev slider maxEnemies=0 stalled the wave
           forever (queue waited, ships.length never cleared). Floor at 1. */
        if(ships.filter(s=>!s.finalizing).length>=Math.max(1,Math.round(TUNES.maxEnemies))){
          wg.timer=2;
        }else{wg.timer=wg.queue[0].delay;spawnShip(wg.queue.shift().type);}}}
    else if(ships.length===0){
      wg.active=false;wg.between=5;
      const bonus=Math.round(90*waveNum*TUNES.waveBonusMul);
      addScore(Math.round(60*waveNum*TUNES.scoreMul));addCredits(bonus);
      player.hp=Math.min(player.maxhp,player.hp+15);
      player.crew=Math.min(player.maxCrew,player.crew+10);
      fleet.ammo+=TUNES.eAmmo; /* FIX: #24 sector resupply — fleet never starves for ammo (dev-slider) */
      banner('SECTOR CLEARED','+'+bonus+' CR · +10 CREW · [TAB] DOCKYARD');
      feed('🪙 +'+bonus+' CR WAVE BONUS · +10 CREW RECRUITED','good');
    }
  }else{wg.between-=dt;if(wg.between<=0)startNextWave();}
}

/* ================= UI ================= */
const ui={score:$('score'),hi:$('hi'),credits:$('credits'),waveN:$('waveN'),left:$('shipsLeft'),
  hullF:$('hullFill'),hullT:$('hpTxt'),hullBox:$('hullBox'),buoyF:$('buoyFill'),buoyT:$('buoyTxt'),
  crewF:$('crewFill'),crewT:$('crewTxt'),
  rel:$('reloadFill'),rge:$('rangeTxt'),feed:$('killfeed'),ban:$('banner'),dmg:$('dmgflash'),
  bossF:$('bossFill'),
  cross:$('crosshair'),hit:$('hitmark'),spd:$('spdTxt'),dc:$('dcIco')};
ui.hi.textContent='BEST '+best;
if(IS_TOUCH)$('hint').textContent='Left drag: drive · Right drag: aim · FIRE/ZOOM buttons · tap weapon slots';
function hitmarkFx(){ui.hit.classList.add('show');setTimeout(()=>ui.hit.classList.remove('show'),110);}
function feed(txt,cls=''){
  const d=document.createElement('div');if(cls)d.className=cls;
  d.textContent=txt;
  /* FIX #12 (2026-09-06): newest notification on TOP (prepend + reversed column)
     so messages stack downward instead of covering the weapon panel */
  ui.feed.prepend(d);
  while(ui.feed.children.length>6)ui.feed.lastChild.remove();
  setTimeout(()=>{if(d.parentNode)d.remove();},4200);}
function banner(h,p=''){ui.ban.querySelector('h2').textContent=h;ui.ban.querySelector('p').textContent=p;
  ui.ban.classList.remove('pop');void ui.ban.offsetWidth;ui.ban.classList.add('pop');}
function addScore(base){if(tNow-lastSinkT<4.5)combo=Math.min(combo+1,5);else combo=1;
  /* FIX: combo multiplier now actually applies to the score */
  lastSinkT=tNow;score+=Math.round(base*TUNES.scoreMul*combo);ui.score.textContent=score;}
function addCredits(c){credits+=Math.round(c*TUNES.credMul);ui.credits.textContent=credits;}
function gameOverNow(title){
  gameOver=true;try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}
  /* FIX: #41 (2026-11-12) — cheated runs are not ranked and never become
     the stored best score. */
  if(!runCheated&&score>best){best=score;try{localStorage.setItem('schiffsbruch3d_2_hs',best);}catch(e){}}
  ui.hi.textContent='BEST '+best;
  $('overTitle').textContent=title;
  $('overStats').innerHTML=`Score: <b>${score}</b><br>Wave reached: <b>${waveNum}</b><br>Ships sunk: <b>${shipsSunk}</b><br>Best: <b>${best}</b>`+(runCheated?'<br><b style="color:#ffb703">CHEATED RUN — not ranked</b>':'');
  $('over').classList.remove('hidden');
}

/* ================= Minimap ================= */
const mm=$('minimap'),mtx=mm.getContext('2d');
/* FIX: clamp so enemies beyond the map edge (spawn radius up to 230 m) stay visible */
const mx=v=>clamp((v+180)/360*170,1,169), mz=v=>clamp((v+250)/340*170,1,169);
function drawMap(){
  mtx.clearRect(0,0,170,170);
  mtx.fillStyle='rgba(6,20,34,.85)';mtx.fillRect(0,0,170,170);
  mtx.strokeStyle='rgba(76,195,255,.2)';mtx.strokeRect(.5,.5,169,169);
  if(!player)return;
  for(const s of ships){if(s.finalizing)continue;
    const boss=s.isBoss&&s.isBoss();
    mtx.fillStyle=boss?'#ff9a2a':'#ff4d5e';
    mtx.beginPath();mtx.arc(mx(s.pos.x),mz(s.pos.z),boss?5:2+s.def.l/9,0,TAU);mtx.fill();}
  mtx.fillStyle='#ffb02a'; /* carrier jets on radar */
  for(const j of jets){mtx.beginPath();mtx.arc(mx(j.pos.x),mz(j.pos.z),1.8,0,TAU);mtx.fill();}
  mtx.fillStyle='#ff2a3c';
  for(const t of torps){mtx.fillRect(mx(t.m.position.x)-1,mz(t.m.position.z)-1,2.4,2.4);}
  for(const d of drones){mtx.fillStyle='#4cc3ff';mtx.beginPath();mtx.arc(mx(d.pos.x),mz(d.pos.z),2,0,TAU);mtx.fill();}
  mtx.save();mtx.translate(mx(player.pos.x),mz(player.pos.z));
  mtx.rotate(-player.yaw);
  mtx.fillStyle='#a7f439';mtx.beginPath();mtx.moveTo(0,6);mtx.lineTo(-4,-4);mtx.lineTo(4,-4);mtx.closePath();mtx.fill();mtx.restore();
}

/* ================= Tactical map (FIX: #30, press M) =================
   Full-screen top-down view: select any friendly ship (single click or
   drag-box selects ALL), click an enemy to make the selection PRIORITIZE it,
   per-ship modes (AGGRESSIVE / AUTO / PASSIVE), follow/stop toggle, and a
   hover tooltip with live stats. Press M again (or ESC) to return. */
let mapOpen=false,mapSel=new Set(),mapDrag=null,mapHover=null;
/* FIX: #36 — selection helpers + fleet orders for the side panel & E/F */
function selShips(){return friendlyFleet().filter(f=>mapSel.has(f.id));}
function cycleSelMode(){
  const sel=selShips();if(!sel.length){feed('⚠ No ship selected — click one on the map','warn');return;}
  const MODES=['auto','agg','passive'];
  for(const s of sel){if(!s.reg)continue;
    s.reg.mode=MODES[(MODES.indexOf(s.reg.mode||'auto')+1)%3];}
  feed('⚙ MODE → '+((sel.find(s=>s.reg)||{reg:{mode:'auto'}}).reg.mode.toUpperCase())+' ('+sel.length+' ships)','info');
  renderTactMap();
}
function toggleSelFollow(){
  const sel=selShips();if(!sel.length){feed('⚠ No ship selected — click one on the map','warn');return;}
  const stop=!sel.every(s=>s.reg&&s.reg.follow===false);
  for(const s of sel){if(s.reg)s.reg.follow=!stop;}
  feed((stop?'🛑 HOLD POSITION':'⚓ FOLLOW ME')+' — '+sel.length+' ships','info');
  renderTactMap();
}
function tactMapOpen(){return mapOpen;}
function uiBlockedFMap(){return uiOpen||paused||devOpen||devPwOpen||mapOpen;}
function toggleTacticalMap(){
  if(state!=='play'||uiOpen||devOpen||devPwOpen){return;}
  mapOpen=!mapOpen;
  if(mapOpen){document.exitPointerLock&&document.exitPointerLock();}
  else {mapSel.clear();mapDrag=null;mapHover=null;}
  $('tactMap').classList.toggle('hidden',!mapOpen);
  if(mapOpen){cancelAnimationFrame(_tactRaf);_tactRaf=requestAnimationFrame(tactLoop);}
  else cancelAnimationFrame(_tactRaf);
}
/* FIX: #36 — the map redraws itself while open (rotating sweep, live HP,
   moving contacts). Canvas redraw is cheap; the side panel DOM is
   signature-gated (see updateTactSel/updateTactList) so buttons survive. */
let _tactRaf=0;
function tactLoop(){if(!mapOpen)return;renderTactMap();_tactRaf=requestAnimationFrame(tactLoop);}
function friendlyFleet(){
  const out=[];
  for(const e of escorts)out.push({kind:'escort',id:e.id,obj:e,pos:e.pos,reg:e.reg||null});
  for(const r of fleet.reg)if(r.obj&&r.done)out.push({kind:'reg',id:r.id,obj:r.obj,pos:r.obj.position,reg:r});
  return out;
}
function tactMapPos(){ /* the ship body position on the map canvas (offset for triangle center) */
  return {x:player.pos.x,z:player.pos.z};
}
function renderTactMap(){
  const cv=$('tactCan'),c2=cv.getContext('2d');
  /* FIX: #36 — resize only on change (avoids reallocating the canvas
     every frame in the RAF loop) */
  const S=Math.round(Math.min(700,window.innerWidth*.66)),H=Math.round(Math.min(700,window.innerHeight*.74));
  if(cv.width!==S)cv.width=S;
  if(cv.height!==H)cv.height=H;
  c2.clearRect(0,0,S,H);
  const sc=Math.min(S,H)/480,ox=S/2,oz=H/2;
  const X=v=>ox+(v-player.pos.x)*sc, Z=v=>oz+(v-player.pos.z)*sc;
  /* FIX: #36 — radar look: vignette, range rings, rotating sweep */
  const bg=c2.createRadialGradient(ox,oz,20,ox,oz,Math.max(S,H)*.7);
  bg.addColorStop(0,'rgba(9,28,48,.95)');bg.addColorStop(1,'rgba(3,10,18,.98)');
  c2.fillStyle=bg;c2.fillRect(0,0,S,H);
  c2.strokeStyle='rgba(76,195,255,.28)';c2.lineWidth=1;c2.strokeRect(.5,.5,S-1,H-1);
  c2.strokeStyle='rgba(76,195,255,.1)';
  for(const rr of [120,240,360]){c2.beginPath();c2.arc(ox,oz,rr*sc,0,TAU);c2.stroke();}
  if(c2.createConicGradient){const sweepA=(tNow*0.9)%TAU;
    const sg=sweepGradient(c2,ox,oz,sweepA);c2.fillStyle=sg;
    c2.beginPath();c2.moveTo(ox,oz);c2.arc(ox,oz,Math.max(S,H),sweepA-.7,sweepA);c2.closePath();c2.fill();}
  /* priority-target crosshair (the selected ships' designated enemy) */
  const prSel=selShips().find(s=>s.reg&&s.reg.priorityTarget);
  const pr=prSel?priorityEnemy(prSel.reg.priorityTarget):null;
  c2.strokeStyle='rgba(76,195,255,.12)';
  for(let g=-4;g<=4;g++){c2.beginPath();c2.moveTo(X(g*120),0);c2.lineTo(X(g*120),H);c2.stroke();c2.beginPath();c2.moveTo(0,Z(g*120));c2.lineTo(S,Z(g*120));c2.stroke();}
  /* enemies */
  for(const s of ships){if(s.finalizing)continue;
    const boss=s.isBoss&&s.isBoss();
    c2.fillStyle=boss?'#ff9a2a':'#ff4d5e';
    c2.beginPath();c2.arc(X(s.pos.x),Z(s.pos.z),boss?6:2+s.def.l/10,0,TAU);c2.fill();
    if(s===pr){c2.strokeStyle='#ff9a2a';c2.lineWidth=1.5;c2.beginPath();c2.arc(X(s.pos.x),Z(s.pos.z),10,0,TAU);c2.stroke();
      c2.beginPath();c2.moveTo(X(s.pos.x)-14,Z(s.pos.z));c2.lineTo(X(s.pos.x)-6,Z(s.pos.z));c2.moveTo(X(s.pos.x)+6,Z(s.pos.z));c2.lineTo(X(s.pos.x)+14,Z(s.pos.z));c2.moveTo(X(s.pos.x),Z(s.pos.z)-14);c2.lineTo(X(s.pos.x),Z(s.pos.z)-6);c2.stroke();}}
  for(const j of jets){c2.fillStyle='#ffb02a';c2.beginPath();c2.arc(X(j.pos.x),Z(j.pos.z),2.2,0,TAU);c2.fill();
    if(j===pr){c2.strokeStyle='#ff9a2a';c2.lineWidth=1.5;c2.beginPath();c2.arc(X(j.pos.x),Z(j.pos.z),8,0,TAU);c2.stroke();}}
  /* friendlies — FIX: #36 heading ticks so you SEE where they sail */
  const fr=friendlyFleet();
  for(const f of fr){
    const fx=X(f.pos.x),fz=Z(f.pos.z);
    const q=f.obj&&f.obj.quaternion;
    const yaw=q?Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*q.y*q.y):0;
    c2.strokeStyle='#4cc3ff';c2.lineWidth=2;
    c2.beginPath();c2.arc(fx,fz,4,0,TAU);c2.stroke();
    c2.beginPath();c2.moveTo(fx,fz);c2.lineTo(fx+Math.sin(yaw)*9,fz-Math.cos(yaw)*9);c2.stroke();
    if(mapSel.has(f.id)){c2.strokeStyle='#a7f439';c2.lineWidth=1.5;c2.beginPath();c2.arc(fx,fz,7.5,0,TAU);c2.stroke();}
  }
  /* player */
  const px=tactMapPos();c2.save();c2.translate(X(px.x),Z(px.z));c2.rotate(-player.yaw);
  c2.fillStyle='#a7f439';c2.beginPath();c2.moveTo(0,8);c2.lineTo(-5,-5);c2.lineTo(5,-5);c2.closePath();c2.fill();c2.restore();
  /* FIX: #36 — live drag-box overlay while dragging */
  if(mapDrag&&mapDrag.cur){
    c2.strokeStyle='#a7f439';c2.lineWidth=1;c2.setLineDash([4,3]);
    c2.strokeRect(Math.min(mapDrag.x,mapDrag.cur.x),Math.min(mapDrag.y,mapDrag.cur.y),Math.abs(mapDrag.cur.x-mapDrag.x),Math.abs(mapDrag.cur.y-mapDrag.y));
    c2.setLineDash([]);}
  /* hover tooltip */
  if(mapHover){
    c2.fillStyle='rgba(10,22,36,.95)';c2.strokeStyle='rgba(255,183,3,.8)';c2.lineWidth=1;
    const tx=X(mapHover.pos.x),tz=Z(mapHover.pos.z);
    c2.beginPath();c2.rect(tx-52,tz-44,104,34);c2.fill();c2.stroke();
    c2.fillStyle='#ffd9a0';c2.font='10px Orbitron';
    c2.fillText(mapHover.txt,(tx-50),(tz-38));
  }
  $('tactInfo').textContent='M/ESC: CLOSE · CLICK friendly: select · CLICK enemy: attack · SHIFT+CLICK: add · DRAG: box-select · E mode / F follow — SELECTED: '+mapSel.size;
  updateTactSide();
}
/* FIX: #36 — rotating radar sweep gradient */
function sweepGradient(c2,ox,oz,a){
  const g=c2.createConicGradient(a,ox,oz);
  g.addColorStop(0,'rgba(76,195,255,.14)');g.addColorStop(.12,'rgba(76,195,255,0)');g.addColorStop(1,'rgba(76,195,255,0)');
  return g;
}
/* FIX: #36 — SHIP INFO & STATUS panel. DOM rebuilt ONLY when the
   selection/orders signature changes; live HP numbers updated in place. */
let _selSig='\u0000',_fleetSig='\u0000';
function selSig(sel){return sel.map(f=>f.id+':'+(f.reg?f.reg.mode||'auto':'-')+':'+(f.reg?(f.reg.follow===false?'H':'F'):'-')+':'+((f.reg&&f.reg.priorityTarget)||'-')).join('|');}
function updateTactSel(){
  const box=$('tactSel');if(!box)return;
  const sel=selShips();
  const sig=selSig(sel);
  if(sig!==_selSig){_selSig=sig;buildSelBox(sel);}
  if(sel.length){const hpEl=box.querySelector('#tsHp');
    if(hpEl)hpEl.textContent=sel.reduce((a,f)=>a+Math.max(0,Math.round(f.reg?f.reg.hp:f.obj.hp)),0);}
}
function buildSelBox(sel){
  const box=$('tactSel');
  if(!sel.length){
    box.innerHTML='<div class="name">NO SHIP SELECTED</div><div class="row"><b>Hint</b><span>click a friendly ship</span></div><div class="row"><b>Box-select</b><span>drag on the map</span></div>';
    return;}
  const m0=sel[0];
  const mode=m0.reg?(m0.reg.mode||'auto').toUpperCase():'AUTO';
  const fol=m0.reg?(m0.reg.follow===false?'HOLD':'FOLLOW'):'FOLLOW';
  box.innerHTML='<div class="name">'+(sel.length===1?(m0.reg?m0.reg.name:'ESCORT'):(sel.length+' SHIPS SELECTED'))+'</div>'
    +'<div class="row"><b>Hull total</b><span id="tsHp">—</span></div>'
    +'<div class="row"><b>Mode</b><span>'+mode+'</span></div>'
    +'<div class="row"><b>Orders</b><span>'+fol+'</span></div>'
    +'<div class="btns"><button id="tsMode">⚙ MODE</button><button id="tsFollow">'+(fol==='HOLD'?'⚓ FOLLOW':'🛑 HOLD')+'</button>'
    +'<button id="tsPrio">🎯 TARGET</button><button id="tsClear" class="stop">✕ CLEAR</button></div>';
  box.querySelector('#tsMode').onclick=()=>cycleSelMode();
  box.querySelector('#tsFollow').onclick=()=>toggleSelFollow();
  box.querySelector('#tsPrio').onclick=()=>{const f=selShips()[0];
    const t=f.reg?priorityEnemy(f.reg.priorityTarget):null;
    feed(t?'🎯 Current target: '+(t.def?t.def.name:'JET'):'🎯 No target — click an enemy on the map','info');};
  box.querySelector('#tsClear').onclick=()=>{mapSel.clear();renderTactMap();};
}
function updateTactList(){
  const list=$('tactFleetList');if(!list)return;
  const fr=friendlyFleet();
  const ids=fr.map(f=>f.id+((f.reg&&f.reg.repair>0)?'R':'')).join(',');
  if(ids!==_fleetSig){_fleetSig=ids;
    list.innerHTML=fr.length?fr.map(f=>{
      const hp=Math.max(0,Math.round(f.reg?f.reg.hp:f.obj.hp));
      const max=f.reg&&f.reg.maxhp?f.reg.maxhp:100;
      const pct=Math.min(100,Math.round(hp/max*100));
      const rep=f.reg&&f.reg.repair>0?'🔧':'';
      return '<div class="frow'+(mapSel.has(f.id)?' sel':'')+'" data-id="'+f.id+'"><span class="nm">'+rep+(f.reg?f.reg.name:'ESCORT')+'</span><span class="bar"><i style="width:'+pct+'%"></i></span><span class="hp">'+hp+'</span></div>';
    }).join(''):'<div class="frow">— no ships in service —</div>';
    list.querySelectorAll('.frow').forEach(r=>{
      r.onclick=()=>{const rid=r.dataset.id;
        if(keys.ShiftLeft||keys.ShiftRight){mapSel.has(rid)?mapSel.delete(rid):mapSel.add(rid);}
        else{mapSel.clear();mapSel.add(rid);}
        renderTactMap();};});
  }else{
    for(const f of fr){const row=list.querySelector('.frow[data-id="'+f.id+'"]');if(!row)continue;
      const hp=Math.max(0,Math.round(f.reg?f.reg.hp:f.obj.hp));
      const max=f.reg&&f.reg.maxhp?f.reg.maxhp:100;
      row.querySelector('.hp').textContent=hp;
      row.querySelector('.bar i').style.width=Math.min(100,Math.round(hp/max*100))+'%';
      row.classList.toggle('sel',mapSel.has(f.id));}
  }
}
function updateTactSide(){updateTactSel();updateTactList();}
function tactMapClick(px,py){
  const cv=$('tactCan'),S=cv.width,H=cv.height,sc=Math.min(S,H)/480,ox=S/2,oz=H/2;
  const X=v=>ox+(v-player.pos.x)*sc,Z=v=>oz+(v-player.pos.z)*sc;
  const shift=keys.ShiftLeft||keys.ShiftRight;
  let hit=null,bd=20;
  for(const f of friendlyFleet()){const dx=X(f.pos.x)-px,dy=Z(f.pos.z)-py,d=Math.hypot(dx,dy);if(d<bd){bd=d;hit=f;}}
  if(hit){
    if(shift){mapSel.has(hit.id)?mapSel.delete(hit.id):mapSel.add(hit.id);}
    else{mapSel.clear();mapSel.add(hit.id);}
    renderTactMap();return;
  }
  const en=enemyAt(px,py);
  if(en){ /* FIX: #36 — attack orders now WORK (see setPriority fix) */
    const sel=selShips();
    const attackers=sel.length?sel:friendlyFleet();
    if(!attackers.length){feed('⚠ No ships to command','warn');return;}
    for(const f of attackers)setPriority(f,en);
    mapSel.clear();for(const f of attackers)mapSel.add(f.id);
    feed('🎯 ATTACK: '+(attackers.length===1&&attackers[0].reg?attackers[0].reg.name:'FLEET')+' → '+(en.def?en.def.name:'JET'),'info');
  }else if(!shift){mapSel.clear();} /* empty water: clear selection */
  renderTactMap();
}
function enemyAt(px,py){
  const cv=$('tactCan'),S=cv.width,H=cv.height,sc=Math.min(S,H)/480,ox=S/2,oz=H/2;
  const X=v=>ox+(v-player.pos.x)*sc,Z=v=>oz+(v-player.pos.z)*sc;
  let best=null,bb=14;
  for(const s of ships){if(s.finalizing)continue;const dx=X(s.pos.x)-px,dy=Z(s.pos.z)-py,d=Math.hypot(dx,dy);if(d<bb){bb=d;best=s;}}
  for(const j of jets){const dx=X(j.pos.x)-px,dy=Z(j.pos.z)-py,d=Math.hypot(dx,dy);if(d<bb){bb=d;best=j;}}
  return best;
}
/* FIX: #36 — priority targeting was DEAD: it stored 's'+tgt.id on ships
   that have no .id (→ 'sundefined') and then looked that id up among the
   FRIENDLY escorts instead of the enemies. Ships/jets now get stable ids
   (spawnShip/launchJet) and priorityTarget resolves against ships+jets. */
function setPriority(f,tgt){
  if(!f.reg)return;
  f.reg.priorityTarget=tgt&&tgt.id?tgt.id:null;
}
function priorityEnemy(id){
  if(!id)return null;
  const s=ships.find(o=>o.id===id&&!o.finalizing);
  if(s)return s;
  return jets.find(o=>o.id===id)||null;
}

/* ================= Input (desktop) ================= */
let locked=false,mouseDown=false;
const keys={};
const cvs=renderer.domElement;
let camYaw=0,camPitch=.18,camDist=17;
/* FIX #11 (2026-09-06): mouse wheel in zoom view now changes the zoom LEVEL
   (4 steps, 22°..10° fov) instead of switching weapons — RMB/MMB still toggle
   zoom on/off. Outside zoom view the wheel keeps switching weapons. */
let zoomLvl=0;
const ZOOM_FOV=[22,18,14,10];
function setZoom(on,lvl=0){cvs._zoom=!!on;zoomLvl=on?clamp(lvl,0,ZOOM_FOV.length-1):0;}
function uiBlockedF(){return uiOpen||paused||devOpen||devPwOpen;}
function reqLock(){if(IS_TOUCH)return;try{const p=cvs.requestPointerLock();if(p&&p.catch)p.catch(()=>{});}catch(e){}}
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{
  locked=document.pointerLockElement===cvs;
  if(!locked&&state==='play'&&!uiBlockedF()&&!mapOpen){paused=true;$('pause').classList.remove('hidden');}
});
$('pause').addEventListener('click',()=>{paused=false;$('pause').classList.add('hidden');reqLock();});
cvs.addEventListener('click',()=>{if(state==='play'&&!locked&&!uiBlockedF())reqLock();});
/* FIX: mousemove was broken (doubled guard, referenced animate()) — now correct */
document.addEventListener('mousemove',e=>{
  if(mapOpen){ /* hover tooltip */
    const cv=$('tactCan'),r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    if(mapDrag){mapDrag.cur={x:px,y:py};renderTactMap();return;} /* FIX: #36 — live drag-box */
    let best=null,bb=16;
    for(const f of friendlyFleet()){const dd=Math.hypot(f.pos.x-(player.pos.x+(px-cv.width/2)/(Math.min(cv.width,cv.height)/480)),f.pos.z-(player.pos.z+(py-cv.height/2)/(Math.min(cv.width,cv.height)/480)));if(dd<bb){bb=dd;best=f;}}
    if(best){
      const hp=Math.round(best.reg?best.reg.hp:best.obj.hp);
      const am=best.reg?best.reg.lvl.ammo:0;
      mapHover={pos:best.pos,txt:(best.reg?best.reg.name:'ESCORT')+' HP '+hp+' · mode '+(best.reg?best.reg.mode:'-')};
    }else mapHover=null;
    renderTactMap();return;
  }
  if(!locked||IS_TOUCH||state!=='play'||uiBlockedF())return;
  const sens=.0021*TUNES.sens*(camera.fov/60);
  camYaw-=e.movementX*sens;
  camPitch=clamp(camPitch-e.movementY*sens,-.15,1.1);
});
document.addEventListener('mousedown',e=>{
  if(IS_TOUCH)return;
  if(mapOpen){ /* FIX: #36 — mousedown only STARTS a box-select; the
       click itself is dispatched on mouseup (drag > 6 px = box, else click) */
    const cv=$('tactCan'),r=cv.getBoundingClientRect();
    mapDrag={x:e.clientX-r.left,y:e.clientY-r.top,cur:null};
    return;
  }
  if(state!=='play'||uiBlockedF())return;
  if(e.button===1){
    e.preventDefault();
    if(locked)setZoom(!cvs._zoom);
    return;
  }
  if(!locked)return;
  if(e.button===0)mouseDown=true;
  if(e.button===2)cvs._zoom=true;
});
document.addEventListener('mouseup',e=>{
  if(mapOpen){ /* FIX: #36 — finish box-select or dispatch the click */
    const cv=$('tactCan');
    if(mapDrag){
      const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
      if(mapDrag.cur&&Math.hypot(mapDrag.cur.x-mapDrag.x,mapDrag.cur.y-mapDrag.y)>6){
        const S=cv.width,H=cv.height,sc=Math.min(S,H)/480,ox=S/2,oz=H/2;
        const x0=Math.min(mapDrag.x,mapDrag.cur.x),x1=Math.max(mapDrag.x,mapDrag.cur.x);
        const y0=Math.min(mapDrag.y,mapDrag.cur.y),y1=Math.max(mapDrag.y,mapDrag.cur.y);
        if(!(keys.ShiftLeft||keys.ShiftRight))mapSel.clear();
        let n=0;
        for(const f of friendlyFleet()){
          const fx=ox+(f.pos.x-player.pos.x)*sc,fz=oz+(f.pos.z-player.pos.z)*sc;
          if(fx>=x0&&fx<=x1&&fz>=y0&&fz<=y1){mapSel.add(f.id);n++;}}
        if(n)feed('☑ BOX-SELECT: '+n+' ships (total '+mapSel.size+')','info');
      }else tactMapClick(px,py);
    }
    mapDrag=null;renderTactMap();return;
  }
  if(e.button===0)mouseDown=false;
  if(e.button===2)cvs._zoom=false;
});
document.addEventListener('auxclick',e=>e.preventDefault());
document.addEventListener('wheel',e=>{
  if(state!=='play'||uiBlockedF())return;
  e.preventDefault();
  if(cvs._zoom){ /* zoom view: wheel = zoom level, NOT weapon switch */
    setZoom(true,zoomLvl+(e.deltaY>0?-1:1));
    return;
  }
  switchWeapon((curWeapon+(e.deltaY>0?1:2))%3);
},{passive:false});
document.addEventListener('keydown',e=>{
  if(rebinding){e.preventDefault();
    if(!e.repeat&&!rebindBuf.includes(e.code)){rebindBuf.push(e.code);
      $('devMsg').textContent='KEY 1/2 OK ('+e.code+') — press second key…';
      if(rebindBuf.length===2){
        DEVKEYS=[...rebindBuf];
        try{localStorage.setItem('sb_dev_keys',JSON.stringify(DEVKEYS));}catch(err){}
        rebinding=false;
        $('devRebind').textContent='⌨ REBIND TRIGGER KEYS';
        $('devMsg').textContent='✔ New trigger: '+DEVKEYS.map(k=>k.replace('Key','').replace('Digit','')).join(' + ');}}
    return;}
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')){if(e.code!=='Escape')return;}
  keys[e.code]=true;
  if(e.code==='Space'&&state==='play')e.preventDefault(); /* FIX: space must not scroll/reactivate buttons */
  if(!e.repeat&&state==='play'&&!uiBlockedF()&&
     keys[DEVKEYS[0]]&&keys[DEVKEYS[1]]){
    openDevPw();return;}
  if(e.code==='Tab'&&!e.repeat&&state==='play'&&player&&!player.dead&&!devOpen&&!devPwOpen){
    e.preventDefault();uiOpen?closeWerft():openWerft();return;}
  if(e.code==='KeyI'&&!e.repeat&&uiOpen){ /* FIX: #33 — info card on demand: I toggles the hovered card's info */
    const im=$('infoModal');
    if(im&&!im.classList.contains('hidden'))hideInfo();
    else if(_infoHover){_infoHover();}
    return;}
  if(e.repeat)return;
  if(state!=='play')return;
  if(e.code==='Digit1')switchWeapon(0);
  if(e.code==='Digit2')switchWeapon(1);
  if(e.code==='Digit3')switchWeapon(2);
  /* FIX: #36 — fleet orders while the tactical map is open */
  if(mapOpen&&e.code==='KeyE'&&!e.repeat){cycleSelMode();return;}
  if(mapOpen&&e.code==='KeyF'&&!e.repeat){toggleSelFollow();return;}
  if(e.code==='KeyE')toggleDrones();
  if(e.code==='KeyR')toggleDC();
  if(e.code==='KeyM'&&!e.repeat){toggleTacticalMap();return;}
  if(e.code==='Escape'&&mapOpen){toggleTacticalMap();return;}
  if(e.code==='Escape'&&!$('infoModal').classList.contains('hidden')){hideInfo();return;} /* FIX: #34 — Escape closes the info card first, not the whole dockyard */
  if(e.code==='Escape'&&uiOpen)closeWerft();
  if(e.code==='Escape'&&devOpen)closeDev();
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});
document.addEventListener('keydown',e=>{const t=e.target;if((e.code==='Enter'||e.code==='Space')&&t&&t.getAttribute&&t.getAttribute('role')==='button'){e.preventDefault();e.stopPropagation();t.click();}});
addEventListener('blur',()=>{mouseDown=false;for(const k in keys)keys[k]=false;});

/* ================= TOUCH CONTROLS ================= */
const touchJoy={active:false,thr:0,rud:0};
const touchMap=new Map();
let lastTapT=0,lastTapX=0,lastTapY=0;
function touchPlayOK(){return state==='play'&&!uiBlockedF();}
function initTouchUI(){
  if(!IS_TOUCH)return;
  $('touchUI').classList.remove('hidden');
  cvs.addEventListener('touchstart',e=>{
    if(!touchPlayOK())return;
    e.preventDefault();
    for(const t of e.changedTouches){
      const x=t.clientX,y=t.clientY;
      if(!touchJoy.active&&x<innerWidth*0.42&&y>innerHeight*0.42){
        touchJoy.active=true;
        touchMap.set(t.identifier,{mode:'joy',startX:x,startY:y,lastX:x,lastY:y});
        const jb=$('joyBase');jb.style.display='block';
        jb.style.left=(x-60)+'px';jb.style.top=(y-60)+'px';
        $('joyKnob').style.left='32px';$('joyKnob').style.top='32px';
      }else{
        touchMap.set(t.identifier,{mode:'look',startX:x,startY:y,lastX:x,lastY:y});
        const now=performance.now();
        if(now-lastTapT<320&&Math.hypot(x-lastTapX,y-lastTapY)<60){
          cvs._zoom=!cvs._zoom;$('btnZoom').classList.toggle('on',cvs._zoom);
          lastTapT=0;
        }else{lastTapT=now;lastTapX=x;lastTapY=y;}
        const lookN=[...touchMap.values()].filter(v=>v.mode==='look').length;
        if(lookN===2){cvs._zoom=!cvs._zoom;$('btnZoom').classList.toggle('on',cvs._zoom);}
      }
    }
  },{passive:false});
  cvs.addEventListener('touchmove',e=>{
    if(!touchPlayOK())return;
    e.preventDefault();
    for(const t of e.changedTouches){
      const st=touchMap.get(t.identifier);if(!st)continue;
      if(st.mode==='joy'){
        const dx=t.clientX-st.startX,dy=t.clientY-st.startY;
        touchJoy.rud=clamp(dx/55,-1,1);
        touchJoy.thr=clamp(-dy/55,-1,1);
        const kb=$('joyKnob');
        kb.style.left=(32+clamp(dx,-44,44))+'px';
        kb.style.top=(32+clamp(dy,-44,44))+'px';
        st.lastX=t.clientX;st.lastY=t.clientY;
      }else{
        const sens=.0035*TUNES.sens*(camera.fov/60);
        camYaw-=(t.clientX-st.lastX)*sens;
        camPitch=clamp(camPitch-(t.clientY-st.lastY)*sens,-.15,1.1);
        st.lastX=t.clientX;st.lastY=t.clientY;
      }
    }
  },{passive:false});
  const endTouch=e=>{
    for(const t of e.changedTouches){
      const st=touchMap.get(t.identifier);if(!st)continue;
      if(st.mode==='joy'){touchJoy.active=false;touchJoy.thr=0;touchJoy.rud=0;$('joyBase').style.display='none';}
      touchMap.delete(t.identifier);
    }
  };
  cvs.addEventListener('touchend',endTouch);
  cvs.addEventListener('touchcancel',endTouch);
  $('btnFire').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(touchPlayOK())mouseDown=true;},{passive:false});
  $('btnFire').addEventListener('touchend',e=>{e.preventDefault();mouseDown=false;},{passive:false});
  $('btnZoom').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();
    if(touchPlayOK()){cvs._zoom=!cvs._zoom;$('btnZoom').classList.toggle('on',cvs._zoom);}},{passive:false});
  /* FIX: #40 (2026-11-12) — touch parity: dockyard and tactical map were
     keyboard-only, so phone players could never upgrade or command. */
  $('btnDock').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(state==='play'&&!paused&&!devOpen&&!devPwOpen){uiOpen?closeWerft():openWerft();}},{passive:false});
  $('btnMap').addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();if(state==='play'&&!paused&&!devOpen&&!devPwOpen)toggleTacticalMap();},{passive:false});
  $('hint').textContent='☰ DOCK · MAP · FIRE · ZOOM · ▲ Drone · ✚ Damage Control';
}
initTouchUI();
for(let k=0;k<3;k++)$('s'+k).addEventListener('click',()=>switchWeapon(k));
$('dronesIco').addEventListener('click',()=>{if(state==='play')toggleDrones();});
$('dcIco').addEventListener('click',()=>{if(state==='play')toggleDC();});
/* FIX: illegal U+2020 character removed — simple portrait detection */
function checkOrientation(){
  const bad=IS_TOUCH&&innerHeight>innerWidth;
  $('rotatePrompt').classList.toggle('hidden',!bad);
}

/* ================= DEV panel ================= */
const SCHEMA=[
  {g:'TOGGLES'},
  {g:'TOGGLES',k:'godMode',l:'GOD MODE (no damage)',min:0,max:1,s:1,b:1},
  {g:'TOGGLES',k:'infHP',l:'INFINITE HP (auto refill)',min:0,max:1,s:1,b:1},
  {g:'TOGGLES',k:'noReload',l:'NO RELOAD TIME',min:0,max:1,s:1,b:1},
  {g:'TOGGLES',k:'aimbot',l:'AIMBOT (always auto-aim)',min:0,max:1,s:1,b:1},
  {g:'TOGGLES',k:'aimAssist',l:'AIM ASSIST (soft, near crosshair)',min:0,max:1,s:1,b:1},
  {g:'TOGGLES',k:'eAggro',l:'ENEMIES FIRE BACK',min:0,max:1,s:1,b:1},
  {g:'PLAYER'},
  {g:'PLAYER',k:'pThrust',l:'Thrust',min:2,max:40,s:.5},
  {g:'PLAYER',k:'pVmax',l:'Max speed (m/s)',min:3,max:50,s:.5},
  {g:'PLAYER',k:'pTurn',l:'Rudder rate',min:.1,max:3,s:.02},
  {g:'PLAYER',k:'pHP',l:'Max hull',min:50,max:3000,s:10},
  {g:'PLAYER',k:'pReloadMul',l:'Reload multiplier',min:.05,max:3,s:.05},
  {g:'PLAYER',k:'pDmgMul',l:'Damage multiplier',min:.1,max:10,s:.1},
  {g:'PLAYER',k:'fireChance',l:'Fire-on-hit chance',min:0,max:1,s:.02},
  {g:'WEAPONS'},
  {g:'WEAPONS',k:'heDmg',l:'HE shell damage',min:5,max:800,s:5},
  {g:'WEAPONS',k:'shellVel',l:'HE shell speed',min:40,max:400,s:5},
  {g:'WEAPONS',k:'mgDmg',l:'MG damage',min:1,max:100,s:1},
  {g:'WEAPONS',k:'mgVel',l:'MG speed',min:60,max:500,s:10},
  {g:'WEAPONS',k:'grav',l:'Gravity (G)',min:2,max:40,s:.5},
  {g:'WEAPONS',k:'rocketCount',l:'Rockets per turret',min:1,max:8,s:1},
  {g:'WEAPONS',k:'salvoGap',l:'Rocket salvo gap (s)',min:.04,max:1,s:.02},
  {g:'WEAPONS',k:'rocketLife',l:'Rocket homing TIME (s)',min:1,max:30,s:.5},
  {g:'WEAPONS',k:'rocketVel',l:'Rocket speed',min:20,max:200,s:2},
  {g:'WEAPONS',k:'rocketTurn',l:'Rocket turn rate',min:.5,max:20,s:.5},
  {g:'WEAPONS',k:'rocketDmg',l:'Rocket damage',min:5,max:500,s:5},
  {g:'ENEMIES (BOTS)'},
  {g:'ENEMIES (BOTS)',k:'eSpeed',l:'Bot speed multiplier',min:.1,max:4,s:.05},
  {g:'ENEMIES (BOTS)',k:'eFire',l:'Bot fire-rate multiplier',min:.1,max:8,s:.05},
  {g:'ENEMIES (BOTS)',k:'eDmg',l:'Bot damage multiplier',min:0,max:8,s:.05},
  {g:'ENEMIES (BOTS)',k:'eHP',l:'Bot HP multiplier',min:.1,max:5,s:.05},
  {g:'ENEMIES (BOTS)',k:'maxEnemies',l:'MAX bots alive',min:1,max:30,s:1},
  {g:'ENEMIES (BOTS)',k:'jetHp',l:'Jet HP',min:5,max:300,s:5},
  {g:'ENEMIES (BOTS)',k:'jetMgDmg',l:'Jet MG damage',min:0,max:40,s:1},
  {g:'ENEMIES (BOTS)',k:'emslDmg',l:'Boss missile damage',min:0,max:80,s:2},
  {g:'ENEMIES (BOTS)',k:'eAmmo',l:'Fleet ammo resupply / wave',min:0,max:100,s:5},
  {g:'ENEMIES (BOTS)',k:'bombDmg',l:'Bomb damage multiplier',min:.1,max:6,s:.1},
  {g:'ECONOMY'},
  {g:'ECONOMY',k:'credMul',l:'CR per kill multiplier',min:0,max:20,s:.5},
  {g:'ECONOMY',k:'scoreMul',l:'Score multiplier',min:0,max:20,s:.5},
  {g:'ECONOMY',k:'startCR',l:'Starting CR (next run)',min:0,max:10000,s:50},
  {g:'ECONOMY',k:'startAmmo',l:'Starting ammo (next run)',min:0,max:500,s:25},
  {g:'ECONOMY',k:'waveBonusMul',l:'Wave bonus multiplier',min:0,max:20,s:.5},
  {g:'WORLD / GFX / SOUND'},
  {g:'WORLD / GFX / SOUND',k:'waveScale',l:'Wave height scale',min:0,max:2.5,s:.05},
  {g:'WORLD / GFX / SOUND',k:'waterBlue',l:'Water blueness',min:0,max:1,s:.02},
  {g:'WORLD / GFX / SOUND',k:'masterVol',l:'Master volume',min:0,max:1,s:.02},
  {g:'WORLD / GFX / SOUND',k:'fov',l:'Camera FOV',min:30,max:110,s:1},
  {g:'WORLD / GFX / SOUND',k:'camDist',l:'Camera distance',min:6,max:50,s:1},
  {g:'WORLD / GFX / SOUND',k:'sens',l:'Mouse sensitivity',min:.1,max:4,s:.05},
];
let curGroup='ALL';
function renderDev(){
  const box=$('devBody');box.innerHTML='';
  const addTitle=t=>{const d=document.createElement('div');d.className='dgrptitle';d.textContent=t;box.appendChild(d);};
  for(const it of SCHEMA){
    if(!it.k){
      if(curGroup!=='ALL'&&it.g!==curGroup)continue;
      addTitle('— '+it.g+' —');continue;}
    let gname='';for(const s of SCHEMA){if(!s.k)gname=s.g;if(s===it)break;}
    if(curGroup!=='ALL'&&gname!==curGroup)continue;
    const row=document.createElement('div');row.className='drow'+(it.b?' b':'');
    if(it.b){
      row.innerHTML=`<label><span>${it.l}</span><input type="checkbox" ${TUNES[it.k]?'checked':''}/></label>`;
      row.querySelector('input').onchange=ev=>{TUNES[it.k]=ev.target.checked?1:0;applyDev();};
    }else{
      row.innerHTML=`<label><span>${it.l}</span><b>${(+TUNES[it.k]).toFixed(2)}</b></label>
        <input type="range" min="${it.min}" max="${it.max}" step="${it.s}" value="${TUNES[it.k]}"/>`;
      const num=row.querySelector('b');
      row.querySelector('input').oninput=ev=>{
        TUNES[it.k]=+ev.target.value;num.textContent=(+ev.target.value).toFixed(2);applyDev();};
    }
    box.appendChild(row);
  }
}
function applyDev(){
  if(cheatsOn())runCheated=true;
  G=TUNES.grav;WSCALE=TUNES.waveScale;
  waterMat.uniforms.uWS.value=WSCALE;
  waterMat.uniforms.uC1.value.copy(c1a).lerp(c1b,TUNES.waterBlue);
  waterMat.uniforms.uC2.value.copy(c2a).lerp(c2b,TUNES.waterBlue);
  if(sfx.ctx)sfx.master.gain.value=TUNES.masterVol;
  if(player)applyStats();
}
function resetDev(){Object.assign(TUNES,DEV_DEF);if(IS_TOUCH){TUNES.aimAssist=1;TUNES.camDist=12;TUNES.sens=1.3;}
  applyDev();renderDev();
  $('devMsg').textContent='↺ ALL VALUES RESET TO DEFAULT';}
$('devReset').onclick=resetDev;
$('devClose').onclick=closeDev;
$('devSetPw').onclick=()=>{
  const v=$('devNewPw').value.trim();
  if(v.length<3){$('devMsg').textContent='✗ password too short (min 3)';return;}
  DEVPW=v;try{localStorage.setItem('sb_dev_pw',DEVPW);}catch(e){}
  $('devNewPw').value='';
  $('devMsg').textContent='✔ Password changed & saved';
};
$('devRebind').onclick=()=>{
  rebinding=true;rebindBuf=[];rebindT=15;
  $('devRebind').textContent='⏳ '+rebindT+'s — press 2 NEW keys…';
  const iv=setInterval(()=>{
    if(!rebinding){clearInterval(iv);return;}
    rebindT--;
    if(rebindT<=0){
      clearInterval(iv);rebinding=false;
      DEVKEYS=['KeyH','KeyC'];
      try{localStorage.setItem('sb_dev_keys',JSON.stringify(DEVKEYS));}catch(e){}
      $('devRebind').textContent='⌨ REBIND TRIGGER KEYS';
      $('devMsg').textContent='⏱ TIMEOUT — trigger keys reset to H+C (other settings kept)';
      renderDev();
    }else if(rebinding&&rebindBuf.length===0)
      $('devRebind').textContent='⏳ '+rebindT+'s — press 2 NEW keys…';
  },1000);
  $('devMsg').textContent='Press TWO new keys within 15s (e.g. J then K)…';
};
function openDevPw(){
  devPwOpen=true;paused=false;
  $('devpwMsg').textContent='';$('devpwIn').value='';
  $('devpw').classList.remove('hidden');
  try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}
  setTimeout(()=>$('devpwIn').focus(),50);
}
$('devpwGo').onclick=tryPw;
$('devpwIn').addEventListener('keydown',e=>{if(e.key==='Enter')tryPw();});
function tryPw(){
  if($('devpwIn').value===DEVPW){
    devPwOpen=false;$('devpw').classList.add('hidden');
    devOpen=true;curGroup='ALL';renderDev();
    $('devMsg').textContent='Dev console unlocked · trigger: '+DEVKEYS.map(k=>k.replace('Key','')).join('+');
    $('dev').classList.remove('hidden');
  }else{
    $('devpwMsg').textContent='✗ WRONG PASSWORD';
    $('devpwIn').value='';
  }
}
$('devpw').addEventListener('click',e=>{if(e.target===$('devpw')){devPwOpen=false;$('devpw').classList.add('hidden');}});
function closeDev(){
  devOpen=false;$('dev').classList.add('hidden');
  if(state==='play'&&!IS_TOUCH)reqLock();
}

/* ================= Start / End ================= */
initPlayer();
camera.position.set(0,10,0);
checkOrientation();
$('startBtn').addEventListener('click',()=>{try{sfx.init();sfx.ctx&&sfx.ctx.resume&&sfx.ctx.resume();}catch(e){}startGame();});
$('againBtn').addEventListener('click',()=>{startGame();});
/* FIX: #38 (2026-11-12) — one reset point for every per-run system: ordnance
   prices/reload chain, impact rings, admin tuning and the cheat flag. */
function resetRunState(){
  armory.shell='ap';armory.msl='ir';armory.mslChain=0;armory.mslWait=0;
  armory.shellBuys=0;armory.mslBuys=0;
  impReset();
  for(const s of rings.it){s.life=0;s.m.visible=false;}
  if(!devOpen){Object.assign(TUNES,DEV_DEF);if(IS_TOUCH){TUNES.aimAssist=1;TUNES.camDist=12;TUNES.sens=1.3;}}
  runCheated=false;
  G=TUNES.grav;WSCALE=TUNES.waveScale;
}
function startGame(){
  resetRunState();
  uiOpen=false;paused=false;devOpen=false;devPwOpen=false;
  $('menu').classList.add('hidden');$('over').classList.add('hidden');$('pause').classList.add('hidden');
  $('werft').classList.add('hidden');$('dev').classList.add('hidden');$('devpw').classList.add('hidden');
  for(const s of ships){scene.remove(s.group);scene.remove(s.blob);}ships.length=0;
  for(const s of shells)scene.remove(s.m);shells.length=0;
  for(const r of rockets)scene.remove(r.m);rockets.length=0;
  for(const m of emissiles)scene.remove(m.m);emissiles.length=0; /* BOSS v2 */
  for(const j of jets)scene.remove(j.mesh);jets.length=0;
  for(const t of torps)scene.remove(t.m);torps.length=0;
  for(const d of debris)scene.remove(d.m);debris.length=0;
  for(const d of drones)d.kill();drones.length=0;salvoQ.length=0;
  clearEscorts(); /* FIX: #23 fleet escorts are bought per-run like all upgrades */
  scene.remove(player.group);scene.remove(player.blob);
  initPlayer();
  score=0;credits=Math.round(TUNES.startCR);fleet.ammo=Math.round(TUNES.startAmmo);combo=1;lastSinkT=-99;shipsSunk=0;gameOver=false;waveNum=0;weaponCds=[0,0,0]; /* FIX: lastSinkT reset (combo carry-over between runs) · FIX: #28 (2026-09-07) — generous starting ammo; before it was 0 so the very first shell/rocket was impossible while the crate cost 300 CR */
  ui.score.textContent=0;ui.credits.textContent=credits;ui.feed.innerHTML='';
  switchWeapon(0);
  waveGear.active=false;waveGear.queue=[];waveGear.between=2.5;
  /* FIX #10 (2026-09-06): camera spawned IN FRONT of the bow (camYaw=0 puts it at
     +Z, but the ship's bow points to +Z) so the ship always appeared backwards.
     PI = behind the stern, matching atan2(x,z) ship heading convention. */
  camYaw=Math.PI;camPitch=.18;camDist=17;
  cvs._zoom=false;$('btnZoom').classList.remove('on');
  state='play';document.body.dataset.state='play';
  sinkTimer=0;
  feed('🪙 '+credits+' CR STARTING CAPITAL · TAB = DOCKYARD','info');
  banner('SET SAIL','Wave 1 incoming — good hunting, captain!');
  reqLock();
}

/* ================= Sniper marker ================= */
const aimMark=new THREE.Mesh(new THREE.RingGeometry(.5,.7,22),new THREE.MeshBasicMaterial({color:0x4cc3ff,depthTest:false,transparent:true,opacity:.9}));
aimMark.renderOrder=12;aimMark.visible=false;scene.add(aimMark);

/* ================= Main loop ================= */
const clock=new THREE.Clock();
let menuYaw=0;
function animate(){
  requestAnimationFrame(animate);
  try{
  const dt=Math.min(clock.getDelta(),1/30);
  tNow+=dt;
  WSCALE=TUNES.waveScale;
  waterMat.uniforms.uTime.value=tNow;
  waterMat.uniforms.uWS.value=WSCALE;
  waterMat.uniforms.uC1.value.copy(c1a).lerp(c1b,TUNES.waterBlue);
  waterMat.uniforms.uC2.value.copy(c2a).lerp(c2b,TUNES.waterBlue);
  particles.update(dt,tNow);
  rings.update(dt,tNow);
  /* FIX: muzzle/explosion lights now decay instead of staying on forever */
  for(const l of flashPool){if(l.intensity>0)l.intensity*=Math.exp(-9*dt);}

  const uiBlocked=paused||uiOpen||devOpen||devPwOpen;
  const frozen=(state==='play'&&uiBlocked);

  if(state==='menu'){
    menuYaw+=dt*.1;
    player.yaw=menuYaw;
    floatStep(player,dt);
    player.group.quaternion.copy(player.quat);player.group.position.copy(player.pos);
    player.group.updateMatrixWorld(true);
    player.blob.position.set(player.pos.x,waveH(player.pos.x,player.pos.z,tNow)+.05,player.pos.z);
    camera.position.set(player.pos.x+Math.sin(menuYaw)*30,11,player.pos.z+Math.cos(menuYaw)*30);
    camera.position.y=Math.max(camera.position.y,waveH(camera.position.x,camera.position.z,tNow)+2);
    camera.lookAt(player.pos.x,3,player.pos.z);
    camera.fov=60;camera.updateProjectionMatrix();
  }
  else if((state==='play'||state==='over')&&!frozen){
    if(!player.finalizing){
      updatePlayer(dt);
      if(sinkTimer>0){sinkTimer-=dt;if(sinkTimer<=0)finalizePlayer();}
    }
    /* CAMERA — ORIGINAL STYLE (unchanged) */
    recoil*=Math.exp(-9*dt);shakeV*=Math.exp(-6*dt);
    /* FIX: #32 (2026-09-09) — zoom LVL now actually zooms. Mouse-wheel
       steps zoomLvl; FOV tightens via core.zoomFOV (Modern-Warships-style
       scope steps) and the camera pulls in closer per level. FIX #32b:
       base 22 (the old ZOOM_FOV[0]) — with base TUNES.fov=60 level 0
       equalled the un-zoomed view, so plain RMB zoom did nothing. */
    const tgtF=cvs._zoom?zoomFOV(zoomLvl,22):TUNES.fov;
    camera.fov+=(tgtF-camera.fov)*Math.min(1,10*dt);camera.updateProjectionMatrix();
    const wantDist=cvs._zoom?Math.max(3.5,9-zoomLvl*1.8):TUNES.camDist;
    camDist+=(wantDist-camDist)*Math.min(1,8*dt);
    const bx=Math.sin(camYaw),bz=Math.cos(camYaw);
    const cpi=Math.max(.25,Math.cos(camPitch));
    camera.position.set(
      player.pos.x+bx*camDist*cpi,
      player.pos.y+4.6+Math.sin(camPitch)*camDist,
      player.pos.z+bz*camDist*cpi);
    camera.position.y=Math.max(camera.position.y,waveH(camera.position.x,camera.position.z,tNow)+1.5);
    camera.rotation.set(
      camPitch+recoil*.6+(Math.random()-.5)*shakeV*(REDUCED_MOTION?0:1),
      camYaw+(Math.random()-.5)*shakeV*(REDUCED_MOTION?0:1),
      (Math.random()-.5)*shakeV*.5*(REDUCED_MOTION?0:1));
    {const zc=!!cvs._zoom&&state==='play';if(zc!==zoomCls){zoomCls=zc;body.classList.toggle('zoomed',zc);}}

    computeAimbot();
    computeAssist();
    updateTowers(dt);
    const simActive=state==='play'&&!gameOver;
    if(!player.finalizing&&simActive){
      weaponCds[0]-=dt;weaponCds[1]-=dt;weaponCds[2]-=dt;
      /* FIX: #25 — rocket reload chain escalates 30s→60→90→120s WITHOUT cheats,
         and drains while you wait. Admin pause = no chain, no drain. */
      if(weaponCds[2]>0&&!cheatsOn()){
        armory.mslWait=(armory.mslWait||0)+dt;
        if(armory.mslWait>=1){const s=Math.ceil(weaponCds[2]);
          if(s!==armory.mslLast){armory.mslLast=s;
            if(s%30===0&&s>0)feed('⏳ ROCKET RELOAD '+s+'s — pause or use guns (admin pause: none)','info');}}
      }
      if(mouseDown||keys.Space)fireCurrent(dt);
      updateSalvo(dt);
    }
    for(const s of ships)s.update(dt,!simActive);    for(let i=ships.length-1;i>=0;i--)if(ships[i].finalizing)ships.splice(i,1);
    if(simActive)updateWaves(dt);
    if(!player.finalizing)for(const s of ships){
      if(s.finalizing)continue;
      const dd=nearDist(s.pos,player.pos),min=(s.def.l+player.def.l)*.45;
      if(dd<min&&dd>.01){
        const nx=(s.pos.x-player.pos.x)/dd,nz=(s.pos.z-player.pos.z)/dd,push=(min-dd)*2.2*dt;
        s.vel.x+=nx*push*2;s.vel.z+=nz*push*2;
        player.vel.x-=nx*push*2;player.vel.z-=nz*push*2;}}
    updateDrones(dt);
    updateEscorts(dt); /* FIX: #23 bought fleet escorts */
    updateJets(dt); /* BOSS v2: carrier air wing */

    aimMark.visible=false;
    if(cvs._zoom&&state==='play'&&!uiOpen&&!player.finalizing){
      const P=getAimPoint();
      aimMark.position.set(P.x,waveH(P.x,P.z,tNow)+.3,P.z);
      aimMark.lookAt(camera.position);aimMark.visible=true;
      ui.rge.textContent='RNG '+Math.round(nearDist(player.pos,P))+' m';
    }else ui.rge.textContent='';
  }

  water.position.set(camera.position.x,0,camera.position.z);
  seaDisc.position.set(camera.position.x,-0.4,camera.position.z);
  sky.position.copy(camera.position);

  if(!frozen){
    impReset(); /* FIX: #19 impact-ring frame cycle */
    updateShells(dt);
    updateRockets(dt);
    updateEMissiles(dt); /* BOSS v2: battleship missiles */
    updateTorps(dt);
    updateBombs(dt); /* FIX: #22 dive-bomber payloads */
    renderImps(); /* FIX: #19 position pooled rings from collected points */
    for(let i=debris.length-1;i>=0;i--)if(debris[i].update(dt,tNow))debris.splice(i,1);
  }

  /* HUD */
  if(player){
    ui.waveN.textContent=waveNum||'–';
    ui.left.textContent=ships.filter(s=>!s.finalizing).length+waveGear.queue.length;
    /* BOSS v2: boss HP bar (first alive boss, incl. ELITE tag) */
    const boss=ships.find(s=>!s.finalizing&&s.isBoss&&s.isBoss());
    if(boss){
      const tid=boss.type+(boss.elite?'*':'');
      if($('bossbar').dataset.tid!==tid){
        $('bossbar').dataset.tid=tid;
        $('bossName').textContent=boss.def.name.replace(/^[^ ]+ /,'')+(boss.elite?' — ELITE':'');}
      $('bossbar').classList.remove('hidden');
      $('bossbar').classList.toggle('elite',!!boss.elite);
      ui.bossF.style.width=clamp(boss.hp/boss.maxhp*100,0,100)+'%';
    }else{$('bossbar').classList.add('hidden');$('bossbar').dataset.tid='';}
    const hpP=Math.round(player.hp/player.maxhp*100);
    ui.hullF.style.width=hpP+'%';ui.hullT.textContent=hpP+'%';
    ui.hullBox.classList.toggle('low',hpP<35);
    const avg=(player.floods[0]+player.floods[1]+player.floods[2]+player.floods[3])/4;
    ui.buoyF.style.width=Math.round((1-avg)*100)+'%';
    ui.buoyT.textContent=Math.round((1-avg)*100)+'%';
    const crP=Math.round(player.crew/player.maxCrew*100);
    ui.crewF.style.width=crP+'%';ui.crewT.textContent=crP+'%';
    ui.dc.textContent=player.repairMode?'DC ● ON [R]':'DC ○ OFF [R]';
    ui.dc.classList.toggle('on',player.repairMode);
    const spd=Math.hypot(player.vel.x,player.vel.z)*1.9438;
    const rudR=touchJoy.active?touchJoy.rud:((keys.KeyA?1:0)-(keys.KeyD?1:0));
    ui.spd.textContent=spd.toFixed(1)+' kn · RUD '+(rudR>0?'◄':rudR<0?'►':'─');
    for(let k=0;k<3;k++){
      const f=$('s'+k).querySelector('.cdf');
      const cds=Math.max(0,weaponCds[k]);
      const base=(TUNES.noReload?0.03:WEAPONS[k].cd*curReloadMul());
      f.style.width=(base>0?clamp(cds/base,0,1)*100:0)+'%';
    }
    /* FIX: center reload bar was dead — now driven by the active weapon's cooldown */
    {
      const base=(TUNES.noReload?0.03:WEAPONS[curWeapon].cd*curReloadMul());
      ui.rel.style.width=(base>0?clamp(Math.max(0,weaponCds[curWeapon])/base,0,1)*100:0)+'%';
    }

    drawMap();
  }
  renderer.render(scene,camera);
  }catch(e){showCrash(e);} /* FIX: #26 — no more silent black screen on crash */
}
switchWeapon(0);
applyDev();
animate();
