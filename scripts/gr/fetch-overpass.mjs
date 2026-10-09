#!/usr/bin/env node
// Fetch GR (Grande Randonnée) relations from Overpass for metropolitan
// France + Corsica, normalize tags, compute lengths, resolve a "most
// official" external link per route, and write a GeoJSON FeatureCollection
// to scripts/gr/.cache/gr-routes.normalized.geojson.
//
// The output feeds scripts/gr/build-tiles.sh, which packs it into
// public/data/gr-routes.pmtiles via Tippecanoe.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, '.cache');
const WIKIDATA_CACHE_FILE = resolve(CACHE_DIR, 'wikidata.json');
const OUT_FILE = resolve(CACHE_DIR, 'gr-routes.normalized.geojson');

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_S = 300;

// Filter: route=hiking, network=nwn (national walking network), ref starts
// with "GR" followed by an optional space/dash then a digit (excludes GRP
// and PR by construction). Area=FR covers metropolitan France + Corsica.
// Some GRs (e.g. GR 34, GR 65, GR 367) are modelled as super-relations whose
// direct members are stage child relations, not ways. Two consequences:
//   1. `(area.fr)` can't see them — Overpass tests area membership via the
//      relation's direct nodes/ways, and a pure superroute has none. So we
//      union a second query for `type=superroute` (no area filter) and
//      drop foreign hits in JS via an FR bbox check.
//   2. `>>` recurses through child relations to gather all descendant ways
//      and nodes, letting the JS walker flatten arbitrary nesting depth.
// Spain's "Gran Recorrido" also uses `GR<n>` refs with `network=nwn`, so the
// global superroute query pulls in many Spanish/Portuguese routes — the
// FR bbox filter is what keeps the dataset metropolitan-FR + Corsica only.
const OVERPASS_QUERY = `
[out:json][timeout:${OVERPASS_TIMEOUT_S}];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
(
  relation(area.fr)["route"="hiking"]["network"="nwn"]["ref"~"^GR ?[0-9]"];
  relation["type"="superroute"]["route"="hiking"]["network"="nwn"]["ref"~"^GR ?[0-9]"];
)->.gr;
(.gr; .gr >>;);
out body;
`.trim();

// Generous bbox covering metropolitan France + Corsica. A GR is kept iff
// at least one of its collected coordinates falls inside this box.
const FR_BBOX = { minLon: -5.5, minLat: 41.0, maxLon: 10.0, maxLat: 51.5 };

// Variant / branch / access routes share their parent GR's ref with a single
// trailing letter (GR 4B, GR 211A, GR 5C). At country/regional zoom they
// clutter the map with duplicate red lines and stacked labels next to the
// parent. We drop variants shorter than VARIANT_MIN_KM; digits-only and
// dotted refs (GR 5, GR 10.1) are always kept. See openspec change
// `drop-short-gr-variants` for the rationale and threshold tuning.
const VARIANT_REF_PATTERN = /^GR \d+[A-Z]$/;
const VARIANT_MIN_KM = 100;
function isVariantRef(ref) {
  return VARIANT_REF_PATTERN.test(ref);
}

// ---------- Overpass fetch with one retry/backoff ----------
async function fetchOverpass() {
  const attempts = 2;
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      const backoffMs = 10_000;
      console.error(`[overpass] retrying in ${backoffMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
    try {
      const resp = await fetch(OVERPASS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'trail-by-train-gr-build/0.1 (+https://github.com/carlossantosgarcia/trail-by-train)',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ data: OVERPASS_QUERY }).toString(),
      });
      if (resp.status === 429 || resp.status === 504) {
        lastErr = new Error(`Overpass HTTP ${resp.status}`);
        continue;
      }
      if (!resp.ok) {
        throw new Error(`Overpass HTTP ${resp.status}: ${await resp.text()}`);
      }
      return await resp.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('Overpass fetch failed');
}

// ---------- Ref normalization ----------
function normalizeRef(raw) {
  if (typeof raw !== 'string') return null;
  // Strip leading/trailing whitespace, collapse internal whitespace and
  // separators between "GR" and the number into a single space.
  const m = raw.trim().match(/^GR[\s\-]*([0-9][0-9A-Za-z]*)$/i);
  if (!m) return null;
  return `GR ${m[1].toUpperCase()}`;
}

// ---------- Geometry helpers ----------
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function lineLengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return total;
}

// ---------- Wikidata link resolution (cached) ----------
async function loadWikidataCache() {
  try {
    return JSON.parse(await readFile(WIKIDATA_CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveWikidataCache(cache) {
  await writeFile(WIKIDATA_CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Wikidata SPARQL is overkill; the wbgetentities REST endpoint returns the
// sitelinks directly. We ask only for frwiki sitelink.
async function resolveWikidataToWikipediaUrl(qid, cache) {
  if (cache[qid] !== undefined) return cache[qid];
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
    qid,
  )}&props=sitelinks/urls&sitefilter=frwiki&format=json&origin=*`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      cache[qid] = null;
      return null;
    }
    const data = await resp.json();
    const ent = data?.entities?.[qid];
    const sitelink = ent?.sitelinks?.frwiki;
    const link = sitelink?.url ?? null;
    cache[qid] = link;
    return link;
  } catch {
    cache[qid] = null;
    return null;
  }
}

