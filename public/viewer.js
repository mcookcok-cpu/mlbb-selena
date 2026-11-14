import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeLocomotionClips } from './locomotion.js?v=1';
import { loadOriginalRunClips } from './runexp.js?v=1';

const $ = s => document.querySelector(s);
const canvas = $('#c');
const mobile = matchMedia('(pointer:coarse)').matches;
const S = { bloom: true, bloomStrength: 0.45, exposure: 1.05, shadows: true, particles: true, autorotate: false, speed: 1,
  pr: Math.min(devicePixelRatio || 1, 2), form: 'f1', lockXZ: true, mode: 'pbr', wire: false, cine: false, fov: 32, manual: false, bg: 0 };

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(S.pr); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = S.exposure;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0a14, 0.035);
const camera = new THREE.PerspectiveCamera(S.fov, innerWidth / innerHeight, 0.05, 300);
const HOME = { pos: new THREE.Vector3(0.9, 1.3, 4.4), target: new THREE.Vector3(0, 0.95, 0) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(HOME.target); controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.5; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.58; controls.autoRotateSpeed = 1.2;
controls.update();
const FORM_W = { f1: 1.5, f2: 2.0, both: 3.6, orig: 2.4 };
function frame(reset = true) {
  const asp = innerWidth / innerHeight; S.fov = asp < 0.8 ? 48 : asp < 1.2 ? 40 : 32;
  const t = Math.tan(S.fov * Math.PI / 360), h = 2.35, w = FORM_W[S.form] || 2;
  const dist = Math.max((h / 2) / t, (w / 2) / (t * asp));
  camera.fov = S.fov; camera.updateProjectionMatrix();
  HOME.target.set(0, 0.95, 0); HOME.pos.copy(new THREE.Vector3(0.22, 0.14, 1).normalize().multiplyScalar(dist).add(HOME.target));
  if (reset) { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); }
}
frame();

const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4; composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), S.bloomStrength, 0.6, 0.8);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

// sky
const skyU = { top: { value: new THREE.Color('#1b0f3a') }, mid: { value: new THREE.Color('#2b1458') }, bot: { value: new THREE.Color('#07060d') }, glow: { value: new THREE.Color('#5a33b3') } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top,mid,bot,glow; varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(bot,mid,smoothstep(-.25,.2,h)); c=mix(c,top,smoothstep(.15,.9,h)); float g=exp(-pow(length(vec2(vP.x*.8,vP.y-.08))*2.4,2.))*.55; c+=glow*g; gl_FragColor=vec4(c,1.); }' }));
scene.add(sky);
{ const n = 500, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u) * 100; a[i*3] = Math.cos(t) * r; a[i*3+1] = Math.abs(u) * 100 + 4; a[i*3+2] = Math.sin(t) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, color: 0xcfc4ff, fog: false, transparent: true, opacity: 0.8, sizeAttenuation: false, depthWrite: false }))); }

// stage
const stage = new THREE.Group(); scene.add(stage);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.7, 96), new THREE.MeshStandardMaterial({ color: 0x0d0b1b, metalness: 0.6, roughness: 0.3 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; stage.add(floor);
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x07060f, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; stage.add(ground);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false });
const ring = new THREE.Mesh(new THREE.RingGeometry(2.55, 2.7, 128), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; stage.add(ring);
function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.translate(512, 512);
  x.strokeStyle = '#c4b5fd'; x.fillStyle = '#c4b5fd'; x.lineWidth = 3;
  for (const r of [500, 470, 360]) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
  for (let i = 0; i < 96; i++) { x.save(); x.rotate(i / 96 * Math.PI * 2); x.fillRect(-2, -500, 4, i % 4 ? 14 : 30); x.restore(); }
  for (let i = 0; i < 12; i++) { x.save(); x.rotate(i / 12 * Math.PI * 2); x.beginPath(); x.moveTo(0, -468); x.lineTo(-14, -420); x.lineTo(14, -420); x.closePath(); x.fill(); x.restore(); }
  x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * 360, Math.sin(a) * 360); } x.closePath(); x.stroke();
  x.beginPath(); for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * Math.PI * 2 - Math.PI / 2; x.lineTo(Math.cos(a) * 360, Math.sin(a) * 360); } x.closePath(); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const rune = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 5.1), new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false, color: 0x9d7bff }));
