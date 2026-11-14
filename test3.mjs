import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: true });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });
p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
await p.goto('http://localhost:2600/'); await p.waitForFunction(() => document.querySelector('#loading')?.classList.contains('done'), null, { timeout: 150000 });
await p.waitForTimeout(2000);
const tab = async i => { await p.evaluate(i => document.querySelectorAll('#tabs .chip')[i].click(), i); await p.waitForTimeout(450); };
const btn = async t => { await p.evaluate(t => [...document.querySelectorAll('#body .btn')].find(b => b.textContent.includes(t)).click(), t); await p.waitForTimeout(1200); };
const closeSheet = async () => { await p.evaluate(() => document.querySelector('#tabs .chip.on')?.click()); await p.waitForTimeout(500); };
await p.screenshot({ path: '/tmp/t_f1.png' });
await tab(1); await btn('Abyss'); await closeSheet(); await p.screenshot({ path: '/tmp/t_f2.png' });
await tab(1); await btn('Berdampingan'); await closeSheet(); await p.screenshot({ path: '/tmp/t_both.png' });
// expression tab
await tab(2); const nSliders = await p.evaluate(() => document.querySelectorAll('#body input[type=range]').length); console.log('expression sliders:', nSliders);
await p.evaluate(() => { const r = document.querySelectorAll('#body input[type=range]')[0]; r.value = 1; r.dispatchEvent(new Event('input')); });
await p.waitForTimeout(600);
const w = await p.evaluate(() => window.__app.byKey.face01.morphTargetInfluences.map(x => +x.toFixed(2))); console.log('morph weights', JSON.stringify(w));
// cinematic cam
await tab(0); await btn('Aksi sinematik');
await p.evaluate(() => { const el = [...document.querySelectorAll('#body .row')].find(r => r.textContent.includes('Kamera game')); el.querySelector('input').click(); });
const cams = []; for (let i = 0; i < 4; i++) { await p.waitForTimeout(900); cams.push(await p.evaluate(() => { const c = window.__app.camera; return c.position.toArray().map(x => +x.toFixed(2)).join(',') + ' fov' + c.fov; })); }
console.log('cine cam:', cams);
await closeSheet(); await p.screenshot({ path: '/tmp/t_cine.png' });
// gallery
const g = await b.newPage({ viewport: { width: 412, height: 860 } }); g.on('pageerror', e => errs.push('GALLERY ' + e.message));
await g.goto('http://localhost:2600/gallery.html'); await g.waitForSelector('.card', { timeout: 20000 });
console.log('gallery cards', await g.$$eval('.card', e => e.length));
await g.evaluate(() => document.querySelectorAll('#tabs .chip')[3].click()); await g.waitForTimeout(300);
console.log('audio rows', await g.$$eval('audio', e => e.length));
await g.evaluate(() => document.querySelectorAll('#tabs .chip')[2].click()); await g.waitForTimeout(300);
console.log('mesh rows', await g.$$eval('.row', e => e.length));
console.log('ERRORS', errs);
await b.close();
