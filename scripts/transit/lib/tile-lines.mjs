// Build a per-provider lines.pmtiles from an in-memory feature collection.
// Writes a temp GeoJSON, runs tippecanoe, deletes the temp.
//
// Mirrors the tippecanoe invocation used by scripts/build-rail-tiles.sh:
// vector layer name, zoom range, simplification, and the
// drop-densest-as-needed safety valve. Bus lines are visible at zoom ≥ 7
// per the public-transit spec, so we ship one zoom of headroom at z6.
//
// Requires `tippecanoe` on PATH. Fails fast with an install hint when
// missing — same UX as build-rail-tiles.sh.

import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function ensureTippecanoe() {
  const probe = spawnSync('tippecanoe', ['--version'], { stdio: 'ignore' });
  if (probe.status !== 0) {
    console.error("error: 'tippecanoe' not found on PATH");
    console.error('  install: apt install tippecanoe   |   brew install tippecanoe');
    process.exit(1);
  }
}

/**
 * @param {Array<{ type: 'Feature', geometry: object, properties: object }>} features
 * @param {string} outPmtilesPath  Absolute path to write `<provider>/lines.pmtiles`
 * @param {string} tempGeoJsonPath Absolute path for the intermediate GeoJSON
 */
export async function writeLinesPmtiles(features, outPmtilesPath, tempGeoJsonPath) {
  ensureTippecanoe();
  await mkdir(dirname(tempGeoJsonPath), { recursive: true });
  await mkdir(dirname(outPmtilesPath), { recursive: true });
  await writeFile(tempGeoJsonPath, JSON.stringify({ type: 'FeatureCollection', features }));
  try {
    const args = [
      `--output=${outPmtilesPath}`,
      '--layer=transit',
      '--minimum-zoom=6',
      '--maximum-zoom=14',
      '--simplification=4',
      '--drop-densest-as-needed',
      '--no-tile-size-limit',
      '--force',
      tempGeoJsonPath,
    ];
    const r = spawnSync('tippecanoe', args, { stdio: 'inherit' });
    if (r.status !== 0) {
      throw new Error(`tippecanoe failed with status ${r.status}`);
    }
  } finally {
    await rm(tempGeoJsonPath, { force: true });
  }
  return features.length;
}
