// Build public/transit/explore-index.json: the one file Explore loads to
// answer "what serves this area?".
//
// Explore used to fetch every provider's stops.geojson — 63 files, 31 MB once
// decompressed — and parse them on the main thread, which froze the page for
// seconds on a phone. Matching needs far less: each stop's position and the
// lines that call there. This writes exactly that, plus the rail stations,
// with coordinates as integers of 1e-5° (about a metre).
//
// Run after the transit build (and whenever rail-stations.geojson changes):
//   node scripts/transit/build-explore-index.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './providers.config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = resolve(ROOT, 'public');
const OUT = resolve(PUBLIC, 'transit/explore-index.json');
const E5 = (x) => Math.round(x * 1e5);

const providers = [];
let stopCount = 0;
const missing = [];
for (const p of PROVIDERS) {
  const path = resolve(PUBLIC, 'transit', p.id, 'stops.geojson');
  if (!existsSync(path)) {
    missing.push(p.id);
    continue;
  }
  const fc = JSON.parse(readFileSync(path, 'utf8'));
  const lineIndex = new Map();
  const lines = [];
  const stops = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    const idx = [];
    for (const l of f.properties?.serving_lines ?? []) {
      let i = lineIndex.get(l.route_id);
      if (i === undefined) {
        i = lines.length;
        lineIndex.set(l.route_id, i);
        lines.push([l.route_id, l.short_name ?? '']);
      }
      if (!idx.includes(i)) idx.push(i);
    }
    if (idx.length === 0) continue;
    stops.push([E5(lon), E5(lat), ...idx]);
  }
  stopCount += stops.length;
  providers.push({ id: p.id, lines, stops });
}

const stationsPath = resolve(PUBLIC, 'rail-stations.geojson');
const stations = [];
if (existsSync(stationsPath)) {
  const fc = JSON.parse(readFileSync(stationsPath, 'utf8'));
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    stations.push([E5(lon), E5(lat), f.properties?.name ?? 'Gare', f.properties?.commune ?? null]);
  }
} else {
  missing.push('rail-stations.geojson');
}

writeFileSync(
  OUT,
  JSON.stringify({ version: 1, built_at: new Date().toISOString(), providers, stations }),
);
const kb = Math.round(readFileSync(OUT).length / 1024);
console.log(
  `explore-index.json: ${providers.length} providers, ${stopCount} stops, ${stations.length} stations, ${kb} KB`,
);
if (missing.length) {
  console.warn(`missing inputs (left out): ${missing.join(', ')}`);
  // A provider without artifacts would silently vanish from Explore.
  if (missing.length > PROVIDERS.length / 2) process.exit(1);
}
