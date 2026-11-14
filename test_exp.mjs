import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 412, height: 860 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 200)); });
p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.goto('http://localhost:2600/?exp=1'); await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 150000 });
await p.waitForTimeout(1500);
// tombol klip eksperimental muncul?
const labels = await p.evaluate(() => { document.querySelectorAll('#tabs .chip')[0].click(); return [...document.querySelectorAll('#body [data-clip]')].map(b => b.dataset.clip); });
console.log('klip di UI:', labels.join(', '));
const res = await p.evaluate(async () => {
  const THREE = await import('three'); const { loadOriginalRunClips } = await import('/runexp.js?v=1');
  const model = window.__app.model; const clips = await loadOriginalRunClips(THREE, model);
  const get = n => model.getObjectByName(n); const v = new THREE.Vector3();
  const names = { pel: 'Bip001_Pelvis', head: 'Bip001_Head', lf: 'Bip001_L_Foot', rf: 'Bip001_R_Foot', lh: 'Bip001_L_Hand', rh: 'Bip001_R_Hand' };
  const out = {};
  for (const c of clips) {
    const mixer = new THREE.AnimationMixer(model); mixer.clipAction(c).play();
    const rows = []; let nan = false;
    for (let i = 0; i < 8; i++) {
      mixer.setTime(c.duration * i / 8); model.updateMatrixWorld(true);
      const r = {}; for (const [k, n] of Object.entries(names)) { get(n).getWorldPosition(v); r[k] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; if (v.toArray().some(Number.isNaN)) nan = true; }
      rows.push(r);
    }
    out[c.name] = { dur: +c.duration.toFixed(3), tracks: c.tracks.length, nan, rows };
  }
  return out;
});
for (const [n, o] of Object.entries(res)) {
  console.log(`\n== ${n} durasi=${o.dur}s track=${o.tracks} NaN=${o.nan}`);
  console.log('fase | pinggul y | kaki L (y,z) | kaki R (y,z) | tangan L z | tangan R z | kepala y');
  o.rows.forEach((r, i) => console.log(`${i}/8 | ${r.pel[1]} | ${r.lf[1]},${r.lf[2]} | ${r.rf[1]},${r.rf[2]} | ${r.lh[2]} | ${r.rh[2]} | ${r.head[1]}`));
}
console.log('\nERRORS/WARN', errs.length ? errs : 'tidak ada');
await b.close();
