// Stills for the tutorial. Usage: node tutorial-stills.mjs <transit|hike>
//   transit: the real app between Crest and Saoû on Topo, weekend buses only,
//            the D52's popup open (a line off the railway, through the hills), the basemap paled and the line drawn thick in its
//            card's colour. PHONE=1 for the phone layout, with the popup as a sheet.
//   hike:    the bare map (satellite, railways) framing a hike from Alès to
//            Chamborigaud, plus the hike's trace, smoothed, projected to screen
//            pixels for the tutorial to draw over it ($OUT/hike-<layout>.json).
// Writes $OUT/<scene>-<layout>.png.
import fs from 'node:fs';
import { open, loadApp, sleep, OUT, REPO, L, exposeMap, mapIdle, phoneBasemap } from './lib.mjs';

const scene = process.argv[2];
const phone = process.env.PHONE === '1';
const layout = phone ? 'phone' : 'desktop';

// The hike band is wider than a phone screen: its own frame on each layout.
const SIZE = {
  transit: phone ? [393, 708] : [1280, 760],
  // Near the band's shape in the dialog (560×333 on desktop, 393×340 on a
  // phone), large enough to fit the hike at z10, where station names show:
  // shown a little smaller than captured.
  hike: phone ? [480, 415] : [760, 452],
}[scene];
if (!SIZE) throw new Error('unknown scene ' + scene);
const [W, H] = SIZE;

const storage =
  scene === 'transit'
    ? {
        'hp:transit-visible:cars-region-drome': '1',
        'hp:transit-visible:zou': '1',
        // Weekend lines only, none of the archived ones: a readable map.
        'hp:bus-days': '0000011',
        'hp:bus-show-archived': '0',
        'controls.panel.collapsed': '1',
      }
    : { 'hp:rail-visible': '1', 'hp:gr-visible': '0', 'hp:curated-nsv-visible': '0' };
const ctx = await open({ width: W, height: H, dpr: 2, mobile: phone, storage });
const { page } = ctx;
await loadApp(page);
const basemap = scene === 'transit' ? 'Topo' : 'Satellite';
if (phone) await phoneBasemap(page, basemap);
else {
  // The panel is collapsed: open it for the basemap, then collapse it again.
  await page.evaluate(() => document.querySelector('[class*="collapsedTrigger"]')?.click());
  await sleep(600);
  await page.evaluate((name) => {
    for (const b of document.querySelectorAll('button'))
      if (b.innerText.trim() === name) return b.click();
  }, basemap);
  await sleep(600);
  if (scene === 'transit')
    await page.evaluate(() => document.querySelector('[class*="minimize"]')?.click());
}
await exposeMap(page);

