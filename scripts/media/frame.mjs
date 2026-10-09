// Renders a browser-window overlay PNG with a transparent hole for the app.
// Usage: node frame.mjs <out.png> <contentW> <contentH>
import { open } from './lib.mjs';

const [out, cw, ch] = [process.argv[2], +process.argv[3], +process.argv[4]];
const PAD = 36, BAR = 84, R = 12;
const W = cw + PAD * 2, H = ch + BAR + PAD * 2;
const x0 = PAD, y0 = PAD, x1 = PAD + cw, y1 = PAD + BAR + ch;

// Hole: the content rect with rounded bottom corners.
const hole = `M${x0} ${y0 + BAR} H${x1} V${y1 - R} A${R} ${R} 0 0 1 ${x1 - R} ${y1} H${x0 + R} A${R} ${R} 0 0 1 ${x0} ${y1 - R} Z`;

const html = `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
body{width:${W}px;height:${H}px;position:relative;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
svg{position:absolute;inset:0}
.win{position:absolute;left:${x0}px;top:${y0}px;width:${cw}px;height:${BAR}px;border-radius:${R}px ${R}px 0 0;background:#dfe3e8;overflow:hidden}
.tabs{height:42px;display:flex;align-items:flex-end;padding-left:84px;position:relative}
.dots{position:absolute;left:18px;top:15px;display:flex;gap:8px}
.dots i{width:12px;height:12px;border-radius:50%;display:block}
.tab{height:34px;width:236px;background:#fff;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:9px;padding:0 14px;box-sizing:border-box;font-size:12.5px;color:#1f2328;font-weight:500}
.tab .x{margin-left:auto;color:#6b7280;font-size:13px}
.fav{width:16px;height:16px;border-radius:4px;background:linear-gradient(135deg,#2563eb,#0f766e);display:grid;place-items:center}
.plus{color:#4b5563;font-size:18px;margin:0 0 7px 12px}
.bar{height:42px;background:#fff;display:flex;align-items:center;gap:14px;padding:0 14px;box-sizing:border-box;border-bottom:1px solid #e5e7eb}
.nav{display:flex;gap:16px;color:#6b7280}
.url{flex:1;height:30px;border-radius:15px;background:#f1f3f5;display:flex;align-items:center;padding:0 14px;gap:9px;font-size:13px;color:#1f2328}
.url .h{color:#6b7280}
.av{width:24px;height:24px;border-radius:50%;background:#cbd5e1}
</style></head><body>
<svg width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8eef5"/><stop offset="1" stop-color="#d6e4e0"/>
    </linearGradient>
    <filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity=".22"/></filter>
    <mask id="m"><rect width="${W}" height="${H}" fill="#fff"/><path d="${hole}" fill="#000"/></mask>
  </defs>
  <g mask="url(#m)">
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="${x0}" y="${y0}" width="${cw}" height="${BAR + ch}" rx="${R}" fill="#fff" filter="url(#s)"/>
  </g>
</svg>
<div class="win">
  <div class="tabs">
    <div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
    <div class="tab"><span class="fav"><svg width="10" height="10" viewBox="0 0 10 10" style="position:static"><path d="M1 8 4 3l2 3 1-1.5L9 8z" fill="#fff"/></svg></span>Trail by Train<span class="x">✕</span></div>
    <span class="plus">+</span>
  </div>
  <div class="bar">
    <div class="nav">
      <svg width="16" height="16" viewBox="0 0 16 16" style="position:static"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <svg width="16" height="16" viewBox="0 0 16 16" style="position:static;opacity:.45"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <svg width="16" height="16" viewBox="0 0 16 16" style="position:static"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 3v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="url">
      <svg width="12" height="12" viewBox="0 0 12 12" style="position:static"><rect x="2" y="5" width="8" height="6" rx="1.5" fill="#6b7280"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="#6b7280" stroke-width="1.4"/></svg>
      <span>carlossantosgarcia.github.io<span class="h">/trail-by-train/</span></span>
    </div>
    <div class="av"></div>
  </div>
</div>
</body></html>`;

const ctx = await open({ width: W, height: H, dpr: Number(process.env.DPR ?? 1) });
await ctx.page.setContent(html);
await ctx.page.evaluate(() => document.fonts.ready);
await ctx.page.screenshot({ path: out, omitBackground: true });
await ctx.browser.close();
console.log(JSON.stringify({ W, H, x: x0, y: y0 + BAR }));
