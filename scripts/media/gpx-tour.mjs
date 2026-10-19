// The tutorial's GPX animation: a close-up on "Open .gpx" as it is pressed,
// a pull-back as the map flies to the track, the track in the dock's list, its
// figures along the profile, then explore a few kilometres around Saoû, at its
// far end.
// PHONE=1 records the phone layout. Writes numbered PNG frames to $OUT/frames.
import fs from 'node:fs';
import { open, loadApp, sleep, Recorder, OUT, REPO, L, phoneBasemap, exposeMap, mapIdle } from './lib.mjs';

const phone = process.env.PHONE === '1';
// Same frames as the other scenes: the README window, or the phone.
const W = phone ? 393 : 1280, H = phone ? 708 : 760;
// The track under a plain name, as a hiker would save it: the app shows the
// GPX's own <name>, which here carries the export's details.
const NAME = 'Crest – Saoû';
const GPX = OUT + '/crest-saou.gpx';
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(REPO + '/test_data/saou_25.6_980_810.gpx', 'utf8');
fs.writeFileSync(GPX, src.replace(/<name>[^<]*<\/name>/g, `<name>${NAME}</name>`));
// The village at the far end, and a radius that keeps to its buses.
const END = 'Saoû';
const RADIUS_KM = 4;

const ctx = await open({ width: W, height: H, dpr: phone ? 2 : 1, mobile: phone });
const { page } = ctx;
await loadApp(page, { basemap: phone ? undefined : 'Topo' });
// Topo on the phone too: as on desktop, and lighter to encode than satellite.
if (phone) await phoneBasemap(page, 'Topo');
await exposeMap(page);
// For the clip only: new tiles replace the coarser ones at once. Fading in,
// the coarser ones show through in other colours as the map flies.
await page.evaluate(() => {
  const m = window.__map;
  for (const l of m.getStyle().layers)
    if (l.type === 'raster') m.setPaintProperty(l.id, 'raster-fade-duration', 0);
});
const tap = async (el) => (phone ? el.tap() : el.click());

// Set-up, not recorded: start over the Diois, a short flight from the track.
async function openSearch() {
  if (phone) await tap(await page.$(`button[aria-label="${L.search}"]`));
  else await page.click('input[type=search]');
  await sleep(500);
}
await openSearch();
await page.keyboard.type('Die');
await sleep(1800);
await tap(await page.$(`[aria-label="${L.results}"] button`));
await sleep(4000);
const quit = await page.$(`button[aria-label="${L.quit}"]`);
if (quit) await tap(quit);
await sleep(800);
await page.mouse.move(W * 0.5, H * 0.45);
await page.mouse.wheel({ deltaY: 300 });
await sleep(1500);
// Everything drawn before the first frame, the close-up's edges included.
await mapIdle(page, 1500);

