#!/usr/bin/env node
// Fetches one WMTS tile per basemap from Géoplateforme and writes it to
// public/basemap-thumbs/<id>.png. Run with `npm run build:thumbs`. Requires
// network access to https://data.geopf.fr. Node 20+ (uses global fetch).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GEOPF_WMTS = 'https://data.geopf.fr/wmts';

// Same shape as BASE_LAYERS in src/layers/ignBaseLayers.ts, duplicated here so
// the script has no dependency on the React/TS toolchain.
const BASE_LAYERS = [
  {
    id: 'opentopo',
    // OpenTopoMap uses a plain XYZ template, not WMTS.
    tileUrl: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    ext: 'png',
  },
  {
    id: 'satellite',
    wmtsLayer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    tileMatrixSet: 'PM_0_19',
    format: 'image/jpeg',
    ext: 'png', // saved as .png filename for uniformity; bytes are jpeg
  },
  {
    id: 'street',
    // OSM standard tiles use a plain XYZ template, not WMTS.
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ext: 'png',
  },
];

// Annecy / French Alps area — mix of lake, town, and mountains so every basemap
// style (vector, photo, topo) looks visually distinct as a thumbnail.
const PREVIEW_LON = 6.13;
const PREVIEW_LAT = 45.9;
const PREVIEW_ZOOM = 8;

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

function tileUrl(layer, z, x, y) {
  if (layer.tileUrl) {
    return layer.tileUrl
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
  }
  const params = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: layer.wmtsLayer,
    STYLE: 'normal',
    TILEMATRIXSET: layer.tileMatrixSet,
    TILEMATRIX: String(z),
    TILEROW: String(y),
    TILECOL: String(x),
    FORMAT: layer.format,
  });
  return `${GEOPF_WMTS}?${params.toString()}`;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, '..', 'public', 'basemap-thumbs');
  await mkdir(outDir, { recursive: true });

  const { x, y } = lonLatToTile(PREVIEW_LON, PREVIEW_LAT, PREVIEW_ZOOM);
  console.log(
    `Fetching preview tile z=${PREVIEW_ZOOM} x=${x} y=${y} (Annecy / French Alps) for each basemap…`,
  );

  for (const layer of BASE_LAYERS) {
    const url = tileUrl(layer, PREVIEW_ZOOM, x, y);
    process.stdout.write(`  ${layer.id} … `);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'train-to-trail-thumb-builder/1.0 (+https://github.com/carlossantosgarcia/train-to-trail)' },
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch ${layer.id} (${res.status} ${res.statusText}): ${url}`,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = resolve(outDir, `${layer.id}.${layer.ext}`);
    await writeFile(outPath, buf);
    console.log(`${buf.byteLength} bytes -> ${outPath}`);
  }

  console.log('Done. Commit public/basemap-thumbs/ so production builds are reproducible offline.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
