import { chromium } from 'playwright-core';
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 390, height: 780 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.addInitScript(() => { window.__manual = true; window.__norender = true; localStorage.clear(); });
await p.goto('http://127.0.0.1:6070/'); await p.waitForSelector('#menu.on', { timeout: 150000 });
const adv = s => p.evaluate(s => { for (let i = 0; i < Math.round(s * 60); i++) __game.step(1 / 60); }, s);
const st = () => p.evaluate(() => { const S = __game.S, V = __game.SV; return { s: S.state, stage: S.stage, lane: S.lane, py: +S.py.toFixed(2), v: +S.speed.toFixed(1), dist: Math.floor(S.dist), score: Math.floor(S.score), coins: S.coins, stumbleT: +S.stumbleT.toFixed(1), inv: +S.inv.toFixed(1), board: +S.board.toFixed(1), pu: Object.fromEntries(Object.entries(S.pu).map(([k, v]) => [k, +v.toFixed(1)])), keys: V.keys, boards: V.boards, mult: V.mult }; });
const ok = (n, c, x = '') => console.log((c ? 'OK   ' : 'GAGAL') + ' ' + n + (x ? ' -> ' + x : ''));
const vis = id => p.evaluate(id => document.getElementById(id).classList.contains('on'), id);
const startRun = async () => { await p.evaluate(() => { const S = __game.S; if (S.state === 'menu') document.getElementById('m-play').click(); else document.getElementById('o-again').click(); }); await adv(2.3); };
const clear = () => p.evaluate(() => { __game.obs.length = 0; });

ok('menu tampil', await vis('menu'), await p.evaluate(() => document.getElementById('m-wallet').textContent));
ok('3 misi', await p.evaluate(() => __game.SV.missions.length === 3), await p.evaluate(() => __game.SV.missions.map(m => m.k + ':' + m.target).join(' ')));
await startRun(); let s = await st(); ok('mulai lari', s.s === 'run', JSON.stringify(s));

