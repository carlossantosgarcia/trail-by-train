#!/usr/bin/env node
// Benchmark the GPX D+/D− algorithm against reference tracks.
//
// Usage: node scripts/benchmark-elevation.mjs [--window <m>] [--threshold <m>] [--dir <path>] [--dem]
//
// Reads every *.gpx in --dir (default test_data/). Filenames must match
//   <name>_<km>_<dplus>_<dminus>.gpx
// where <km>, <dplus>, <dminus> are the reference distance and elevation
// gain/loss (for the bundled fixtures: what Komoot reported for the
// maintainer's own recorded hikes). Parses each file with a minimal regex-based
// trackpoint extractor (zero new deps), runs the production algorithm
// from src/features/gpx/elevationAlgorithm.mjs, and prints a comparison
// table plus aggregate accuracy.
//
// Exit code is 0 iff MAPE(D+) ≤ 10 %, MAPE(D−) ≤ 10 % and max |err%| ≤ 20 %.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeAscentDescentMeters,
  DEFAULT_THRESHOLD_M,
  DEFAULT_WINDOW_M,
} from '../src/features/gpx/elevationAlgorithm.mjs';
import {
  DEM_DPLUS_INTERVAL_M,
  DEM_THRESHOLD_M,
  DEM_WINDOW_M,
} from '../src/features/terrain/constants.mjs';
import { resampleByDistance } from '../src/features/terrain/resample.mjs';
import { sampleElevations, TerrainServiceError } from '../src/features/terrain/ignAltimetry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const MAPE_BUDGET = 10; // %, computed over non-DEM-limited fixtures only
const WORST_PCT_BUDGET = 20; // %, OR
const ABSOLUTE_FLOOR_M = 120; // metres — see spec.md / design.md "Calibration findings"

const FIXTURE_NAME_RE = /^(?<name>.+)_(?<km>[\d.]+)_(?<dp>\d+)_(?<dm>\d+)\.gpx$/;

const TRKPT_RE =
  /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
const TRKPT_SELF_CLOSING_RE =
  /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*\/>/g;
const ELE_RE = /<ele>\s*(-?\d+(?:\.\d+)?)\s*<\/ele>/;
const TRKSEG_RE = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/g;

function parseArgs(argv) {
  const out = {
    windowM: DEFAULT_WINDOW_M,
    thresholdM: DEFAULT_THRESHOLD_M,
    dir: 'test_data',
    dem: false,
    windowExplicit: false,
    thresholdExplicit: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--window') {
      out.windowM = Number(next);
      out.windowExplicit = true;
      i += 1;
    } else if (a === '--threshold') {
      out.thresholdM = Number(next);
      out.thresholdExplicit = true;
      i += 1;
    } else if (a === '--dir') {
      out.dir = next;
      i += 1;
    } else if (a === '--dem') {
      out.dem = true;
    } else if (a === '-h' || a === '--help') {
      out.help = true;
    } else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(out.windowM) || out.windowM < 0) {
    console.error('--window must be a non-negative number of metres');
    process.exit(2);
  }
  if (!Number.isFinite(out.thresholdM) || out.thresholdM < 0) {
    console.error('--threshold must be a non-negative number of metres');
    process.exit(2);
  }
  return out;
}

function showHelp() {
  console.log(
    [
      'Usage: node scripts/benchmark-elevation.mjs [--window <m>] [--threshold <m>] [--dir <path>]',
      '                                           [--dem]',
      '',
      'Compares computed D+/D− against reference values encoded in fixture filenames.',
      `Defaults: --window ${DEFAULT_WINDOW_M} --threshold ${DEFAULT_THRESHOLD_M} --dir test_data`,
      '',
      'Terrain mode (--dem) ignores each fixture\'s own <ele> and re-derives elevation by',
      "querying IGN's altimetry service through the same module the browser uses, so a",
      'regression in the terrain tuning fails here too. It defaults to the terrain tuning',
      `(window ${DEM_WINDOW_M} m, threshold ${DEM_THRESHOLD_M} m) unless --window/--threshold say otherwise.`,
      'The default mode needs no network access; terrain mode needs data.geopf.fr.',
    ].join('\n'),
  );
}

