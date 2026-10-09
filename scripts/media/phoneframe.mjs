// iPhone 15 Pro overlay (status bar, Dynamic Island, Safari's bottom bar) with a
// transparent hole for the page. Usage: node phoneframe.mjs <out.png> <cw> <ch>
// Prints the hole's position as JSON, in CSS pixels.
import { open } from './lib.mjs';

const [out, cw, ch] = [process.argv[2], +process.argv[3], +process.argv[4]];
const PAD = 40, RIM = 4, BEZ = 11, SB = 54, BAR = 90, R = 64;
const DW = cw + (RIM + BEZ) * 2, DH = SB + ch + BAR + (RIM + BEZ) * 2;
const W = DW + PAD * 2, H = DH + PAD * 2;
const dx = PAD, dy = PAD; // device origin
const sx = dx + RIM + BEZ, sy = dy + RIM + BEZ; // screen origin
const sr = R - RIM - BEZ; // screen corner radius
const hole = `M${sx} ${sy + SB} h${cw} v${ch} h${-cw} Z`;

const btn = (side, top, h) =>
  `<rect x="${side === 'l' ? dx - 3 : dx + DW - 1}" y="${dy + top}" width="4" height="${h}" rx="2" fill="url(#ti)"/>`;

const html = `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
body{width:${W}px;height:${H}px;position:relative;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
svg{position:absolute;inset:0}
.sb{position:absolute;left:${sx}px;top:${sy}px;width:${cw}px;height:${SB}px;display:flex;align-items:center;justify-content:space-between;padding:4px 34px 0 46px;box-sizing:border-box;font-size:17px;font-weight:600;color:#000;letter-spacing:-.2px}
.isl{position:absolute;left:${sx + cw / 2 - 62}px;top:${sy + 11}px;width:124px;height:36px;border-radius:18px;background:#000}
.bar{position:absolute;left:${sx}px;top:${sy + SB + ch}px;width:${cw}px;height:${BAR}px;border-radius:0 0 ${sr}px ${sr}px;overflow:hidden;background:rgba(246,246,248,.96);border-top:.5px solid rgba(0,0,0,.12);box-sizing:border-box}
.url{position:absolute;left:12px;right:12px;top:8px;height:44px;border-radius:13px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:space-between;padding:0 14px;box-sizing:border-box;font-size:16px;color:#000}
.url .aa{font-size:15px;font-weight:500}
.url .host{display:flex;align-items:center;gap:6px;font-size:15.5px}
.home{position:absolute;left:${cw / 2 - 67}px;bottom:8px;width:134px;height:5px;border-radius:3px;background:#000}
</style></head><body>
<svg width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8eef5"/><stop offset="1" stop-color="#d6e4e0"/>
    </linearGradient>
    <linearGradient id="ti" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9a9ca1"/><stop offset=".5" stop-color="#5d5f63"/><stop offset="1" stop-color="#8b8d92"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-10%" width="140%" height="120%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity=".28"/>
    </filter>
    <mask id="m"><rect width="${W}" height="${H}" fill="#fff"/><path d="${hole}" fill="#000"/></mask>
  </defs>
  <g mask="url(#m)">
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    ${btn('l', 120, 32)}${btn('l', 185, 62)}${btn('l', 262, 62)}${btn('r', 210, 100)}
    <rect x="${dx}" y="${dy}" width="${DW}" height="${DH}" rx="${R}" fill="url(#ti)" filter="url(#s)"/>
    <rect x="${dx + RIM}" y="${dy + RIM}" width="${DW - RIM * 2}" height="${DH - RIM * 2}" rx="${R - RIM}" fill="#0b0b0c"/>
    <rect x="${sx}" y="${sy}" width="${cw}" height="${SB + ch + BAR}" rx="${sr}" fill="#fff"/>
  </g>
</svg>
<div class="sb"><span>9:41</span><span style="display:flex;gap:7px;align-items:center">
  <svg width="19" height="12" viewBox="0 0 19 12" style="position:static"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="#000"/><rect x="5.2" y="5.5" width="3.2" height="6.5" rx="1" fill="#000"/><rect x="10.4" y="3" width="3.2" height="9" rx="1" fill="#000"/><rect x="15.6" y="0" width="3.2" height="12" rx="1" fill="#000"/></svg>
  <svg width="17" height="12" viewBox="0 0 17 12" style="position:static"><path d="M8.5 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.2A10.6 10.6 0 0 0 8.5.5 10.6 10.6 0 0 0 1 3.5l1.2 1.2A9 9 0 0 1 8.5 2.2zm0 3.4c1.5 0 2.9.6 3.9 1.5l1.2-1.2A7.3 7.3 0 0 0 8.5 4a7.3 7.3 0 0 0-5.1 1.9l1.2 1.2c1-.9 2.4-1.5 3.9-1.5zm0 3.4c.6 0 1.2.2 1.6.6L8.5 11.2 6.9 9.6c.4-.4 1-.6 1.6-.6z" fill="#000"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13" style="position:static"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="#000" opacity=".35"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="#000"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="#000" opacity=".4"/></svg>
</span></div>
<div class="isl"></div>
<div class="bar">
  <div class="url">
    <span class="aa">AA</span>
    <span class="host"><svg width="10" height="13" viewBox="0 0 10 13" style="position:static"><rect x="0" y="5.5" width="10" height="7.5" rx="1.6" fill="#000"/><path d="M2.2 5.5V3.8a2.8 2.8 0 0 1 5.6 0v1.7" fill="none" stroke="#000" stroke-width="1.5"/></svg>carlossantosgarcia.github.io</span>
    <svg width="16" height="16" viewBox="0 0 16 16" style="position:static"><path d="M13.5 8a5.5 5.5 0 1 1-1.7-4M13.5 2v3.5H10" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </div>
  <div class="home"></div>
</div>
</body></html>`;

const ctx = await open({ width: W, height: H, dpr: Number(process.env.DPR ?? 1) });
await ctx.page.setContent(html);
await ctx.page.evaluate(() => document.fonts.ready);
await ctx.page.screenshot({ path: out, omitBackground: true });
await ctx.browser.close();
console.log(JSON.stringify({ W, H, x: sx, y: sy + SB }));
