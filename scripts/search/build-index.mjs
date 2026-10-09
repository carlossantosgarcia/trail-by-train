#!/usr/bin/env node
// Build the offline place index served at public/data/place-index.json.
//
// Why an index at all: every place name the user reads on the map is a pixel.
// The basemaps are raster WMTS/XYZ tiles, so their labels are rendered
// upstream and there is nothing in the running app to search. Anything
// searchable has to be shipped.
//
// Why a bundled snapshot rather than a geocoder: IGN's Géoplateforme
// geocoding API is keyless and CORS-open and would have worked, but it is a
// third-party runtime dependency in an app whose convention is that all data
// is a build-time artifact, it rate-limits as-you-type input, and it sends
// keystrokes off-device. A ~5 MB file (1.6 MB over the wire, gzipped) costs
// one lazy fetch and answers in tens of milliseconds forever after.
//
// The index has two record shapes, because the two behave differently in the
// app: `places` are points (a circle around one is meaningful, so they seed
// Explore), `features` are extents (a bus line has no centre, so they are
// framed and revealed instead).
//
// Sources, and why each:
//   sommet/col/lac/glacier  GeoNames FR dump (CC-BY 4.0) — one file, no
//                           per-feature API. Thinner on summits than OSM
//                           (~6k named), but country-wide Overpass
//                           extraction times out on the public endpoints.
//   lieu                    GeoNames class P — hamlets, localities and ski
//                           resorts. See GEONAMES_KINDS for why this is not
//                           optional.
//   commune                 geo.api.gouv.fr — authoritative names, centroids
//                           and population (population is the rank tiebreak
//                           that puts Grenoble above a like-named hamlet).
//   gare                    public/rail-stations.geojson — already in-repo.
//   bus                     public/transit/*/lines-ledger.geojson.gz — the
//                           ledger carries geometry, so a bbox is free.
//   rando                   public/curated/manifest.json — already has bbox.
//   gr                      scripts/gr/.cache/gr-routes.normalized.geojson —
//                           the shipped pmtiles is tiled and not enumerable;
//                           the cache that built it is. That cache is
//                           gitignored, so a clean checkout omits GR with a
//                           warning rather than failing.
//
// Individual bus STOPS are deliberately excluded: 34k of them, with hundreds
// sharing names like "Mairie" or "Église", swamp every other result. Bus
// lines carry the same navigational value without the noise.
//
// Run: npm run build:search

