// Still screenshots for the README, at 2x. Usage: node stills.mjs <bus|hike|satellite|phone>
// Writes $OUT/<scene>.png (the bare app; build.sh puts it in its frame).
import { open, loadApp, sleep, OUT } from './lib.mjs';

const scene = process.argv[2];
const mobile = scene === 'phone';
// The phone is an iPhone 15 Pro (393 pt wide) with Safari's bottom bar: the
// page gets what is left between the status bar and that bar.
const W = mobile ? 393 : 1280, H = mobile ? 708 : 760;
const storage = {
  'hp:transit-visible:cars-region-drome': '1',
  'hp:transit-visible:zou': '1',
  'hp:gr-visible': '1',
  'hp:curated-nsv-visible': '1',
  'controls.panel.collapsed': scene === 'hike' ? '0' : '1',
};
const ctx = await open({ width: W, height: H, dpr: 2, mobile, storage });
const { page } = ctx;
await loadApp(page, { basemap: scene === 'hike' ? 'Topo' : undefined });

async function search(q, pick) {
  if (mobile) {
    await (await page.$('button[aria-label="Rechercher un lieu"]'))?.tap();
    await sleep(500);
  } else await page.click('input[type=search]');
  await page.keyboard.type(q);
  await sleep(1800);
  for (const r of await page.$$('[aria-label="Résultats de recherche"] button')) {
    if (pick.test(await r.evaluate((e) => e.innerText))) {
      mobile ? await r.tap() : await r.click();
      return;
    }
  }
  throw new Error('no search result for ' + q);
}
async function settle(ms) {
  await page.mouse.move(W - 5, H / 2);
  await sleep(ms); // tiles
}

if (scene === 'bus') {
  // Searching a line frames it; then click the Zou P25 coach on the right.
  await search('26-25004', /25004/);
  await settle(4000);
  await page.mouse.click(1040, 512);
  await sleep(1500);
  await settle(3500);
} else if (scene === 'hike') {
  await search('Hauts-Plateaux', /gare de Die/);
  await settle(6000);
} else if (scene === 'satellite' || scene === 'phone') {
  await search('Die', /^Die\b/);
  await sleep(4000);
  const quit = await page.$('button[aria-label="Quitter"]');
  if (quit) await quit.click();
  await sleep(800);
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.wheel({ deltaY: 300 });
  await sleep(900);
  // Put Die low and left so the hike and the Vercors fill the frame.
  const [dx, dy] = mobile ? [-50, 90] : [-220, 120];
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(W / 2 + (dx * i) / 12, H / 2 + (dy * i) / 12);
    await sleep(25);
  }
  await page.mouse.up();
  await settle(6000);
} else {
  throw new Error('unknown scene ' + scene);
}
await page.screenshot({ path: `${OUT}/${scene}.png` });
await ctx.browser.close();
