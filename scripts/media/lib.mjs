// Deterministic screen capture for the README media. See scripts/media/README.md.
//
// The page clock (performance.now, Date.now, requestAnimationFrame) is frozen
// and stepped one frame at a time; after each step we wait for the network to
// settle, then take a screenshot. Playback is therefore smooth however slow
// the machine doing the capture is.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4321/';
export const OUT = process.env.OUT ?? '.';
export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const found = candidates.find((c) => fs.existsSync(c));
  if (!found) throw new Error('No Chrome/Chromium found; set CHROME_PATH.');
  return found;
}

export const FPS = 30;
const DT = 1000 / FPS;

const CLOCK = `(() => {
  const rp = performance.now.bind(performance);
  const rd = Date.now;
  const rRaf = window.requestAnimationFrame.bind(window);
  const rCaf = window.cancelAnimationFrame.bind(window);
  let frozen = false, virt = 0, dateOff = 0, id = 1;
  let q = new Map();
  performance.now = () => (frozen ? virt : rp());
  Date.now = () => (frozen ? Math.round(virt + dateOff) : rd());
  window.requestAnimationFrame = (cb) => {
    if (!frozen) return rRaf(cb);
    const i = 1e9 + id++; q.set(i, cb); return i;
  };
  window.cancelAnimationFrame = (i) => { if (i >= 1e9) q.delete(i); else rCaf(i); };
  const run = () => {
    const cbs = [...q.values()]; q = new Map();
    for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } }
  };
  window.__vc = {
    freeze() { virt = rp(); dateOff = rd() - virt; frozen = true; },
    step(ms) { virt += ms; run(); },
    flush() { run(); },
    pending() { return q.size; },
  };
})();`;

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><path d="M5 2.5v18.2l4.6-4.4 3 6.7 3.3-1.5-3-6.6h6.4z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const OVERLAY = `(() => {
  const c = document.createElement('div');
  c.id = '__cursor';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))';
  c.innerHTML = ${JSON.stringify(CURSOR_SVG)};
  const ring = document.createElement('div');
  ring.id = '__ring';
  ring.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:rgba(37,99,235,.28);border:2px solid rgba(37,99,235,.55);opacity:0;transform:scale(.4)';
  document.body.append(ring, c);
  window.__cur = (x, y) => { c.style.transform = 'translate(' + (x - 5) + 'px,' + (y - 2.5) + 'px)'; };
  window.__ring = (x, y, t) => {
    // t in [0,1]: expanding, fading ring
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    ring.style.opacity = t >= 1 ? 0 : String(0.9 * (1 - t));
    ring.style.transform = 'scale(' + (0.4 + 0.9 * t) + ')';
  };
})();`;

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Launch Chromium on a page of the given size. */
export async function open({ width, height, dpr = 1, mobile = false, storage = {} }) {
  const browser = await puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    // SwiftShader gives MapLibre a WebGL context on headless machines with no GPU.
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.evaluateOnNewDocument(CLOCK);
  // The giant zoom readout is a debugging aid; keep it out of README media.
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '[class*="_readout_"]{display:none!important}';
      document.head.append(st);
    });
  });
  await page.evaluateOnNewDocument((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch {}
  }, storage);
  let inflight = 0;
  page.on('request', () => inflight++);
  page.on('requestfinished', () => inflight--);
  page.on('requestfailed', () => inflight--);
  const cdp = await page.createCDPSession();
  await cdp.send('Animation.enable');
  return { browser, page, cdp, inflight: () => inflight };
}

export class Recorder {
  constructor(ctx, dir) {
    this.ctx = ctx; this.page = ctx.page; this.dir = dir; this.n = 0;
    this.x = -100; this.y = -100; this.ringAt = null; this.down = false;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  async start(x, y) {
    await this.page.evaluate(OVERLAY);
    await this.page.evaluate(() => window.__vc.freeze());
    // CSS transitions run on the real compositor clock; slow them to roughly
    // match capture speed (refined every frame).
    await this.ctx.cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
    this.x = x; this.y = y;
    await this.page.mouse.move(x, y);
  }
  async settle() {
    // Let loaded tiles render without advancing virtual time.
    for (let i = 0; i < 60; i++) {
      await this.page.evaluate(() => window.__vc.flush());
      if (this.ctx.inflight() <= 0 && i >= 1) break;
      await sleep(50);
    }
    await this.page.evaluate(() => window.__vc.flush());
  }
  async frame() {
    const t0 = Date.now();
    await this.page.evaluate((dt) => window.__vc.step(dt), DT);
    await this.settle();
    await this.page.evaluate((x, y) => window.__cur(x, y), this.x, this.y);
    if (this.ringAt) {
      const t = this.ringAt.k / 12;
      await this.page.evaluate((x, y, t) => window.__ring(x, y, t), this.ringAt.x, this.ringAt.y, t);
      this.ringAt.k++;
      if (t >= 1) this.ringAt = null;
    }
    await this.page.screenshot({ path: path.join(this.dir, String(this.n++).padStart(5, '0') + '.png') });
    const real = Date.now() - t0;
    const rate = Math.max(0.01, Math.min(1, DT / real));
    await this.ctx.cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
  }
  async hold(sec) {
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) await this.frame();
  }
  /** Move the cursor along an eased straight line. */
  async moveTo(x, y, sec = 0.8) {
    const n = Math.max(1, Math.round(sec * FPS));
    const x0 = this.x, y0 = this.y;
    // A slight arc reads as a hand, not a robot.
    const mx = (x0 + x) / 2 + (y - y0) * 0.12, my = (y0 + y) / 2 - (x - x0) * 0.12;
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n);
      const u = 1 - t;
      this.x = u * u * x0 + 2 * u * t * mx + t * t * x;
      this.y = u * u * y0 + 2 * u * t * my + t * t * y;
      await this.page.mouse.move(this.x, this.y);
      await this.frame();
    }
  }
  async click() {
    await this.page.mouse.down();
    await this.frame();
    await this.page.mouse.up();
    this.ringAt = { x: this.x, y: this.y, k: 0 };
    await this.frame();
  }
  /** Drag the mouse along a list of points over `sec` seconds (constant speed). */
  async drag(pts, sec) {
    const n = Math.round(sec * FPS);
    // arc-length parametrisation
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = L[L.length - 1];
    const at = (d) => {
      let i = 1;
      while (i < L.length - 1 && L[i] < d) i++;
      const f = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
      return [pts[i - 1][0] + f * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1])];
    };
    this.x = pts[0][0]; this.y = pts[0][1];
    await this.page.mouse.move(this.x, this.y);
    await this.page.mouse.down();
    await this.frame();
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const s = t < 0.08 ? (t / 0.08) ** 2 * 0.04 : t > 0.94 ? 1 - ((1 - t) / 0.06) ** 2 * 0.03 : 0.04 + (t - 0.08) / 0.86 * 0.93;
      const target = s * total;
      // several sub-moves per frame so the lasso gets a dense stroke
      const prev = this._d ?? 0;
      for (let j = 1; j <= 4; j++) {
        const [x, y] = at(prev + ((target - prev) * j) / 4);
        await this.page.mouse.move(x, y);
        this.x = x; this.y = y;
      }
      this._d = target;
      await this.frame();
    }
    this._d = 0;
    await this.page.mouse.up();
    await this.frame();
  }
}

/** Closed Catmull-Rom spline through control points, sampled densely. */
export function smoothLoop(ctrl, perSeg = 24) {
  const out = [];
  const n = ctrl.length;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // overshoot slightly past the start so the loop closes naturally
  out.push(...out.slice(0, 3));
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Load the app and switch basemap if asked. */
export async function loadApp(page, { basemap } = {}) {
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(1500);
  if (basemap) await clickText(page, 'button', basemap);
  await sleep(800);
}

/** Click the first element matching `sel` whose text is `text` (string or RegExp). */
export async function clickText(page, sel, text, { tap = false } = {}) {
  for (const el of await page.$$(sel)) {
    const t = (await el.evaluate((e) => e.innerText)).trim();
    if (text instanceof RegExp ? text.test(t) : t === text) {
      tap ? await el.tap() : await el.click();
      return true;
    }
  }
  return false;
}