import { mkdir, readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const CACHE_DIR = resolve(SCRIPT_DIR, '.cache');
const OUT_FILE = resolve(REPO_ROOT, 'public', 'data', 'place-index.json');

// Both GeoNames archives below contain a member literally named `FR.txt`.
// Extracting them into one directory makes the second silently destroy the
// first, which looks like a corrupt dump rather than a name collision — so
// each is extracted and then renamed to its own file.
const GEONAMES_URL = 'https://download.geonames.org/export/dump/FR.zip';
const GEONAMES_ZIP = resolve(CACHE_DIR, 'geonames-FR.zip');
const GEONAMES_TXT = resolve(CACHE_DIR, 'geonames-FR.txt');
const ALTNAMES_URL = 'https://download.geonames.org/export/dump/alternatenames/FR.zip';
const ALTNAMES_ZIP = resolve(CACHE_DIR, 'alternatenames-FR.zip');
const ALTNAMES_TXT = resolve(CACHE_DIR, 'alternatenames-FR.txt');
const COMMUNES_URL =
  'https://geo.api.gouv.fr/communes?fields=nom,code,centre,population&format=json';
const COMMUNES_JSON = resolve(CACHE_DIR, 'communes.json');

/**
 * GeoNames feature codes we keep, mapped to our kinds.
 *
 * PK/MT/HLL are all "a summit" to a hiker even though GeoNames separates peak,
 * mountain and hill; collapsing them keeps the result groups legible.
 *
 * Class P (populated places) is kept as `lieu` and matters more than it looks:
 * the places this app is most often asked about are frequently NOT communes.
 * L'Alpe-d'Huez, Les Deux Alpes and Val Thorens are all hamlets or localities
 * inside another commune, so a communes-only index cannot find any of them —
 * even though the app ships a dedicated bus provider for each. Entries that
 * merely restate a commune are dropped in `dedupeLieux`.
 */
const GEONAMES_KINDS = {
  PK: 'sommet',
  MT: 'sommet',
  HLL: 'sommet',
  PASS: 'col',
  LK: 'lac',
  RESV: 'lac',
  GLCR: 'glacier',
  RSRT: 'lieu',
};

/** Every class-P code is a `lieu`; listing the class beats listing 16 codes. */
const LIEU_CLASS = 'P';

/**
 * A `lieu` is dropped when a commune of the same name sits within this many
 * degrees (~5 km) of it — that is GeoNames restating the commune we already
 * have from the authoritative source, not a distinct place. Same name far
 * away is a different place and is kept.
 */
const LIEU_DEDUPE_DEG = 0.05;

function foldName(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-'’./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collapse GeoNames rows that describe the same thing twice. Val Thorens, for
 * instance, is both a `PPLL` and an `RSRT` at the same coordinates, and
 * without this it appears twice in the results with nothing to tell the two
 * apart. Same name and kind within ~2 km is one place.
 */
function dedupeGeoNames(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const key = `${foldName(r[0])}|${r[3]}|${Math.round(r[1] / 0.02)}|${Math.round(r[2] / 0.02)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Drop the class-P rows that just restate a commune we already indexed. */
function dedupeLieux(lieux, communes) {
  const byName = new Map();
  for (const c of communes) {
    const key = foldName(c[0]);
    const list = byName.get(key);
    if (list) list.push(c);
    else byName.set(key, [c]);
  }
  return lieux.filter((l) => {
    const near = byName.get(foldName(l[0]));
    if (!near) return true;
    return !near.some(
      (c) => Math.abs(c[1] - l[1]) < LIEU_DEDUPE_DEG && Math.abs(c[2] - l[2]) < LIEU_DEDUPE_DEG,
    );
  });
}

/**
 * Extra strings a record can also be matched on. Anything empty, duplicated,
 * or identical to the primary name is dropped, so an alias list is never just
 * a second copy of what the row already says.
 */
function dedupeAliases(primary, candidates) {
  const seen = new Set([foldName(primary)]);
  const out = [];
  for (const c of candidates) {
    if (!c) continue;
    const folded = foldName(String(c));
    if (!folded || seen.has(folded)) continue;
    seen.add(folded);
    out.push(String(c));
  }
  return out.length ? out : null;
}

/** Coordinates are stored to 5 decimals — ~1 m, far past what a search needs. */
function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

function bboxOfGeometry(geometry) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const c of coords) visit(c);
  };
  if (!geometry?.coordinates) return null;
  visit(geometry.coordinates);
  if (!Number.isFinite(minLon)) return null;
  return [round5(minLon), round5(minLat), round5(maxLon), round5(maxLat)];
}

async function download(url, dest, label) {
  if (existsSync(dest)) {
    console.log(`  cached  ${label}`);
    return;
  }
  console.log(`  fetch   ${label}`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await writeFile(dest, buf);
}

// ---------- Sources.

/** Extract the `FR.txt` member of a GeoNames zip to a name of our choosing. */
async function unzipTo(zip, dest, label) {
  if (existsSync(dest)) return;
  // Node has no zip reader in core; the dumps are only published zipped.
  try {
    execFileSync('unzip', ['-o', '-q', zip, 'FR.txt', '-d', CACHE_DIR]);
  } catch (err) {
    throw new Error(
      `Could not unzip ${zip} — install \`unzip\` or extract FR.txt by hand. (${err.message})`,
    );
  }
  await rename(resolve(CACHE_DIR, 'FR.txt'), dest);
  console.log(`  unzip   ${label}`);
}

async function loadGeoNames() {
  await download(GEONAMES_URL, GEONAMES_ZIP, 'GeoNames FR.zip');
  await unzipTo(GEONAMES_ZIP, GEONAMES_TXT, 'geonames-FR.txt');
  const text = await readFile(GEONAMES_TXT, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const kind = f[6] === LIEU_CLASS ? 'lieu' : GEONAMES_KINDS[f[7]];
    if (!kind) continue;
    const name = f[1];
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Column 15 is the tagged elevation, 16 the DEM lookup. Prefer the tag.
    const elev = Number(f[15] || f[16]);
    const hasElev = Number.isFinite(elev) && elev > 0;
    const population = Number(f[14]) || 0;
    // admin2 is the department code in the French dump — the only thing that
    // tells apart the several "La Grave"s.
    const dept = f[11] || null;
    out.push([
      name,
      round5(lon),
      round5(lat),
      kind,
      kind === 'lieu' ? dept : hasElev && (kind === 'sommet' || kind === 'col') ? `${elev} m` : null,
      // Rank within kind: altitude for summits and cols, so the Mont Blanc
      // sorts above a 400 m hill of the same name family; population for
      // localities, so Les Deux Alpes outranks an empty hamlet.
      kind === 'lieu' ? population : hasElev ? elev : 0,
      // Aliases, filled in by attachAliases once the whole set is known.
      null,
      // The geonameid, used only to join the alternate-names table. Dropped
      // from the record before the index is written.
      f[0],
    ]);
  }
  return out;
}

