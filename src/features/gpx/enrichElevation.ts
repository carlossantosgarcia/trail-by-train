// Terrain enrichment for tracks whose GPX carried no usable elevation.
//
// Lives outside parseCore.mjs on purpose: that module is shared with the
// Node build scripts and must stay synchronous and free of
// browser-only globals (design D8). Enrichment is a separate async stage, so
// a track renders immediately and gains its profile when the altimetry service answers.
//
// Only ever runs when `summary.hasElevation === false`. Files with recorded
// <ele> keep it: measured against the Komoot fixtures, the recorded series
// scores −0.5 % where terrain scores ~3 %, so recomputing everything would
// change existing numbers for a net accuracy loss (design D7).

import type { FeatureCollection, LineString } from 'geojson';

import { sampleElevations, TerrainServiceError } from '../terrain/ignAltimetry.mjs';
import { deriveTerrainProfile } from '../terrain/profile.mjs';
import type { TrackSummary } from './types';

type Geometry = FeatureCollection<LineString, Record<string, unknown>>;

export interface EnrichedResult {
  geojson: Geometry;
  summary: TrackSummary;
}

/**
 * Derive elevation for a track from IGN's altimetry service (RGE ALTI).
 *
 * Returns geometry with elevation written as the third coordinate value and
 * a summary carrying the new D+/D−, or `null` when the terrain has no
 * coverage at all for this track — in which case the caller must leave the
 * track marked as having no elevation rather than reporting a flat profile.
 *
 * @throws {TerrainServiceError} when the altimetry service is unavailable.
 */
export async function enrichWithTerrain(
  geojson: Geometry,
  summary: TrackSummary,
): Promise<EnrichedResult | null> {
  const featureCoords = geojson.features.map((f) => f.geometry.coordinates);
  const profile = await deriveTerrainProfile(featureCoords, (points) => sampleElevations(points));

  if (profile.covered === 0) return null;

  const features = geojson.features.map((f, i) => {
    const eles = profile.elevationsByFeature[i] ?? [];
    return {
      ...f,
      geometry: {
        ...f.geometry,
        coordinates: f.geometry.coordinates.map((c, j) => {
          const ele = eles[j];
          // Keep 2D where terrain is missing rather than writing a fake 0:
          // computeSummary and the chart both treat a missing third value as
          // "no elevation here", which is the truth.
          return ele === null || ele === undefined
            ? [c[0], c[1]]
            : [c[0], c[1], Math.round(ele * 10) / 10];
        }),
      },
    };
  });

  return {
    geojson: { ...geojson, features } as Geometry,
    summary: {
      ...summary,
      hasElevation: true,
      ascentM: profile.ascentM,
      descentM: profile.descentM,
      elevationSource: 'terrain',
      terrainCoverage: profile.sampled === 0 ? 0 : profile.covered / profile.sampled,
    },
  };
}

export { TerrainServiceError };
