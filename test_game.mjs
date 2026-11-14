import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 480, height: 300 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 200)); });
p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; });
await p.goto('http://127.0.0.1:6070/');
await p.waitForSelector('#start', { state: 'visible', timeout: 150000 });
const adv = s => p.evaluate(s => { for (let i = 0; i < Math.round(s * 60); i++) __game.step(1 / 60); }, s);
const st = () => p.evaluate(() => ({ s: __game.P.state, x: +__game.P.pos.x.toFixed(2), z: +__game.P.pos.z.toFixed(2), y: +__game.P.pos.y.toFixed(2), hp: __game.P.hp, wave: __game.G.wave, score: __game.G.score, en: __game.enemies.length }));
// kecepatan lari tanpa meluncur: kaki tumpu = kaki yang rendah (kontak tanah); v = jarak mundur kaki / lama kontak
const sp = await p.evaluate(() => {
  const g = __game, T = g.THREE, m = g.model, out = {};
  const L = m.getObjectByName('Bip001_L_Foot'), R = m.getObjectByName('Bip001_R_Foot'); if (!L || !R) return 'foot tidak ketemu';
  for (const name of ['run', 'fastrun']) {
    const a = g.actions[name]; a.reset().play(); a.paused = true; a.enabled = true; a.setEffectiveWeight(1);
    const dur = a.getClip().duration, N = 120, res = [];
    for (const [k, f] of [['L', L], ['R', R]]) {
      const zs = [], ys = [];
      for (let i = 0; i < N; i++) { a.time = dur * i / N; a.getMixer().update(0); m.updateMatrixWorld(true); const pz = new T.Vector3(); g.pel.getWorldPosition(pz); m.worldToLocal(pz); const v = new T.Vector3(); f.getWorldPosition(v); m.worldToLocal(v); zs.push(v.z - pz.z); ys.push(v.y); }
      const ymin = Math.min(...ys), thr = ymin + 0.07, idx = ys.map((y, i) => y < thr ? i : -1).filter(i => i >= 0);
      // kontak berurutan (tangani lilitan siklus)
      const c = idx.length ? idx : [0]; let a0 = c[0], a1 = c[c.length - 1];
      for (let i = 1; i < c.length; i++) if (c[i] - c[i - 1] > 1) { a0 = c[i]; a1 = c[i - 1] + N; break; }
      const z0 = zs[a0 % N], z1 = zs[a1 % N], tc = (a1 - a0) / N * dur;
      res.push({ k, kontak_dtk: +tc.toFixed(2), jarak: +(z0 - z1).toFixed(2), v: +((z0 - z1) / tc).toFixed(2) });
    }
    out[name] = res; a.stop();
  }
  return out;
});
console.log('kecepatan tanpa meluncur:', JSON.stringify(sp));
await p.click('#start'); await adv(0.1); console.log('awal:', JSON.stringify(await st()));
await adv(2.2); console.log('setelah birth:', JSON.stringify(await st()));
await p.keyboard.down('KeyW'); await adv(1.2); console.log('lari W 1,2 dtk:', JSON.stringify(await st()));
await p.keyboard.down('ShiftLeft'); await adv(1.0); console.log('+Shift 1 dtk:', JSON.stringify(await st()));
await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW'); await adv(0.6);
await p.keyboard.press('Space'); await adv(0.25); console.log('lompat:', JSON.stringify(await st())); await adv(1.0); console.log('mendarat:', JSON.stringify(await st()));
await adv(2.5); console.log('gelombang jalan:', JSON.stringify(await st()));
await p.keyboard.press('KeyJ'); await adv(0.2); console.log('serang:', JSON.stringify(await st()));
await adv(1.3);
for (let i = 0; i < 12 && (await st()).en > 0; i++) {
  await p.evaluate(() => { __game.P.hp = 100; let k = 0; for (const e of __game.enemies) { e.m.position.set(__game.P.pos.x + Math.sin(__game.P.yaw) * 1.6 + (k++ % 3) * 0.3, 1.1, __game.P.pos.z + Math.cos(__game.P.yaw) * 1.6); } });
  await p.keyboard.press('KeyJ'); await adv(0.7); await p.keyboard.press('KeyJ'); await adv(1.6);
}
console.log('setelah kombo serang:', JSON.stringify(await st()));
await p.keyboard.press('KeyE'); await adv(0.9); console.log('E (dash):', JSON.stringify(await st())); await adv(1.5);
await p.keyboard.press('KeyB'); await adv(0.6); console.log('recall mulai:', JSON.stringify(await st()));
await adv(5.2); console.log('recall selesai:', JSON.stringify(await st()));
await adv(2.5);
await p.evaluate(() => { __game.P.hp = 1; __game.enemies.forEach(e => e.m.position.set(__game.P.pos.x + 0.8, 1.1, __game.P.pos.z)); });
await adv(1.5); console.log('mati:', JSON.stringify(await st()));
await adv(4.5); console.log('respawn:', JSON.stringify(await st()));
await adv(2); console.log('setelah respawn:', JSON.stringify(await st()));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'tidak ada');
await b.close();