/**
 * Join GeoNames' alternate-names table onto the places we kept.
 *
 * This is what makes "Barre des Écrins" findable: GeoNames files that summit
 * under the primary name "Les Écrins" and puts the name everyone actually uses
 * in the alternates. Without this the most famous peak in the Écrins returns
 * nothing at all.
 *
 * The table is mostly noise for our purposes — postal codes, UN/LOCODEs,
 * Wikidata ids and 30-odd languages — so it is filtered hard:
 *   - French and unspecified languages only (unspecified is the local name);
 *   - no historic names;
 *   - nothing that folds to the primary name (accent and case variants);
 *   - no inverted index forms ("Recon, Col de"), which no one types;
 *   - at most ALIAS_CAP per place, preferred names first.
 * That takes 226k rows down to ~19k, which costs under 0.1 MB gzipped.
 */
const ALIAS_CAP = 3;
const ALIAS_MAX_LEN = 60;

async function attachAliases(places) {
  await download(ALTNAMES_URL, ALTNAMES_ZIP, 'GeoNames alternate names');
  await unzipTo(ALTNAMES_ZIP, ALTNAMES_TXT, 'alternatenames-FR.txt');

  const byId = new Map();
  for (const rec of places) byId.set(rec[7], rec);

  const collected = new Map();
  const text = await readFile(ALTNAMES_TXT, 'utf8');
  for (const line of text.split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    const rec = byId.get(f[1]);
    if (!rec) continue;
    if (f[7] === '1') continue; // historic
    const lang = f[2] || '';
    if (lang !== '' && lang !== 'fr') continue;
    const name = (f[3] ?? '').trim();
    if (!name || name.length > ALIAS_MAX_LEN) continue;
    if (name.includes(',')) continue;
    if (foldName(name) === foldName(rec[0])) continue;
    const list = collected.get(f[1]) ?? [];
    list.push([f[4] === '1' ? 0 : 1, name]);
    collected.set(f[1], list);
  }

  let n = 0;
  for (const [gid, list] of collected) {
    const seen = new Set();
    const names = [];
    for (const [, name] of list.sort((a, b) => a[0] - b[0])) {
      const folded = foldName(name);
      if (seen.has(folded)) continue;
      seen.add(folded);
      names.push(name);
      if (names.length >= ALIAS_CAP) break;
    }
    if (names.length) {
      byId.get(gid)[6] = names;
      n += names.length;
    }
  }
  console.log(`  aliases ${n} alternate names attached to ${collected.size} places`);
  // Drop the join key; it has no meaning to the app.
  for (const rec of places) rec.length = 7;
}

async function loadCommunes() {
  await download(COMMUNES_URL, COMMUNES_JSON, 'communes (geo.api.gouv.fr)');
  const communes = JSON.parse(await readFile(COMMUNES_JSON, 'utf8'));
  const out = [];
  for (const c of communes) {
    const coords = c.centre?.coordinates;
    if (!c.nom || !coords) continue;
    out.push([
      c.nom,
      round5(coords[0]),
      round5(coords[1]),
      'commune',
      // The department code is what disambiguates the 13 Saint-Martins.
      c.code ? `${c.code.slice(0, 2)}` : null,
      c.population ?? 0,
      null, // no alias source for communes
    ]);
  }
  return out;
}

async function loadGares() {
  const path = resolve(REPO_ROOT, 'public', 'rail-stations.geojson');
  const fc = JSON.parse(await readFile(path, 'utf8'));
  const out = [];
  for (const ft of fc.features ?? []) {
    const coords = ft.geometry?.coordinates;
    const name = ft.properties?.name;
    if (!name || !coords) continue;
    out.push([
      name,
      round5(coords[0]),
      round5(coords[1]),
      'gare',
      ft.properties?.commune ?? null,
      0,
      null, // no alias source for gares
    ]);
  }
  return out;
}

