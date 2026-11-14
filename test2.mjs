import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto('http://localhost:2600/'); await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 150000 });
await p.waitForTimeout(1500);
// zoom to face in base-color mode
const shot = async (name, pos, tgt, fov, mode) => {
  await p.evaluate(([pos, tgt, fov, mode]) => { const a = window.__app; a.S.cine = false; const c = a.camera; c.fov = fov; c.updateProjectionMatrix(); c.position.set(...pos); c.lookAt(...tgt); }, [pos, tgt, fov, mode]);
  await p.waitForTimeout(500); await p.screenshot({ path: `/tmp/${name}.png` });
};
await p.evaluate(() => { document.querySelectorAll('#tabs .chip')[3].click(); });
await p.waitForTimeout(300);
await p.evaluate(() => { [...document.querySelectorAll('#body .btn')].find(b => b.textContent.includes('Warna dasar')).click(); document.querySelector('#c').dispatchEvent(new Event('pointerdown')); });
await p.evaluate(() => { window.__app.S.autorotate = false; });
await p.evaluate(() => { const c = document.querySelector('#top'); c.style.display = 'none'; document.querySelector('#hud').style.display = 'none'; document.querySelector('#sheet').style.display = 'none'; });
await shot('face_basic', [0, 1.62, 1.1], [0, 1.62, 0], 28, 'basic');
await shot('full_basic', [0.2, 1.0, 5.2], [0, 0.95, 0], 36, 'basic');
console.log('errs', errs);
await b.close();
