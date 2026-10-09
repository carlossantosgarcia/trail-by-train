#!/usr/bin/env node
// Contrast gate. Asserts every text-on-surface pairing in src/tokens.css
// clears its WCAG threshold, in both themes, and fails the build if not.
//
// Why this exists rather than a claim in a spec: chrome in this app is
// translucent and floats over arbitrary map tiles, so "the token is dark
// enough" is not something you can eyeball. The check composites each
// surface at its *minimum* opacity over the worst-case basemap luminance
// before measuring — that is the real worst case a user sees, and it is
// exactly the case that a light-only design gets wrong over satellite.
//
// Run: node scripts/check-contrast.mjs   (wired into `npm run lint`)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Comments are stripped first: a token name mentioned inside one (e.g.
// `/* on --warn-wash: … */`) would otherwise parse as a declaration.
const CSS = readFileSync(join(ROOT, 'src/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

// ── Colour maths (mirrors src/lib/colorContrast.ts) ──────────────────────

function parseHex(hex) {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function composite(fg, alpha, backdrop) {
  return fg.map((c, i) => Math.round(c * alpha + backdrop[i] * (1 - alpha)));
}

// ── Token extraction ─────────────────────────────────────────────────────

function block(selector) {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\n\\}',
    'm',
  );
  const m = CSS.match(re);
  if (!m) throw new Error(`token block not found: ${selector}`);
  const out = {};
  for (const [, name, value] of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim();
  }
  return out;
}

const light = block(':root');
const darkOverrides = block(":root[data-theme='dark']");
const dark = { ...light, ...darkOverrides };

/** Resolve a token to [r,g,b] plus the alpha it is drawn at. */
function resolve(theme, name) {
  const raw = theme[name];
  if (!raw) throw new Error(`unknown token ${name}`);
  const hex = parseHex(raw);
  if (hex) return { rgb: hex, alpha: 1 };
  const m = raw.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)%\s*\)/);
  if (m) {
    return {
      rgb: [Number(m[1]), Number(m[2]), Number(m[3])],
      alpha: Number(m[4]) / 100,
    };
  }
  throw new Error(`cannot resolve ${name} = ${raw}`);
}

// ── What gets checked ────────────────────────────────────────────────────

// Worst-case basemap luminance behind a translucent surface. Satellite
// imagery spans nearly the full range, so both extremes are tested.
const BASEMAP_EXTREMES = [
  ['white tile (snow, cloud)', [255, 255, 255]],
  ['black tile (forest, shadow)', [0, 0, 0]],
];

// [ink token, surface token, minimum ratio, what it is ]
// 3:1 applies where the text is >=18px or is a non-text UI boundary.
const PAIRS = [
  ['--ink', '--surface', 4.5, 'body text on chrome'],
  ['--ink', '--surface-strong', 4.5, 'body text on a solid surface'],
  ['--slate', '--surface', 4.5, 'secondary text on chrome'],
  ['--slate', '--surface-strong', 4.5, 'secondary text on a solid surface'],
  ['--accent', '--surface', 3, 'active-state border against chrome'],
  ['--accent', '--surface-strong', 3, 'focus ring against a solid surface'],
  ['--alert', '--alert-wash', 4.5, 'error text on its wash'],
  ['--warn', '--warn-wash', 4.5, 'warning text on its wash'],
  ['--profile', '--surface-strong', 3, 'elevation profile against its panel'],
  ['--rule', '--surface-strong', 1.2, 'hairline against its surface'],
  ['--slate-soft', '--surface-strong', 3, 'disabled text on a solid surface'],
];

// Known exceptions, carried deliberately. These are properties of the app's
// original palette, restored on purpose; they are listed here so the debt is
// visible in the build output rather than hidden by a lowered threshold.
// Format: `${theme}|${ink}|${surface}` -> why it is tolerated.
const EXCEPTIONS = {
  'light|--slate-soft|--surface-strong':
    'placeholder and disabled text only, which WCAG 1.4.3 exempts, and never the sole cue',
  'light|--rule|--surface-strong':
    'a decorative hairline, not a control boundary — no information depends on seeing it',
};

// ── Run ──────────────────────────────────────────────────────────────────

const failures = [];
const tolerated = [];
let checked = 0;

for (const [themeName, theme] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [inkName, surfaceName, min, what] of PAIRS) {
    const ink = resolve(theme, inkName);
    const surface = resolve(theme, surfaceName);

    // Opaque surface: measure directly. Translucent: composite over both
    // basemap extremes and take the worse result.
    const cases =
      surface.alpha === 1
        ? [['', surface.rgb]]
        : BASEMAP_EXTREMES.map(([label, tile]) => [
            label,
            composite(surface.rgb, surface.alpha, tile),
          ]);

    for (const [label, bg] of cases) {
      checked++;
      const r = ratio(ink.rgb, bg);
      if (r >= min) continue;
      const why = EXCEPTIONS[`${themeName}|${inkName}|${surfaceName}`];
      if (why) {
        tolerated.push({ themeName, inkName, surfaceName, r, min, why });
      } else {
        failures.push({ themeName, inkName, surfaceName, what, label, r, min });
      }
    }
  }
}

const pad = (s, n) => String(s).padEnd(n);
if (failures.length) {
  console.error(`\n✖ contrast gate: ${failures.length} of ${checked} pairings below threshold\n`);
  for (const f of failures) {
    console.error(
      `  ${pad(f.themeName, 6)} ${pad(f.inkName + ' on ' + f.surfaceName, 34)} ` +
        `${f.r.toFixed(2)}:1  (needs ${f.min}:1)  — ${f.what}` +
        (f.label ? `, over ${f.label}` : ''),
    );
  }
  console.error(
    '\n  Fix by raising the surface opacity rather than darkening the ink:\n' +
      '  chrome that has to shout over the basemap is chrome that is too thin.\n',
  );
  process.exit(1);
}

for (const t of tolerated) {
  console.log(
    `  known exception: ${t.themeName} ${t.inkName} on ${t.surfaceName} ` +
      `${t.r.toFixed(2)}:1 (below ${t.min}:1) — ${t.why}`,
  );
}
console.log(
  `✓ contrast: ${checked - tolerated.length} pairings clear their threshold in both themes` +
    (tolerated.length ? `, ${tolerated.length} known exceptions listed above` : ''),
);