async function loadBusLines() {
  const transitRoot = resolve(REPO_ROOT, 'public', 'transit');
  if (!existsSync(transitRoot)) {
    console.warn('  WARN    public/transit missing — no bus lines indexed');
    return [];
  }
  const out = [];
  for (const dir of (await readdir(transitRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const ledger = resolve(transitRoot, dir, 'lines-ledger.geojson.gz');
    const metaPath = resolve(transitRoot, dir, 'meta.json');
    if (!existsSync(ledger)) continue;
    const label = existsSync(metaPath)
      ? (JSON.parse(await readFile(metaPath, 'utf8')).label ?? dir)
      : dir;
    const fc = JSON.parse(gunzipSync(await readFile(ledger)).toString('utf8'));
    for (const ft of fc.features ?? []) {
      const p = ft.properties ?? {};
      // Archived lines are kept in the ledger and aged by last-seen date; they
      // are not on the map by default, so they are not searchable either.
      if (p.archived) continue;
      const name = p.route_short_name || p.route_long_name;
      if (!name) continue;
      const box = bboxOfGeometry(ft.geometry);
      if (!box) continue;
      out.push([
        String(name),
        'bus',
        box[0],
        box[1],
        box[2],
        box[3],
        // The long name is what tells two "Ligne 3"s apart; the provider label
        // is shown beside it in the result row.
        [p.route_long_name || null, label],
        String(p.route_id ?? ''),
        p.provider_id ?? dir,
        // A line is indexed under its number, which is all `route_short_name`
        // holds — so "62" found it but "ligne 62" and the destinations it
        // actually serves did not. Both are how people name a bus.
        dedupeAliases(name, [p.route_long_name, `Ligne ${name}`]),
      ]);
    }
  }
  return out;
}

async function loadCuratedHikes() {
  const path = resolve(REPO_ROOT, 'public', 'curated', 'manifest.json');
  if (!existsSync(path)) {
    console.warn('  WARN    curated manifest missing — no hikes indexed');
    return [];
  }
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  const out = [];
  for (const h of manifest.hikes ?? []) {
    if (!h.title || !h.bbox) continue;
    out.push([
      h.title,
      'rando',
      round5(h.bbox[0]),
      round5(h.bbox[1]),
      round5(h.bbox[2]),
      round5(h.bbox[3]),
      [h.durationDays > 1 ? `${h.durationDays} jours` : '1 jour', h.source ?? null],
      h.id,
      h.colour ?? null,
      null, // a hike's title is its only name
    ]);
  }
  return out;
}

async function loadGrTrails() {
  const path = resolve(REPO_ROOT, 'scripts', 'gr', '.cache', 'gr-routes.normalized.geojson');
  if (!existsSync(path)) {
    console.warn('  WARN    scripts/gr/.cache missing (run `npm run gr:fetch`) — no GR indexed');
    return [];
  }
  const fc = JSON.parse(await readFile(path, 'utf8'));
  const out = [];
  for (const ft of fc.features ?? []) {
    const p = ft.properties ?? {};
    if (!p.ref) continue;
    const box = bboxOfGeometry(ft.geometry);
    if (!box) continue;
    out.push([
      String(p.ref),
      'gr',
      box[0],
      box[1],
      box[2],
      box[3],
      [p.name && p.name !== p.ref ? p.name : null, p.total_km ? `${Math.round(p.total_km)} km` : null],
      String(p.ref),
      null,
      dedupeAliases(String(p.ref), [p.name]),
    ]);
  }
  return out;
}

// ---------- Main.

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  console.log('==> Sources');

  const [geonames, communes, gares, buses, hikes, grs] = [
    await loadGeoNames(),
    await loadCommunes(),
    await loadGares(),
    await loadBusLines(),
    await loadCuratedHikes(),
    await loadGrTrails(),
  ];

  // Join before deduping, while every row still carries its geonameid.
  await attachAliases(geonames);

  const collapsed = dedupeGeoNames(geonames);
  const natural = collapsed.filter((r) => r[3] !== 'lieu');
  const lieux = dedupeLieux(
    collapsed.filter((r) => r[3] === 'lieu'),
    communes,
  );
  console.log(
    `  dedupe  ${geonames.length - collapsed.length} duplicate GeoNames rows collapsed, ` +
      `${collapsed.length - natural.length - lieux.length} lieux dropped as restatements of a commune`,
  );

  const places = [...natural, ...communes, ...gares, ...lieux];
  const features = [...buses, ...hikes, ...grs];

  const byKind = {};
  for (const p of places) byKind[p[3]] = (byKind[p[3]] ?? 0) + 1;
  for (const f of features) byKind[f[1]] = (byKind[f[1]] ?? 0) + 1;

  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    counts: byKind,
    sources: {
      'sommet/col/lac/glacier/lieu': 'GeoNames (CC-BY 4.0) — https://www.geonames.org/',
      commune: 'API Découpage administratif (Etalab) — https://geo.api.gouv.fr/',
      gare: 'SNCF Open Data — liste-des-gares, via public/rail-stations.geojson',
      bus: "Feeds GTFS via transport.data.gouv.fr, via l'index des lignes de l'app",
      rando: "Randonnées curées de l'app (manifest.json)",
      gr: 'OpenStreetMap (ODbL) — relations GR',
    },
    // places:   [name, lon, lat, kind, detail, rank, aliases]
    // features: [name, kind, minLon, minLat, maxLon, maxLat, [detail, sub], id, extra, aliases]
    // `aliases` is null or a short list of other names the record answers to;
    // the app matches against them and shows which one hit.
    places,
    features,
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify(index);
  await writeFile(OUT_FILE, json);

  console.log('\n==> Index');
  for (const [kind, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${kind}`);
  }
  console.log(`  ${String(places.length + features.length).padStart(6)}  TOTAL`);
  console.log(`\nWrote ${OUT_FILE} (${(json.length / 1e6).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
