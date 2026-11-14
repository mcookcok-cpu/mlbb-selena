import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 360, height: 640 } });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; });
await p.goto('http://127.0.0.1:6070/'); await p.waitForSelector('#start', { state: 'visible', timeout: 150000 }); await p.click('#start');
const res = await p.evaluate(() => {
  const g = __game, S = g.S, out = [];
  for (let run = 0; run < 12; run++) {
    if (S.state === 'dead') { S.t = 2; g.act('jump'); } for (let i = 0; i < 160 && S.state !== 'run'; i++) g.step(1 / 60);
    let cool = 0;
    for (let f = 0; f < 60 * 150 && S.state === 'run'; f++) {
      cool -= 1 / 60; const L = S.speed * 1.1 + 6;
      const blockedBy = l => g.obs.some(o => o.lane === l && o.type === 'block' && o.z - o.hd < 1.2 && o.z + o.hd > -L);
      const load = l => g.obs.filter(o => o.lane === l && o.z + o.hd > -L && o.z - o.hd < 1.2).length;
      if (cool <= 0 && blockedBy(S.lane)) { const cand = [-1, 0, 1].filter(l => !blockedBy(l)).sort((a, b) => Math.abs(a - S.lane) - Math.abs(b - S.lane) || load(a) - load(b)); if (cand.length && cand[0] !== S.lane) { g.act(cand[0] < S.lane ? 'left' : 'right'); cool = 0.14; } }
      for (const o of g.obs) { if (o.lane !== S.lane) continue; const d = -(o.z + o.hd);
        if (o.type === 'low' && d > 0 && d < S.speed * 0.33 && d > S.speed * 0.22 && S.py < 0.01) g.act('jump');
        if (o.type === 'gate' && d > 0 && d < S.speed * 0.2 && S.sliding <= 0 && S.py < 0.01) g.act('slide'); }
      g.step(1 / 60);
    }
    out.push({ jarak: Math.floor(S.dist), sebab: S.state === 'dead' ? S.cause : 'selamat 150 dtk' });
  }
  return out;
});
for (const r of res) console.log(JSON.stringify(r));
await b.close();