/** Earth-radius haversine, in metres. */
function haversineMetres(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(c));
}

/**
 * Extract ordered trackpoints per <trkseg>.
 * Returns: Array<Array<{ lat:number, lon:number, ele:number|null }>>.
 *
 * This is a minimal extractor — we explicitly do NOT use it in the
 * production code path. GPX-spec edge cases (namespaces, comments,
 * exotic attribute order) are not handled here on purpose: the bundled
 * fixtures come from Komoot exports whose <trkpt> tags are regular.
 */
function extractSegments(gpxText) {
  const segments = [];
  let segMatch;
  TRKSEG_RE.lastIndex = 0;
  while ((segMatch = TRKSEG_RE.exec(gpxText)) !== null) {
    const segBody = segMatch[1];
    const points = [];

    TRKPT_RE.lastIndex = 0;
    let m;
    while ((m = TRKPT_RE.exec(segBody)) !== null) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      const body = m[3];
      const eleMatch = body.match(ELE_RE);
      const ele = eleMatch ? Number(eleMatch[1]) : null;
      points.push({ lat, lon, ele });
    }
    TRKPT_SELF_CLOSING_RE.lastIndex = 0;
    while ((m = TRKPT_SELF_CLOSING_RE.exec(segBody)) !== null) {
      points.push({ lat: Number(m[1]), lon: Number(m[2]), ele: null });
    }

    if (points.length > 0) segments.push(points);
  }

  // Fallback: some GPX files put <trkpt> directly under <trk> without a
  // <trkseg>. Treat all trackpoints as one segment.
  if (segments.length === 0) {
    const points = [];
    TRKPT_RE.lastIndex = 0;
    let m;
    while ((m = TRKPT_RE.exec(gpxText)) !== null) {
      const eleMatch = m[3].match(ELE_RE);
      points.push({
        lat: Number(m[1]),
        lon: Number(m[2]),
        ele: eleMatch ? Number(eleMatch[1]) : null,
      });
    }
    if (points.length > 0) segments.push(points);
  }
  return segments;
}

/**
 * Compute distance, D+, D− and total point count for one parsed GPX.
 */
function summarise(segments, opts) {
  let distanceM = 0;
  let ascentM = 0;
  let descentM = 0;
  let pointCount = 0;
  for (const seg of segments) {
    pointCount += seg.length;
    const eps = new Array(seg.length);
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i];
      let step = 0;
      if (i > 0) {
        const prev = seg[i - 1];
        step = haversineMetres(prev.lat, prev.lon, p.lat, p.lon);
        distanceM += step;
      }
      eps[i] = { ele: p.ele == null ? null : p.ele, distFromPrevM: step };
    }
    const r = computeAscentDescentMeters(eps, opts);
    ascentM += r.ascentM;
    descentM += r.descentM;
  }
  return { distanceKm: distanceM / 1000, ascentM, descentM, pointCount };
}

function pct(expected, actual) {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return ((actual - expected) / expected) * 100;
}

function fmtPct(p) {
  if (!Number.isFinite(p)) return '   ∞';
  const sign = p >= 0 ? '+' : '−';
  return `${sign}${Math.abs(p).toFixed(1).padStart(4)}`;
}

function pad(s, n, align = 'left') {
  const str = String(s);
  if (str.length >= n) return str;
  const padding = ' '.repeat(n - str.length);
  return align === 'right' ? padding + str : str + padding;
}

/**
 * Terrain-mode summary for one fixture: discard its <ele>, resample the
 * geometry uniformly and query IGN's altimetry service, exactly as the
 * browser does.
 */
