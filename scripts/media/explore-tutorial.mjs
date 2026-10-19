// The tutorial's Explore animation: a close-up on the Explore button as it is
// pressed, a pull-back to the whole screen, then a zone drawn around one
// station (Luc-en-Diois, a few bus lines) and its results. PHONE=1 records the
// phone layout, with a finger. Writes numbered PNG frames to $OUT/frames.
import { open, loadApp, sleep, Recorder, smoothLoop, OUT, L, phoneBasemap, exposeMap, mapIdle } from './lib.mjs';

const phone = process.env.PHONE === '1';
// Same frames as the other scenes: the README window, or the phone.
const W = phone ? 393 : 1280, H = phone ? 708 : 760;
const STATION = [5.45462, 44.6137];

const ctx = await open({ width: W, height: H, dpr: phone ? 2 : 1, mobile: phone });
const { page } = ctx;
await loadApp(page, { basemap: phone ? undefined : 'Topo' });
// Topo on the phone too: as on desktop, and lighter to encode than satellite.
if (phone) await phoneBasemap(page, 'Topo');
await exposeMap(page);

// The station where the zone will be drawn: right of the dock on desktop, in
// the upper part of a phone, clear of the results sheet.
const spot = phone ? [W * 0.5, H * 0.4] : [W * 0.5, H * 0.56];
await page.evaluate(
  (c, z, spot, W, H) => {
    const m = window.__map;
    m.jumpTo({ center: c, zoom: z });
    // Shift so the station lands on `spot` rather than the centre.
    m.panBy([W / 2 - spot[0], H / 2 - spot[1]], { duration: 0 });
  },
  STATION, phone ? 12 : 12.4, spot, W, H,
);
await mapIdle(page, 2500);

const btn = await (await page.$(`button[aria-label="${L.explore}"]`)).boundingBox();
const bx = btn.x + btn.width * (phone ? 0.5 : 0.45), by = btn.y + btn.height / 2;

const rec = new Recorder(ctx, OUT + '/frames');
// Open on the dock, close up, so it is clear which button does it.
const Z = phone ? 1.7 : 2.6;
rec.look(bx, by, Z);
await rec.start(bx + (phone ? 50 : 90), by + (phone ? 60 : 50), { touch: phone });
await rec.hold(0.5);
await rec.moveTo(bx, by, 0.8);
await rec.hold(0.15);
await rec.click();
await rec.hold(0.6);

// A blob around the station, a few kilometres across.
const [cx, cy] = spot, R = phone ? 135 : 200;
const ctrl = [
  [0, -1.0], [0.62, -0.78], [1.0, -0.1], [0.8, 0.55],
  [0.2, 0.9], [-0.45, 0.78], [-0.95, 0.2], [-0.85, -0.5],
].map(([x, y]) => [cx + x * R * 1.1, cy + y * R * 0.9]);
const loop = smoothLoop(ctrl, 30);
// Pull back to the whole screen while the hand goes to the map.
rec.camTo(W / 2, H / 2, 1, 1.4);
await rec.moveTo(loop[0][0], loop[0][1], 1.5);
await rec.hold(0.15);
await rec.drag(loop, 2.8);
// Out of the way, so the results read.
if (phone) rec.x = rec.y = -100;
else await rec.moveTo(W - 60, H - 60, 0.8);
await rec.hold(2.8);
console.log('explore-tutorial: frames', rec.n);
await ctx.browser.close();
