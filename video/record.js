const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(process.env.HOME, 'Documents/Novosti/video/node_modules/playwright'));
const ROOT = __dirname;
const BASE = 'http://localhost:8090';
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const CREDS = fs.readFileSync(path.join(ROOT, '..', 'deploy', 'demo-access.txt'), 'utf8');
const LOGIN = CREDS.match(/Логин:\s*(\S+)/)[1], PASS = CREDS.match(/Пароль:\s*(\S+)/)[1];
const W = 1600, H = 900, PAD = 0.7;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY = `(() => {
  const mk = () => {
    if (document.getElementById('__cap')) return;
    const st = document.createElement('style');
    st.textContent = '#__cap{position:fixed;left:50%;bottom:44px;transform:translateX(-50%);max-width:1100px;z-index:2147483647;background:rgba(10,30,32,.82);color:#fff;font:600 25px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;padding:12px 22px;border-radius:14px;text-align:center;pointer-events:none;transition:opacity .25s}#__cap:empty{opacity:0}#__cur{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(14,159,154,.35);border:2px solid #0e9f9a;z-index:2147483646;pointer-events:none;transition:left .5s ease,top .5s ease,transform .15s}';
    document.documentElement.appendChild(st);
    const c = document.createElement('div'); c.id = '__cap'; document.documentElement.appendChild(c);
    const k = document.createElement('div'); k.id = '__cur'; k.style.left = '-50px'; k.style.top = '-50px'; document.documentElement.appendChild(k);
    if (window.__capText) c.textContent = window.__capText;
  };
  window.__setCap = (t) => { window.__capText = t; const c = document.getElementById('__cap'); if (c) c.textContent = t; };
  document.addEventListener('DOMContentLoaded', mk); if (document.readyState !== 'loading') mk();
})();`;

