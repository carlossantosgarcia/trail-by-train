// Emit `stops.geojson` and `meta.json` for one provider, and project the
// feature shapes the line/stop ledger union writes.
// The schema here is the runtime contract — `src/transit/types.ts` defines
// the matching TypeScript types. Keep both in sync.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function writeJson(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}

/** Write an already-projected feature array (used for the line/stop union). */
export async function writeFeatureCollection(features, outPath) {
  await writeJson(outPath, { type: 'FeatureCollection', features });
  return features.length;
}

/** Project clustered stop records to their GeoJSON feature form. */
export function toStopFeatures(stops) {
  return stops.map((s) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: {
      provider_id: s.provider_id,
      stop_id: s.stop_id,
      stop_name: s.stop_name ?? '',
      display_color: s.display_color ?? '#FFFFFF',
      serving_lines: s.serving_lines,
      runs_weekday: Boolean(s.runs_weekday),
      runs_saturday: Boolean(s.runs_saturday),
      runs_sunday: Boolean(s.runs_sunday),
      has_high_freq_line: Boolean(s.has_high_freq_line),
    },
  }));
}

export async function writeMeta(meta, outPath) {
  await writeJson(outPath, meta);
}
