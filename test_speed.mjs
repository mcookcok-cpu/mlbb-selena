import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 320, height: 200 } });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; });
await p.goto('http://127.0.0.1:6070/'); await p.waitForSelector('#start', { state: 'visible', timeout: 150000 });
const r = await p.evaluate(() => {
  const g = __game, T = g.THREE, m = g.model, out = {};
  const L = m.getObjectByName('Bip001_L_Foot'), R = m.getObjectByName('Bip001_R_Foot');
  for (const name of ['run', 'fastrun']) {
    const a = g.actions[name]; a.reset().play(); a.paused = true; a.enabled = true; a.setEffectiveWeight(1);
    const dur = a.getClip().duration, N = 240; out[name] = { dur: +dur.toFixed(3) };
    const data = { L: [], R: [] };
    for (let i = 0; i < N; i++) { a.time = dur * i / N; a.getMixer().update(0); m.updateMatrixWorld(true); const pz = new T.Vector3(); g.pel.getWorldPosition(pz); m.worldToLocal(pz);
      for (const [k, f] of [['L', L], ['R', R]]) { const v = new T.Vector3(); f.getWorldPosition(v); m.worldToLocal(v); data[k].push([i / N * dur, v.z - pz.z, v.y]); } }
    for (const th of [0.04, 0.08, 0.12]) {
      const vs = [];
      for (const k of ['L', 'R']) {
        const d = data[k], ymin = Math.min(...d.map(x => x[2])), c = d.filter(x => x[2] < ymin + th);
        if (c.length < 4) continue; const n = c.length, mt = c.reduce((s, x) => s + x[0], 0) / n, mz = c.reduce((s, x) => s + x[1], 0) / n;
        let num = 0, den = 0; for (const x of c) { num += (x[0] - mt) * (x[1] - mz); den += (x[0] - mt) ** 2; }
        vs.push(+(-num / den).toFixed(2));
      }
      out[name]['v@' + th] = vs;
    }
    a.stop();
  }
  return out;
});
console.log(JSON.stringify(r)); await b.close();