if (scene === 'transit') {
  // Crest station and the D52 south to Saoû and Bourdeaux: in the upper half
  // of a phone, clear of the sheet.
  await page.evaluate(
    (phone) =>
      window.__map.jumpTo(phone ? { center: [5.07, 44.6], zoom: 9.9 } : { center: [5.14, 44.676], zoom: 10.8 }),
    phone,
  );
  await mapIdle(page, 2500);
  // Open the line's popup: a point on it, clear of any stop and of the
  // chrome, nearest the place the popup reads best.
  const LINE = 'D52';
  const at = await page.evaluate((W, H, phone, LINE) => {
    const m = window.__map;
    const ids = m.getStyle().layers.map((l) => l.id);
    const lineLayers = ids.filter((id) => /^transit-.*-line$/.test(id));
    const stopLayers = ids.filter((id) => /^transit-.*-stop$/.test(id));
    // Desktop: its end at Bourdeaux, low on the screen: the popup opens above
    // it, right of the line as it climbs to Saoû and Crest.
    const target = phone ? [W * 0.5, H * 0.25] : [W * 0.5, H];
    let best = null;
    for (const f of m.queryRenderedFeatures({ layers: lineLayers })) {
      if (f.properties.route_short_name !== LINE) continue;
      const g = f.geometry;
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const ln of lines)
        for (let i = 1; i < ln.length; i++) {
          const a = m.project(ln[i - 1]), b = m.project(ln[i]);
          const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (p.x < 40 || p.y < 160 || p.x > W - 40 || p.y > H - 120) continue;
          const box = [[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]];
          if (m.queryRenderedFeatures(box, { layers: stopLayers }).length) continue;
          const d = Math.hypot(p.x - target[0], p.y - target[1]);
          if (!best || d < best.d)
            best = { d, x: p.x, y: p.y, layer: f.layer.id, route: f.properties.route_id, paint: f.layer.paint['line-color'] };
        }
    }
    return best;
  }, W, H, phone, LINE);
  if (!at) throw new Error(`no ${LINE} on screen`);
  // The chip by the card's title, in the line's own colour: in the popup on
  // desktop, in the sheet's head on a phone.
  const CHIP = '[class*="_header_"] [class*="_chip_"], [class*="_sheetHead_"] [class*="_chip_"]';
  // A tap sometimes goes unanswered on a slow machine: try again.
  for (let tries = 1; ; tries++) {
    if (phone) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    const card = await page
      .waitForSelector(CHIP, { timeout: 8000 })
      .catch(() => null);
    if (card) break;
    if (tries === 3) {
      await page.screenshot({ path: `${OUT}/transit-failed.png` });
      throw new Error(`the line card did not open (tap at ${Math.round(at.x)},${Math.round(at.y)})`);
    }
  }
  await sleep(1500);
  await page.mouse.move(W - 4, H / 2);
  // For the picture only, nothing the app does: a paler basemap, and the
  // clicked line drawn thick in the colour of its card's chip, so the line and
  // its card read as one.
  const restyle = () => page.evaluate((at, CHIP) => {
    const m = window.__map;
    for (const l of m.getStyle().layers)
      if (l.type === 'raster') {
        m.setPaintProperty(l.id, 'raster-saturation', -0.55);
        m.setPaintProperty(l.id, 'raster-brightness-min', 0.32);
        m.setPaintProperty(l.id, 'raster-contrast', -0.15);
      }
    const chip = document.querySelector(CHIP);
    if (!chip) throw new Error('no line card');
    let colour = getComputedStyle(chip).backgroundColor;
    // A line with no colour of its own has a white chip: draw it in its map
    // colour instead, and the chip with it.
    const [r, g, b] = colour.match(/[\d.]+/g).map(Number);
    if (Math.min(r, g, b) > 225) {
      const c = at.paint;
      colour = typeof c === 'string' ? c : `rgb(${c.r * 255}, ${c.g * 255}, ${c.b * 255})`;
      chip.style.background = colour;
      chip.style.borderColor = colour;
      chip.style.color = '#ffffff';
    }
    // Drawn as a layer of its own over everything, from the line's own tiles.
    const src = m.getLayer(at.layer);
    const only = ['==', ['get', 'route_id'], at.route];
    for (const [id, paint] of [
      ['tutorial-line-casing', { 'line-color': '#ffffff', 'line-width': 10 }],
      ['tutorial-line', { 'line-color': colour, 'line-width': 6 }],
    ])
      m.addLayer({
        id,
        type: 'line',
        source: src.source,
        'source-layer': src.sourceLayer,
        filter: only,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint,
      });
  }, at, CHIP);
  await restyle();
  await mapIdle(page, 1500);
} else {
  // Only the map: the trace and its ends are drawn by the tutorial itself.
  await page.evaluate(() => {
    // Hide every sibling on the way from the map up to the root, and the
    // map's own controls: what is left is the drawn map.
    for (let el = document.querySelector('.maplibregl-map'); el && el !== document.body; el = el.parentElement)
      for (const sib of el.parentElement?.children ?? []) if (sib !== el) sib.style.visibility = 'hidden';
    document.querySelector('.maplibregl-control-container')?.setAttribute('style', 'display:none');
  });
  const gpx = fs.readFileSync(`${REPO}/test_data/cevennes_66_2480_2320.gpx`, 'utf8');
  const pts = [...gpx.matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)"/g)].map((m) => [+m[2], +m[1]]);
  // A moving average over ~1/120 of the route, sampled every ~1/200: the
  // walk's bends without its wiggles. Ends kept exact, on their stations.
  const win = Math.max(1, Math.round(pts.length / 120));
  const step = Math.max(1, Math.round(pts.length / 200));
  const smooth = [];
  for (let i = 0; i < pts.length; i += step) {
    let x = 0, y = 0, n = 0;
    for (let j = Math.max(0, i - win); j <= Math.min(pts.length - 1, i + win); j++) {
      x += pts[j][0]; y += pts[j][1]; n++;
    }
    smooth.push([x / n, y / n]);
  }
  smooth[0] = pts[0];
  smooth.push(pts[pts.length - 1]);
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  const bbox = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  const pad = phone ? { top: 25, bottom: 25, left: 50, right: 50 } : { top: 40, bottom: 40, left: 120, right: 120 };
  const px = await page.evaluate(
    (bbox, pad, line) => {
      const m = window.__map;
      m.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: pad, duration: 0 });
      // Station names show from z10.
      if (m.getZoom() < 10) m.setZoom(10);
      return line.map((c) => {
        const p = m.project(c);
        return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
      });
    },
    bbox,
    pad,
    smooth,
  );
  await mapIdle(page, 2500);
  fs.writeFileSync(
    `${OUT}/hike-${layout}.json`,
    JSON.stringify({ width: W, height: H, start: 'Alès', end: 'Chamborigaud', points: px }),
  );
}
await page.screenshot({ path: `${OUT}/${scene}-${layout}.png` });
await ctx.browser.close();