rune.rotation.x = -Math.PI / 2; rune.position.y = 0.008; stage.add(rune);

// particles
const PN = 420, pArr = new Float32Array(PN * 3), pSeed = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3);
for (let i = 0; i < PN; i++) { const r = 0.4 + Math.random() * 3.2, t = Math.random() * 6.283;
  pArr[i*3] = Math.cos(t) * r; pArr[i*3+1] = Math.random() * 4; pArr[i*3+2] = Math.sin(t) * r;
  pSeed[i*3] = Math.random() * 6.283; pSeed[i*3+1] = 0.08 + Math.random() * 0.25; pSeed[i*3+2] = 0.2 + Math.random() * 0.6;
  const c = new THREE.Color().setHSL(Math.random() < 0.65 ? 0.74 + Math.random() * 0.06 : 0.5 + Math.random() * 0.05, 0.9, 0.65); pCol.set([c.r, c.g, c.b], i * 3); }
function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.075, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9 }));
particles.frustumCulled = false; scene.add(particles);

// lights
const hemi = new THREE.HemisphereLight(0xa99cff, 0x0b0a14, 0.55); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1e6, 2.2); key.position.set(3, 5.5, 4.5); key.castShadow = true;
key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.5, bottom: -2.5, near: 0.5, far: 20 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
const rimA = new THREE.DirectionalLight(0xff4fd8, 2.0); rimA.position.set(-3.5, 3, -4); scene.add(rimA);
const rimB = new THREE.DirectionalLight(0x22d3ee, 1.7); rimB.position.set(4, 2.5, -3.5); scene.add(rimB);
const fill = new THREE.PointLight(0x8b5cf6, 8, 9, 2); fill.position.set(-1.8, 1.2, 2.6); scene.add(fill);

const BGS = [
  { n: 'Kosmik', top: '#1b0f3a', mid: '#2b1458', bot: '#07060d', glow: '#5a33b3', ring: 0x8b5cf6, fog: 0x0b0a14 },
  { n: 'Neon', top: '#0a1a3a', mid: '#0b3a5a', bot: '#04070d', glow: '#0891b2', ring: 0x22d3ee, fog: 0x050a12 },
  { n: 'Abyss', top: '#2a0a22', mid: '#4a0f3a', bot: '#0a0409', glow: '#be185d', ring: 0xf43f9e, fog: 0x0c0409 },
  { n: 'Studio', top: '#1a1a1f', mid: '#26262d', bot: '#0b0b0e', glow: '#4b4b58', ring: 0xe5e7eb, fog: 0x0b0b0e },
];
function setBG(i) { const b = BGS[i]; S.bg = i; skyU.top.value.set(b.top); skyU.mid.value.set(b.mid); skyU.bot.value.set(b.bot); skyU.glow.value.set(b.glow); ringMat.color.set(b.ring); rune.material.color.set(b.ring); scene.fog.color.set(b.fog); }

// ---------------------------------------------------------------- load model
async function loadGLB(url, onp) {
  const res = await fetch(url); if (!res.ok) throw new Error('GLB ' + res.status);
  const total = +res.headers.get('content-length') || 0, rd = res.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onp(got, total); }
  const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  return { gltf: await new Promise((ok, err) => new GLTFLoader().parse(buf.buffer, '', ok, err)), bytes: got };
}
const KEYS = ['face01', 'body01', 'hair01', 'qunzi01', 'leg_01', 'body02', 'face02', 'hair02'];
const F1 = ['face01', 'body01', 'hair01', 'qunzi01', 'leg_01'], F2 = ['body02', 'face02', 'hair02'];
const byKey = {}, partVis = {}, baseMat = new Map(), basicMat = new Map();
let model, mixer, clips = [], cur = null, paused = false, fileBytes = 0, camNode = null, bind1 = null, bind2 = null, pel1 = null, pel2 = null, faceMesh = null;
const manualW = [];
const clipLabel = { city_idle: 'Idle (lobi)', city_special_idle_01: 'Idle spesial 1', city_special_idle_02: 'Idle spesial 2', city_intercation01: 'Interaksi · ganti bentuk', city_action: 'Aksi sinematik (16 dtk)', loco_walk: 'Jalan (prosedural)', loco_run: 'Lari (prosedural)', loco_sprint: 'Lari cepat (prosedural)', orig_run: 'Lari ASLI (eksperimental)', orig_fastrun: 'Lari cepat ASLI (eksperimental)' };

