import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 360, height: 640 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; });
await p.goto('http://127.0.0.1:6070/'); await p.waitForSelector('#start', { state: 'visible', timeout: 150000 });
const adv = s => p.evaluate(s => { for (let i = 0; i < Math.round(s * 60); i++) __game.step(1 / 60); }, s);
const st = () => p.evaluate(() => { const S = __game.S; return { s: S.state, lane: S.lane, px: +S.px.toFixed(2), py: +S.py.toFixed(2), v: +S.speed.toFixed(1), dist: Math.floor(S.dist), coins: S.coins, obs: __game.obs.length, sl: +S.sliding.toFixed(2) }; });
console.log('klip:', await p.evaluate(() => Object.keys(__game.actions).join(',')));
await p.click('#start'); await adv(0.1); console.log('intro:', JSON.stringify(await st())); await adv(2.0); console.log('mulai lari:', JSON.stringify(await st()));
await p.keyboard.press('ArrowLeft'); await adv(0.3); console.log('kiri:', JSON.stringify(await st()));
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await adv(0.3); console.log('kanan 2x:', JSON.stringify(await st()));
await p.keyboard.press('Space'); await adv(0.3); console.log('lompat:', JSON.stringify(await st())); await adv(0.6);
await p.keyboard.press('ArrowDown'); await adv(0.2); console.log('merunduk:', JSON.stringify(await st())); await adv(0.8);
// bot untuk menguji rintangan adil & bisa dilewati
async function bot(seconds, seed) {
  return await p.evaluate(([seconds]) => {
    const g = __game, S = g.S; let cool = 0, maxDist = 0, jumps = 0, slides = 0, lanesChanged = 0;
    for (let f = 0; f < seconds * 60 && S.state === 'run'; f++) {
      cool -= 1 / 60; const L = S.speed * 1.1 + 6;
      const blockedBy = l => g.obs.some(o => o.lane === l && o.type === 'block' && o.z - o.hd < 1.2 && o.z + o.hd > -L);
      const load = l => g.obs.filter(o => o.lane === l && o.z + o.hd > -L && o.z - o.hd < 1.2).length;
      if (cool <= 0 && blockedBy(S.lane)) {
        const cand = [-1, 0, 1].filter(l => !blockedBy(l)).sort((a, b) => Math.abs(a - S.lane) - Math.abs(b - S.lane) || load(a) - load(b));
        if (cand.length) { const t = cand[0]; if (t !== S.lane) { g.act(t < S.lane ? 'left' : 'right'); cool = 0.14; lanesChanged++; } }
      }
      for (const o of g.obs) {
        if (o.lane !== S.lane) continue; const d = -(o.z + o.hd);
        if (o.type === 'low' && d > 0 && d < S.speed * 0.33 && d > S.speed * 0.22 && S.py < 0.01) { g.act('jump'); jumps++; }
        if (o.type === 'gate' && d > 0 && d < S.speed * 0.2 && S.sliding <= 0 && S.py < 0.01) { g.act('slide'); slides++; }
      }
      g.step(1 / 60);
    }
    return { akhir: S.state, jarak: Math.floor(S.dist), koin: S.coins, kecepatan: +S.speed.toFixed(1), jumps, slides, pindahJalur: lanesChanged };
  }, [seconds]);
}
for (let run = 1; run <= 3; run++) {
  await p.evaluate(() => { const S = __game.S; if (S.state === 'dead') { S.t = 2; __game.act('jump'); } else if (S.state === 'run') { /* reset */ } });
  await adv(2.2);
  console.log('bot #' + run + ':', JSON.stringify(await bot(120)), JSON.stringify(await st()));
  await p.evaluate(() => { const S = __game.S; S.state = 'dead'; S.t = 2; __game.act('jump'); });
}
// uji tabrakan: diam di jalur dengan rintangan -> harus mati
await adv(2.2); await p.evaluate(() => { const S = __game.S; for (let i = 0; i < 60 * 40 && S.state === 'run'; i++) __game.step(1 / 60); }); console.log('diam saja 40 dtk:', JSON.stringify(await st()));
await adv(1.2); console.log('overlay tampil:', await p.evaluate(() => document.querySelector('#over').classList.contains('on')), '| teks:', await p.evaluate(() => document.querySelector('#o-dist').textContent));
await p.keyboard.press('Space'); await adv(0.1); console.log('restart:', JSON.stringify(await st()));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'tidak ada'); await b.close();