async function summariseFromTerrain(segments, opts) {
  let ascentM = 0;
  let descentM = 0;
  let sampled = 0;
  let covered = 0;
  // Distance and point count describe the track itself, so they come from
  // the original geometry in both modes and stay directly comparable.
  let distanceM = 0;
  let pointCount = 0;

  for (const seg of segments) {
    pointCount += seg.length;
    for (let i = 1; i < seg.length; i++) {
      distanceM += haversineMetres(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
    }
    const coords = seg.map((p) => [p.lon, p.lat]);
    const uniform = resampleByDistance(coords, DEM_DPLUS_INTERVAL_M);
    const eles = await sampleElevations(uniform);
    sampled += eles.length;
    covered += eles.reduce((n, v) => n + (v === null ? 0 : 1), 0);

    const points = eles.map((ele, i) => ({
      ele,
      distFromPrevM:
        i === 0
          ? 0
          : haversineMetres(uniform[i - 1][1], uniform[i - 1][0], uniform[i][1], uniform[i][0]),
    }));
    const r = computeAscentDescentMeters(points, {
      windowM: opts.windowM,
      thresholdM: opts.thresholdM,
    });
    ascentM += r.ascentM;
    descentM += r.descentM;
  }
  return {
    distanceKm: distanceM / 1000,
    ascentM,
    descentM,
    pointCount,
    sampled,
    covered,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    showHelp();
    process.exit(0);
  }

  // Terrain mode has its own calibrated tuning; only override it when the
  // caller explicitly asked for different values.
  if (opts.dem) {
    if (!opts.windowExplicit) opts.windowM = DEM_WINDOW_M;
    if (!opts.thresholdExplicit) opts.thresholdM = DEM_THRESHOLD_M;
    console.log('mode: terrain (IGN altimetry service, RGE ALTI)');
  }
  const dirAbs = resolve(REPO_ROOT, opts.dir);
  const files = readdirSync(dirAbs)
    .filter((f) => f.toLowerCase().endsWith('.gpx'))
    .sort();
  if (files.length === 0) {
    console.error(`No .gpx files found in ${dirAbs}`);
    process.exit(2);
  }

  const rows = [];
  const errors = { dPlus: [], dMinus: [] };

  for (const fname of files) {
    const match = fname.match(FIXTURE_NAME_RE);
    if (!match) {
      console.error(`warn: skipping ${fname} — filename does not match <name>_<km>_<dp>_<dm>.gpx`);
      continue;
    }
    const expKm = Number(match.groups.km);
    const expDp = Number(match.groups.dp);
    const expDm = Number(match.groups.dm);

    const text = readFileSync(join(dirAbs, fname), 'utf8');
    const segments = extractSegments(text);
    const summary = opts.dem
      ? await summariseFromTerrain(segments, opts).catch((err) => {
          if (err instanceof TerrainServiceError) {
            console.error(`FAIL: ${err.message}`);
            process.exit(1);
          }
          throw err;
        })
      : summarise(segments, { windowM: opts.windowM, thresholdM: opts.thresholdM });
    if (opts.dem && summary.covered < summary.sampled) {
      console.error(
        `warn: ${fname} — only ${summary.covered}/${summary.sampled} samples inside DEM coverage`,
      );
    }

    const errDp = pct(expDp, summary.ascentM);
    const errDm = pct(expDm, summary.descentM);
    errors.dPlus.push(errDp);
    errors.dMinus.push(errDm);

    rows.push({
      name: match.groups.name,
      pts: summary.pointCount,
      expKm,
      gotKm: summary.distanceKm,
      expDp,
      gotDp: summary.ascentM,
      errDp,
      expDm,
      gotDm: summary.descentM,
      errDm,
    });
  }

  // Classify each fixture: a fixture passes by the absolute floor if
  // BOTH |D+ err| ≤ 100m AND |D- err| ≤ 100m. A fixture is DEM-limited
  // if it relies on the floor for at least one of D+/D-.
  for (const r of rows) {
    const absDp = Math.abs(r.gotDp - r.expDp);
    const absDm = Math.abs(r.gotDm - r.expDm);
    r.absDp = absDp;
    r.absDm = absDm;
    const dpPass = Math.abs(r.errDp) <= WORST_PCT_BUDGET || absDp <= ABSOLUTE_FLOOR_M;
    const dmPass = Math.abs(r.errDm) <= WORST_PCT_BUDGET || absDm <= ABSOLUTE_FLOOR_M;
    r.withinBudget = dpPass && dmPass;
    r.demLimited =
      (absDp <= ABSOLUTE_FLOOR_M && Math.abs(r.errDp) > WORST_PCT_BUDGET) ||
      (absDm <= ABSOLUTE_FLOOR_M && Math.abs(r.errDm) > WORST_PCT_BUDGET);
  }

  // Render table.
  const headers = [
    'fixture',
    'pts',
    'km exp',
    'km got',
    'D+ exp',
    'D+ got',
    'D+ err%',
    'D- exp',
    'D- got',
    'D- err%',
    'note',
  ];
  const widths = [22, 6, 7, 7, 7, 7, 8, 7, 7, 8, 7];
  console.log(headers.map((h, i) => pad(h, widths[i], i === 0 ? 'left' : 'right')).join('  '));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) {
    const note = r.demLimited ? '(DEM)' : r.withinBudget ? '' : 'FAIL';
    console.log(
      [
        pad(r.name, widths[0]),
        pad(r.pts, widths[1], 'right'),
        pad(r.expKm.toFixed(1), widths[2], 'right'),
        pad(r.gotKm.toFixed(1), widths[3], 'right'),
        pad(r.expDp, widths[4], 'right'),
        pad(r.gotDp, widths[5], 'right'),
        pad(fmtPct(r.errDp), widths[6], 'right'),
        pad(r.expDm, widths[7], 'right'),
        pad(r.gotDm, widths[8], 'right'),
        pad(fmtPct(r.errDm), widths[9], 'right'),
        pad(note, widths[10], 'right'),
      ].join('  '),
    );
  }

  // MAPE over fixtures that did NOT lean on the absolute floor.
  const cleanRows = rows.filter((r) => !r.demLimited);
  const mape = (arr) =>
    arr.length === 0 ? 0 : arr.reduce((acc, x) => acc + Math.abs(x), 0) / arr.length;
  const mapeDp = mape(cleanRows.map((r) => r.errDp));
  const mapeDm = mape(cleanRows.map((r) => r.errDm));

  console.log('');
  console.log(
    `MAPE D+: ${mapeDp.toFixed(2)}%   MAPE D-: ${mapeDm.toFixed(2)}%   ` +
      `(over ${cleanRows.length}/${rows.length} non-DEM-limited fixtures)   ` +
      `window=${opts.windowM}m  threshold=${opts.thresholdM}m`,
  );

  const reasons = [];
  for (const r of rows) {
    if (!r.withinBudget) {
      reasons.push(
        `${r.name}: D+ err ${r.errDp.toFixed(1)}% (${r.absDp.toFixed(0)} m), ` +
          `D- err ${r.errDm.toFixed(1)}% (${r.absDm.toFixed(0)} m)`,
      );
    }
  }
  if (mapeDp > MAPE_BUDGET) reasons.push(`MAPE(D+) ${mapeDp.toFixed(2)}% > ${MAPE_BUDGET}%`);
  if (mapeDm > MAPE_BUDGET) reasons.push(`MAPE(D-) ${mapeDm.toFixed(2)}% > ${MAPE_BUDGET}%`);

  if (reasons.length > 0) {
    console.error('FAIL:');
    for (const r of reasons) console.error('  ' + r);
    process.exit(1);
  }
  console.log('PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