function findBone(mesh, tail) { const n = s => s.replace(/[ _]/g, ''); return mesh.skeleton.bones.findIndex(b => n(b.name).endsWith(tail)); }
function bindPos(mesh, idx) { return new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[idx].clone().invert()); }

async function init() {
  const lm = $('#lmsg'), bar = $('#bar i');
  const { gltf, bytes } = await loadGLB('/models/selena_zenith_hd.glb', (g, t) => { const p = t ? g / t : 0; bar.style.width = (p * 90) + '%'; lm.textContent = `Memuat model ${(g / 1e6).toFixed(1)}${t ? ' / ' + (t / 1e6).toFixed(1) : ''} MB`; });
  fileBytes = bytes; lm.textContent = 'Menyiapkan rig & material…'; bar.style.width = '95%';
  model = gltf.scene; scene.add(model); clips = gltf.animations;
  try { clips = clips.concat(makeLocomotionClips(THREE, model)); } catch (e) { console.warn('klip prosedural gagal dibuat', e); }
  model.traverse(o => {
    if (o.isSkinnedMesh) {
      const k = KEYS.find(k => o.name.includes(k)); if (!k) return;
      byKey[k] = o; partVis[k] = true; o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      o.bindMode = THREE.DetachedBindMode; o.bindMatrixInverse.copy(o.bindMatrix).invert();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { if (baseMat.has(m)) continue; baseMat.set(m, m); m.envMapIntensity = 1.0;
        if (m.transparent && !m.alphaTest) { m.depthWrite = false; } if (m.map) m.map.anisotropy = 8; }
      if (k === 'qunzi01') o.renderOrder = 3; if (k === 'hair01') o.renderOrder = 2;
    }
  });
  camNode = model.getObjectByName('cam');
  const b1 = byKey.body01, b2 = byKey.body02;
  const i1 = findBone(b1, 'Bip001Pelvis'), i2 = findBone(b2, 'Bip002Pelvis');
  pel1 = b1.skeleton.bones[i1]; pel2 = b2.skeleton.bones[i2]; bind1 = bindPos(b1, i1); bind2 = bindPos(b2, i2);
  faceMesh = byKey.face01; if (faceMesh && faceMesh.morphTargetInfluences) faceMesh.morphTargetInfluences.forEach((_, i) => manualW[i] = 0);
  mixer = new THREE.AnimationMixer(model);
  playClip('city_idle', 0);
  if (new URLSearchParams(location.search).get('exp') === '1') await setExp(true, false);
  applyForm(); buildUI();
  controls.update(); bar.style.width = '100%';
  setTimeout(() => $('#loading').classList.add('done'), 250);
}

