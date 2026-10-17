// OpenStreetMap road data for shape estimation (see estimate-shapes.mjs).
//
// Geofabrik cuts France into its pre-2016 regions and stops each extract at the
// border, so a line through Geneva or Le Tréport loses its roads at the edge of
// one region. The extracts a feed needs are therefore picked from the points
// its lines have to cover — French regions and the neighbouring countries
// alike — then cropped to the area around those points and merged.
//
// Downloads are cached under scripts/transit/.cache/osm/ and refreshed once
// they are older than MAX_AGE_DAYS: roads change slowly, and a weekly refresh
// of several hundred megabytes per region would buy nothing. Each extract is
// cut down to what pfaedle reads — roads, transit stops and route relations —
// which keeps about a quarter of it (Rhône-Alpes: 531 → 146 MB).

import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const GEOFABRIK_INDEX_URL = 'https://download.geofabrik.de/index-v1.json';
const MAX_AGE_DAYS = 28;

/**
 * Geofabrik regions a French feed can reach: metropolitan France's regions
 * (its overseas ones are left out) and the neighbours whose roads cross-border
 * lines use. Countries Geofabrik splits further are listed by sub-region.
 */
const PARENTS = new Set(['france']);
const NEIGHBOURS = new Set([
  'andorra',
  'belgium',
  'luxembourg',
  'monaco',
  'switzerland',
  'nord-ovest', // Italy: Piemonte, Valle d'Aosta, Liguria
  'cataluna',
  'aragon',
  'navarra',
  'pais-vasco',
  'baden-wuerttemberg',
  'rheinland-pfalz',
  'saarland',
]);
const OVERSEAS = new Set(['guadeloupe', 'guyane', 'martinique', 'mayotte', 'reunion']);

/** The candidate regions from Geofabrik's index, with their polygons. */
export function candidateRegions(index) {
  return index.features
    .filter((f) => {
      const { id, parent } = f.properties;
      return (PARENTS.has(parent) && !OVERSEAS.has(id)) || NEIGHBOURS.has(id);
    })
    .map((f) => ({
      id: f.properties.id,
      url: f.properties.urls.pbf,
      polygons: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
    }));
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(p, rings) {
  return inRing(p, rings[0]) && !rings.slice(1).some((hole) => inRing(p, hole));
}

/**
 * The regions containing at least one of `points` ([lon, lat]), largest share
 * first. Passing the midpoints of each hop as well as the stops catches a line
 * that leaves its region between two stops.
 */
export function regionsFor(points, regions) {
  const counts = new Map();
  for (const p of points) {
    for (const r of regions) {
      if (r.polygons.some((rings) => inPolygon(p, rings))) {
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([r]) => r);
}

function fresh(path) {
  return existsSync(path) && Date.now() - statSync(path).mtimeMs < MAX_AGE_DAYS * 86400000;
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'trail-by-train (+https://github.com/carlossantosgarcia/trail-by-train)',
    },
  });
  if (!res.ok || !res.body) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  await rename(tmp, dest);
}

/** What pfaedle reads from OSM: osmium keeps the nodes and members they need. */
const KEEP_TAGS = ['nwr/highway', 'nwr/public_transport', 'r/route', 'r/route_master'];

async function fetchExtract(region, dest, log) {
  log(`downloading OSM extract ${region.id}…`);
  const raw = `${dest}.raw.pbf`;
  await download(region.url, raw);
  const r = spawnSync('osmium', ['tags-filter', '--overwrite', '-o', dest, raw, ...KEEP_TAGS], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (r.error || r.status !== 0) {
    // Unfiltered is slower to read, not wrong.
    log(`could not filter ${region.id} (is osmium-tool installed?) — keeping it whole`);
    await rename(raw, dest);
  } else {
    await rm(raw, { force: true });
  }
}

async function loadIndex(cacheDir) {
  const path = resolve(cacheDir, 'index-v1.json');
  if (!fresh(path)) {
    await mkdir(cacheDir, { recursive: true });
    await download(GEOFABRIK_INDEX_URL, path);
  }
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Margin around the stops, in degrees (~15 km): room for detours and loops. */
const PAD_DEG = 0.15;

function osmium(args) {
  const r = spawnSync('osmium', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  return !r.error && r.status === 0;
}

/**
 * One OSM file covering `points`, written into `workDir`. The extracts that
 * contain them are downloaded as needed, each is cropped to the points' box
 * plus a margin, and the crops are merged: a line reaching into Monaco reads
 * a few square kilometres of it, not the whole of Italy's north-west.
 *
 * Returns `{ path, regions }`, or `{ path: null, reason }` when no region
 * covers the points. Without osmium, the largest region is used whole.
 */
export async function osmFileFor(points, cacheDir, workDir, log = console.log) {
  const regions = regionsFor(points, candidateRegions(await loadIndex(cacheDir)));
  if (regions.length === 0) return { path: null, reason: 'no OSM extract covers these stops' };
  for (const r of regions) {
    const path = resolve(cacheDir, `${r.id}.osm.pbf`);
    if (!fresh(path)) await fetchExtract(r, path, log);
  }
  const ids = regions.map((r) => r.id);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    box[0] = Math.min(box[0], x - PAD_DEG);
    box[1] = Math.min(box[1], y - PAD_DEG);
    box[2] = Math.max(box[2], x + PAD_DEG);
    box[3] = Math.max(box[3], y + PAD_DEG);
  }
  const bbox = box.map((v) => v.toFixed(4)).join(',');
  await mkdir(workDir, { recursive: true });
  const crops = [];
  for (const id of ids) {
    const crop = resolve(workDir, `crop-${id}.osm.pbf`);
    const src = resolve(cacheDir, `${id}.osm.pbf`);
    if (!osmium(['extract', '--overwrite', '-s', 'complete_ways', '-b', bbox, '-o', crop, src])) {
      log(`could not crop OSM extracts (is osmium-tool installed?) — using ${ids[0]} whole`);
      return { path: resolve(cacheDir, `${ids[0]}.osm.pbf`), regions: [ids[0]] };
    }
    crops.push(crop);
  }
  if (crops.length === 1) return { path: crops[0], regions: ids };
  const merged = resolve(workDir, 'osm.pbf');
  if (!osmium(['merge', '--overwrite', '-o', merged, ...crops])) {
    // Better one region's roads than none: the line is matched where that
    // region reaches, and cut where it does not.
    log(`could not merge OSM extracts — using ${ids[0]} only`);
    return { path: crops[0], regions: [ids[0]] };
  }
  return { path: merged, regions: ids };
}