function wikipediaUrlFromTag(value) {
  // "fr:GR 5" → "https://fr.wikipedia.org/wiki/GR_5"
  if (typeof value !== 'string') return null;
  const idx = value.indexOf(':');
  const lang = idx >= 0 ? value.slice(0, idx) : 'fr';
  const title = (idx >= 0 ? value.slice(idx + 1) : value).trim();
  if (!title) return null;
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function validHttpUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function resolveLink(tags, relationId, wikidataCache) {
  // 1. wikipedia tag
  if (tags.wikipedia) {
    const url = wikipediaUrlFromTag(tags.wikipedia);
    if (url) return url;
  }
  // 2. wikidata tag → frwiki sitelink
  if (tags.wikidata) {
    const url = await resolveWikidataToWikipediaUrl(tags.wikidata, wikidataCache);
    if (url) return url;
  }
  // 3. website tag (if a valid URL)
  if (tags.website) {
    const url = validHttpUrl(tags.website);
    if (url) return url;
  }
  // 4. fallback: OSM relation URL
  return `https://www.openstreetmap.org/relation/${relationId}`;
}

// ---------- Main ----------
async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  console.error('[overpass] querying GR relations for FR…');
  const raw = await fetchOverpass();
  const elements = raw?.elements ?? [];

  // Index nodes by id; ways by id (with node refs); relations by id so we
  // can chase child-relation members for GR super-routes.
  const nodes = new Map();
  const ways = new Map();
  const relationsById = new Map();
  for (const el of elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat]);
    else if (el.type === 'way') ways.set(el.id, el);
    else if (el.type === 'relation') relationsById.set(el.id, el);
  }

  // Top-level GR routes are the relations whose own `ref` matches the GR
  // pattern. Stage child relations carried in by the `>>` recursion often
  // have stage-specific refs (or none) — we treat them as plumbing.
  // Two-phase ordering: process non-superroute (`type=route` or unset) GRs
  // first — these came from the `area.fr` query and are guaranteed FR.
  // Superroutes go second so we can skip those whose ref was already
  // produced by Phase 1 (prevents cross-border Spanish superroutes — which
  // share `GR<n>` refs — from polluting French GR lengths after merge).
  const relations = [];
  for (const rel of relationsById.values()) {
    if (normalizeRef(rel.tags?.ref ?? '')) relations.push(rel);
  }
  relations.sort((a, b) => {
    const aSuper = a.tags?.type === 'superroute' ? 1 : 0;
    const bSuper = b.tags?.type === 'superroute' ? 1 : 0;
    return aSuper - bSuper;
  });

  console.error(`[overpass] received ${relationsById.size} relations (${relations.length} GR top-level), ${ways.size} ways, ${nodes.size} nodes`);

  // Flatten a relation into its full way set, descending through any
  // child relations. Guarded against cycles.
  function collectWays(rel, acc, seen) {
    if (seen.has(rel.id)) return;
    seen.add(rel.id);
    for (const member of rel.members ?? []) {
      if (member.type === 'way') {
        const w = ways.get(member.ref);
        if (w) acc.push(w);
      } else if (member.type === 'relation') {
        const child = relationsById.get(member.ref);
        if (child) collectWays(child, acc, seen);
      }
    }
  }

  const wikidataCache = await loadWikidataCache();
  const features = [];
  let dropped = 0;
  const droppedSamples = [];
  let totalKm = 0;
  const refsSeen = new Set();

  for (const rel of relations) {
    const tags = rel.tags ?? {};
    const refRaw = tags.ref ?? '';
    const ref = normalizeRef(refRaw);
    if (!ref) {
      dropped++;
      if (droppedSamples.length < 5) droppedSamples.push(refRaw || `(no ref) r${rel.id}`);
      continue;
    }
    // Phase-2 skip: superroutes whose ref was already covered by a
    // direct-member relation from the `area.fr` query. The direct match is
    // definitively FR; the superroute could be a Spanish/Portuguese twin
    // sharing the same `GR<n>` ref.
    if (tags.type === 'superroute' && refsSeen.has(ref)) continue;
    refsSeen.add(ref);
    const link = await resolveLink(tags, rel.id, wikidataCache);
    // Save the cache after each lookup so a crash doesn't lose progress.
    if (tags.wikidata) await saveWikidataCache(wikidataCache);

    const name = typeof tags.name === 'string' ? tags.name : null;

    const collectedWays = [];
    collectWays(rel, collectedWays, new Set());

    // Drop GRs that aren't primarily in FR/Corsica. Spain's "Gran Recorrido"
    // network reuses `GR<n>` refs with `network=nwn` and many border routes
    // (e.g. "GR 10 - Senda Pirenaica", "GR 11" Spanish side) share refs
    // with French GRs — merging-by-ref would inflate their length. A
    // majority-in-FR threshold keeps cross-border FR GRs while dropping
    // foreign-side counterparts.
    let inFr = 0;
    let sampled = 0;
    for (const w of collectedWays) {
      for (const nid of w.nodes ?? []) {
        const ll = nodes.get(nid);
        if (!ll) continue;
        sampled++;
        if (
          ll[0] >= FR_BBOX.minLon && ll[0] <= FR_BBOX.maxLon &&
          ll[1] >= FR_BBOX.minLat && ll[1] <= FR_BBOX.maxLat
        ) inFr++;
      }
    }
    if (sampled === 0 || inFr / sampled < 0.5) continue;

    for (const w of collectedWays) {
      if (!Array.isArray(w.nodes) || w.nodes.length < 2) continue;
      const coords = [];
      for (const nid of w.nodes) {
        const ll = nodes.get(nid);
        if (ll) coords.push(ll);
      }
      if (coords.length < 2) continue;
      const km = lineLengthKm(coords);
      totalKm += km;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          ref,
          name,
          length_km: Math.round(km * 1000) / 1000,
          link,
          osm_relation_id: rel.id,
        },
      });
    }
  }

  await saveWikidataCache(wikidataCache);

  // Merge all per-way LineStrings into one MultiLineString per normalized
  // `ref`. Two wins:
  //   - Symbol-placement: `line` needs each LineString long enough to fit
  //     the label. Per-way features are often only tens of metres long
  //     and never get labelled at moderate zooms.
  //   - Tippecanoe's `--drop-densest-as-needed` drops tiny segments in
  //     dense areas at low zoom; merged features survive simplification.
  // Per-ref features also collapse 73K → 160 features, shrinking the
  // PMTiles artifact and making click handling trivial (one feature per
  // route → `ref` directly identifies the clicked route).
  const byRef = new Map();
  for (const f of features) {
    const r = f.properties.ref;
    let bucket = byRef.get(r);
    if (!bucket) {
      bucket = {
        name: f.properties.name,
        link: f.properties.link,
        osm_relation_id: f.properties.osm_relation_id,
        coordsList: [],
        totalKm: 0,
      };
      byRef.set(r, bucket);
    }
    bucket.coordsList.push(f.geometry.coordinates);
    bucket.totalKm += f.properties.length_km;
    // First non-null name wins; same for link (build-time resolution
    // already picked the best per relation; further relations sharing the
    // ref typically duplicate it).
    if (!bucket.name && f.properties.name) bucket.name = f.properties.name;
  }
  const merged = [];
  let droppedVariants = 0;
  const droppedVariantSamples = [];
  for (const [ref, bucket] of byRef) {
    const totalKm = Math.round(bucket.totalKm * 10) / 10;
    if (isVariantRef(ref) && totalKm < VARIANT_MIN_KM) {
      droppedVariants++;
      if (droppedVariantSamples.length < 5) {
        droppedVariantSamples.push(`${ref} (${totalKm}km)`);
      }
      continue;
    }
    merged.push({
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: bucket.coordsList,
      },
      properties: {
        ref,
        name: bucket.name ?? ref,
        total_km: totalKm,
        link: bucket.link,
        osm_relation_id: bucket.osm_relation_id,
      },
    });
  }

  const fc = { type: 'FeatureCollection', features: merged };
  await writeFile(OUT_FILE, JSON.stringify(fc));

  console.error('---');
  console.error(`[summary] routes (distinct ref): ${refsSeen.size}`);
  console.error(`[summary] per-way features: ${features.length}`);
  console.error(`[summary] merged features (one MultiLineString per ref): ${merged.length}`);
  console.error(`[summary] total km: ${Math.round(totalKm)}`);
  console.error(`[summary] dropped (no/invalid ref): ${dropped}`);
  if (droppedSamples.length > 0) {
    console.error(`[summary] dropped examples: ${droppedSamples.join(', ')}`);
  }
  console.error(`[summary] dropped (variant under ${VARIANT_MIN_KM}km): ${droppedVariants}`);
  if (droppedVariantSamples.length > 0) {
    console.error(`[summary] variant examples: ${droppedVariantSamples.join(', ')}`);
  }
  console.error(`[summary] wrote ${OUT_FILE}`);

  if (!existsSync(OUT_FILE)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