// ---------------------------------------------------------------- animation / forms
function playClip(name, fade = 0.35) {
  const clip = clips.find(c => c.name === name); if (!clip) return;
  const next = mixer.clipAction(clip); next.reset().setLoop(THREE.LoopRepeat, Infinity).play(); next.setEffectiveTimeScale(1);
  if (cur && cur !== next) cur.crossFadeTo(next, fade, false); cur = next; cur._name = name; refreshAnimButtons();
}
let expOn = false;
async function setExp(on, rerender = true) {
  if (on) {
    try { const add = await loadOriginalRunClips(THREE, model); clips = clips.filter(c => !c.name.startsWith('orig_')).concat(add); expOn = add.length > 0; }
    catch (e) { console.warn('klip lari asli (eksperimental) gagal dimuat', e); expOn = false; }
  } else {
    if (cur && cur._name && cur._name.startsWith('orig_')) playClip('city_idle');
    clips = clips.filter(c => !c.name.startsWith('orig_')); expOn = false;
  }
  if (rerender) renderTab();
}
function applyForm() {
  const f = S.form;
  for (const k of F1) if (byKey[k]) byKey[k].visible = f !== 'f2' && partVis[k];
  for (const k of F2) if (byKey[k]) byKey[k].visible = f !== 'f1' && partVis[k];
}
const tmp = new THREE.Vector3();
function applyLocks() {
  if (!model) return;
  model.updateMatrixWorld(true);
  const orig = S.form === 'orig' || S.cine;
  let d1 = new THREE.Vector3(), d2 = new THREE.Vector3();
  if (!orig) {
    pel1.getWorldPosition(tmp); if (S.lockXZ) d1.set(bind1.x - tmp.x, 0, bind1.z - tmp.z);
    pel2.getWorldPosition(tmp); d2.set(bind2.x - tmp.x, bind2.y - tmp.y, bind2.z - tmp.z);
    if (S.form === 'both') { d1.x -= 0.85; d2.x += 0.85; }
  }
  for (const k of F1) if (byKey[k]) byKey[k].position.copy(d1);
  for (const k of F2) if (byKey[k]) byKey[k].position.copy(d2);
}
function followCam() {
  if (!S.cine || !camNode) return;
  camNode.updateWorldMatrix(true, false);
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  camNode.matrixWorld.decompose(p, q, s); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  camera.position.copy(p); camera.quaternion.copy(q);
}

// ---------------------------------------------------------------- UI
const TABS = ['Animasi', 'Bentuk', 'Ekspresi', 'Tampilan', 'Info'];
let tab = 0, open = false;
const sheet = $('#sheet'), tabsEl = $('#tabs'), bodyEl = $('#body');
function setSheetH() { document.documentElement.style.setProperty('--sheet-h', (open ? sheet.offsetHeight : 54 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0)) + 'px'); }
function buildUI() {
  tabsEl.innerHTML = '';
  TABS.forEach((t, i) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = t; b.onclick = () => { if (open && tab === i) open = false; else { open = true; tab = i; } sheet.classList.toggle('open', open); renderTab(); setTimeout(setSheetH, 30); setTimeout(setSheetH, 320); }; tabsEl.appendChild(b); });
  renderTab(); setSheetH();
}
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
function slider(label, min, max, step, val, fn, fmt = v => (+v).toFixed(2)) {
  const r = el(`<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}"><span style="min-width:44px;text-align:right;color:#9a95c4">${fmt(val)}</span></div>`);
  const inp = r.querySelector('input'), sp = r.querySelector('span'); inp.oninput = () => { sp.textContent = fmt(inp.value); fn(+inp.value); }; return r;
}
function toggle(label, val, fn) { const r = el(`<div class="row"><label style="flex:1;color:#e9e6ff">${label}</label><input type="checkbox" ${val ? 'checked' : ''}></div>`); r.querySelector('input').onchange = e => fn(e.target.checked); return r; }
function sec(t) { return el(`<div class="sec">${t}</div>`); }
function refreshAnimButtons() { bodyEl.querySelectorAll('[data-clip]').forEach(b => b.classList.toggle('on', cur && b.dataset.clip === cur._name)); }
const EXPR = { faceit_cc_beishang01: 'Sedih 1 (cc)', faceit_cc_beishang02: 'Sedih 2 (cc)', faceit_cc_jingya: 'Kaget (cc)', beishang01: 'Sedih 1', beishang02: 'Sedih 2', jingya: 'Kaget', yangmei: 'Alis naik', weixiao: 'Senyum', teshudaiji02: 'Spesial idle', '63_selena_skin10_high_face003': 'Wajah 003' };

