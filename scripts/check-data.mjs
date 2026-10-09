// Fail when a dataset the app needs is missing from public/, so a deploy can
// never publish the interface without its map layers. Run by the Deploy
// workflow before building; also handy after `npm run data:download`.
//
//   node scripts/check-data.mjs

import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS } from './transit/providers.config.mjs';

const PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const required = [
  'rail.pmtiles',
  'rail-stations.geojson',
  'data/gr-routes.pmtiles',
  'data/place-index.json',
  'transit/explore-index.json',
  ...PROVIDERS.flatMap((p) => [
    `transit/${p.id}/lines.pmtiles`,
    `transit/${p.id}/stops.geojson`,
    `transit/${p.id}/meta.json`,
  ]),
];

const missing = required.filter((f) => {
  const path = resolve(PUBLIC, f);
  return !existsSync(path) || statSync(path).size === 0;
});
if (missing.length) {
  console.error(`Missing or empty datasets in public/ (${missing.length}):`);
  for (const f of missing) console.error(`  ${f}`);
  console.error('Fetch them with `npm run data:download`, or build them with `npm run build:data`.');
  process.exit(1);
}
console.log(`All ${required.length} datasets present.`);
