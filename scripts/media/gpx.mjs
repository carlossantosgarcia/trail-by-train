// GPX animation: open a track, the map flies to it, scrub the elevation profile.
// Writes numbered PNG frames to $OUT/frames.
import { open, loadApp, sleep, Recorder, OUT, REPO } from './lib.mjs';

const W = 1280, H = 760;
const GPX = REPO + '/test_data/saou_25.6_980_810.gpx';

const ctx = await open({ width: W, height: H });
const { page } = ctx;
await loadApp(page, { basemap: 'Topo' });

// Set-up, not recorded: start over the Diois, a short flight from the track.
await page.click('input[type=search]');
await page.keyboard.type('Die');
await sleep(1500);
await page.click('[aria-label="Résultats de recherche"] button');
await sleep(4000);
const quit = await page.$('button[aria-label="Quitter"]');
if (quit) await quit.click();
await sleep(500);
for (let i = 0; i < 2; i++) {
  await page.mouse.move(W * 0.5, H * 0.5);
  await page.mouse.wheel({ deltaY: 300 });
  await sleep(900);
}
await page.mouse.move(W * 0.6, H * 0.6);
await sleep(3000);

const pick = await (await page.$('button[aria-label="Open GPX file"]')).boundingBox();

/** The elevation chart: the widest svg/canvas in the bottom half. */
async function profileBox() {
  return page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('svg, canvas')) {
      const r = el.getBoundingClientRect();
      if (r.width > 300 && r.height > 60 && r.top > window.innerHeight * 0.5 && (!best || r.width * r.height > best.w * best.h))
        best = { x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best;
  });
}

const rec = new Recorder(ctx, OUT + '/frames');
await rec.start(W * 0.6, H * 0.62);
await rec.hold(0.5);
await rec.moveTo(pick.x + pick.width * 0.5, pick.y + pick.height / 2, 1.0);
await rec.hold(0.15);
const chooser = page.waitForFileChooser();
await rec.click();
await (await chooser).accept([GPX]);
// Parsing runs in real time while the virtual clock holds the picture still.
for (let i = 0; i < 40; i++) {
  await sleep(250);
  if (await profileBox()) break;
}
await rec.hold(2.0);
const p = await profileBox();
if (!p) throw new Error('elevation profile did not appear');
const y = p.y + p.h * 0.55;
await rec.moveTo(p.x + p.w * 0.04, y, 1.0);
// Scrub along the profile, easing in and out.
const n = Math.round(4.5 * 30);
for (let i = 1; i <= n; i++) {
  const t = i / n;
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  rec.x = p.x + p.w * (0.04 + 0.9 * e);
  rec.y = y;
  await page.mouse.move(rec.x, rec.y);
  await rec.frame();
}
await rec.hold(1.8);
console.log('gpx: frames', rec.n);
await ctx.browser.close();