const FIX = [[/вотсап/gi, 'WhatsApp'], [/два-гис/gi, '2ГИС'], [/инстаграма/gi, 'Instagram'], [/пятнадцать минут/g, '15 минут']];
function chunks(text) {
  FIX.forEach(([a, b]) => (text = text.replace(a, b)));
  const parts = text.split(/(?<=[.!?:])\s+/);
  const out = [];
  for (const p of parts) {
    if (p.length <= 70) { out.push(p); continue; }
    const words = p.split(' '); let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > 60 && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) out.push(cur);
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(ROOT, 'raw'), size: { width: W, height: H } }, locale: 'ru-RU' });
  await ctx.addInitScript(OVERLAY);
  await ctx.addInitScript(() => { try { localStorage.setItem('diamond_cookie_ok', '1'); localStorage.setItem('diamond_lang', 'ru'); } catch (e) {} });
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const t0 = Date.now();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await sleep(1200);

  let lastCap = '';
  const setCap = (t) => { lastCap = t; return page.evaluate((x) => window.__setCap && window.__setCap(x), t).catch(() => {}); };
  const go = async (u) => { await page.goto(u, { waitUntil: 'load' }); await setCap(lastCap); };
  const cur = async (sel) => {
    const box = await page.locator(sel).first().boundingBox().catch(() => null);
    if (box) await page.evaluate(([x, y]) => { const k = document.getElementById('__cur'); if (k) { k.style.left = x + 'px'; k.style.top = y + 'px'; } }, [box.x + box.width / 2, box.y + box.height / 2]);
    await sleep(550);
  };
  const click = async (sel) => { await cur(sel); await page.locator(sel).first().click(); };
  const scrollTo = (sel, block = 'start') => page.evaluate(([s, b]) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ behavior: 'smooth', block: b }); }, [sel, block]);
  const glide = (dy, ms) => page.evaluate(([dy, ms]) => new Promise((r) => { const y0 = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), [dy, ms]);

  const ACT = {
    hero: async () => { await sleep(2500); await glide(260, 3500); },
    services: async () => { await scrollTo('#services'); await sleep(1500); await glide(500, 4000); },
    doctors: async () => { await scrollTo('#doctors'); await sleep(3200); await scrollTo('#reviewsSec'); await sleep(1500); await glide(250, 2500); },
    lang: async () => { await page.evaluate(() => document.querySelector('[data-lang="kz"]').click()); await sleep(3200); await page.evaluate(() => document.querySelector('[data-lang="ru"]').click()); },
    reels: async () => { await scrollTo('#reels'); await sleep(3500); await scrollTo('#contacts'); },
    book: async () => {
      await scrollTo('#book'); await sleep(1300);
      await click('#bookForm input[name="name"]'); await page.locator('#bookForm input[name="name"]').pressSequentially('Демо', { delay: 90 });
      await click('#phoneInput'); await page.locator('#phoneInput').pressSequentially('7001234567', { delay: 60 });
      await cur('select[name="service"]'); await page.selectOption('select[name="service"]', { index: 2 });
      await click('#whenBtn'); await sleep(900);
      await click('.day:not([disabled]) >> nth=1'); await sleep(900);
      await click('#slots .slot:not([disabled]) >> nth=3'); await sleep(700);
      const closer = page.locator('#whenClose'); if (await closer.isVisible().catch(() => false)) await click('#whenClose');
    },
    submit: async () => {
      await click('#bookForm input[name="consent"]');
      const pop = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
      await click('#bookForm button[type="submit"]');
      const p = await pop; await sleep(1500); if (p) await p.close().catch(() => {});
      await page.bringToFront(); await sleep(400);
    },
    crm: async () => {
      await go(BASE + '/admin');
      await page.fill('#user', LOGIN); await page.fill('#pass', PASS); await click('#loginBtn');
      await page.waitForSelector('#app:not(.hide)'); await sleep(800);
    },
    pipeline: async () => {
      await click('[data-t="pipeline"]'); await sleep(1800);
      const card = page.locator('.kcard').first(); const target = page.locator('.kcol').nth(1);
      await cur('.kcard >> nth=0');
      const a = await card.boundingBox(), b = await target.boundingBox();
      if (a && b) { await page.mouse.move(a.x + 40, a.y + 20); await page.mouse.down(); await page.mouse.move(b.x + 80, b.y + 80, { steps: 25 }); await page.mouse.up(); }
      await sleep(1200);
      await click('.kcard >> nth=2'); await sleep(2500);
      await cur('.wa-tpl a >> nth=1'); await sleep(800);
      await page.locator('.dw-x').first().click({ timeout: 2000 }).catch(() => page.keyboard.press('Escape'));
    },
    stats: async () => { await click('[data-t="stats"]'); await sleep(2500); await glide(450, 3500); },
    edit: async () => { await click('[data-t="services"]'); await sleep(1200); await click('#list .item [data-toggle] >> nth=0'); await sleep(2000); await cur('#list .item.open input >> nth=2'); },
    outro: async () => { await go(BASE + '/'); },
  };

  let clock = (Date.now() - t0) / 1000;
  const marks = [];
  for (const s of T) {
    const start = (Date.now() - t0) / 1000;
    marks.push({ id: s.id, start });
    const span = s.dur + PAD;
    const caps = chunks(s.text); const total = caps.reduce((n, c) => n + c.length, 0);
    let acc = 0;
    const timers = caps.map((c) => { const at = (acc / total) * s.dur * 1000; acc += c.length; return setTimeout(() => setCap(c), at); });
    setCap(caps[0]);
    try { await ACT[s.id](); } catch (e) { console.log('scene', s.id, 'action error:', e.message.split('\n').slice(0, 3).join(' | ')); await page.screenshot({ path: path.join(ROOT, 'err_' + s.id + '.png') }).catch(() => {}); }
    const left = start + span - (Date.now() - t0) / 1000;
    if (left > 0) await sleep(left * 1000); else console.log('scene', s.id, 'overran by', (-left).toFixed(2), 's');
    timers.forEach(clearTimeout);
  }
  await setCap('');
  await sleep(1500);
  const vid = page.video();
  await ctx.close(); await browser.close();
  const file = await vid.path();
  fs.writeFileSync(path.join(ROOT, 'marks.json'), JSON.stringify({ file, marks }, null, 1));
  console.log('video', file);
})();
