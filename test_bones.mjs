import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 780 } });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; localStorage.clear(); });
await p.goto('http://127.0.0.1:6070/'); await p.waitForSelector('#menu.on', { timeout: 150000 });
await p.evaluate(() => { document.getElementById('m-play').click(); for (let i = 0; i < 200; i++) __game.step(1 / 60); __game.obs.length = 0; });
const r = await p.evaluate(() => {
  const { THREE, model } = __game; model.updateWorldMatrix(true, true);
  const out = { names: [], pos: {} };
  model.traverse(o => { if (o.isBone) { out.names.push(o.name); const n = o.name.toLowerCase(); if (/(toe|foot|head|calf|thigh|spine|pelvis|hip|clavicle)/.test(n) && !/twist|roll/.test(n)) { const v = new THREE.Vector3(); o.getWorldPosition(v); out.pos[o.name] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; } } });
  out.names = out.names.slice(0, 25);
  return out;
});
console.log(JSON.stringify(r.pos, null, 0).replace(/\],/g, '],\n'));
await b.close();
