import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1 });
const errs = []; p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text().slice(0, 220)); }); p.on('pageerror', e => errs.push('PAGEERR: ' + e.message.slice(0, 300)));
const t0 = Date.now();
await p.goto('http://localhost:2600/', { waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 150000 }); console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's'); }
catch (e) { console.log('TIMEOUT loading; msg =', await p.textContent('#lmsg')); }
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/s1_f1.png' });
const info = await p.evaluate(() => { const a = window.__app; if (!a || !a.model) return null; const r = {}; for (const k in a.byKey) { const o = a.byKey[k]; r[k] = { vis: o.visible, pos: o.position.toArray().map(x => +x.toFixed(2)) }; } return { fov: a.camera.fov, parts: r }; });
console.log(JSON.stringify(info));
// forms
for (const [name, label] of [['f2', 'Abyss'], ['both', 'Berdampingan']]) {
  await p.evaluate(() => { document.querySelectorAll('#tabs .chip')[1].click(); });
  await p.waitForTimeout(400);
  await p.evaluate((l) => { [...document.querySelectorAll('#body .btn')].find(b => b.textContent.includes(l)).click(); }, label);
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('#c').dispatchEvent(new PointerEvent('pointerdown')));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `/tmp/s2_${name}.png` });
}
// action clip
await p.evaluate(() => { document.querySelectorAll('#tabs .chip')[0].click(); });
await p.waitForTimeout(300);
await p.evaluate(() => { [...document.querySelectorAll('#body .btn')].find(b => b.dataset.clip === 'city_intercation01').click(); });
await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector('#c').dispatchEvent(new PointerEvent('pointerdown')));
await p.screenshot({ path: '/tmp/s3_anim.png' });
console.log('ERRORS:', errs.length); errs.slice(0, 12).forEach(e => console.log(' ', e));
await b.close();
