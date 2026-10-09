// Hero animation: draw a zone around Die and get its buses, stations and hike.
// Writes numbered PNG frames to $OUT/frames.
import { open, loadApp, sleep, Recorder, smoothLoop, OUT } from './lib.mjs';

const W = 1280, H = 760;
const ctx = await open({ width: W, height: H });
const { page } = ctx;
await loadApp(page, { basemap: 'Topo' });

// Set-up, not recorded: jump to Die through search. Picking a place opens
// "explore around a point", which we leave straight away.
await page.click('input[type=search]');
await page.keyboard.type('Die');
await sleep(1500);
await page.click('[aria-label="Résultats de recherche"] button');
await sleep(4000);
const quit = await page.$('button[aria-label="Quitter"]');
if (quit) await quit.click();
await sleep(500);
for (let i = 0; i < 2; i++) {
  await page.mouse.move(W * 0.55, H * 0.55);
  await page.mouse.wheel({ deltaY: 300 });
  await sleep(900);
}
await page.mouse.move(W * 0.62, H * 0.6);
await sleep(3000);

const btn = await (await page.$('button[aria-label="Explorer une zone"]')).boundingBox();

const rec = new Recorder(ctx, OUT + '/frames');
await rec.start(W * 0.62, H * 0.62);
await rec.hold(0.6);
await rec.moveTo(btn.x + btn.width * 0.45, btn.y + btn.height / 2, 1.0);
await rec.hold(0.15);
await rec.click();
await rec.hold(0.7);

// A soft blob around Die, Saillans side to Luc-en-Diois, in screen pixels.
const cx = 660, cy = 478, R = 232;
const ctrl = [
  [0, -1.0], [0.62, -0.78], [1.05, -0.12], [0.85, 0.55],
  [0.25, 0.92], [-0.45, 0.8], [-0.98, 0.25], [-0.88, -0.48],
].map(([x, y]) => [cx + x * R * 1.15, cy + y * R * 0.92]);
const loop = smoothLoop(ctrl, 30);
await rec.moveTo(loop[0][0], loop[0][1], 0.9);
await rec.hold(0.15);
await rec.drag(loop, 3.0);
await rec.hold(2.2);

// Rest on the hike the zone found (no click: it would zoom away).
for (const b of await page.$$('button')) {
  if ((await b.evaluate((e) => e.innerText)).includes('Hauts-Plateaux')) {
    const c = await b.boundingBox();
    await rec.moveTo(c.x + 60, c.y + c.height / 2, 1.0);
    break;
  }
}
await rec.hold(1.6);
console.log('explore: frames', rec.n);
await ctx.browser.close();