// 1. tersandung lalu tertangkap
await p.evaluate(() => { __game.addObs('low', 0, -6); __game.addObs('low', 0, -40); });
await adv(0.6); s = await st(); ok('rintangan pertama = tersandung, belum mati', s.s === 'run' && s.stumbleT > 3, JSON.stringify({ stumbleT: s.stumbleT, inv: s.inv, v: s.v }));
ok('pengejar terlihat', await p.evaluate(() => __game.S.chaserZ < 6.8));
await adv(2.6); s = await st(); ok('rintangan kedua dalam 4 dtk = tertangkap', s.s === 'dead', JSON.stringify(s));
await adv(1.0); ok('panel revive muncul (punya kunci)', await vis('revive'), await p.evaluate(() => document.getElementById('rev-cost').textContent));
await p.evaluate(() => document.getElementById('rev-yes').click()); s = await st(); ok('revive: kembali lari, kunci berkurang', s.s === 'run' && s.keys === 2 && s.inv > 2, JSON.stringify({ keys: s.keys, inv: s.inv }));
// 2. tabrak balok dari depan = langsung tertangkap
await clear(); await adv(2.7); await p.evaluate(() => __game.addObs('block', 0, -8, 6)); await adv(1.0); s = await st(); ok('balok dari depan = langsung mati', s.s === 'dead', JSON.stringify(s));
await adv(1.0); ok('revive kedua minta 2 kunci', await p.evaluate(() => /Biaya 2 kunci/.test(document.getElementById('rev-cost').textContent)), await p.evaluate(() => document.getElementById('rev-cost').textContent));
await p.evaluate(() => document.getElementById('rev-no').click()); ok('selesai: panel hasil muncul', await vis('over'), await p.evaluate(() => document.getElementById('o-line').textContent));
// 3. papan
await startRun(); await p.keyboard.press('KeyH'); await adv(0.1); s = await st(); ok('papan aktif, stok berkurang', s.board > 14 && s.boards === 1, JSON.stringify({ board: s.board, boards: s.boards }));
await p.evaluate(() => __game.addObs('low', 0, -6)); await adv(0.8); s = await st(); ok('papan menyerap satu tabrakan', s.s === 'run' && s.board === 0 && s.stumbleT === 0, JSON.stringify({ board: s.board, stumbleT: s.stumbleT, inv: s.inv }));
// 4. power-up
await clear(); await adv(2); await p.evaluate(() => __game.addPickup('x2', 0, -1)); await adv(0.3); s = await st(); ok('ambil x2', s.pu.x2 > 7, JSON.stringify(s.pu));
const sc0 = (await st()).score; await adv(1); const sc1 = (await st()).score; await p.evaluate(() => { __game.S.pu.x2 = 0; }); await adv(0.1); const a0 = (await st()).score; await adv(1); const a1 = (await st()).score;
ok('skor x2 sekitar dua kali lipat', (sc1 - sc0) / (a1 - a0) > 1.7, ((sc1 - sc0) / (a1 - a0)).toFixed(2));
await p.evaluate(() => { __game.addPickup('magnet', 0, -1); __game.addCoin(-2.4, 1.0, -9); __game.addCoin(2.4, 1.0, -11); }); await adv(0.3); const c0 = (await st()).coins; await adv(1.2); s = await st(); ok('magnet menarik koin dari jalur lain', s.pu.magnet > 5 && s.coins - c0 >= 2, JSON.stringify({ magnet: s.pu.magnet, koin: s.coins - c0 }));
await p.evaluate(() => { __game.S.pu.magnet = 0; __game.addPickup('sneak', 0, -1); }); await adv(0.3); let maxPy = 0; await p.keyboard.press('Space'); for (let i = 0; i < 70; i++) { await adv(1 / 60); maxPy = Math.max(maxPy, (await st()).py); } ok('sepatu: lompat jauh lebih tinggi', maxPy > 3.0, 'tinggi puncak ' + maxPy + ' m (normal 1.73)');
await adv(1); await clear(); await p.evaluate(() => { __game.addPickup('jet', 0, -1); }); await adv(0.3); const ncoin = await p.evaluate(() => __game.coins.length); await adv(1.5); s = await st(); ok('jetpack terbang & jejak koin', s.py > 3.5 && ncoin > 15, JSON.stringify({ py: s.py, koinJejak: ncoin }));
await p.evaluate(() => __game.addObs('block', 0, -10, 6)); await adv(2.5); s = await st(); ok('terbang melewati balok tanpa mati', s.s === 'run', JSON.stringify({ s: s.s, py: s.py, coins: s.coins }));
await adv(5); s = await st(); ok('jetpack habis lalu mendarat, kebal sesaat', s.s === 'run' && s.py < 0.2 && s.pu.jet === 0, JSON.stringify({ py: s.py, inv: s.inv }));
// 5. misi & pengali
const m0 = await p.evaluate(() => __game.SV.mult); await p.evaluate(() => { for (const m of __game.SV.missions) { m.p = m.target - 1; } }); await p.evaluate(() => { __game.S.dist = 1e6; __game.S.score = 1e9; for (const m of __game.SV.missions) if (!m.done) { /* pancing lewat aksi nyata */ } });
for (const k of ['lane', 'jump', 'roll', 'coins', 'power', 'dist', 'score']) { /* tidak perlu: mission kind acak */ }
await clear(); await p.evaluate(() => { __game.addPickup('x2', 0, -1); __game.addCoin(0, 1, -1); }); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowRight'); await adv(0.2); await p.keyboard.press('Space'); await adv(0.9); await p.keyboard.press('ArrowDown'); await adv(0.5); await adv(0.5);
s = await st(); const m1 = await p.evaluate(() => ({ mult: __game.SV.mult, sets: __game.SV.sets, keys: __game.SV.keys, boards: __game.SV.boards, ms: __game.SV.missions.map(m => m.k + ' ' + m.p + '/' + m.target + (m.done ? ' ok' : '')).join(' | ') }));
ok('set misi selesai -> pengali naik', m1.mult === m0 + 1, JSON.stringify(m1));
// 6. jeda
await p.keyboard.press('KeyP'); ok('jeda: panel tampil', await vis('pausep')); const d0 = (await st()).dist; await adv(1); ok('jeda: dunia berhenti', (await st()).dist === d0);
await p.evaluate(() => document.getElementById('p-resume').click()); await adv(0.5); ok('lanjut: dunia jalan lagi', (await st()).dist > d0);
// 7. simpan data
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('surf_save2'))); ok('data tersimpan', saved && saved.mult === m1.mult, JSON.stringify({ mult: saved.mult, keys: saved.keys, coins: saved.coins }));
// 8. menu dan hasil
await p.evaluate(() => document.getElementById('p-menu') && __game.showMenu()); ok('kembali ke menu', await vis('menu'));
console.log('ERRORS:', errs.length ? errs.join('\n') : 'tidak ada'); await b.close();