const box = async (sel) => (await page.$(sel))?.boundingBox();
const centre = (b) => [b.x + b.width / 2, b.y + b.height / 2];
/** The elevation chart's plot, once uPlot has drawn it. */
const chartBox = () =>
  page.evaluate(() => {
    const c = document.querySelector('.uplot .u-over');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return r.width > 100 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
/** The first search result among localities (a village itself, where a
 * town's point is the middle of its commune), else the first result. */
const placeResult = () =>
  page.evaluate((label) => {
    const list = document.querySelector(`[aria-label="${label}"]`);
    if (!list) return null;
    const groups = [...list.querySelectorAll('section')];
    const lieu = groups.find((g) => /^(Lieux-dits & stations|Localities & resorts)$/.test(g.querySelector('h4')?.textContent ?? ''));
    const b = (lieu ?? list).querySelector('button');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 };
  }, L.results);

const rec = new Recorder(ctx, OUT + '/frames');
// 1. Open the file, seen close up; the camera pulls back as the map flies to
// the track.
const [ox, oy] = centre(await box(`button[aria-label="${L.openGpx}"]`));
rec.look(ox, oy, phone ? 1.7 : 2.6);
await rec.start(ox + (phone ? 40 : 70), oy + (phone ? 60 : 50), { touch: phone });
await rec.hold(0.5);
await rec.moveTo(ox, oy, 0.8);
await rec.hold(0.15);
const chooser = page.waitForFileChooser();
// No frame while the picker is open: the map's canvas can read blank then.
// Pressed, the file picked, and the next frame once the track is in.
await page.mouse.down();
// A press long enough to count as one on the phone's emulated touch.
await sleep(120);
await page.mouse.up();
await (await chooser).accept([GPX]);
rec.ringAt = { x: rec.x, y: rec.y, k: 0 };
// Parsing runs in real time while the virtual clock holds the picture still.
await sleep(2500);
// The dock grew with the track's row, which resizes and clears the map's
// canvas: let it draw again before the next frame.
await rec.settle();
if (phone) rec.x = rec.y = -100;
rec.camTo(W / 2, H / 2, 1, 1.4);
await rec.hold(2.4);

// The track is in the list, under its name.
if (phone) {
  await rec.moveTo(...centre(await box('#sheet-tab-tracks')), 0.8);
  await rec.click();
  await rec.hold(0.4);
  // The list starts folded, in the sheet as in the dock.
  await rec.moveTo(...centre(await box(`button[aria-label="${L.showList}"]`)), 0.6);
  await rec.click();
} else {
  await rec.moveTo(...centre(await box(`button[aria-label="${L.showList}"]`)), 0.8);
  await rec.click();
}
await rec.hold(1.6);

// 2. Its figures: on a phone the profile is a segment of the sheet.
if (phone) {
  await rec.moveTo(...centre(await box('#sheet-tab-profile')), 0.8);
  await rec.click();
  // The sheet rises over the lower half, and the map frames the track
  // above it: the dot that follows the finger stays in sight.
  await rec.hold(1.8);
}
let p = null;
for (let i = 0; i < 40 && !p; i++) {
  await sleep(250);
  p = await chartBox();
}
if (!p) throw new Error('elevation profile did not appear');
const y = p.y + p.h * 0.55;
await rec.moveTo(p.x + p.w * 0.04, y, 0.9);
const n = Math.round(3.2 * 30);
for (let i = 1; i <= n; i++) {
  const t = i / n;
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  rec.x = p.x + p.w * (0.04 + 0.9 * e);
  rec.y = y;
  await page.mouse.move(rec.x, rec.y);
  await rec.frame();
}
await rec.hold(1.0);

// 3. What runs at the far end: explore around the village.
if (phone) {
  // A tap on the map puts the sheet away.
  await rec.moveTo(W * 0.5, H * 0.3, 0.6);
  await rec.click();
  await rec.hold(0.6);
  await rec.moveTo(...centre(await box(`button[aria-label="${L.search}"]`)), 0.7);
  await rec.click();
} else {
  await rec.moveTo(...centre(await box('input[type=search]')), 0.9);
  await rec.click();
}
await rec.hold(0.3);
await rec.type(END);
await sleep(1800);
await rec.hold(0.4);
const hit = await placeResult();
if (!hit) throw new Error(`no search result for ${END}`);
await rec.moveTo(hit.x, hit.y, 0.7);
await rec.click();
await sleep(3000);
await rec.hold(1.0);
// Bring the radius in, by its slider, to the village and its buses.
const slider = await page.evaluate(() => {
  const s = document.querySelector('input[type=range]');
  if (!s) return null;
  const r = s.getBoundingClientRect();
  return { x: r.left, y: r.top + r.height / 2, w: r.width, min: +s.min, max: +s.max, v: +s.value };
});
if (!slider) throw new Error('radius slider did not appear');
const thumb = (v) => slider.x + 8 + ((slider.w - 16) * (v - slider.min)) / (slider.max - slider.min);
await rec.moveTo(thumb(slider.v), slider.y, 0.7);
await rec.drag([[thumb(slider.v), slider.y], [thumb(RADIUS_KM), slider.y]], 0.9);
await rec.hold(0.8);
const km = await page.evaluate(() => +document.querySelector('input[type=range]').value);
if (km !== RADIUS_KM) throw new Error(`radius is ${km} km, not ${RADIUS_KM}`);
const confirm = await page.evaluate((label) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === label);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, L.confirmRadius);
if (!confirm) throw new Error('radius panel did not appear');
await rec.moveTo(confirm[0], confirm[1], 0.8);
await rec.click();
await sleep(3000);
if (phone) rec.x = rec.y = -100;
await rec.hold(3.0);
console.log('gpx-tour: frames', rec.n);
await ctx.browser.close();
