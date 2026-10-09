// Uniform arc-length resampling of a polyline.
//
// Terrain is sampled at points spaced evenly by distance travelled, not at
// the polyline's own vertices (design D5). Vertex density varies wildly
// between producers — the 7 Laux route emits one every ~7 m, other tools
// only at direction changes — and sampling raw vertices would make D+/D- a
// property of the exporting tool rather than of the terrain.

import { haversineMetres } from '../gpx/parseCore.mjs';

/**
 * Resample a [lon, lat] polyline at a fixed along-track interval.
 *
 * The first and last coordinates are always present, so the profile spans
 * the whole route. Zero-length steps are skipped rather than dividing by
 * zero.
 *
 * @param {ReadonlyArray<readonly number[]>} coords  [lon, lat, ...] positions.
 * @param {number} intervalM
 * @returns {[number, number][]}
 */
export function resampleByDistance(coords, intervalM) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  if (coords.length === 1 || !(intervalM > 0)) {
    return coords.map((c) => [c[0], c[1]]);
  }

  /** @type {[number, number][]} */
  const out = [[coords[0][0], coords[0][1]]];
  let carry = 0;

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const seg = haversineMetres(a, b);
    if (!(seg > 0)) continue;

    // Distance from the segment start to the next sample point.
    let pos = intervalM - carry;
    while (pos <= seg) {
      const f = pos / seg;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      pos += intervalM;
    }
    carry = (carry + seg) % intervalM;
  }

  const last = coords[coords.length - 1];
  const tail = out[out.length - 1];
  // Only append the true endpoint if the last emitted sample is meaningfully
  // short of it, so we do not create a near-zero final step.
  if (haversineMetres(tail, last) > intervalM * 0.25) {
    out.push([last[0], last[1]]);
  }
  return out;
}

/**
 * Cumulative along-track distance for each position, in metres.
 *
 * @param {ReadonlyArray<readonly number[]>} coords
 * @returns {number[]}
 */
export function cumulativeDistances(coords) {
  const out = new Array(coords.length);
  let cum = 0;
  for (let i = 0; i < coords.length; i++) {
    if (i > 0) cum += haversineMetres(coords[i - 1], coords[i]);
    out[i] = cum;
  }
  return out;
}