function renderTab() {
  [...tabsEl.children].forEach((b, i) => b.classList.toggle('on', open && i === tab));
  bodyEl.innerHTML = '';
  if (!model) return;
  if (tab === 0) {
    bodyEl.append(sec('Klip animasi · 5 asli (Unity) + 3 lokomotif prosedural'));
    const g = el('<div class="grid"></div>');
    clips.forEach(c => { const b = el(`<button class="btn" data-clip="${c.name}"><span>${clipLabel[c.name] || c.name}</span><small>${c.duration.toFixed(1)}s</small></button>`); b.onclick = () => playClip(c.name); g.appendChild(b); });
    bodyEl.append(g); refreshAnimButtons();
    bodyEl.append(toggle('Eksperimental: lari ASLI dari file game', expOn, v => setExp(v)));
    bodyEl.append(el('<div class="note">Mode eksperimental: klip <b>run</b> dan <b>fastrun</b> asli dari bundle low-poly (kurva Transform, bukan muscle) diretarget ke rangka HD. Hasil bisa sedikit beda proporsi (tangan ±14 cm). Klip prosedural tetap tersedia sebagai cadangan. Bisa juga dibuka dengan <b>?exp=1</b>.</div>'));
    bodyEl.append(slider('Kecepatan', 0.1, 2, 0.05, S.speed, v => { S.speed = v; if (!paused) mixer.timeScale = v; }, v => (+v).toFixed(2) + '×'));
    bodyEl.append(toggle('Kunci posisi (tanpa root motion)', S.lockXZ, v => S.lockXZ = v));
    bodyEl.append(toggle('Kamera game (sinematik)', S.cine, v => { S.cine = v; controls.enabled = !v; if (!v) { frame(); } else { S.form = 'orig'; applyForm(); } }));
    bodyEl.append(el('<div class="note">Kamera game memakai node <b>cam</b> dari klip. Mode ini menampilkan kedua bentuk sesuai aslinya (saling bertukar posisi saat klip Interaksi/Aksi).</div>'));
  } else if (tab === 1) {
    bodyEl.append(sec('Bentuk karakter'));
    const g = el('<div class="grid"></div>');
    [['f1', 'Selena (bentuk 1)'], ['f2', 'Abyss / evilgirl (bentuk 2)'], ['both', 'Berdampingan'], ['orig', 'Asli (tanpa kunci)']].forEach(([id, n]) => { const b = el(`<button class="btn ${S.form === id ? 'on' : ''}">${n}</button>`); b.onclick = () => { S.form = id; if (S.cine) { S.cine = false; controls.enabled = true; } applyForm(); frame(); renderTab(); }; g.appendChild(b); });
    bodyEl.append(g);
    bodyEl.append(el('<div class="note">Model punya dua rangka (Bip001 &amp; Bip002). Di game, animasi menyembunyikan salah satu bentuk di bawah tanah; di sini posisi pelvis dikunci supaya bentuk 2 tampil berdiri.</div>'));
    bodyEl.append(sec('Bagian mesh'));
    KEYS.forEach(k => { if (!byKey[k]) return; const g2 = byKey[k].geometry; bodyEl.append(toggle(`${k} <small style="color:#9a95c4">· ${g2.attributes.position.count.toLocaleString()} vtx</small>`, partVis[k], v => { partVis[k] = v; applyForm(); })); });
  } else if (tab === 2) {
    bodyEl.append(sec('Blendshape wajah (face01)'));
    bodyEl.append(toggle('Atur manual (matikan ekspresi animasi)', S.manual, v => S.manual = v));
    const names = Object.keys(faceMesh.morphTargetDictionary || {});
    names.forEach(n => { const i = faceMesh.morphTargetDictionary[n]; bodyEl.append(slider(EXPR[n] || n, 0, 1, 0.01, manualW[i] || 0, v => { manualW[i] = v; if (!S.manual) { S.manual = true; renderTab(); } })); });
    bodyEl.append(el('<div class="note">Ekspresi asli diputar oleh klip (kurva blendShape.* dari Unity).</div>'));
  } else if (tab === 3) {
    bodyEl.append(sec('Gambar'));
    bodyEl.append(toggle('Bloom', S.bloom, v => S.bloom = v)); bodyEl.append(slider('Kekuatan bloom', 0, 1.5, 0.05, S.bloomStrength, v => bloomPass.strength = S.bloomStrength = v));
    bodyEl.append(slider('Eksposur', 0.4, 2, 0.05, S.exposure, v => renderer.toneMappingExposure = S.exposure = v));
    bodyEl.append(slider('Cahaya lingkungan', 0, 2, 0.05, scene.environmentIntensity, v => scene.environmentIntensity = v));
    bodyEl.append(slider('FOV kamera', 15, 70, 1, S.fov, v => { S.fov = v; if (!S.cine) { camera.fov = v; camera.updateProjectionMatrix(); } }, v => v + '°'));
    bodyEl.append(sec('Adegan'));
    bodyEl.append(toggle('Bayangan', S.shadows, v => { S.shadows = v; key.castShadow = v; }));
    bodyEl.append(toggle('Partikel', S.particles, v => { S.particles = v; particles.visible = v; }));
    bodyEl.append(toggle('Putar otomatis', S.autorotate, v => controls.autoRotate = S.autorotate = v));
    const sw = el('<div class="swatch"></div>'); BGS.forEach((b, i) => { const s = el(`<i title="${b.n}" class="${S.bg === i ? 'on' : ''}" style="background:linear-gradient(135deg,${b.top},${b.glow})"></i>`); s.onclick = () => { setBG(i); renderTab(); }; sw.appendChild(s); });
    bodyEl.append(el('<div class="row"><label>Latar</label></div>')); bodyEl.append(sw);
    bodyEl.append(sec('Material'));
    const g = el('<div class="grid"></div>');
    [['pbr', 'PBR penuh'], ['basic', 'Warna dasar']].forEach(([id, n]) => { const b = el(`<button class="btn ${S.mode === id ? 'on' : ''}">${n}</button>`); b.onclick = () => { setMode(id); renderTab(); }; g.appendChild(b); });
    bodyEl.append(g); bodyEl.append(toggle('Wireframe', S.wire, v => setWire(v)));
    bodyEl.append(sec('Kualitas render'));
    const q = el('<div class="grid"></div>'); [['Hemat (1×)', 1], ['Normal (1.5×)', 1.5], ['Tinggi (2×)', 2], ['Maks (3×)', 3]].forEach(([n, v]) => { const b = el(`<button class="btn ${Math.abs(S.pr - v) < 0.01 ? 'on' : ''}">${n}</button>`); b.onclick = () => { setPR(v); renderTab(); }; q.appendChild(b); }); bodyEl.append(q);
    const r = el('<div class="grid"><button class="btn">Reset kamera</button></div>'); r.firstChild.onclick = () => { S.cine = false; controls.enabled = true; frame(); renderTab(); }; bodyEl.append(r);
  } else {
    let verts = 0, tris = 0, bones = 0; const mats = new Set(), texs = new Set();
    model.traverse(o => { if (o.isBone) bones++; if (o.isSkinnedMesh) { verts += o.geometry.attributes.position.count; tris += o.geometry.index.count / 3; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { mats.add(m); ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(k => m[k] && texs.add(m[k])); }); } });
    bodyEl.append(sec('Hasil decode'));
    bodyEl.append(el(`<div class="kv"><b>Sumber</b><span>Selena Zenith – Default + Logo</span><b>Unity</b><span>2019.4.33f1 (UnityFS)</span><b>Mesh skinned</b><span>${Object.keys(byKey).length}</span><b>Vertex</b><span>${verts.toLocaleString()}</span><b>Segitiga</b><span>${Math.round(tris).toLocaleString()}</span><b>Tulang</b><span>${bones}</span><b>Material</b><span>${mats.size}</span><b>Tekstur</b><span>${texs.size}</span><b>Blendshape</b><span>${Object.keys(faceMesh.morphTargetDictionary || {}).length}</span><b>Animasi</b><span>${clips.length} klip</span><b>Ukuran GLB</b><span>${(fileBytes / 1e6).toFixed(1)} MB</span></div>`));
    bodyEl.append(el('<div class="note" style="margin-top:12px">File: <a style="color:#a78bfa" href="/models/selena_zenith_hd.glb">selena_zenith_hd.glb</a> (bisa dibuka di Blender). Semua tekstur, ikon, mesh efek &amp; audio ada di <a style="color:#a78bfa" href="/gallery.html">Galeri aset</a>.</div>'));
    bodyEl.append(el('<div class="note">Klip in-game asli (attack, skill, run) memakai Mecanim muscle di model low-poly, jadi tidak ikut diekspor. Yang diputar di sini: 5 klip lobi asli + 3 klip lokomotif prosedural (jalan, lari, lari cepat) yang dihitung dari rangka, bukan dari data game.</div>'));
  }
}
function setMode(m) {
  S.mode = m;
  for (const k of KEYS) { const o = byKey[k]; if (!o) continue; const base = baseMat.get(Array.isArray(o.material) ? o.material[0] : o.material) ? null : null; }
  for (const k of KEYS) { const o = byKey[k]; if (!o) continue;
    if (!o.userData.orig) o.userData.orig = o.material;
    if (m === 'pbr') o.material = o.userData.orig;
    else { const om = o.userData.orig; if (!basicMat.has(om)) basicMat.set(om, new THREE.MeshBasicMaterial({ map: om.map, transparent: om.transparent, alphaTest: om.alphaTest, side: om.side, depthWrite: om.depthWrite })); o.material = basicMat.get(om); }
    o.material.wireframe = S.wire; }
}
function setWire(v) { S.wire = v; for (const k of KEYS) if (byKey[k]) byKey[k].material.wireframe = v; for (const m of baseMat.keys()) m.wireframe = v; for (const m of basicMat.values()) m.wireframe = v; }
function setPR(v) { S.pr = v; renderer.setPixelRatio(v); composer.setPixelRatio(v); resize(); }

