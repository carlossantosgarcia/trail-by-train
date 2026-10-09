// Derive a terrain elevation profile and D+/D- for a track's geometry.
//
// Two distinct series are produced from one pass of tile lookups:
//
//   - elevations at the track's OWN vertices, written back into the stored
//     geometry so the elevation chart keeps the track's identity and its
//     point count is unchanged. Only vertices at least DEM_VERTEX_SPACING_M
//     apart are queried; the rest are interpolated along-track, because the
//     terrain model carries no detail finer than that and dense recorders
//     emit a vertex every few metres;
//   - a uniform 50 m series used ONLY for D+/D-, because that is the spacing
//     the tuning was calibrated at (design D6). Resampling directly at 50 m
//     is equivalent to building the 10 m grid and decimating it by five, and
//     costs one fewer pass.
//
// Both series are sampled in a single batch so they share requests to the
// altimetry service.

import { computeAscentDescentMeters } from '../gpx/elevationAlgorithm.mjs';
import { haversineMetres } from '../gpx/parseCore.mjs';
import {
  DEM_DPLUS_INTERVAL_M,
  DEM_THRESHOLD_M,
  DEM_VERTEX_SPACING_M,
  DEM_WINDOW_M,
} from './constants.mjs';
import { cumulativeDistances, resampleByDistance } from './resample.mjs';

/**
 * Indices of the vertices to query: the first, the last, and every vertex at
 * least `spacingM` along-track from the previously kept one.
 *
 * @param {number[]} cum  cumulative distances
 * @param {number} spacingM
 * @returns {number[]}
 */
function pickVertices(cum, spacingM) {
  if (cum.length === 0) return [];
  const keep = [0];
  for (let i = 1; i < cum.length - 1; i++) {
    if (cum[i] - cum[keep[keep.length - 1]] >= spacingM) keep.push(i);
  }
  if (cum.length > 1) keep.push(cum.length - 1);
  return keep;
}

/**
 * Expand elevations at the kept vertices back to every vertex, linearly by
 * along-track distance. A vertex between a covered and an uncovered sample
 * stays null rather than borrowing elevation across the coverage edge.
 *
 * @param {number[]} cum
 * @param {number[]} keep
 * @param {(number | null)[]} keptZ
 * @returns {(number | null)[]}
 */
function interpolateVertices(cum, keep, keptZ) {
  /** @type {(number | null)[]} */
  const out = new Array(cum.length).fill(null);
  for (let k = 0; k < keep.length; k++) {
    out[keep[k]] = keptZ[k];
    if (k === 0) continue;
    const a = keep[k - 1];
    const b = keep[k];
    const za = keptZ[k - 1];
    const zb = keptZ[k];
    if (za === null || zb === null) continue;
    const span = cum[b] - cum[a];
    for (let i = a + 1; i < b; i++) {
      const f = span > 0 ? (cum[i] - cum[a]) / span : 0;
      out[i] = za + (zb - za) * f;
    }
  }
  return out;
}

/**
 * @typedef {Object} TerrainProfile
 * @property {(number | null)[][]} elevationsByFeature  Per feature, one
 *   elevation per original vertex; null where the DEM has no coverage.
 * @property {number} ascentM
 * @property {number} descentM
 * @property {number} sampled   Total D+ samples attempted.
 * @property {number} covered   Of those, how many resolved.
 */

/**
 * @param {ReadonlyArray<ReadonlyArray<readonly number[]>>} featureCoords
 * @param {(points: [number, number][]) => Promise<(number | null)[]>} sample
 * @returns {Promise<TerrainProfile>}
 */
export async function deriveTerrainProfile(featureCoords, sample) {
  /** @type {[number, number][]} */
  const batch = [];
  const plan = [];

  for (const coords of featureCoords) {
    const cum = cumulativeDistances(coords);
    const keep = pickVertices(cum, DEM_VERTEX_SPACING_M);
    const own = keep.map((i) => /** @type {[number, number]} */ ([coords[i][0], coords[i][1]]));
    const uniform = resampleByDistance(coords, DEM_DPLUS_INTERVAL_M);
    plan.push({
      cum,
      keep,
      ownStart: batch.length,
      ownCount: own.length,
      uniformStart: batch.length + own.length,
      uniformCount: uniform.length,
      uniform,
    });
    batch.push(...own, ...uniform);
  }

  const z = await sample(batch);

  /** @type {(number | null)[][]} */
  const elevationsByFeature = [];
  let ascentM = 0;
  let descentM = 0;
  let sampled = 0;
  let covered = 0;

  for (const p of plan) {
    elevationsByFeature.push(
      interpolateVertices(p.cum, p.keep, z.slice(p.ownStart, p.ownStart + p.ownCount)),
    );

    const uz = z.slice(p.uniformStart, p.uniformStart + p.uniformCount);
    sampled += uz.length;
    covered += uz.reduce((n, v) => n + (v === null ? 0 : 1), 0);

    // computeAscentDescentMeters splits its runs at nulls rather than
    // interpolating, so partial coverage yields D+/D- over the covered
    // stretches instead of a phantom climb across the gap.
    const points = uz.map((ele, i) => ({
      ele,
      distFromPrevM: i === 0 ? 0 : haversineMetres(p.uniform[i - 1], p.uniform[i]),
    }));
    const seg = computeAscentDescentMeters(points, {
      windowM: DEM_WINDOW_M,
      thresholdM: DEM_THRESHOLD_M,
    });
    ascentM += seg.ascentM;
    descentM += seg.descentM;
  }

  return { elevationsByFeature, ascentM, descentM, sampled, covered };
}
