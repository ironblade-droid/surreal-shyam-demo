import { chromium } from '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core/index.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:4180/exterior/';
const OUT = '/workspace/surreal-shyam/qa/shots', TAG = process.env.TAG || 'ext-orbit';
const VPS = [{ name: 'desktop', viewport: { width: 1280, height: 800 }, touch: false }, { name: 'phone', viewport: { width: 390, height: 844 }, touch: true }];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok ' : '  FAIL ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const v of VPS) {
  const ctx = await b.newContext({ viewport: v.viewport, hasTouch: v.touch, isMobile: v.touch, deviceScaleFactor: v.touch ? 3 : 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const bad = []; p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto(BASE, { waitUntil: 'networkidle' }); await sleep(800);
  ok(await p.evaluate(() => document.getElementById('img').complete && document.getElementById('img').naturalWidth > 0), v.name + ' hero image loaded');
  await p.screenshot({ path: `${OUT}/${TAG}-${v.name}-dusk.png` });
  await p.click('#next'); await sleep(900);
  ok((await p.textContent('#cap')).startsWith('Angle 2'), v.name + ' arrow rotates to angle 2');
  await p.click('#bDay'); await p.waitForFunction(() => document.getElementById('img').src.includes('/day/')); await sleep(1200);
  await p.screenshot({ path: `${OUT}/${TAG}-${v.name}-day.png` });
  // tap a flat: find the centre of floor 4 / some visible wing in the mask, then tap there
  const pt = await p.evaluate(() => new Promise(res => { const t0 = Date.now(); (function f() {
    const m = window.__mask && window.__mask(); if (!m) { if (Date.now() - t0 < 5000) return setTimeout(f, 100); return res(null); }
    const want = Object.entries(window.__idmap()).filter(([h, i]) => i.floor === 4).map(([h]) => h);
    const cnt = {}; for (let i = 0; i < m.d.length; i += 4) { if (m.d[i + 3] < 128) continue; const h = '#' + [m.d[i], m.d[i + 1], m.d[i + 2]].map(x => x.toString(16).padStart(2, '0')).join('');
      if (want.includes(h)) { const c = cnt[h] || (cnt[h] = { n: 0, x: 0, y: 0 }); c.n++; c.x += (i / 4) % m.w; c.y += Math.floor(i / 4 / m.w); } }
    const best = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n)[0]; if (!best) return res(null);
    const r = document.getElementById('stage').getBoundingClientRect(), c = best[1];
    res({ h: best[0], x: r.left + (c.x / c.n) / m.w * r.width, y: r.top + (c.y / c.n) / m.h * r.height }); })(); }));
  ok(!!pt, v.name + ' found floor 4 in the ID mask');
  if (pt) {
    if (v.touch) await p.touchscreen.tap(pt.x, pt.y); else await p.mouse.click(pt.x, pt.y);
    await sleep(500);
    const href = await p.getAttribute('#card a.go', 'href').catch(() => null);
    ok(href && /#floor-4\/wing-\d$/.test(href), v.name + ' card links to ' + href);
    await p.screenshot({ path: `${OUT}/${TAG}-${v.name}-tap.png` });
    if (href) { await p.click('#card a.go'); await sleep(2500); ok(/#floor-4\/wing-\d$/.test(p.url()), v.name + ' landed on ' + p.url()); }
  }
  ok(errs.length === 0, v.name + ' no console errors ' + errs.join(' | '));
  ok(bad.filter(u => !/favicon/.test(u)).length === 0, v.name + ' no 4xx ' + bad.join(' '));
  await ctx.close();
}
await b.close(); console.log(fails ? `FAILS ${fails}` : 'ALL OK'); process.exit(fails ? 1 : 0);