// ---------------------------------------------------------------- controls / hud
$('#play').onclick = () => { paused = !paused; mixer.timeScale = paused ? 0 : S.speed; $('#play').textContent = paused ? '▶' : '⏸'; };
let scrubbing = false; const scrub = $('#scrub');
scrub.addEventListener('pointerdown', () => scrubbing = true); scrub.addEventListener('pointerup', () => scrubbing = false);
scrub.oninput = () => { if (!cur) return; const d = cur.getClip().duration; cur.time = (scrub.value / 1000) * d; mixer.update(0); };
$('#shot').onclick = () => { composer.render(); canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'selena-zenith.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); };
function resize() { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloomPass.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); setSheetH(); }
addEventListener('resize', resize);
let startX = 0; canvas.addEventListener('pointerdown', () => { if (open) { open = false; sheet.classList.remove('open'); renderTab(); setTimeout(setSheetH, 30); } });

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let fpsT = 0, fpsN = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  if (mixer) {
    mixer.update(dt);
    if (S.manual && faceMesh && faceMesh.morphTargetInfluences) manualW.forEach((w, i) => faceMesh.morphTargetInfluences[i] = w);
    applyLocks();
    if (cur && !scrubbing) { const d = cur.getClip().duration; scrub.value = Math.round((cur.time % d) / d * 1000); $('#time').textContent = `${(cur.time % d).toFixed(1)} / ${d.toFixed(1)} s`; }
  }
  if (S.cine) followCam(); else controls.update();
  rune.rotation.z = t * 0.12; ring.material.opacity = 0.8 + Math.sin(t * 2) * 0.15; fill.intensity = 7 + Math.sin(t * 1.3) * 2;
  if (S.particles) { for (let i = 0; i < PN; i++) { const s = pSeed[i * 3 + 1]; pArr[i*3+1] += s * dt; if (pArr[i*3+1] > 4.2) pArr[i*3+1] = 0;
      pArr[i*3] += Math.sin(t * pSeed[i*3+2] + pSeed[i*3]) * dt * 0.05; pArr[i*3+2] += Math.cos(t * pSeed[i*3+2] + pSeed[i*3]) * dt * 0.05; } pGeo.attributes.position.needsUpdate = true; }
  bloomPass.enabled = S.bloom;
  composer.render();
  fpsN++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(fpsN / fpsT) + ' fps'; fpsT = fpsN = 0; }
}
loop();
init().catch(e => { console.error(e); $('#lmsg').textContent = 'Gagal: ' + e.message; $('#lmsg').style.color = '#f87171'; });
window.__app = { S, scene, camera, get model() { return model; }, byKey };
